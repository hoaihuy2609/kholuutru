# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
PhysiVault is a client-side React SPA (Vite + TypeScript + Tailwind CSS) for Vietnamese Physics education. There is no backend server to run; the app connects to external Supabase, Telegram (via Cloudflare Worker proxy), and optional Gemini/GitHub APIs.

### Running services
- **Dev server:** `npm run dev` — starts Vite on `http://localhost:3000` (binds `0.0.0.0`).
- No local database or backend process is needed. All data flows through Supabase and Telegram APIs configured via `.env`.

### Key commands
| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` |
| Tests | `npm run test` (vitest, single run) |
| Tests (watch) | `npm test:watch` |
| Build | `npm run build` |
| Preview prod | `npm run preview` |

### Environment variables
Copy `.env.example` to `.env`. Required keys: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TELEGRAM_CHAT_ID`, `VITE_CLOUDFLARE_PROXY_URL`, `VITE_ADMIN_KEY`, `VITE_SYSTEM_SALT`, `VITE_XOR_KEY`, `VITE_AES_KEY`. The app loads and navigates with placeholder values, but backend features (activation, sync, exams) require real credentials.

### Gotchas
- There is no ESLint configuration in this repo. Linting is not available as a separate script.
- The project uses npm (not pnpm/yarn). A `package-lock.json` is committed.
- Vite dev server port is hardcoded to 3000 in `vite.config.ts`.
- The `@/` path alias resolves to the repo root (not `src/`).
