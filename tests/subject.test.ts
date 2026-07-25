import { describe, it, expect } from "vitest";
import { normaliseSubject, subjectKey, detectKind } from "../shared/subject";

describe("subject normalisation (§21)", () => {
  it("two spellings of the same URL produce the same subject key", () => {
    expect(subjectKey("url", "https://WWW.Example.com/?utm_source=x")).toBe(
      subjectKey("url", "example.com"),
    );
  });

  it("strips tracking params, sorts survivors, drops www and trailing slash", () => {
    expect(normaliseSubject("url", "http://www.Example.com/path?b=2&a=1&utm_medium=m#frag")).toBe(
      "https://example.com/path?a=1&b=2",
    );
    expect(normaliseSubject("url", "https://www.Example.com/deal/")).toBe(
      "https://example.com/deal",
    );
  });

  it("phone numbers normalise to E.164", () => {
    expect(normaliseSubject("phone", "+92 300 1234567")).toBe("+923001234567");
    expect(normaliseSubject("phone", "0300 1234567")).toBe("+923001234567");
  });

  it("text lowercases, collapses whitespace, trims punctuation", () => {
    expect(normaliseSubject("text", '  "Free   iPhone!!"  ')).toBe("free iphone");
  });

  it("detectKind guesses url / phone / text", () => {
    expect(detectKind("example.com/offer")).toBe("url");
    expect(detectKind("https://x.com")).toBe("url");
    expect(detectKind("+92 300 1234567")).toBe("phone");
    expect(detectKind("you won a prize")).toBe("text");
  });
});
