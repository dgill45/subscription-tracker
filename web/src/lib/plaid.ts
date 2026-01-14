import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || "sandbox";

if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
  console.warn(
    "Plaid credentials not configured. Set PLAID_CLIENT_ID and PLAID_SECRET in environment variables."
  );
}

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": PLAID_CLIENT_ID || "",
      "PLAID-SECRET": PLAID_SECRET || "",
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

// Default products to request from Plaid
export const PLAID_PRODUCTS: Products[] = [Products.Transactions];

// Supported countries
export const PLAID_COUNTRY_CODES: CountryCode[] = [CountryCode.Us];

// Webhook URL for receiving transaction updates
export const PLAID_WEBHOOK_URL = process.env.PLAID_WEBHOOK_URL;

// Table name for Plaid connections
export const PLAID_CONNECTIONS_TABLE = process.env.PLAID_CONNECTIONS_TABLE || "PlaidConnections";

// Table name for transactions
export const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE || "Transactions";
