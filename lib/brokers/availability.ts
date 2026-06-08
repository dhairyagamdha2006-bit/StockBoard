import "server-only";
import type { BrokerName } from "@/types";
import { BROKER_SUPPORT, ALL_BROKERS, type BrokerSupport } from "./support";
import { isBrokerConfigured, isRobinhoodExperimentalEnabled } from "@/lib/env";

export interface BrokerAvailability extends BrokerSupport {
  /** CSV import is always available — it's the reliable default. */
  csvAvailable: boolean;
  /** True if this broker's OAuth is configured on this deployment. */
  oauthConfigured: boolean;
  /** True if Robinhood's experimental login is enabled on this deployment. */
  experimentalEnabled: boolean;
}

/** Resolves a broker's real capabilities on THIS deployment (static + env). */
export function getBrokerAvailability(broker: BrokerName): BrokerAvailability {
  const support = BROKER_SUPPORT[broker];

  const oauthConfigured =
    support.hasOAuth && (broker === "schwab" || broker === "etrade")
      ? isBrokerConfigured(broker)
      : false;

  const experimentalEnabled = support.hasExperimentalLogin ? isRobinhoodExperimentalEnabled() : false;

  return {
    ...support,
    csvAvailable: true, // every broker supports CSV import
    oauthConfigured,
    experimentalEnabled,
  };
}

export function getAllBrokerAvailability(): BrokerAvailability[] {
  return ALL_BROKERS.map(getBrokerAvailability);
}
