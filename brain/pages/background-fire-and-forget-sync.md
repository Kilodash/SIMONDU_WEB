---
id: background-fire-and-forget-sync
title: Background fire-and-forget sync ke Gajamada
category: decision
status: active
created: "2026-07-06T14:35:22"
updated: "2026-07-06T14:35:27"
updated: "2026-07-07T20:22:30"
---


## compiled_truth

# Keputusan: Background Fire-and-Forget Sync

Background jobs menggunakan `setInterval` di `route.js`: auto-refresh ASTINA cookie setiap 2 jam, retry failed Gajamada sync logs setiap 5 menit. Tidak ada task scheduler atau queue.

**Alasan**: Cukup untuk kebutuhan internal, tidak perlu Celery/BullMQ, simple implementation.

**Konsekuensi**: Tidak reliable ? interval mati kalau process restart, tidak ada monitoring, tidak ada retry proper untuk Gajamada sync.


## timeline

- time: 2026-07-06T14:35:22
  kind: decision
  summary: "Created this page: Background fire-and-forget sync ke Gajamada"
  source: "code review: route.js scheduleSync/backgroundSync"
  affects: [background-fire-and-forget-sync]

- time: 2026-07-06T14:35:27
  kind: decision
  summary: "Captured from code review: background fire-and-forget sync pattern for Gajamada write-back"
  source: "code review: route.js"
  affects: [background-fire-and-forget-sync]

- time: 2026-07-07T20:22:30
  kind: decision
  summary: Background sync mechanism details
  source: code analysis
  affects: [background-fire-and-forget-sync]
