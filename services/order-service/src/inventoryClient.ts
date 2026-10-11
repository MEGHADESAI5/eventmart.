import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { config } from "./config";
import type { OrderLine } from "./events";

export interface Product {
  sku: string;
  name: string;
  stock: number;
  unitPriceCents: number;
}
export interface StockCheckResult {
  sku: string;
  available: boolean;
  unitPriceCents: number;
}
export interface CheckStockResponse {
  allAvailable: boolean;
  results: StockCheckResult[];
}

const definition = protoLoader.loadSync(config.protoPath, {
  keepCase: false, // unit_price_cents -> unitPriceCents
  longs: Number,
  defaults: true,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proto = grpc.loadPackageDefinition(definition) as any;
const client = new proto.inventory.v1.InventoryService(
  config.inventoryAddr,
  grpc.credentials.createInsecure(),
) as grpc.Client;

function call<Req, Res>(method: string, request: Req): Promise<Res> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)[method](
      request,
      { deadline: new Date(Date.now() + 3000) },
      (err: grpc.ServiceError | null, res: Res) => (err ? reject(err) : resolve(res)),
    );
  });
}

export async function listProducts(): Promise<Product[]> {
  const res = await call<object, { products: Product[] }>("ListProducts", {});
  return res.products;
}

export function checkStock(items: OrderLine[]): Promise<CheckStockResponse> {
  return call("CheckStock", { items });
}
