import type { BrokerName } from "@/types";
import { parseFidelity } from "./fidelity";
import { parseSchwab } from "./schwab";
import { parseEtrade } from "./etrade";
import { parseRobinhood } from "./robinhood";
import { parseGeneric } from "./generic";
import { CsvParseError, type CsvParseResult } from "./shared";

export { CsvParseError } from "./shared";
export type { CsvParseResult, NormalizedHolding } from "./shared";

const BROKER_PARSERS: Record<BrokerName, (content: string) => CsvParseResult> = {
  fidelity: parseFidelity,
  schwab: parseSchwab,
  etrade: parseEtrade,
  robinhood: parseRobinhood,
};

/**
 * Parse a broker CSV. Tries the broker-specific parser first; if it can't find
 * holdings, falls back to the generic column-detection parser and adds a warning.
 * Throws CsvParseError with a user-friendly message if nothing can be parsed.
 */
export function parseBrokerCsv(broker: BrokerName, content: string): CsvParseResult {
  const specific = BROKER_PARSERS[broker];

  try {
    return specific(content);
  } catch (specificErr) {
    // Fall back to generic parsing.
    try {
      const generic = parseGeneric(content);
      return {
        ...generic,
        warnings: [
          `We couldn't read this as a standard ${broker} export, so we used flexible column detection. Please double-check the preview.`,
          ...generic.warnings,
        ],
      };
    } catch (genericErr) {
      // Surface the most specific, user-friendly message we have.
      const msg =
        genericErr instanceof CsvParseError
          ? genericErr.message
          : specificErr instanceof CsvParseError
            ? specificErr.message
            : "We couldn't read this CSV. Make sure it has Symbol, Quantity, and Price columns.";
      throw new CsvParseError(msg);
    }
  }
}
