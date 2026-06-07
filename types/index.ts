export type BrokerName = "robinhood" | "fidelity" | "etrade" | "schwab";
export type AssetType = "stock" | "etf" | "crypto" | "option";
export type TransactionType = "buy" | "sell" | "dividend" | "split";
export type ConnectionType = "oauth" | "credentials" | "csv";
export type AccountStatus = "active" | "expired" | "error" | "disconnected";

export interface BrokerAccount {
  id: string;
  user_id: string;
  broker_name: BrokerName;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  connection_type: ConnectionType;
  status: AccountStatus;
  last_synced_at?: string | null;
  created_at: string;
}

export interface Holding {
  id: string;
  user_id: string;
  account_id: string;
  ticker: string;
  company_name?: string | null;
  shares: number;
  average_cost?: number | null;
  current_price?: number | null;
  market_value?: number | null;
  day_change?: number | null;
  day_change_pct?: number | null;
  total_gain_loss?: number | null;
  total_gain_loss_pct?: number | null;
  sector?: string | null;
  asset_type: AssetType;
  updated_at: string;
  created_at: string;
  broker_accounts?: BrokerAccount;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  ticker: string;
  transaction_type: TransactionType;
  shares?: number | null;
  price?: number | null;
  total_amount?: number | null;
  fees: number;
  transaction_date: string;
  created_at: string;
  broker_accounts?: BrokerAccount;
}

export interface PriceCache {
  ticker: string;
  current_price?: number | null;
  previous_close?: number | null;
  day_change?: number | null;
  day_change_pct?: number | null;
  updated_at: string;
}

export interface PortfolioSnapshot {
  id: string;
  user_id: string;
  total_value: number;
  total_gain_loss: number;
  snapshot_date: string;
  created_at: string;
}

export interface PortfolioStats {
  totalValue: number;
  totalInvested: number;
  totalReturn: number;
  totalReturnPct: number;
  dayGain: number;
  dayGainPct: number;
  positionCount: number;
}

export interface BrokerBreakdownItem {
  broker: BrokerName;
  value: number;
  percentage: number;
  isConnected: boolean;
  lastSynced?: string | null;
}

export interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface AlpacaSnapshot {
  symbol: string;
  latestTrade: { p: number; t: string };
  latestQuote: { ap: number; bp: number };
  minuteBar: AlpacaBar;
  dailyBar: AlpacaBar;
  prevDailyBar: AlpacaBar;
}

export interface BrokerConfig {
  name: BrokerName;
  displayName: string;
  initials: string;
  bgColor: string;
  textColor: string;
  dotColor: string;
}

export const BROKER_CONFIGS: Record<BrokerName, BrokerConfig> = {
  robinhood: {
    name: "robinhood",
    displayName: "Robinhood",
    initials: "RH",
    bgColor: "#fee2e2",
    textColor: "#dc2626",
    dotColor: "#dc2626",
  },
  fidelity: {
    name: "fidelity",
    displayName: "Fidelity",
    initials: "FI",
    bgColor: "#dbeafe",
    textColor: "#1d4ed8",
    dotColor: "#1d4ed8",
  },
  etrade: {
    name: "etrade",
    displayName: "E*TRADE",
    initials: "ET",
    bgColor: "#ffedd5",
    textColor: "#c2410c",
    dotColor: "#c2410c",
  },
  schwab: {
    name: "schwab",
    displayName: "Charles Schwab",
    initials: "CS",
    bgColor: "#ede9fe",
    textColor: "#7c3aed",
    dotColor: "#7c3aed",
  },
};
