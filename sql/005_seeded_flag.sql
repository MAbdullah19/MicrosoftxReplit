-- Demo-fixture flag. Attest is a public site that asks strangers to trust its
-- verdicts, and scripts/seed.ts creates claims whose votes were cast by
-- accounts that are not people. Those claims must say so on their face, so the
-- flag lives in the database rather than being inferred in the UI.
--
-- Set ONLY by scripts/seed.ts. Nothing in the request path ever writes it, so
-- a claim submitted by a real user can never be marked demo, and a demo claim
-- can never quietly shed the label.
--
-- Idempotent, like every file here: safe to re-run on each deploy.
alter table forum.claims   add column if not exists seeded boolean not null default false;
alter table forum.accounts add column if not exists seeded boolean not null default false;

-- Backfill for databases seeded before the column existed. Seeded accounts are
-- identifiable by their `seed-` passkey sentinel — a real credential id is a
-- base64url WebAuthn identifier and can never collide with that prefix. Claims
-- inherit the flag from their author, which is how the seed writes them.
update forum.accounts
   set seeded = true
 where passkey_id like 'seed-%' and not seeded;

update forum.claims c
   set seeded = true
 where not c.seeded
   and exists (select 1 from forum.accounts a
                where a.pseudonym_id = c.author and a.seeded);
