/** Postgres-backed fixed-window rate limiter (§12.6). Keys are pseudonyms or
 *  HMAC'd IPs — NEVER a raw IP (I11). */
import { sql } from "drizzle-orm";
import { db } from "./db";
import { RATE_LIMITS } from "../shared/config";

/** Atomic fixed-window counter. Returns true if the action is allowed. */
export async function checkRate(key: string, action: keyof typeof RATE_LIMITS) {
  const { limit, windowMinutes } = RATE_LIMITS[action];
  const { rows } = await db.execute(sql`
    insert into enrolment.rate_limits (key, action, count, window_start)
    values (${key}, ${action}, 1, now())
    on conflict (key, action) do update set
      count = case when enrolment.rate_limits.window_start < now() - (${windowMinutes} || ' minutes')::interval
                   then 1 else enrolment.rate_limits.count + 1 end,
      window_start = case when enrolment.rate_limits.window_start < now() - (${windowMinutes} || ' minutes')::interval
                   then now() else enrolment.rate_limits.window_start end
    returning count`);
  return Number((rows[0] as any).count) <= limit;
}

export function retryAfterSeconds(action: keyof typeof RATE_LIMITS) {
  return RATE_LIMITS[action].windowMinutes * 60;
}
