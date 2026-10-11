import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOrderPlacedEvent, computeTotal, mergeItems, validateItems } from "./domain";

test("validateItems rejects empty orders and bad quantities", () => {
  assert.ok(validateItems([]));
  assert.ok(validateItems([{ sku: "A", quantity: 0 }]));
  assert.ok(validateItems([{ sku: "A", quantity: 1.5 }]));
  assert.ok(validateItems([{ sku: "A", quantity: 101 }]));
  assert.ok(validateItems([{ sku: " ", quantity: 1 }]));
  assert.equal(validateItems([{ sku: "A", quantity: 2 }]), null);
});

test("mergeItems combines duplicate SKUs", () => {
  const merged = mergeItems([
    { sku: "A", quantity: 1 },
    { sku: "B", quantity: 2 },
    { sku: "A", quantity: 3 },
  ]);
  assert.deepEqual(merged, [
    { sku: "A", quantity: 4 },
    { sku: "B", quantity: 2 },
  ]);
});

test("computeTotal multiplies quantity by unit price", () => {
  const prices = new Map([
    ["A", 100],
    ["B", 250],
  ]);
  assert.equal(
    computeTotal(
      [
        { sku: "A", quantity: 2 },
        { sku: "B", quantity: 1 },
      ],
      prices,
    ),
    450,
  );
});

test("buildOrderPlacedEvent wraps data in an envelope", () => {
  const e = buildOrderPlacedEvent({ orderId: "o1", customerId: "c1", items: [], totalCents: 0 });
  assert.equal(e.type, "OrderPlaced");
  assert.equal(e.data.orderId, "o1");
  assert.match(e.eventId, /^[0-9a-f-]{36}$/);
  assert.ok(!Number.isNaN(Date.parse(e.occurredAt)));
});
