---
id: hardcoded-mvp-auth
title: Hardcoded user credentials for MVP
category: decision
status: active
created: "2026-07-06T10:27:30"
updated: "2026-07-06T10:28:04"
updated: "2026-07-07T20:22:11"
---


## compiled_truth

# Keputusan: Hardcoded MVP Auth

68 user akun di-hardcode dalam `lib/auth.js` (superadmin, kabid, kasubbag, 3 kasubbid, admin, unit officers, 23 Polres jajaran). JWT via jose, cookie-based session.

**Alasan**: Internal tool, user list fixed, tidak perlu database user. Cepat implementasi.

**Konsekuensi**: Tidak bisa tambah user tanpa deploy ulang, tidak ada self-service password reset. Role management static.


## timeline

- time: 2026-07-06T10:27:30
  kind: decision
  summary: "Created this page: Hardcoded user credentials for MVP"
  source: code review
  affects: [hardcoded-mvp-auth]

- time: 2026-07-06T10:28:04
  kind: decision
  summary: "Captured from code: hardcoded users in auth.js for MVP"
  source: code review
  affects: [hardcoded-mvp-auth]

- time: 2026-07-07T20:22:11
  kind: decision
  summary: Update decision details
  source: code analysis
  affects: [hardcoded-mvp-auth]
