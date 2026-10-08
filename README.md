# SplitPay Web

Browser-first web app project for SplitPay. The goal is an installable PWA for Windows, Mac, Android, and iPhone browsers, with durable local-first ledger storage and automatic sync when connectivity returns.

## Current status

This is the initial Vite + React + TypeScript scaffold. Ledger UI, IndexedDB persistence, PWA installation/offline assets, Supabase authentication, RLS schema, and synchronization are not implemented yet.

The existing Android project remains at C:\Users\swalih\SplitPay. Its Flutter SQLite client is not assumed to work in browsers.

## Requirements

- Node.js version supported by the installed Vite release (Vite 8 requires Node.js 20.19+ or 22.12+).
- npm.

## Run locally

Run npm install, then npm run dev.

## Checks

Run npm run lint and npm run build.

## Architecture notes

See docs/web-agent-system/ for the product architecture and dynamic agent execution model, and docs/decisions/0001-web-stack.md for the initial stack decision. IndexedDB and Supabase are planned boundaries, not wired integrations yet.