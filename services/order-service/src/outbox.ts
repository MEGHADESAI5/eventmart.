import type { Producer } from "kafkajs";
import { pool } from "./db";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OutboxRow {
  id: string;
  topic: string;
  message_key: string;
  payload: unknown;
}

/**
 * Relays one batch of unpublished outbox rows to Kafka.
 * - FOR UPDATE SKIP LOCKED lets several publisher instances run safely.
 * - Rows are only marked published AFTER Kafka acknowledges them, so a crash in
 *   between causes a re-send (at-least-once). Consumers must therefore be idempotent.
 */
export async function publishBatch(producer: Producer, batchSize = 50): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<OutboxRow>(
      `SELECT id, topic, message_key, payload
         FROM outbox
        WHERE published_at IS NULL
        ORDER BY id
        LIMIT $1
          FOR UPDATE SKIP LOCKED`,
      [batchSize],
    );
    if (rows.length === 0) {
      await client.query("COMMIT");
      return 0;
    }

    // Group by topic while keeping the original (id) order inside each topic.
    const byTopic = new Map<string, { key: string; value: string }[]>();
    for (const r of rows) {
      const list = byTopic.get(r.topic) ?? [];
      list.push({ key: r.message_key, value: JSON.stringify(r.payload) });
      byTopic.set(r.topic, list);
    }
    await producer.sendBatch({
      topicMessages: [...byTopic].map(([topic, messages]) => ({ topic, messages })),
    });

    await client.query("UPDATE outbox SET published_at = now() WHERE id = ANY($1::bigint[])", [
      rows.map((r) => r.id),
    ]);
    await client.query("COMMIT");
    return rows.length;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export function startOutboxPublisher(producer: Producer, idleMs = 500): () => void {
  let stopped = false;
  void (async () => {
    while (!stopped) {
      try {
        const n = await publishBatch(producer);
        if (n > 0) console.log(`[outbox] published ${n} event(s)`);
        else await sleep(idleMs);
      } catch (err) {
        console.error("[outbox] publish failed, will retry:", (err as Error).message);
        await sleep(2000);
      }
    }
  })();
  return () => {
    stopped = true;
  };
}
