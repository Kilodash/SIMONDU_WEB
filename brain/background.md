---
slug: background
title: Project background
role: project background
updated: "2026-07-06T10:25:05"
---

# Project background

## Tujuan

SIMONDU WEB adalah sistem monitoring pengaduan internal untuk **Subbid Paminal Polda Jawa Barat**. Mengkonsolidasi pengaduan masyarakat dari platform Gajamada (eBdesk Fusion) dengan input manual dari ASTINA (e-Office Polri), lalu menambahkan lapisan operasional: routing disposisi berbasis role hierarchy, checklist dokumen SOP, manajemen penyelesaian perkara dengan status kontekstual, dan sinkronisasi balik ke Gajamada.

## Target Pengguna

- **Super Admin** ? akses penuh, mengelola user, unit, dan pengaturan sistem
- **Kabid Propam** ? menerima disposisi dari Kasubbag Yanduan, mendisposisi ke unit, melihat dashboard ANEV
- **Kasubbag Yanduan** ? melakukan disposisi awal ke Kabid Propam, mengelola antrian kasus
- **Unit** ? menerima disposisi dari Kabid Propam, mengerjakan checklist, upload dokumen, update status/resolusi

## Non-Goals

- Bukan pengganti Gajamada ? SIMONDU adalah lapisan operasional di atas Gajamada
- Bukan sistem multi-Polda ? di-hardcode untuk Polda Jawa Barat
- Bukan sistem manajemen user penuh ? auth MVP dengan kredensial hardcoded, tapi sudah ada role hierarchy

## Status Saat Ini

MVP sudah deployed dan digunakan aktif oleh personel Paminal. Arsitektur telah disederhanakan: ASTINA auto-sync, AI/Gemini, dan document register dihapus. Ditambahkan: status kontekstual engine, unit mapping untuk normalisasi nama Gajamada, role hierarchy (super_admin/kabid_propam/kasubbag_yanduan/unit), 3-bucket dashboard (SURAT MASUK/DALAM PENANGANAN/SELESAI), endpoint /terima internal, dan jalur Perdamaian/RJ di semua stage kecuali SIDANG_DISIPLIN. Sedang dalam proses migrasi dari kredensial global (env vars) ke kredensial per-user.
