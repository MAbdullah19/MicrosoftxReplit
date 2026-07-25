/** Runs sql/*.sql in filename order. Idempotent: every file uses
 *  `create ... if not exists` or `create or replace`, so re-running is safe. */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FATAL: DATABASE_URL is not set");
  process.exit(1);
}

const dir = path.resolve(import.meta.dirname, "..", "sql");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const pool = new Pool({ connectionString: url });

for (const file of files) {
  const sql = readFileSync(path.join(dir, file), "utf8");
  process.stdout.write(`applying ${file} … `);
  await pool.query(sql);
  console.log("ok");
}

await pool.end();
console.log(`done — ${files.length} file(s) applied.`);
