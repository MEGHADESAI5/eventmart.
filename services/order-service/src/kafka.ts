import { Kafka, logLevel } from "kafkajs";
import { config } from "./config";

export const kafka = new Kafka({
  clientId: "order-service",
  brokers: config.kafkaBrokers,
  logLevel: logLevel.WARN,
  retry: { retries: 10 },
});

export async function ensureTopics(topics: string[]): Promise<void> {
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
