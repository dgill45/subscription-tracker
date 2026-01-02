# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A subscription tracking application built with Next.js 15 that helps users manage recurring subscriptions. The app features CSV import functionality to detect and add recurring charges from bank statements.

## Development Commands

```bash
# Development
cd web
npm run dev          # Start dev server with Turbopack (http://localhost:3000)
npm run build        # Production build with Turbopack
npm start            # Start production server
npm run lint         # Run ESLint

# Root level has minimal deps (just clsx)
```

## Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Runtime**: Node.js (not Edge)
- **Database**: AWS DynamoDB
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript (strict mode)

### Project Structure

```
web/
├── src/
│   ├── app/              # Next.js App Router pages & API routes
│   │   ├── subscriptions/   # Subscription CRUD pages
│   │   ├── import/          # CSV import page
│   │   └── api/             # REST API endpoints
│   ├── components/       # React components
│   ├── lib/              # Utilities & shared types
│   │   ├── types.ts         # Core domain types & validation
│   │   └── importUtils.ts   # CSV parsing & recurring charge detection
│   └── server/           # Server-side only code
│       └── storage.ts       # DynamoDB operations
├── server/
│   └── dynamo.ts         # DynamoDB client config
```

**Important**: Note the two `server/` directories:
- `web/src/server/` - Contains storage functions using `server-only` package
- `web/server/` - Contains DynamoDB client configuration

### Data Model

The app uses a single DynamoDB table with this schema:

```typescript
{
  userId: string    // Partition key (currently hardcoded to "demo-user")
  id: string        // Sort key (UUID)
  merchant: string
  amount: number    // Positive USD amount
  period: "monthly" | "annual"
  nextBillDate: string  // ISO date (YYYY-MM-DD)
  notes?: string
  status: "active" | "canceled"
  createdAt: string     // ISO timestamp
  updatedAt: string     // ISO timestamp
}
```

### Storage Layer (web/src/server/storage.ts)

All DynamoDB operations go through these functions:
- `listSubscriptions()` - Query all subscriptions for demo user
- `createSubscription(input)` - Create new subscription with validation
- `getSubscriptionById(id)` - Get single subscription
- `updateSubscription(id, updates)` - Partial update with auto-updatedAt
- `deleteSubscription(id)` - Delete subscription

Storage functions import from `../../server/dynamo` for the DynamoDB client.

### CSV Import Feature

The import flow (web/src/app/import/page.tsx):

1. **Parse CSV** - Expects columns: Date, Description, Amount
2. **Normalize merchants** - Strips store numbers, IDs, corporate suffixes
3. **Detect recurring** - Clusters transactions by merchant and similar amounts (±$1)
4. **Estimate cadence** - Analyzes date gaps to determine weekly/monthly/annual/unknown
5. **Deduplicate** - Checks existing subscriptions by normalized merchant name before adding

Key functions in `web/src/lib/importUtils.ts`:
- `parseCsv()` - Parse CSV text to Transaction[]
- `normalizeMerchant()` - Clean merchant names for matching
- `detectRecurring()` - Find recurring charges and suggest subscriptions
- `estimateCadence()` - Determine billing frequency from date gaps

### API Routes

All routes use `runtime = "nodejs"` and `dynamic = "force-dynamic"`:

- `GET /api/subscriptions` - List all subscriptions
- `POST /api/subscriptions` - Create subscription (validates input)
- `GET /api/subscriptions/[id]` - Get single subscription
- `PATCH /api/subscriptions/[id]` - Update subscription
- `DELETE /api/subscriptions/[id]` - Delete subscription
- `POST /api/import` - Analyze CSV and return subscription suggestions

### Environment Variables

Required in `web/.env.local`:
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
SUBSCRIPTIONS_TABLE=Subscriptions
```

### Key Patterns

1. **Server Components by Default** - Pages fetch data server-side (e.g., subscriptions/page.tsx)
2. **Client Components for Interactivity** - Use 'use client' for forms and import page
3. **Path Aliases** - `@/*` maps to `web/src/*`
4. **Validation** - `validateSubscriptionInput()` in lib/types.ts before DB writes
5. **Demo User** - Currently hardcoded to `DEMO_USER_ID = "demo-user"` (auth not implemented)

### Import Deduplication Logic

When adding subscriptions from CSV import (web/src/app/import/page.tsx:118-181):
- Fetches existing subscriptions from API
- Normalizes merchant names to lowercase for comparison
- Skips creating subscriptions if normalized merchant name already exists
- Reports count of created vs skipped (duplicate) subscriptions

## Testing

No test framework currently configured.
