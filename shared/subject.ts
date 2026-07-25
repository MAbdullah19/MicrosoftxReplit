import parsePhone from "libphonenumber-js";
import { sha256Hex } from "./hash";

export type SubjectKind = "url" | "phone" | "text";

const TRACKING = /^(utm_|fbclid$|gclid$|mc_eid$|igshid$|ref$|ref_src$|si$|s$)/i;

export function normaliseSubject(kind: SubjectKind, raw: string): string {
  const v = raw.trim();
  switch (kind) {
    case "url": {
      let u: URL;
      try {
        u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      } catch {
        return v.toLowerCase();
      }
      u.protocol = "https:"; // scheme-insensitive subjects
      u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
      u.hash = "";
      const keep = [...u.searchParams.entries()]
        .filter(([k]) => !TRACKING.test(k))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      u.search = keep.length
        ? "?" + keep.map(([k, val]) => `${k}=${val}`).join("&")
        : "";
      if (u.pathname === "/") u.pathname = "";
      return u.toString().replace(/\/$/, "");
    }
    case "phone": {
      const p = parsePhone(v, "PK"); // default country; user may type +CC
      if (p?.isValid()) return p.number; // E.164, e.g. +923001234567
      const digits = v.replace(/[^\d+]/g, "");
      return digits.startsWith("+") ? digits : `+${digits}`;
    }
    case "text":
      return v
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  }
}

export function subjectKey(kind: SubjectKind, raw: string): string {
  return sha256Hex(`${kind}|${normaliseSubject(kind, raw)}`);
}

/** Used by the landing-page search box to guess the kind from free text. */
export function detectKind(raw: string): SubjectKind {
  const v = raw.trim();
  if (/^(https?:\/\/|www\.)|^[a-z0-9-]+\.[a-z]{2,}(\/|$)/i.test(v)) return "url";
  if (/^\+?[\d\s()-]{7,}$/.test(v)) return "phone";
  return "text";
}
