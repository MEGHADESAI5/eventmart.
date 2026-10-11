import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { config } from "./config";
import { pool } from "./db";

interface ProductRow {
  sku: string;
  name: string;
  stock: number;
  unit_price_cents: number;
}

const definition = protoLoader.loadSync(config.protoPath, { keepCase: false, longs: Number, defaults: true });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proto = grpc.loadPackageDefinition(definition) as any;

type Callback<T> = (err: grpc.ServiceError | null, res?: T) => void;

/** Adapts an async handler to grpc-js callback style and maps errors to INTERNAL. */
function handler<Req, Res>(fn: (req: Req) => Promise<Res>) {
  return (call: grpc.ServerUnaryCall<Req, Res>, cb: Callback<Res>) => {
    fn(call.request).then(
      (res) => cb(null, res),
      (err) => {
        console.error("[grpc] handler error:", err);
        cb({ code: grpc.status.INTERNAL, message: "Internal error" } as grpc.ServiceError);
      },
    );
  };
}

export function startGrpcServer(): Promise<grpc.Server> {
  const server = new grpc.Server();

  server.addService(proto.inventory.v1.InventoryService.service, {
    ListProducts: handler(async () => {
      const { rows } = await pool.query<ProductRow>(
        "SELECT sku, name, stock, unit_price_cents FROM products ORDER BY sku",
      );
      return {
        products: rows.map((r) => ({
          sku: r.sku,
          name: r.name,
          stock: r.stock,
          unitPriceCents: r.unit_price_cents,
        })),
      };
    }),

    CheckStock: handler(async (req: { items: { sku: string; quantity: number }[] }) => {
      const skus = req.items.map((i) => i.sku);
      const { rows } = await pool.query<ProductRow>(
        "SELECT sku, name, stock, unit_price_cents FROM products WHERE sku = ANY($1::text[])",
        [skus],
      );
      const bySku = new Map(rows.map((r) => [r.sku, r]));
      const results = req.items.map((i) => {
        const p = bySku.get(i.sku);
        return {
          sku: i.sku,
          available: !!p && p.stock >= i.quantity,
          unitPriceCents: p?.unit_price_cents ?? 0,
        };
      });
      return { allAvailable: results.every((r) => r.available), results };
    }),
  });

  return new Promise((resolve, reject) => {
    server.bindAsync(`0.0.0.0:${config.grpcPort}`, grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) return reject(err);
      console.log(`[inventory] gRPC listening on :${config.grpcPort}`);
      resolve(server);
    });
  });
}
