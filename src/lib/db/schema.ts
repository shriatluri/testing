import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  plaidAccessToken: text("plaid_access_token"),
  plaidItemId: text("plaid_item_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  plaidAccountId: text("plaid_account_id").notNull(),
  name: text("name").notNull(),
  type: text("type"),
  balanceCurrent: real("balance_current"),
  balanceAvailable: real("balance_available"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
});

export const holdings = sqliteTable("holdings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  quantity: real("quantity").notNull(),
  costBasis: real("cost_basis"),
  currentPrice: real("current_price"),
  currentValue: real("current_value"),
  snapshotDate: text("snapshot_date").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  generatedAt: integer("generated_at", { mode: "timestamp" }).notNull(),
  portfolioSummary: text("portfolio_summary").notNull(),
  contextMarkdown: text("context_markdown").notNull(),
  emailSentAt: integer("email_sent_at", { mode: "timestamp" }),
});

export const stockNarratives = sqliteTable("stock_narratives", {
  id: text("id").primaryKey(),
  reportId: text("report_id")
    .notNull()
    .references(() => reports.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  ticker: text("ticker").notNull(),
  narrative: text("narrative").notNull(),
  signal: text("signal").notNull(), // "BUY" | "SELL" | "HOLD"
  signalRationale: text("signal_rationale").notNull(),
  researchSources: text("research_sources").notNull(), // JSON array
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
