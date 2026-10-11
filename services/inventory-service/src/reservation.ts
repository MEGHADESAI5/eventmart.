import { pool } from "./db";
import type { EventEnvelope, OrderPlacedData, Outcome } from "./events";

/**
 * Reserves stock for an OrderPlaced event - exactly-once in effect.
 *
 *  - First delivery: decrement stock atomically, record the outcome in processed_events.
 *  - Duplicate delivery (Kafka is at-least-once): do NOT touch stock again; return the
 *    stored outcome so the caller can safely re-publish it (covers a crash between
 *    "commit" and "publish").
 *  - Rows are updated in SKU order so concurrent orders cannot deadlock each other.
 */
export async function reserveStock(event: EventEnvelope<OrderPlacedData>): Promise<Outcome> {
  const { orderId, items } = event.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const prev = await client.query<{ outcome: string; reason: string | null }>(
      "SELECT outcome, reason FROM processed_events WHERE event_id = $1",
      [event.eventId],
    );
    if (prev.rows[0]) {
      await client.query("COMMIT");
      const { outcome, reason } = prev.rows[0];
      return outcome === "RESERVED"
        ? { outcome: "RESERVED" }
        : { outcome: "REJECTED", reason: reason ?? "Rejected" };
    }

    let failure: string | null = null;
    for (const it of [...items].sort((a, b) => a.sku.localeCompare(b.sku))) {
      const res = await client.query(
        "UPDATE products SET stock = stock - $2 WHERE sku = $1 AND stock >= $2",
        [it.sku, it.quantity],
      );
      if (res.rowCount === 0) {
        failure = `Insufficient stock or unknown SKU: ${it.sku}`;
        break;
      }
    }

    if (failure) {
      await client.query("ROLLBACK"); // undo any partial decrements
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO processed_events (event_id, order_id, outcome, reason)
         VALUES ($1, $2, 'REJECTED', $3) ON CONFLICT DO NOTHING`,
        [event.eventId, orderId, failure],
      );
      await client.query("COMMIT");
      return { outcome: "REJECTED", reason: failure };
    }

    await client.query(
      "INSERT INTO processed_events (event_id, order_id, outcome) VALUES ($1, $2, 'RESERVED')",
      [event.eventId, orderId],
    );
    await client.query("COMMIT");
    return { outcome: "RESERVED" };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
