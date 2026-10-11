import assert from "node:assert/strict";
import { test } from "node:test";
import { buildResultMessage } from "./results";

test("RESERVED outcome goes to inventory.reserved keyed by orderId", () => {
  const m = buildResultMessage("o1", { outcome: "RESERVED" });
  assert.equal(m.topic, "inventory.reserved");
  assert.equal(m.key, "o1");
  assert.equal(m.event.type, "InventoryReserved");
  assert.deepEqual(m.event.data, { orderId: "o1" });
});

test("REJECTED outcome carries the reason", () => {
  const m = buildResultMessage("o2", { outcome: "REJECTED", reason: "Insufficient stock or unknown SKU: KB-001" });
  assert.equal(m.topic, "inventory.rejected");
  assert.equal(m.event.type, "InventoryRejected");
  assert.equal(m.event.data.reason, "Insufficient stock or unknown SKU: KB-001");
});
