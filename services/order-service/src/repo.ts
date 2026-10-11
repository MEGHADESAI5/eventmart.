import { pool } from "./db";

export interface OrderView {
  id: string;
  customerId: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  totalCents: number;
  reason: string | null;
  createdAt: string;
  items: { sku: string; quantity: number; unitPriceCents: number }[];
}

// One query per call (json_agg) instead of one per order -> no N+1 in GraphQL.
const SELECT_ORDERS = `
  SELECT o.id, o.customer_id, o.status, o.total_cents, o.reason, o.created_at,
         COALESCE(
           json_agg(json_build_object(
             'sku', i.sku, 'quantity', i.quantity, 'unitPriceCents', i.unit_price_cents
           ) ORDER BY i.sku) FILTER (WHERE i.sku IS NOT NULL),
           '[]'
         ) AS items
    FROM orders o
    LEFT JOIN order_items i ON i.order_id = o.id`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toView(r: any): OrderView {
  return {
    id: r.id,
    customerId: r.customer_id,
    status: r.status,
    totalCents: r.total_cents,
    reason: r.reason,
    createdAt: new Date(r.created_at).toISOString(),
    items: r.items,
  };
}

export async function getOrder(id: string): Promise<OrderView | null> {
  const { rows } = await pool.query(`${SELECT_ORDERS} WHERE o.id = $1 GROUP BY o.id`, [id]);
  return rows[0] ? toView(rows[0]) : null;
}

export async function listOrders(customerId: string | null, limit: number): Promise<OrderView[]> {
  const { rows } = await pool.query(
    `${SELECT_ORDERS}
      WHERE ($1::text IS NULL OR o.customer_id = $1)
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $2`,
    [customerId, Math.min(Math.max(limit, 1), 100)],
  );
  return rows.map(toView);
}
