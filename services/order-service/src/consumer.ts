import type { Consumer } from "kafkajs";
import { pool } from "./db";
import { TOPICS, type EventEnvelope, type InventoryRejectedData, type InventoryReservedData } from "./events";
import { kafka } from "./kafka";

/**
 * Applies inventory results to orders. The UPDATEs are naturally idempotent
 * (only PENDING orders change), so duplicate deliveries are harmless.
 */
export async function startInventoryResultConsumer(): Promise<Consumer> {
  const consumer = kafka.consumer({ groupId: "order-service" });
  await consumer.connect();
  await consumer.subscribe({ topics: [TOPICS.INVENTORY_RESERVED, TOPICS.INVENTORY_REJECTED] });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      let event: EventEnvelope<InventoryReservedData | InventoryRejectedData>;
      try {
        event = JSON.parse(message.value.toString());
      } catch {
        console.error(`[order] skipping malformed message on ${topic}`);
        return;
      }

      if (topic === TOPICS.INVENTORY_RESERVED) {
        await pool.query("UPDATE orders SET status = 'CONFIRMED' WHERE id = $1 AND status = 'PENDING'", [
          event.data.orderId,
        ]);
        console.log(`[order] ${event.data.orderId} -> CONFIRMED`);
      } else {
        const { orderId, reason } = event.data as InventoryRejectedData;
        await pool.query(
          "UPDATE orders SET status = 'REJECTED', reason = $2 WHERE id = $1 AND status = 'PENDING'",
          [orderId, reason],
        );
        console.log(`[order] ${orderId} -> REJECTED (${reason})`);
      }
    },
  });
  return consumer;
}
