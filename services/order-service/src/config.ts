import path from "node:path";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://eventmart:eventmart@localhost:5432/orders",
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? "localhost:29092").split(","),
  inventoryAddr: process.env.INVENTORY_GRPC_ADDR ?? "localhost:50051",
  protoPath: process.env.PROTO_PATH ?? path.resolve(__dirname, "../../../proto/inventory.proto"),
};
