/** EVERY user-facing string lives here (§14.5), so translation is a later PR,
 *  not a rewrite. Layer-1 target reading level: roughly a 12-year-old. */

export const STRINGS = {
  productName: "Attest",
  tagline: "Check whether a link, phone number, or claim can be trusted.",
  searchPlaceholder: "Paste a link, phone number, or claim",

  verdict: {
    likelyTrue: "Likely true",
    likelyFalse: "Likely false",
    likelyScam: "Likely a scam",
    leaningTrue: "Leaning true — still being checked",
    leaningFalse: "Leaning false — still being checked",
    notEnoughEvidence: "Not enough evidence yet",
    unresolved: "Checked, but unresolved — the evidence conflicts",
    removed: "Removed by an operator — see the tombstone",
  },

  join: {
    noPii:
      "We never ask for your email, phone number, or name. That also means we cannot help you recover a lost account — save your backup codes.",
    savedCodes: "I've saved these",
    haveInvite: "Have an invite code?",
    createPasskey: "Create your passkey",
  },

  verify: {
    localOnly: "Verified against our local ledger. Not yet anchored on-chain.",
    aiUnavailable: "AI analysis unavailable.",
    tamper: "Tamper with the record",
  },

  home: {
    recentlyResolved: "Recently resolved",
    beFirst: "Be the first to report this",
  },

  claim: {
    voteFirst: "Vote first to see the tally",
    peopleChecked: (n: number) =>
      n === 1 ? "1 person checked this" : `${n} people checked this`,
  },

  errors: {
    notAuthenticated: "You need to sign in first.",
    tierRequired: "You need an invite to vote.",
    alreadyVoted: "You already voted on this claim.",
    rateLimited: "Too many requests. Please wait a bit.",
  },
} as const;
