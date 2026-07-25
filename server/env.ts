/** Validated environment — fail fast, no fallback defaults for secrets (I10).
 *  `process.env.X ?? "some-default"` is forbidden for anything secret. */
import "dotenv/config";
import { z } from "zod";

// Secrets come from the host's environment in production. Off Replit there is
// no Secrets pane, so a gitignored .env supplies them locally. dotenv never
// overwrites an already-set variable, so the host always wins — this loads
// values, it does not invent them, and I10 still holds.

const required = z.string().min(16);

// RP_ID/RP_ORIGIN are NOT secrets: in development on Replit we derive them
// from the runtime-provided REPLIT_DEV_DOMAIN so passkeys work in preview.
// In production they must be set explicitly.
const devDomain = process.env.REPLIT_DEV_DOMAIN;
if (!process.env.RP_ID && devDomain) process.env.RP_ID = devDomain;
if (!process.env.RP_ORIGIN && devDomain) process.env.RP_ORIGIN = `https://${devDomain}`;

const schema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: required,
  PEPPER_IDENTITY: required,
  PEPPER_VOTE: required,
  PEPPER_NET: required,
  JOB_TOKEN: required,
  RP_ID: z.string().min(1),
  RP_ORIGIN: z.string().url(),
  RP_NAME: z.string().default("Attest"),
  // optional — absence switches on a documented degraded mode (§5.3)
  TURNSTILE_SECRET_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  ANCHOR_CONTRACT_ADDRESS: z.string().optional(),
  ANCHORER_PRIVATE_KEY: z.string().optional(),
  RPC_URL: z.string().url().default("https://sepolia.base.org"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("FATAL: invalid environment\n", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;

export const features = {
  turnstile: !!env.TURNSTILE_SECRET_KEY,
  ai: !!env.GEMINI_API_KEY,
  chain: !!(env.ANCHOR_CONTRACT_ADDRESS && env.ANCHORER_PRIVATE_KEY),
};

// Log each degraded mode ONCE at boot (§5.3). Never log secret values (I11).
if (!features.turnstile) console.log("[degraded] turnstile disabled");
if (!features.ai) console.log("[degraded] ai disabled — fixture signals only");
if (!features.chain) console.log("[degraded] chain disabled — anchors marked skipped_no_chain");
