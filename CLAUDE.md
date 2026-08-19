# Coffee Shop POS

## Project

Production-quality Coffee Shop Point of Sale system.

## Technology Stack

Frontend:
- React 19
- TypeScript
- Vite
- Tailwind CSS

Backend:
- Node.js
- Express
- TypeScript

Database:
- PostgreSQL
- Prisma ORM

Authentication:
- JWT authentication
- Server-side RBAC

## Roles

ADMIN:
- Product management
- Category management
- Product variants
- Modifiers
- Pricing
- Inventory
- Cashier management
- Orders
- Sales
- Reports
- Audit logs
- System settings
- POS

CASHIER:
- POS
- Product selection
- Variants
- Modifiers
- Cart
- Permitted discounts
- Checkout
- Payments
- Receipts
- Permitted order history

Cashiers must not access administrative APIs.

## Security

Frontend authorization is only for UX.

All authorization MUST be enforced server-side.

Never trust client-provided:

- prices
- totals
- discounts
- payment calculations
- inventory quantities
- role information

All financial calculations must be validated or recalculated on the backend.

Passwords must never be stored in plaintext.

Never expose password hashes or sensitive authentication data.

## Orders

Completed orders must preserve historical transaction data.

Order items must snapshot:

- product name
- variant
- modifiers
- unit price
- quantity
- subtotal

Changing the current product price must NEVER modify historical orders.

## Financial Transactions

Money-critical operations must use appropriate database transactions.

A completed checkout must maintain consistency between:

- order
- order items
- payment
- inventory
- audit records

Prevent duplicate transactions.

## Inventory

Inventory modifications must be recorded as inventory transactions.

Do not silently modify inventory without recording the reason.

Inventory failures must never be silently ignored.

## Development Workflow

Use the installed Everything Claude Code workflows.

Initial foundation:

/orch-build-mvp

New features:

/orch-add-feature

Defects:

/orch-fix-defect

Changes to existing features:

/orch-change-feature

Code review:

/code-review

PR review:

/review-pr

Test coverage:

/test-coverage

## Development Principles

- Do not implement unrelated features.
- Do not rewrite working code unnecessarily.
- Prefer small, reviewable changes.
- Write tests for important business logic.
- Never weaken tests to make them pass.
- Keep frontend and backend responsibilities separate.
- Use strict TypeScript.
- Validate external input.
- Preserve historical business data.

## POS UX

The cashier interface must prioritize:

- speed
- minimal clicks
- clear product selection
- clear cart state
- large usable controls
- keyboard accessibility
- fast checkout

Do not add unnecessary animations or interactions that slow down the cashier.

## Testing

Every major feature should have appropriate unit, integration, and E2E tests where applicable.

Critical workflows include:

- authentication
- RBAC
- product selection
- checkout
- payment
- inventory deduction
- historical pricing
- duplicate transaction prevention

## Commands

Development:
npm run dev

Build:
npm run build

Lint:
npm run lint

Testing will be configured during the first test-bearing phase.
