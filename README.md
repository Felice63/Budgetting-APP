# Budgeting PWA

A mobile-friendly budget tracker built with vanilla JavaScript, Web Components, Shadow DOM, and IndexedDB. The app is designed as a lightweight PWA with no framework and no build step.

## Overview

The interface is split into three areas:

- A left sidebar for transaction entry and daily details
- A wide central calendar for browsing and adding entries by date
- A right rail that tracks weekly balance and month-end outcome based on the starting balance

Transactions can be added multiple times on the same date. Daily rows show a compact preview of entries, while the balance math is summarized in the weekly rail and the month-end card.

## Features

- **Monthly Calendar**: Browse months, select a day, and review all transactions for that date.
- **Multi-Entry Days**: Add more than one income or expense entry to the same day.
- **Transaction Management**: Add, edit, and delete income or expense entries from the sidebar or the day detail view.
- **Starting Balance Input**: Enter a monthly starting balance at the top of the calendar.
- **Weekly Balance Rail**: Review week-by-week running balance cards driven by the month’s starting balance.
- **Month-End Summary**: See the ending balance plus surplus, deficit, or balance status for the month.
- **Selected-Day Detail Panel**: Click a day to see the full transaction list below the calendar grid.
- **Persistent View State**: The selected date and monthly starting balance are stored in IndexedDB.
- **Resilient Persistence**: If stored settings cannot be loaded or saved, the app falls back to defaults without blocking the UI.
- **Expanded Calendar Layout**: The calendar column is intentionally wider than the side panels for better month visibility.
- **PWA Ready**: Includes a manifest, icons, and a service worker for basic offline caching.
- **Vanilla Stack**: Uses only native browser APIs and custom elements.

## How It Works

- The sidebar form writes transactions into IndexedDB.
- The calendar groups all transactions by date and previews them in the date grid.
- The starting balance is read from IndexedDB for the active month.
- Weekly balances are calculated from the starting balance plus the transactions that fall within each week.
- The month-end card compares the ending balance against the starting balance to determine surplus, deficit, or balance.

## Technology Stack

- **JavaScript**: Vanilla ES modules and custom elements
- **HTML**: Semantic HTML5 shell in [src/index.html](src/index.html)
- **CSS**: Component-scoped styles inside Shadow DOM
- **Architecture**: Web Components in [src/components/](src/components/)
- **Storage**: IndexedDB in [src/storage/db.js](src/storage/db.js)
- **PWA Shell**: Manifest and service worker in [src/manifest.json](src/manifest.json) and [src/sw.js](src/sw.js)

## Project Structure

- [src/components/budget-app.js](src/components/budget-app.js): main application shell, sidebar, and selected-day state
- [src/components/budget-calendar/budget-calendar.js](src/components/budget-calendar/budget-calendar.js): calendar UI, weekly balance rail, and month-end summary
- [src/storage/db.js](src/storage/db.js): IndexedDB helpers for add, update, delete, query, and settings operations
- [src/icons/](src/icons/): SVG app icons referenced by the manifest
- [src/index.html](src/index.html): application entry point
- [vercel.json](vercel.json): rewrite rules for serving the app entry point

## Getting Started

This project is plain static web code. You do not need a bundler or install step.

1. Open the project in VS Code.
2. Serve the `src/` directory with any static server.
3. Open the served page in a browser.

If you are using VS Code Live Server or another local static server, point it at the `src/` folder so the service worker and manifest resolve correctly.

## Usage

- Use the sidebar form to add income or expense entries.
- Pick a day in the calendar to view or edit that day’s transactions.
- Enter a starting balance in the month header to update the weekly balance rail and month-end summary.
- Navigate between months with the calendar controls.

## Data and Persistence

- Transaction records are stored in an IndexedDB object store named `transactions`.
- App settings such as the selected date and starting balance are stored in a `settings` object store.
- The app preserves the last selected date and monthly starting balance on reload.
- Storage failures fall back safely to default values so the UI still loads.

## Deployment

This application is configured for deployment to [Vercel](https://vercel.com/). Connect the repository to a Vercel project and the rewrite rules in [vercel.json](vercel.json) will route requests to the app under `src/`.

## Notes

- The calendar column is intentionally wider than the side panels so the month grid has more breathing room.
- The monthly surplus or deficit is based on the difference between the starting balance and ending balance.
- Multiple transactions on the same date are supported and displayed in both the calendar preview and the day detail panel.
