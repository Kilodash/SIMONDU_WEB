---
slug: background
title: Project background
role: project background
updated: "2026-07-06T10:25:05"
---

# Project background

## Tujuan

SIMONDU WEB adalah sistem monitoring pengaduan internal untuk **Subbid Paminal Polda Jawa Barat**. Mengkonsolidasi pengaduan masyarakat dari platform Gajamada (eBdesk Fusion) dan ASTINA (e-Office Polri), lalu menambahkan lapisan operasional: routing disposisi, checklist dokumen SOP, manajemen penyelesaian perkara, dan sinkronisasi balik ke sistem sumber.

## Target Pengguna

- **Kasubbid Paminal** ? melakukan disposisi, melihat dashboard ANEV, mengelola unit
- **Admin/Operator** ? operasional harian, input manual, register dokumen
- **Kanit/Ur (Unit 1-3, Urbinpam, Urlitters, Urprodok)** ? menerima disposisi, mengerjakan checklist, upload dokumen

## Non-Goals

- Bukan pengganti Gajamada/ASTINA ? SIMONDU adalah lapisan operasional di atasnya
- Bukan sistem multi-Polda ? di-hardcode untuk Polda Jawa Barat
- Bukan sistem manajemen user penuh ? auth MVP dengan kredensial hardcoded

## Status Saat Ini

MVP sudah deployed dan digunakan aktif oleh personel Paminal. Semua workflow inti (listing, disposisi, checklist, settlement, sync) berfungsi. Sedang dalam proses migrasi dari kredensial global (env vars) ke kredensial per-user.
