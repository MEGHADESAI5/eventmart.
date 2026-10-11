import { randomUUID } from "node:crypto";
import { GraphQLError } from "graphql";
import { pool } from "./db";
import { buildOrderPlacedEvent, computeTotal, mergeItems, validateItems } from "./domain";
import { TOPICS, type OrderLine } from "./events";
import { checkStock } from "./inventoryClient";
import { getOrder, type OrderView } from "./repo";

export async function placeOrder(input: {
  customerId: string;
  items: OrderLine[];
}): Promise<OrderView> {
  const invalid = validateItems(input.items);
  if (invalid) throw new GraphQLError(invalid, { extensions: { code: "BAD_USER_INPUT" } });
  const items = mergeItems(input.items);

  // 1) Synchronous gRPC call: fast feedback + authoritative unit prices.
  //    This is only advisory - stock can change before the async reservation,
  //    so inventory-service still has the final say (OrderRejected event).
  let check;
  try {
    check = await checkStock(items);
  } catch (err) {
    console.error("[order] inventory gRPC call failed:", (err as Error).message);
    throw new GraphQLError("Inventory service is unavailable, please retry", {
      extensions: { code: "SERVICE_UNAVAILABLE" },
    });
  }
  if (!check.allAvailable) {
    const missing = check.results.filter((r) => !r.available).map((r) => r.sku);
    throw new GraphQLError(`Insufficient stock or unknown SKU: ${missing.join(", ")}`, {
      extensions: { code: "OUT_OF_STOCK" },
    });
  }
  const prices = new Map(check.results.map((r) => [r.sku, r.unitPriceCents]));
  const totalCents = computeTotal(items, prices);

  // 2) Order + outbox row in ONE transaction: either both exist or neither does.
  //    Kafka is never called inside this transaction (no dual-write problem).
  const orderId = randomUUID();
  const event = buildOrderPlacedEvent({
    orderId,
    customerId: input.customerId,
    items,
    totalCents,
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO orders (id, customer_id, status, total_cents) VALUES ($1, $2, 'PENDING', $3)",
      [orderId, input.customerId, totalCents],
    );
    for (const it of items) {
      await client.query(
        "INSERT INTO order_items (order_id, sku, quantity, unit_price_cents) VALUES ($1, $2, $3, $4)",
        [orderId, it.sku, it.quantity, prices.get(it.sku) ?? 0],
      );
    }
    await client.query("INSERT INTO outbox (topic, message_key, payload) VALUES ($1, $2, $3)", [
      TOPICS.ORDER_PLACED,
      orderId,
      JSON.stringify(event),
    ]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  const order = await getOrder(orderId);
  if (!order) throw new Error("Order vanished after commit");
  return order;
}
