import { randomUUID } from "node:crypto";
import { TOPICS, type EventEnvelope, type Outcome } from "./events";

/** Maps a reservation outcome to the Kafka topic + envelope to publish. */
export function buildResultMessage(
  orderId: string,
  outcome: Outcome,
): { topic: string; key: string; event: EventEnvelope<Record<string, string>> } {
  const base = { eventId: randomUUID(), occurredAt: new Date().toISOString() };
  if (outcome.outcome === "RESERVED") {
    return {
      topic: TOPICS.INVENTORY_RESERVED,
      key: orderId,
      event: { ...base, type: "InventoryReserved", data: { orderId } },
    };
  }
  return {
    topic: TOPICS.INVENTORY_REJECTED,
    key: orderId,
    event: { ...base, type: "InventoryRejected", data: { orderId, reason: outcome.reason } },
  };
}
