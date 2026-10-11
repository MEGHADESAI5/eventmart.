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
