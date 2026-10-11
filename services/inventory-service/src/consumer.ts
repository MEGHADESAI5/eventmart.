import type { Consumer, Producer } from "kafkajs";
import { TOPICS, type EventEnvelope, type OrderPlacedData } from "./events";
import { kafka } from "./kafka";
import { reserveStock } from "./reservation";
import { buildResultMessage } from "./results";

export async function startOrderConsumer(producer: Producer): Promise<Consumer> {
  const consumer = kafka.consumer({ groupId: "inventory-service" });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.ORDER_PLACED });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      let event: EventEnvelope<OrderPlacedData>;
      try {
        event = JSON.parse(message.value.toString());
      } catch {
        console.error("[inventory] skipping malformed OrderPlaced message");
        return;
      }

      // Throwing here makes kafkajs retry the message; reserveStock is idempotent.
      const outcome = await reserveStock(event);
      const { topic, key, event: result } = buildResultMessage(event.data.orderId, outcome);
      await producer.send({ topic, messages: [{ key, value: JSON.stringify(result) }] });
      console.log(`[inventory] order ${event.data.orderId} -> ${outcome.outcome}`);
    },
  });
  return consumer;
}
