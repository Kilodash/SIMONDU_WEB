---
id: background-fire-and-forget-sync
title: Background fire-and-forget sync ke Gajamada
category: decision
status: active
created: "2026-07-06T14:35:22"
updated: "2026-07-06T14:35:27"
---

## compiled_truth

## Keputusan

Sync balik ke Gajamada/ASTINA menggunakan **background fire-and-forget** via `setTimeout(100ms)` di dalam API route handler. Setelah setiap mutasi data (disposisi, checklist, dokumen, completion), route handler memanggil `scheduleSync(pid, actor, reason)` yang menjalankan `backgroundSync()` di event loop terpisah.

## Alasan

- **MVP speed**: Tidak perlu infrastructure tambahan (message queue, job server, Redis)
- **User tidak menunggu**: Response ke frontend langsung dikirim, sync berjalan di background
- **Auto-retry implicit**: Jika gagal, error dicatat di `sync_logs` untuk inspeksi manual

## Alternatif

- Message queue (BullMQ + Redis) ??? terlalu berat untuk <10 user
- Synchronous write-back ??? akan lambat karena harus menunggu response Gajamada/ASTINA (~2-5 detik)
- Cron polling ??? bisa dipakai untuk two-way sync, bukan untuk immediate write-back

## Mekanisme

1. Route handler selesai mutasi ??? panggil `scheduleSync(pid, actor, reason)`
2. `scheduleSync` debounce per-case dengan Map ??? jika ada pending sync untuk PID yang sama, skip
3. `setTimeout(syncLoop, 100)` ??? `backgroundSync()` jalan di microtask berikutnya
4. `backgroundSync()`:
   - Fetch data terkini dari Gajamada (`getCase(pid)`)
   - Fetch data overlay dari database lokal (dispositions, timelines, completions)
   - `deriveStatus()` ??? hitung status efektif dari overlay
   - `pushUpdate()` ke Gajamada gateway ??? kirim status, position, timeline
   - Insert `sync_log` entry
5. ASTINA sync via HTTP POST `/proses_dispo` (jalur terpisah, dikelola di route komponen)

## Blast Radius

- **Fire-and-forget fragility**: Jika process crash sebelum sync selesai, data tidak akan sinkron sampai user melakukan mutasi berikutnya
- **No retry backoff**: Kalau Gajamada/ASTINA error, sync gagal tanpa retry otomatis
- **Race condition**: Dua user melakukan mutasi bersamaan di kasus yang sama ??? debounce bisa melewatkan sync terbaru
- **No visibility**: User tidak tahu apakah sync berhasil/gagal kecuali buka Sync Logs

## Upgrade Path

Ponytail: ganti ke antrian persistent (BullMQ) dengan retry + backoff saat kebutuhan reliability meningkat. Tambahkan UI badge "syncing / sync failed" di setiap case row.


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
