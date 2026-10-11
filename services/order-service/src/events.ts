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

export interface OrderLine {
  sku: string;
  quantity: number;
}

export interface OrderPlacedData {
  orderId: string;
  customerId: string;
  items: OrderLine[];
  totalCents: number;
}

export interface InventoryReservedData {
  orderId: string;
}

export interface InventoryRejectedData {
  orderId: string;
  reason: string;
}
