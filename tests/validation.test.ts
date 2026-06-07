import { describe, it, expect } from "vitest";
import {
  isBrokerName,
  isValidTicker,
  sanitizeTickers,
  isNonEmptyString,
  isBoundedString,
  isValidMfaCode,
} from "@/lib/utils/validation";

describe("isBrokerName", () => {
  it("accepts known brokers", () => {
    expect(isBrokerName("robinhood")).toBe(true);
    expect(isBrokerName("schwab")).toBe(true);
  });
  it("rejects unknown / non-strings", () => {
    expect(isBrokerName("webull")).toBe(false);
    expect(isBrokerName(42)).toBe(false);
    expect(isBrokerName(null)).toBe(false);
  });
});

describe("isValidTicker", () => {
  it("accepts normal and dotted tickers", () => {
    expect(isValidTicker("AAPL")).toBe(true);
    expect(isValidTicker("BRK.B")).toBe(true);
    expect(isValidTicker("aapl")).toBe(true); // uppercased before test
  });
  it("rejects empty, too long, or unsafe characters", () => {
    expect(isValidTicker("")).toBe(false);
    expect(isValidTicker("TOOLONGTICKER")).toBe(false);
    expect(isValidTicker("AB;DROP")).toBe(false);
    expect(isValidTicker(123)).toBe(false);
  });
});

describe("sanitizeTickers", () => {
  it("dedupes, uppercases, and drops invalid entries", () => {
    expect(sanitizeTickers("aapl,AAPL, msft ,bad;ticker,")).toEqual(["AAPL", "MSFT"]);
  });
  it("returns empty array for null/empty", () => {
    expect(sanitizeTickers(null)).toEqual([]);
    expect(sanitizeTickers("")).toEqual([]);
  });
  it("respects the max cap", () => {
    const many = Array.from({ length: 50 }, (_, i) => `T${i}`).join(",");
    expect(sanitizeTickers(many, 10)).toHaveLength(10);
  });
});

describe("string guards", () => {
  it("isNonEmptyString", () => {
    expect(isNonEmptyString("x")).toBe(true);
    expect(isNonEmptyString("   ")).toBe(false);
    expect(isNonEmptyString(0)).toBe(false);
  });
  it("isBoundedString", () => {
    expect(isBoundedString("hello", 10)).toBe(true);
    expect(isBoundedString("hello", 3)).toBe(false);
    expect(isBoundedString("", 3)).toBe(false);
  });
});

describe("isValidMfaCode", () => {
  it("accepts 4-8 digit codes", () => {
    expect(isValidMfaCode("123456")).toBe(true);
    expect(isValidMfaCode("1234")).toBe(true);
  });
  it("rejects non-numeric or wrong length", () => {
    expect(isValidMfaCode("12")).toBe(false);
    expect(isValidMfaCode("12345678901")).toBe(false);
    expect(isValidMfaCode("abcd")).toBe(false);
  });
});
