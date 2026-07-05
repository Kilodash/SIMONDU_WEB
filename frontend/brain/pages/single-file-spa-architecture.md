---
id: single-file-spa-architecture
title: Single-file SPA architecture for MVP
category: decision
status: active
created: "2026-07-04T19:06:19"
updated: "2026-07-04T19:08:06"
---

## compiled_truth

## What was decided

All React components (login, dashboard, cases list, disposisi queue, case detail sheet, master data CRUD) live in a single file: \pp/page.js\ (~1657 lines). No Next.js file-based routing is used beyond the root page and the catch-all API route. Navigation between views is handled via internal \	ab\ state.

## Alternatives considered

- **Next.js App Router with multiple pages** (\/dashboard\, \/cases\, \/disposisi\, etc.) ? proper code splitting, better DX, but more boilerplate for an internal tool
- **React Router SPA** ? would have required client-side routing setup; Next.js App Router already provides the framework

## Rationale

- **MVP velocity** ? single file means zero routing overhead, shared state without prop drilling or context
- **Internal tool** ? <10 users, no SEO requirement, no public-facing pages
- **Low complexity budget** ? the team prioritized shipping features over architectural purity
- All server interactions go through a single \pi()\ fetch helper, so the client is effectively a thick client over a thin API

## Blast radius

- The single-file pattern makes future decomposition harder ? extracting a view means creating a new file and importing it
- All \useState\/\useEffect\ hooks exist in one closure; no risk of cross-component state leakage
- Hot reload works on the entire file; changes to any component trigger a full recompile of the module
- The API route (\oute.js\) follows the same pattern: 892-line catch-all handler
- The shadcn/ui components under \components/ui/\ are properly modularized (one file per component) ? only the app logic is monolithic

## When to decompose

Decomposition should happen when:
1. The codebase reaches ~2000+ lines in either \page.js\ or \oute.js\
2. A second developer needs to work on a different view simultaneously
3. Performance issues arise from large bundle size

## Related

- [[mongo-to-supabase-migration]]
- [[gajamada-source-of-truth]]


## timeline

- time: 2026-07-04T19:06:19
  kind: decision
  summary: "Created this page: Single-file SPA architecture for MVP"
  source: code analysis
  affects: [single-file-spa-architecture]

- time: 2026-07-04T19:08:06
  kind: decision
  summary: Initial capture from code analysis
  source: code analysis
  affects: [single-file-spa-architecture]
