export const TOPICS = {
  ORDER_PLACED: "orders.placed",
  INVENTORY_RESERVED: "inventory.reserved",
  INVENTORY_REJECTED: "inventory.rejected",
  NOTIFICATIONS_DLQ: "notifications.dlq",
} as const;

export interface EventEnvelope<T> {
  eventId: string;
  type: string;
  occurredAt: string;
  data: T;
}

export interface OrderPlacedData {
  orderId: string;
  customerId: string;
  items: { sku: string; quantity: number }[];
  totalCents: number;
}

export type Outcome = { outcome: "RESERVED" } | { outcome: "REJECTED"; reason: string };
