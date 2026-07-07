---
id: per-user-credentials
title: Migrasi kredensial global ke per-user
category: decision
status: active
created: "2026-07-06T10:27:32"
updated: "2026-07-06T14:34:37"
updated: "2026-07-07T20:22:40"
---


## compiled_truth

# Keputusan: Per-User Credentials

Setiap user menyimpan kredensial Gajamada/ASTINA/Zimbra sendiri via `POST /api/user/credentials`. Tersimpan di Supabase collection `user_credentials`. Settings page menampilkan form per-user untuk simpan dan test kredensial.

**Alasan**: Setiap Kasubbid/Kabid punya akun Gajamada berbeda, tidak bisa shared credential.

**Konsekuensi**: Setiap user harus setup kredensial sendiri, admin tidak bisa lihat password user lain (masked di API).


## timeline

- time: 2026-07-06T10:27:32
  kind: decision
  summary: "Created this page: Migrasi kredensial global ke per-user"
  source: ongoing work
  affects: [per-user-credentials]

- time: 2026-07-06T10:28:06
  kind: decision
  summary: "Captured ongoing work: migrating from global env-var credentials to per-user credentials"
  source: ongoing work
  affects: [per-user-credentials]

- time: 2026-07-06T14:34:37
  kind: decision
  summary: "Marked as completed: per-user credentials fully implemented in commit fbfcd6e"
  source: "git log: fbfcd6e"
  affects: [per-user-credentials]

- time: 2026-07-07T20:22:40
  kind: decision
  summary: Outdated - now uses global credentials
  source: code analysis
  affects: [per-user-credentials]
