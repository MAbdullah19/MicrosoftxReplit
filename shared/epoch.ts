/** Epoch arithmetic (§10.3). Pure — shared so the server, the anchor job and
 *  any verifier agree on which bucket an event belongs to.
 *
 *  epoch = floor(unixSeconds / EPOCH_MINUTES·60), computed at INSERT time.
 *  The anchor job only closes epochs strictly less than the current one, so
 *  no event can ever land in an already-closed epoch. That single rule is
 *  what makes anchoring idempotent and self-healing. */
import { CHAIN } from "./config";

export const EPOCH_SECONDS = CHAIN.EPOCH_MINUTES * 60;

export const epochOf = (d: Date | number = Date.now()): number =>
  Math.floor((typeof d === "number" ? d : d.getTime()) / 1000 / EPOCH_SECONDS);

export const currentEpoch = (): number => epochOf(Date.now());

/** Start of an epoch as a Date — used for display and for test fixtures. */
export const epochStart = (epoch: number): Date => new Date(epoch * EPOCH_SECONDS * 1000);
