# AG BlueMetals — Yard Operations

A React recreation of the AG BlueMetals operations app: a blue metal quarry's weighbridge, order book, credit ledger and payroll in one screen.

## What's in it

- **Dashboard**: tonnage and billing KPIs against the prior day, tonnage by material, credit exposure per account, the vehicles currently on the bridge, latest tickets and account balances (Overview / Yard / Ledger tabs).
- **Weighbridge station**: live scale reading, tare capture that opens a ticket, weigh-out with net weight, rate-card pricing, loading charge and GST, plus confirm, void and cancel.
- **Eleven record modules**: Orders, Void Orders, Customers, Materials, Rate Cards, Payments & Credit, Expenses, Employees, Attendance, Advances and Payroll. Each has KPI tiles, search, a status filter, a date range, sortable columns, create/edit/delete dialogs with validation, and running totals.
- **Profile and sign-in pages** linked from the sidebar account card.

All data is seeded in the browser (`src/data/seed.js`) and kept in memory, so a page reload restores the seed. The sign-in page is a front-end demo: it checks that both fields are filled, but it does not authenticate, store credentials or call any server.

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
  views/             Dashboard, Weighbridge, ListModule, AccountPages
  styles/            fonts, tokens, components, app layer, shared layout
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
