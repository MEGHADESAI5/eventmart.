import path from "node:path";

export const config = {
  grpcPort: Number(process.env.GRPC_PORT ?? 50051),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://eventmart:eventmart@localhost:5432/inventory",
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? "localhost:29092").split(","),
  protoPath: process.env.PROTO_PATH ?? path.resolve(__dirname, "../../../proto/inventory.proto"),
};
