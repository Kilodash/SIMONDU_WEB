---
slug: stack
title: Tech stack
role: tech-stack choices
updated: "2026-07-08T10:00:00"
---

# Tech stack

## Tech Stack

| Domain | Pilihan | Alasan |
|---|---|---|
| **Runtime** | Next.js 15 (App Router) | SSR/SSR opsional, routing file-based, ekosistem React |
| **UI** | React 18 + Tailwind CSS 3.4 | Utility-first styling, rapid prototyping |
| **Komponen** | shadcn/ui (Radix UI) | 48 komponen siap pakai, aksesibel, copy-paste pattern |
| **Chart** | Recharts | Bar + Pie chart untuk dashboard ANEV |
| **Form** | react-hook-form + zod | Validasi skema, performa re-render minimal |
| **Table** | TanStack React Table 8 | Headless, fleksibel |
| **Data Fetch** | SWR 2 + native fetch | Cache + revalidate sederhana |
| **Auth** | jose 5 (JWT HS256) | Cookie HttpOnly, tanpa database user |
| **Database** | Supabase PostgreSQL (via db.js adapter) | Sebelumnya MongoDB, dikembalikan ke Supabase. Adapter meniru API MongoDB-style untuk kompatibilitas route.js |
| **Storage** | Supabase Storage | Upload dokumen follow-up |
| **Proxy** | Python FastAPI + httpx | Reverse proxy /api/* ke Next.js |
| **Test** | Playwright + pytest | E2E frontend, test backend proxy |

## Dependencies Kunci

| Package | Versi | Fungsi |
|---|---|---|
| next | 15.5 | Framework |
| react / react-dom | 18.3 | UI library |
| @supabase/supabase-js | 2.45 | Database + Storage client |
| jose | 5 | JWT signing/verification |
| tailwindcss | 3.4 | Utility CSS |
| zod | 3 | Schema validation |
| recharts | 2 | Chart library |
| framer-motion | 11 | Animasi |
| date-fns | 4 | Date formatting |
| sonner | 2 | Toast notifications |
| @playwright/test | 1.61 | E2E testing |
| uuid | - | ID generation |
| axios | - | HTTP client (Gajamada calls) |
