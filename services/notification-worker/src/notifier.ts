import type { EventEnvelope } from "./events";

const failRate = Number(process.env.FAIL_RATE ?? 0);

/** Simulated email/SMS provider. FAIL_RATE makes it flaky so retries + the DLQ can be demoed. */
export async function sendNotification(topic: string, event: EventEnvelope<{ orderId: string; reason?: string }>) {
  if (Math.random() < failRate) throw new Error("Notification provider timeout");
  const text =
    topic === "inventory.reserved"
      ? `Your order ${event.data.orderId} is confirmed.`
      : `Your order ${event.data.orderId} could not be fulfilled: ${event.data.reason ?? "unknown reason"}.`;
  console.log(`[notify] -> customer: ${text}`);
}
