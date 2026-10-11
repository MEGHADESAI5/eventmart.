import { randomUUID } from "node:crypto";
import type { EventEnvelope, OrderLine, OrderPlacedData } from "./events";

export const MAX_QTY_PER_LINE = 100;

/** Returns an error message, or null when the items are valid. */
export function validateItems(items: OrderLine[]): string | null {
  if (items.length === 0) return "An order needs at least one item";
  for (const it of items) {
    if (!it.sku.trim()) return "SKU must not be empty";
    if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > MAX_QTY_PER_LINE) {
      return `Quantity for ${it.sku} must be an integer between 1 and ${MAX_QTY_PER_LINE}`;
    }
  }
  return null;
}

/** Merges duplicate SKUs so every SKU appears once. */
export function mergeItems(items: OrderLine[]): OrderLine[] {
  const merged = new Map<string, number>();
  for (const { sku, quantity } of items) merged.set(sku, (merged.get(sku) ?? 0) + quantity);
  return [...merged].map(([sku, quantity]) => ({ sku, quantity }));
}

export function computeTotal(items: OrderLine[], unitPrices: Map<string, number>): number {
  return items.reduce((sum, it) => sum + it.quantity * (unitPrices.get(it.sku) ?? 0), 0);
}

export function buildOrderPlacedEvent(data: OrderPlacedData): EventEnvelope<OrderPlacedData> {
  return {
    eventId: randomUUID(),
    type: "OrderPlaced",
    occurredAt: new Date().toISOString(),
    data,
  };
}
