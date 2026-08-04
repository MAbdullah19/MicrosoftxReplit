/** EVERY user-facing string lives here (§14.5), so translation is a later PR,
 *  not a rewrite. Layer-1 target reading level: roughly a 12-year-old. */

export const STRINGS = {
  productName: "Attest",
  tagline: "Check whether a link, news, or claim can be trusted.",
  searchPlaceholder: "Paste a link, news, or claim",

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
    eyebrow: "Public verdicts, anchored to a blockchain",
    /** Cycled by FlipWords under the headline — what we invite people to
     *  paste. A news story arrives as either a url or a text subject, so
     *  this list is the pitch, not the SubjectKind union. */
    kinds: ["a link", "a news story", "a claim"],
    headline: "For real?",
    lede: "Paste anything suspicious. People check it, the reasoning is shown in full, and the verdict is published so you can prove we did not change it later.",
    /** The three-up strip. `note` is the honest caveat under each number. */
    stats: {
      openLabel: "Claims open now",
      checkedLabel: "Checks cast",
      resolvedLabel: "Verdicts settled",
    },
    howTitle: "How a verdict gets made",
    howLede:
      "No moderators, no single authority, and nothing you have to take on trust.",
    how: {
      reportTitle: "Anyone can report",
      reportBody:
        "Paste a link, a news story, or a sentence. No account needed to look; an invite is needed to vote.",
      voteTitle: "People vote with something at stake",
      voteBody:
        "Each voter says how sure they are and stakes points on it. Hedging at 50% breaks even, so honesty is the winning strategy.",
      weighTitle: "Votes are weighted, not counted",
      weighBody:
        "Your weight is your track record times your stake. An AI signal joins in, capped low and always disputable — it never decides.",
      blindTitle: "Blind until you vote",
      blindBody: "You cannot see the tally before casting. That kills the copy-the-first-voter cascade.",
      settleTitle: "It settles when it holds still",
      settleBody:
        "A claim resolves only once confidence clears the bar and stays there. Then everyone is graded on calibration.",
      anchorTitle: "The verdict is anchored",
      anchorBody:
        "Its hash goes into a Merkle root published on Base Sepolia. Change one digit afterwards and the proof breaks.",
    },
    nextTitle: "Where to go next",
    routes: {
      verifyTitle: "Verify a verdict",
      verifyBody:
        "Check any settled verdict against the public blockchain, in your browser. No account, no wallet.",
      joinTitle: "Join with a passkey",
      joinBody:
        "No email, no phone, no name. A passkey and eight backup codes, and you are in.",
      accountTitle: "Your record",
      accountBody:
        "Reputation, points, and every vote you have cast with the score that graded it.",
    },
  },

  claim: {
    voteFirst: "Vote first to see the tally",
    peopleChecked: (n: number) =>
      n === 1 ? "1 person checked this" : `${n} people checked this`,
    /** Shown on every seeded claim. Say what it is in plain words — "sample
     *  data" is vaguer than the truth and the truth is not embarrassing. */
    demoTitle: "Demo claim — this verdict was not decided by the public",
    demoBody:
      "We created this claim and its votes to show how Attest works. The accounts that voted on it are not real people. Do not rely on it to judge the website, number or statement it describes.",
  },

  errors: {
    notAuthenticated: "You need to sign in first.",
    tierRequired: "You need an invite to vote.",
    alreadyVoted: "You already voted on this claim.",
    rateLimited: "Too many requests. Please wait a bit.",
  },
} as const;
