import { startOrderConsumer } from "./consumer";
import { migrate, pool } from "./db";
import { TOPICS } from "./events";
import { startGrpcServer } from "./grpcServer";
import { ensureTopics, kafka } from "./kafka";

async function main() {
  await migrate();
  await ensureTopics(Object.values(TOPICS));

  const grpcServer = await startGrpcServer();
  const producer = kafka.producer({ allowAutoTopicCreation: false });
  await producer.connect();
  const consumer = await startOrderConsumer(producer);

  const shutdown = async () => {
    console.log("[inventory] shutting down...");
    grpcServer.forceShutdown();
    await consumer.disconnect();
    await producer.disconnect();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[inventory] fatal:", err);
  process.exit(1);
});
