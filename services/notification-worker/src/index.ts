import { Kafka, logLevel } from "kafkajs";
import { RecentIds } from "./dedupe";
import { TOPICS, type EventEnvelope } from "./events";
import { sendNotification } from "./notifier";
import { withRetry } from "./retry";

const kafka = new Kafka({
  clientId: "notification-worker",
  brokers: (process.env.KAFKA_BROKERS ?? "localhost:29092").split(","),
  logLevel: logLevel.WARN,
  retry: { retries: 10 },
});

async function ensureTopics(topics: string[]) {
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: topics.map((topic) => ({ topic, numPartitions: 3, replicationFactor: 1 })),
    });
  } finally {
    await admin.disconnect();
  }
}

async function main() {
  await ensureTopics(Object.values(TOPICS));
  const producer = kafka.producer({ allowAutoTopicCreation: false });
  await producer.connect();
  const consumer = kafka.consumer({ groupId: "notification-worker" });
  await consumer.connect();
  await consumer.subscribe({ topics: [TOPICS.INVENTORY_RESERVED, TOPICS.INVENTORY_REJECTED] });

  const seen = new RecentIds();

  const sendToDlq = (topic: string, key: string | undefined, raw: string, error: string) =>
    producer.send({
      topic: TOPICS.NOTIFICATIONS_DLQ,
      messages: [{ key, value: JSON.stringify({ originalTopic: topic, error, raw, failedAt: new Date().toISOString() }) }],
    });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const raw = message.value?.toString() ?? "";
      const key = message.key?.toString();

      let event: EventEnvelope<{ orderId: string; reason?: string }>;
      try {
        event = JSON.parse(raw);
      } catch {
        await sendToDlq(topic, key, raw, "Malformed JSON");
        return;
      }

      if (seen.has(event.eventId)) {
        console.log(`[notify] duplicate event ${event.eventId} ignored`);
        return;
      }

      try {
        await withRetry(() => sendNotification(topic, event), {
          attempts: 3,
          baseMs: 200,
        });
      } catch (err) {
        const reason = (err as Error).message;
        console.error(`[notify] giving up on ${event.data.orderId} after 3 attempts -> DLQ (${reason})`);
        await sendToDlq(topic, key, raw, reason);
      }
      seen.add(event.eventId);
    },
  });

  const shutdown = async () => {
    await consumer.disconnect();
    await producer.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  console.log("[notify] worker running");
}

main().catch((err) => {
  console.error("[notify] fatal:", err);
  process.exit(1);
});
