import assert from "node:assert/strict";
import { test } from "node:test";
import { RecentIds } from "./dedupe";
import { withRetry } from "./retry";

test("withRetry succeeds after transient failures, with exponential backoff", async () => {
  let calls = 0;
  const delays: number[] = [];
  const result = await withRetry(
    async () => {
      if (++calls < 3) throw new Error("boom");
      return "ok";
    },
    { attempts: 3, baseMs: 100, sleep: async (ms) => void delays.push(ms) },
  );
  assert.equal(result, "ok");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [100, 200]);
});

test("withRetry rethrows the last error after exhausting attempts", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        throw new Error(`fail ${calls}`);
      },
      { attempts: 3, baseMs: 1, sleep: async () => undefined },
    ),
    /fail 3/,
  );
  assert.equal(calls, 3);
});

test("RecentIds forgets the oldest id past its capacity", () => {
  const ids = new RecentIds(2);
  ids.add("a");
  ids.add("b");
  ids.add("c");
  assert.equal(ids.has("a"), false);
  assert.equal(ids.has("b"), true);
  assert.equal(ids.has("c"), true);
});
