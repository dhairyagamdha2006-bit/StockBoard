import "server-only";
import type { BrokerName } from "@/types";
import { BROKER_SUPPORT, ALL_BROKERS, type BrokerSupport } from "./support";
import { isBrokerConfigured, isRobinhoodExperimentalEnabled } from "@/lib/env";

export interface BrokerAvailability extends BrokerSupport {
  /** True if this deployment can actually use the integration right now. */
  available: boolean;
  /** Human-readable reason when not available. */
  unavailableReason?: string;
}

/** Resolves a broker's real availability on THIS deployment (static + env). */
export function getBrokerAvailability(broker: BrokerName): BrokerAvailability {
  const support = BROKER_SUPPORT[broker];

  switch (broker) {
    case "fidelity":
      // CSV import always works — no credentials required.
      return { ...support, available: true };

    case "schwab":
    case "etrade": {
      const ok = isBrokerConfigured(broker);
      return {
        ...support,
        available: ok,
        unavailableReason: ok
          ? undefined
          : `${support.displayName} OAuth is not configured on this deployment.`,
      };
    }

    case "robinhood": {
      const ok = isRobinhoodExperimentalEnabled();
      return {
        ...support,
        available: ok,
        unavailableReason: ok
          ? undefined
          : "Robinhood is experimental and disabled. Set ENABLE_ROBINHOOD_EXPERIMENTAL=true to enable (not recommended for real accounts).",
      };
    }

    default:
      return { ...support, available: false, unavailableReason: "Unknown broker." };
  }
}

export function getAllBrokerAvailability(): BrokerAvailability[] {
  return ALL_BROKERS.map(getBrokerAvailability);
}
