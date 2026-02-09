# GUincoin Test Coverage Analysis

## Current State

| Metric | Value |
|--------|-------|
| Backend source files | 53 |
| Backend test files | **0** (only a smoke test script) |
| Frontend source files | 47 |
| Frontend test files | **1** (CampaignStudio only) |
| Existing tests | 31 passing |
| Test framework (frontend) | Vitest + React Testing Library |
| Test framework (backend) | **None configured** |

The codebase has **~100 source files** and only **1 test file** covering a single component
(CampaignStudio). The backend has zero unit tests. This represents a significant coverage
gap for a financial rewards platform that processes transactions and manages balances.

---

## Priority 1 (Critical) - Backend Financial Logic

These services handle money-equivalent operations. Bugs here directly cause incorrect
balances, lost coins, or over-spending.

### 1.1 TransactionService (`backend/src/services/transactionService.ts`)

**Why it matters:** Core financial engine. Every coin award, transfer, purchase, and wellness
reward flows through this service.

**What to test:**
- Balance direction logic per transaction type (awards increase, purchases decrease)
- Posting a pending transaction correctly updates the account balance
- Rejecting a transaction does not alter the balance
- Edge case: transaction type not matching any condition results in zero balance change
  (current silent bug - should be caught by a test)
- Edge case: posting an already-posted transaction is rejected
- Edge case: negative balance after posting (no guard exists today)
- Pagination and filtering in `getTransactionHistory()`

**Estimated tests:** 15-20

### 1.2 AllotmentService (`backend/src/services/allotmentService.ts`)

**Why it matters:** Controls how much managers can award. Bugs allow over-spending the
company budget.

**What to test:**
- Period boundary calculation (monthly and quarterly)
- `canAward()` correctly checks remaining budget
- `awardCoins()` refuses when budget exceeded
- `getCurrentAllotment()` creates a new allotment if none exists for the period
- `getCurrentAllotment()` reuses existing allotment within same period
- Quarter calculation at year boundaries (Q4 to Q1 rollover)
- `depositAllotment()` increases allotment correctly
- Race condition: two concurrent `awardCoins()` calls both pass `canAward()` check

**Estimated tests:** 15-20

### 1.3 PendingTransferService (`backend/src/services/pendingTransferService.ts`)

**Why it matters:** Handles deferred peer-to-peer transfers for unregistered recipients.
Errors leave coins in limbo.

**What to test:**
- `createPendingTransfer()` deducts from sender immediately
- `claimPendingTransfers()` credits recipient and posts both sides
- `cancelPendingTransfer()` refunds sender and only allows the original sender
- Email normalization (case insensitivity)
- Edge case: claiming when recipient has no account returns empty
- Edge case: cancelling an already-claimed transfer is rejected
- Edge case: email service failure does not block the transfer

**Estimated tests:** 12-15

### 1.4 AccountService (`backend/src/services/accountService.ts`)

**Why it matters:** Manages account creation and lookup. Incorrect behavior causes orphaned
employees or duplicate accounts.

**What to test:**
- `getOrCreateAccount()` creates account with zero balance for new employees
- `getOrCreateAccount()` returns existing account for known employees
- Race condition: concurrent calls for the same user

**Estimated tests:** 5-8

---

## Priority 2 (High) - Backend Middleware & Error Handling

Middleware protects every route. Gaps here are security and reliability risks.

### 2.1 Auth Middleware (`backend/src/middleware/auth.ts`)

**What to test:**
- `requireAuth` returns 401 when no user on request
- `requireAuth` calls `next()` when user exists
- `requireManager` returns 403 for non-managers
- `requireManager` passes for managers
- `requireAdmin` - currently unimplemented (test should document this gap)

**Estimated tests:** 8-10

### 2.2 Error Handler (`backend/src/middleware/errorHandler.ts`)

**What to test:**
- `AppError` instances preserve status code and message
- `ZodError` instances return 400 with validation details
- Prisma `P2002` (unique constraint) maps to 409
- Prisma `P2025` (not found) maps to 404
- Unknown errors default to 500
- Request ID generation and propagation
- Development mode exposes stack traces; production does not
- `notFoundHandler` returns 404 for unmatched routes

**Estimated tests:** 10-12

### 2.3 Validation Middleware (`backend/src/middleware/validation.ts`)

**What to test:**
- Valid request body/query/params passes through
- Invalid body returns 400 with Zod error details
- Non-Zod errors are forwarded to next middleware

**Estimated tests:** 5-7

### 2.4 Rate Limiter (`backend/src/middleware/rateLimiter.ts`)

**What to test:**
- Requests under limit pass through
- Request at limit returns 429
- Counter resets after window expires
- Different IPs tracked independently
- Memory growth behavior over time (regression test for the memory leak)

**Estimated tests:** 6-8

### 2.5 Error Utilities (`backend/src/utils/errors.ts`)

**What to test:**
- `AppError` sets `expose` to true for 4xx, false for 5xx
- `isAppError()` type guard returns correct results
- `normalizePrismaError()` maps known codes correctly
- `asAppError()` wraps unknown errors with 500 status

**Estimated tests:** 8-10

---

## Priority 3 (High) - Frontend Pages & Contexts

These are user-facing components with complex state logic but zero test coverage.

### 3.1 AccountContext (`frontend/src/contexts/AccountContext.tsx`)

**What to test:**
- Default account mode is 'personal'
- `setAccountMode()` persists to localStorage
- Mode resets to 'personal' when `isManager` becomes false
- Hook throws when used outside provider

**Estimated tests:** 5-7

### 3.2 ThemeContext (`frontend/src/contexts/ThemeContext.tsx`)

**What to test:**
- Fetches active campaign on mount
- Falls back to `DEFAULT_THEME` on API error
- Cache expiry logic (5-minute window)
- CSS variables applied to document root
- `daysRemaining` calculation for active campaigns

**Estimated tests:** 8-10

### 3.3 Dashboard Page (`frontend/src/pages/Dashboard.tsx`)

**What to test:**
- Parallel data loading (user, balance, transactions, goals)
- 401 response redirects to /login
- Partial API failures still render available data
- Goal deletion with confirmation
- Confetti fires only once per session on achievement
- Active goals filtered correctly

**Estimated tests:** 10-12

### 3.4 Transfers Page (`frontend/src/pages/Transfers.tsx`)

**What to test:**
- Parallel data loading on mount
- Transfer submission triggers API call and data reload
- Cancel pending transfer with confirmation
- 401 redirect to /login
- Empty state when no transfers exist

**Estimated tests:** 8-10

### 3.5 ManagerPortal Page (`frontend/src/pages/ManagerPortal.tsx`)

**What to test:**
- Non-manager user redirected to /dashboard
- Allotment and award history display
- Award submission triggers API call and data reload
- 401 redirect to /login

**Estimated tests:** 6-8

### 3.6 Login Page (`frontend/src/pages/Login.tsx`)

**What to test:**
- Already-authenticated user redirected to /dashboard
- Google login button sets `window.location.href`
- Auth check failure renders login form

**Estimated tests:** 3-5

### 3.7 App Router (`frontend/src/App.tsx`)

**What to test:**
- All routes render correct page components
- Root path redirects to /dashboard
- ErrorBoundary wraps entire app

**Estimated tests:** 5-7

---

## Priority 4 (Medium) - Backend Route Handlers

Route handlers contain request parsing, authorization checks, and response formatting.
Testing these provides integration-level confidence.

### 4.1 Transfers Route (`backend/src/routes/transfers.ts`)

**What to test:**
- POST /api/transfers validates required fields
- Cannot transfer to self
- Cannot transfer negative or zero amounts
- Insufficient balance returns 400
- Successful transfer returns 201

### 4.2 Manager Route (`backend/src/routes/manager.ts`)

**What to test:**
- Award endpoint validates employee email and amount
- Non-manager gets 403
- Award exceeding allotment returns 400

### 4.3 Wellness Route (`backend/src/routes/wellness.ts`)

**What to test:**
- Submission with file upload
- Duplicate submission prevention
- Admin approval/rejection flow

### 4.4 Store Route (`backend/src/routes/store.ts`)

**What to test:**
- Purchase with sufficient balance
- Purchase with insufficient balance
- Wishlist and goal operations

### 4.5 Auth Route (`backend/src/routes/auth.ts`)

**What to test:**
- Google OAuth callback handling
- Session creation and destruction
- /me endpoint returns current user

**Estimated tests (all routes):** 30-40

---

## Priority 5 (Medium) - Frontend Components

### 5.1 TransferForm Component

**What to test:** Form validation, submission, error display

### 5.2 AwardForm Component (Manager)

**What to test:** Employee selection, amount validation, submission

### 5.3 WellnessSubmission Components

**What to test:** File upload, task selection, submission flow

### 5.4 Dashboard Sub-components

**What to test:** Balance display, transaction list, goal progress bars

**Estimated tests (all components):** 20-30

---

## Infrastructure Recommendations

### Backend Test Setup Needed

The backend has **no test framework installed**. Before writing any backend tests:

1. Install Vitest (or Jest) + supertest for HTTP-level tests
2. Create a Prisma mock strategy (e.g., `vitest-mock-extended` or manual mocks)
3. Add `test` and `test:coverage` scripts to `backend/package.json`
4. Create a `backend/src/test/setup.ts` for shared mocks and helpers

### Dependency Injection

All backend services directly import the Prisma client, making unit testing difficult.
Consider:

- Passing the Prisma client as a constructor parameter to service classes
- Creating a test database with seeded data for integration tests
- Using `vitest-mock-extended` to mock Prisma's generated types

### CI/CD Pipeline

No CI/CD pipeline exists. Recommended additions:

- Run `npm run test:run` on every push
- Run `npm run test:coverage` and enforce minimum thresholds
- Block merges with failing tests

---

## Recommended Implementation Order

| Phase | Scope | Est. Tests | Rationale |
|-------|-------|-----------|-----------|
| 1 | Backend error utilities + middleware | ~35 | No dependencies, pure logic, immediate value |
| 2 | Backend transaction + allotment services | ~35 | Financial correctness is the highest-risk area |
| 3 | Frontend contexts + Login/App | ~25 | Foundation for all page tests |
| 4 | Frontend Dashboard + Transfers pages | ~20 | Most complex user-facing logic |
| 5 | Backend route handlers | ~35 | Integration-level coverage |
| 6 | Frontend Manager + remaining components | ~25 | Completes coverage |

**Total estimated new tests: ~175**

---

## Existing Test Quality Notes

The existing CampaignStudio test file (31 tests) is well-structured but has some issues:

- Multiple `act()` warnings from unhandled state updates in StudioProvider
- API mock for `loadInitialData` returns undefined, causing `TypeError: Cannot read
  properties of undefined (reading 'data')` errors in test output
- Some tests only verify "does not throw" rather than asserting specific behavior
  (keyboard shortcut tests)
- Layer management tests are placeholder - they test absence of elements rather than
  actual layer operations
