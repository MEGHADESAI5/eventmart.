import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { config } from "./config";

export const pool = new Pool({ connectionString: config.databaseUrl });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits for Postgres, then applies schema.sql (tables + seed data, idempotent). */
export async function migrate(): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query("SELECT 1");
      break;
    } catch (err) {
      if (attempt >= 30) throw err;
      console.log(`[db] waiting for postgres (attempt ${attempt})...`);
      await sleep(2000);
    }
  }
  await pool.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  console.log("[db] schema ready");
}
