import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./shared/schema.ts",
  out: "./drizzle",
  schemaFilter: ["forum", "enrolment"],
  dbCredentials: { url: process.env.DATABASE_URL },
});
