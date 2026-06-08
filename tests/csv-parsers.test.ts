import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseFidelity } from "@/lib/brokers/csv-parsers/fidelity";
import { parseSchwab } from "@/lib/brokers/csv-parsers/schwab";
import { parseEtrade } from "@/lib/brokers/csv-parsers/etrade";
import { parseRobinhood } from "@/lib/brokers/csv-parsers/robinhood";
import { parseGeneric } from "@/lib/brokers/csv-parsers/generic";
import { parseBrokerCsv, CsvParseError } from "@/lib/brokers/csv-parsers";

const fixture = (name: string) => readFileSync(join(process.cwd(), "tests/fixtures", name), "utf8");

describe("Fidelity parser", () => {
  it("parses positions, skips cash + totals", () => {
    const { holdings } = parseFidelity(fixture("fidelity-positions.csv"));
    expect(holdings.map((h) => h.ticker).sort()).toEqual(["AAPL", "VOO"]);
    const aapl = holdings.find((h) => h.ticker === "AAPL")!;
    expect(aapl.shares).toBe(10);
    expect(aapl.average_cost).toBeCloseTo(165.2);
    expect(aapl.current_price).toBeCloseTo(212.45);
  });
});

describe("Schwab parser", () => {
  it("strips preamble, converts total cost basis to per-share, skips cash/total", () => {
    const { holdings } = parseSchwab(fixture("schwab-positions.csv"));
    expect(holdings.map((h) => h.ticker).sort()).toEqual(["AMZN", "SCHD"]);
    const amzn = holdings.find((h) => h.ticker === "AMZN")!;
    expect(amzn.shares).toBe(30);
    expect(amzn.average_cost).toBeCloseTo(3867 / 30);
    expect(amzn.asset_type).toBe("stock");
    expect(holdings.find((h) => h.ticker === "SCHD")!.asset_type).toBe("etf");
  });
});

describe("E*TRADE parser", () => {
  it("uses Price Paid as per-share cost and skips TOTAL", () => {
    const { holdings } = parseEtrade(fixture("etrade-positions.csv"));
    expect(holdings.map((h) => h.ticker).sort()).toEqual(["MSFT", "TSLA"]);
    expect(holdings.find((h) => h.ticker === "MSFT")!.average_cost).toBeCloseTo(310.5);
  });
});

describe("Robinhood parser", () => {
  it("parses the simple template", () => {
    const { holdings } = parseRobinhood(fixture("robinhood-positions.csv"));
    expect(holdings.map((h) => h.ticker).sort()).toEqual(["AAPL", "NVDA"]);
  });
});

describe("Generic parser", () => {
  it("detects common column names and handles quoted commas", () => {
    const { holdings } = parseGeneric(fixture("generic-positions.csv"));
    expect(holdings.map((h) => h.ticker).sort()).toEqual(["GOOG", "NFLX"]);
    const nflx = holdings.find((h) => h.ticker === "NFLX")!;
    expect(nflx.company_name).toBe("Netflix, Inc.");
    expect(nflx.average_cost).toBeCloseTo(1200 / 3);
  });
});

describe("parseBrokerCsv orchestration", () => {
  it("uppercases tickers and returns the parser used", () => {
    const result = parseBrokerCsv("fidelity", fixture("fidelity-positions.csv"));
    expect(result.parser).toBe("fidelity");
    expect(result.holdings.every((h) => h.ticker === h.ticker.toUpperCase())).toBe(true);
  });

  it("falls back to generic with a warning when broker parse finds nothing", () => {
    // A Robinhood-style generic file fed as 'schwab' should still parse via fallback.
    const result = parseBrokerCsv("schwab", fixture("generic-positions.csv"));
    expect(result.holdings.length).toBe(2);
    expect(result.warnings.some((w) => /flexible column detection/i.test(w))).toBe(true);
  });

  it("throws a friendly CsvParseError for an unparseable file", () => {
    expect(() => parseBrokerCsv("fidelity", fixture("invalid-positions.csv"))).toThrow(CsvParseError);
    expect(() => parseBrokerCsv("fidelity", fixture("invalid-positions.csv"))).toThrow(/Symbol\/Ticker/i);
  });
});
