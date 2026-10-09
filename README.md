# AG BlueMetals — Yard Operations

A React recreation of the AG BlueMetals operations app: a blue metal quarry's weighbridge, order book, credit ledger and payroll in one screen.

## What's in it

- **Dashboard**: tonnage and billing KPIs against the prior day, tonnage by material, credit exposure per account, the vehicles currently on the bridge, latest tickets and account balances (Overview / Yard / Ledger tabs).
- **Weighbridge station**: live scale reading, tare capture that opens a ticket, weigh-out with net weight, rate-card pricing, loading charge and GST, plus confirm, void and cancel.
- **Credit parties**: everyone who takes material on credit, with owner name, address, contact and remarks. Each party has its own page with rate cards and tickets.
- **Soling suppliers**: boulder suppliers we buy from (we owe them), kept apart from credit parties; a supplier can be linked to a credit party when it is the same person, but the accounts stay separate.
- **Materials and rates**: Aggregate 1/4, 1/2, 3/4, Over, 1 1/2, M-Sand, P-Sand, Dust, Wedmix and Other (name and rate typed per ticket); Soling is purchase-only. Every rate is per ton and has a start date and optional end date. A party rate overrides the standard rate on its dates; amounts are always net tons × rate.
- **Record modules**: Orders, Void Orders, Payments & Credit, Expenses, Employees, Attendance, Advances and Payroll, each with KPI tiles, search, filters, sortable columns, create/edit/delete dialogs with validation, and running totals.
- **Account page** (`#/profile`): profile header and stats, editable account details, module access, security switches, active sessions, recent activity, and a change-password flow with strength meter and six-digit verification code.
- **Sign-in page** (`#/login`): split brand panel and glass sign-in card with email/password validation, show-password, remember-me and operator-PIN shortcut. Both pages are recreated from their own reference artifacts.

Data starts from the parties, rates and tickets in the 22 Aug and 8 Oct 2026 registers (`src/data/seed.js`) and every change is saved in this browser (localStorage key `agbm.db.v2`), so it survives a reload but is not shared between computers yet. Clearing the site data in the browser restores the starting data. The sign-in and change-password flows are front-end demos: they validate input and simulate the check, but nothing is authenticated, stored or sent to a server. The verification code is shown on screen, as in the reference.

## Tech stack

- [React 18](https://react.dev/) with plain JavaScript
- [Vite 6](https://vitejs.dev/) for the dev server and production build
- Plain CSS: design tokens, component classes and an app layer in `src/styles/`, with the Archivo variable font bundled locally
- No router or UI library; a hash route (`#/profile`, `#/login`) selects the two account pages

## Project structure

```
src/
  App.jsx            state, actions and view switch
  config.js          company name, loading charge, GST %, demo business date
  data/seed.js       seed records
  lib/               formatters, pricing/ledger rules, per-module table + form config
  components/        Sidebar, Header, Select, Panel, StatTile, Modal/Toast, …
  views/             Dashboard, Weighbridge, ListModule, Profile, Login
  styles/            fonts, tokens, components, app layer, shared layout, page styles (profile, login)
```

## Getting started

Requires Node.js 18 or newer.

```bash
npm install
```

### Development

```bash
npm run dev
```

Then open http://localhost:5173.

### Production build

```bash
npm run build
```

The optimised site is written to `dist/`. To serve it locally:

```bash
npm run preview
```

## Configuration

Edit `src/config.js` to change the company name, the loading charge retained on voids (₹1,250), the GST rate (5%) or to stop the live scale simulation.
