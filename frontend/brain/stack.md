---
slug: stack
title: Tech stack
role: tech-stack choices
updated: "2026-07-04T19:02:49"
---

# Tech stack

## Technology stack

| Domain | Choice | Rationale |
|---|---|---|
| Runtime / Framework | Next.js 15.5 (App Router) | React SSR framework; standalone output mode for easy deployment |
| UI library | React 18.3 | Component model; large ecosystem |
| Styling | Tailwind CSS 3.4 + tailwindcss-animate | Utility-first CSS; component consistency via shadcn/ui |
| Component primitives | Radix UI (20+ packages) | Unstyled, accessible headless components; shadcn/ui foundation |
| Icons | Lucide React | Consistent icon set; tree-shakeable |
| Charts | Recharts | Declarative React charting for ANEV dashboard (Bar, Pie) |
| Forms | react-hook-form 7 + zod 3 (validation) | Performant form management; schema validation |
| Data fetching | SWR 2 + TanStack React Query 5 | Caching and revalidation (though mostly manual fetch in current code) |
| Tables | TanStack React Table 8 | Headless table for CasesList |
| Database | Supabase (PostgreSQL) | Managed Postgres with storage, RLS; free tier sufficient for MVP |
| Auth (server) | jose 5 (JWT signing/verification) | Zero-dependency JWT library; HS256 symmetric signing |
| HTTP client (server) | Native fetch | No external HTTP client needed; Gajamada calls use raw fetch |
| Date handling | date-fns 4 + dayjs 1 | Server and client date formatting |
| Motion | Framer Motion 11 | Carousel animations (embla-carousel-react) |
| Toast notifications | Sonner 2 | Lightweight toast library |
| File upload | Supabase Storage + Gajamada upload API | Dual upload to both systems |
| Package manager | Yarn 1.22 | Locked via packageManager field |
| Testing | Python (backend_test.py via emergent framework) | Minimal; manual API testing only |
| Deployment | Standalone Node.js output | output: 'standalone' in next.config.js |

## Environment variables

| Variable | Purpose |
|---|---|
| GAJAMADA_BASE_URL | eBdesk Fusion API base (default: gajamada-propam.polri.go.id) |
| GAJAMADA_USERNAME / GAJAMADA_PASSWORD | Service account for Gajamada login |
| GAJAMADA_APP_ID / GAJAMADA_CONNECTION_ID / GAJAMADA_DATABASE | Gajamada dashboard/connection identifiers |
| GAJAMADA_UPDATE_GATEWAY_ID / GAJAMADA_ATTACH_GATEWAY_ID | Gajamada gateway endpoints for push updates and file attachments |
| NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY | Supabase project URL and admin key |
| APP_JWT_SECRET | JWT signing secret (defaults to dev placeholder) |
| CORS_ORIGINS | Allowed CORS origins for file downloads |

## Database schema

13 tables in Supabase PostgreSQL (see supabase_migration.sql):
dispositions, status_history, 	imelines, ollowup_documents, sync_logs, udit_logs, units_master, completions, ollowup_checklist, case_outcomes, satker_satwil, 
umbering_settings.
All tables use prepetrator_id (Gajamada composite key) as the foreign reference ? no internal auto-increment PK coupling.
