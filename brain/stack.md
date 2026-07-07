---
slug: stack
title: Tech stack
role: tech-stack choices
updated: "2026-07-07T20:21:15"
---

# Tech stack

| Domain | Pilihan | Alasan |
|--------|---------|--------|
| **Framework** | Next.js 15.5 | SSR/API routes terintegrasi, React 18, catch-all handler |
| **UI** | React 18 + Tailwind CSS 3.4 | Utility-first CSS, fast iteration |
| **UI Components** | Radix UI (shadcn/ui) + Lucide Icons | Headless, accessible, composable |
| **Auth** | jose JWT + cookie | Simple, no external IdP, server-side verify |
| **Database** | Supabase PostgreSQL | Managed Postgres, free tier, PostgREST |
| **DB Adapter** | Custom MongoDB-compatible (`db.js`) | No migration needed dari MongoDB, translate $in/$ne ke PostgREST |
| **State** | React useState + useSWR | Simple SPA, no global state library needed |
| **Forms** | react-hook-form + zod | Validation, type safety |
| **Charts** | Recharts | React-native, simple config |
| **Toasts** | Sonner | Lightweight, good UX |
| **Email/IMAP** | imap + mailparser | Zimbra OTP fetch |
| **Captcha Solver** | Gemini 2.5 Flash / OpenCode Vision | Vision AI untuk baca captcha ASTINA |
| **Testing** | Playwright | E2E browser testing |
| **Backend Proxy** | FastAPI (Python) | Reverse proxy :8001 ? :3000 |

## Belum Diputuskan
- State management global? Context atau Zustand?
- Migrasi penuh ke Supabase dari MongoDB adapter?
