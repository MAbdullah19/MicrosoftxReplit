import {
  pgSchema,
  uuid,
  text,
  integer,
  bigint,
  bigserial,
  boolean,
  doublePrecision,
  timestamp,
  jsonb,
  smallint,
  customType,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

export const enrolment = pgSchema("enrolment");
export const forum = pgSchema("forum");

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

/* ═══ enrolment — stores NO reference to any pseudonym (I5) ═══ */

export const invites = enrolment.table("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  codeHash: text("code_hash").notNull().unique(), // argon2id(pepper ‖ code) — I6
  issuedBy: text("issued_by"), // 'admin' | 'user' — NEVER a pseudonym (I5)
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  revoked: boolean("revoked").default(false).notNull(),
});

export const rateLimits = enrolment.table(
  "rate_limits",
  {
    key: text("key").notNull(), // HMAC(PEPPER_NET, ip) or pseudonym — NEVER a raw IP (I11)
    action: text("action").notNull(),
    count: integer("count").default(0).notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.key, t.action] }) }),
);

/* ═══ forum ═══
   I2: no email column, no phone column, no name column — anywhere. */

export const accounts = forum.table("accounts", {
  pseudonymId: uuid("pseudonym_id").primaryKey().defaultRandom(), // RANDOM, never derived (I1)
  handle: text("handle").notNull().unique(), // 'fox-8813'
  tier: smallint("tier").default(1).notNull(), // 1 = guest, 2 = verified
  passkeyId: text("passkey_id").notNull().unique(),
  passkeyPubkey: bytea("passkey_pubkey").notNull(),
  passkeyCounter: bigint("passkey_counter", { mode: "number" }).default(0).notNull(),
  repA: doublePrecision("rep_a").default(1).notNull(),
  repB: doublePrecision("rep_b").default(1).notNull(),
  points: integer("points").default(0).notNull(), // EARNED, not granted
  pointsStaked: integer("points_staked").default(0).notNull(),
  invitesMinted: integer("invites_minted").default(0).notNull(),
  /** Created by scripts/seed.ts, not by a human with a passkey. Surfaced in
   *  the UI so a stranger is never shown a fabricated vote as if it were a
   *  person's judgement. Only the seed script ever sets this true. */
  seeded: boolean("seeded").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const backupCodes = forum.table(
  "backup_codes",
  {
    pseudonymId: uuid("pseudonym_id")
      .notNull()
      .references(() => accounts.pseudonymId, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(), // argon2id only (I6)
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.pseudonymId, t.codeHash] }) }),
);

export const claims = forum.table(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectKind: text("subject_kind").notNull(), // 'url' | 'phone' | 'text'
    subjectValue: text("subject_value").notNull(), // normalised
    subjectKey: text("subject_key").notNull(), // sha256(kind|value)
    statement: text("statement").notNull(),
    detail: text("detail"),
    contentHash: text("content_hash").notNull(),
    status: text("status").default("open").notNull(), // open|verified|refuted|inconclusive|removed
    alpha: doublePrecision("alpha").default(1).notNull(),
    beta: doublePrecision("beta").default(1).notNull(),
    score: doublePrecision("score").default(0.5).notNull(),
    ciLow: doublePrecision("ci_low"),
    ciHigh: doublePrecision("ci_high"),
    voterCount: integer("voter_count").default(0).notNull(),
    author: uuid("author").references(() => accounts.pseudonymId),
    stableSince: timestamp("stable_since", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    anchorEpoch: bigint("anchor_epoch", { mode: "number" }),
    /** Demo fixture from scripts/seed.ts. Its verdict was produced by seeded
     *  accounts voting on a script's schedule, not by the public. The claim
     *  page, the feed card and the §14.4 waterfall all say so — see the
     *  limitation noted in README about what this flag does NOT cover. */
    seeded: boolean("seeded").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    bySubject: index("claims_subject_idx").on(t.subjectKey),
    byStatus: index("claims_status_idx").on(t.status, t.createdAt),
  }),
);

export const evidence = forum.table("evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  claimId: uuid("claim_id")
    .notNull()
    .references(() => claims.id, { onDelete: "cascade" }),
  stance: text("stance").notNull(), // supports | refutes | context
  body: text("body").notNull(),
  url: text("url"),
  helpful: integer("helpful").default(0).notNull(),
  unhelpful: integer("unhelpful").default(0).notNull(),
  author: uuid("author").references(() => accounts.pseudonymId),
  contentHash: text("content_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** NO foreign key to accounts. Primary key is the nullifier. (I3)
 *  Dumping this table must reveal nothing about who voted. Do NOT add an
 *  account column "to make settlement easier" — that column is the whole
 *  privacy property. Settlement recomputes HMAC nullifiers per account. */
export const votes = forum.table(
  "votes",
  {
    nullifier: text("nullifier").primaryKey(), // HMAC(PEPPER_VOTE, pseudonym ‖ claimId)
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id, { onDelete: "cascade" }),
    stance: text("stance").notNull(), // support | refute
    confidence: doublePrecision("confidence").notNull(),
    stake: integer("stake").notNull(),
    weight: doublePrecision("weight").notNull(),
    weightBreakdown: jsonb("weight_breakdown").notNull(), // { reputation, stakeFactor, raw, capped }
    settledAt: timestamp("settled_at", { withTimezone: true }),
    brier: doublePrecision("brier"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ byClaim: index("votes_claim_idx").on(t.claimId) }),
);

export const aiSignals = forum.table("ai_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  claimId: uuid("claim_id")
    .notNull()
    .references(() => claims.id, { onDelete: "cascade" }),
  verdictHint: text("verdict_hint").notNull(), // likely_true | likely_false | unverifiable
  confidence: doublePrecision("confidence").notNull(),
  rationale: text("rationale").notNull(),
  redFlags: jsonb("red_flags").notNull(), // string[]
  weightContributed: doublePrecision("weight_contributed").default(0).notNull(),
  disputes: integer("disputes").default(0).notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ledgerEvents = forum.table(
  "ledger_events",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    prevHash: text("prev_hash").notNull(),
    eventType: text("event_type").notNull(), // verdict | removal
    payload: jsonb("payload").notNull(), // the VerdictRecord
    payloadHash: text("payload_hash").notNull(),
    blockHash: text("block_hash").notNull(),
    epoch: bigint("epoch", { mode: "number" }).notNull(),
    leafIndex: integer("leaf_index"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ byEpoch: index("ledger_epoch_idx").on(t.epoch) }),
);

export const anchors = forum.table("anchors", {
  epoch: bigint("epoch", { mode: "number" }).primaryKey(),
  merkleRoot: text("merkle_root").notNull(),
  leafCount: integer("leaf_count").notNull(),
  txHash: text("tx_hash"),
  blockNumber: bigint("block_number", { mode: "number" }),
  status: text("status").default("pending").notNull(), // pending|confirmed|failed|skipped_no_chain
  anchoredAt: timestamp("anchored_at", { withTimezone: true }),
});
