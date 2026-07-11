-- Supabase migration: SIMONDU WEB tables
-- Run in Supabase SQL Editor

-- Dispositions (distribusi kasus dari Kasubbid ke unit)
CREATE TABLE IF NOT EXISTS dispositions (
  id UUID PRIMARY KEY,
  prepetrator_id TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  from_unit TEXT NOT NULL,
  note TEXT DEFAULT '',
  is_atensi BOOLEAN DEFAULT FALSE,
  "by" JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_to_gajamada BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_disp_pid ON dispositions(prepetrator_id, created_at DESC);

-- Status history (perubahan status dari Gajamada)
CREATE TABLE IF NOT EXISTS status_history (
  id UUID PRIMARY KEY,
  prepetrator_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stshist_pid ON status_history(prepetrator_id, created_at DESC);

-- Timelines (catatan tindak lanjut internal)
CREATE TABLE IF NOT EXISTS timelines (
  id UUID PRIMARY KEY,
  prepetrator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  "by" JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tl_pid ON timelines(prepetrator_id, created_at DESC);

-- Sync logs (log sinkronisasi ke Gajamada)
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY,
  prepetrator_id TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  request_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  reason TEXT,
  "by" JSONB DEFAULT '{}',
  response JSONB DEFAULT '{}',
  http_status INTEGER,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_synclog_pid ON sync_logs(prepetrator_id, request_at DESC);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY,
  actor JSONB DEFAULT '{}',
  action TEXT NOT NULL,
  resource TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- Units master (daftar unit)
CREATE TABLE IF NOT EXISTS units_master (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  parent TEXT,
  is_kasubbid BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  "order" INTEGER DEFAULT 99,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  source TEXT
);
CREATE INDEX IF NOT EXISTS idx_units_name ON units_master(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_units_name_unique ON units_master(name);

-- Completions (kasus selesai)
CREATE TABLE IF NOT EXISTS completions (
  prepetrator_id TEXT PRIMARY KEY,
  note TEXT DEFAULT '',
  "by" JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Followup checklist (checklist dokumen per kasus)
CREATE TABLE IF NOT EXISTS followup_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prepetrator_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  note TEXT DEFAULT '',
  document_number TEXT,
  document_date TIMESTAMPTZ,
  updated_by JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prepetrator_id, document_type)
);

-- Case outcomes (hasil lidik & settlement)
CREATE TABLE IF NOT EXISTS case_outcomes (
  prepetrator_id TEXT PRIMARY KEY,
  hasil_lidik TEXT,
  settlement TEXT,
  pelimpahan TEXT,
  updated_by JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Satker/Satwil master data (tujuan pelimpahan)
CREATE TABLE IF NOT EXISTS satker_satwil (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 99,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Numbering settings (penomoran otomatis)
CREATE TABLE IF NOT EXISTS numbering_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT UNIQUE NOT NULL,
  template TEXT NOT NULL,
  next_seq INTEGER DEFAULT 1,
  reset_yearly BOOLEAN DEFAULT TRUE,
  last_year INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (service_role bypassed, but good practice)
ALTER TABLE satker_satwil ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE units_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE completions ENABLE ROW LEVEL SECURITY;

ALTER TABLE followup_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE numbering_settings ENABLE ROW LEVEL SECURITY;

-- Document register (buku register dokumen)
CREATE TABLE IF NOT EXISTS document_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL,
  number TEXT NOT NULL,
  date TIMESTAMPTZ,
  perihal TEXT DEFAULT '',
  requesting_unit TEXT DEFAULT '',
  keterangan TEXT DEFAULT '',
  is_manual BOOLEAN DEFAULT FALSE,
  prepetrator_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_docreg_type ON document_register(document_type, created_at DESC);
ALTER TABLE document_register ENABLE ROW LEVEL SECURITY;

-- Local cases (pengaduan non-Gajamada: ASTINA, manual)
CREATE TABLE IF NOT EXISTS local_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prepetrator_id TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'manual',
  case_type TEXT DEFAULT 'pengaduan',
  perihal TEXT DEFAULT '',
  nomor_surat TEXT DEFAULT '',
  tgl_surat TIMESTAMPTZ,
  jenis_surat TEXT DEFAULT '',
  pengirim TEXT DEFAULT '',
  reporter_nik TEXT DEFAULT '',
  phone_no TEXT DEFAULT '',
  email TEXT DEFAULT '',
  prepetrator_name TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  content TEXT DEFAULT '',
  category TEXT DEFAULT '',
  status TEXT DEFAULT 'Laporan Diterima',
  source_alias TEXT DEFAULT '',
  pdf_url TEXT DEFAULT '',
  raw_data JSONB DEFAULT '{}',
  synced_to_astina BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lc_source ON local_cases(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lc_status ON local_cases(status);
CREATE INDEX IF NOT EXISTS idx_lc_case_type ON local_cases(case_type);
CREATE INDEX IF NOT EXISTS idx_lc_source_type ON local_cases(source, case_type);
ALTER TABLE local_cases ENABLE ROW LEVEL SECURITY;

-- Unit mapping (ASTINA/Surat-menyurat -> SIMONDU)
CREATE TABLE IF NOT EXISTS unit_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_name TEXT NOT NULL UNIQUE,
  internal_unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
ALTER TABLE unit_mapping ENABLE ROW LEVEL SECURITY;

-- Non-Dumas followup (surat dinas non-pengaduan)
CREATE TABLE IF NOT EXISTS surat_non_dumas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id UUID REFERENCES local_cases(id),
  tgl_tindak_lanjut TIMESTAMPTZ,
  nomor TEXT DEFAULT '',
  jenis_surat TEXT DEFAULT '',
  keterangan TEXT DEFAULT '',
  status TEXT DEFAULT 'Diterima',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_snd_letter ON surat_non_dumas(letter_id);
ALTER TABLE surat_non_dumas ENABLE ROW LEVEL SECURITY;

-- User credentials (per-user Gajamada + ASTINA credentials)
CREATE TABLE IF NOT EXISTS user_credentials (
  username TEXT PRIMARY KEY,
  gajamada_email TEXT,
  gajamada_password TEXT,
  astina_email TEXT,
  astina_password TEXT,
  zimbra_email TEXT,
  zimbra_password TEXT,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

-- ASTINA sessions (persisted Bearer tokens)
CREATE TABLE IF NOT EXISTS astina_sessions (
  username TEXT PRIMARY KEY,
  access_token TEXT,
  email TEXT,
  "user" JSONB,
  obtained_at BIGINT,
  otp_verified BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE astina_sessions ENABLE ROW LEVEL SECURITY;

-- App settings (global key-value config, e.g. AI API keys)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Migration: Disposition acceptance tracking (Wave 4, Todo 32)
-- Adds accepted_at and accepted_by to dispositions so the target
-- unit can record when a case disposition was received and by whom.
--
-- UP:
--   ALTER TABLE dispositions ADD COLUMN accepted_at TIMESTAMPTZ;
--   ALTER TABLE dispositions ADD COLUMN accepted_by JSONB DEFAULT '{}';
--
-- DOWN:
--   ALTER TABLE dispositions DROP COLUMN accepted_at;
--   ALTER TABLE dispositions DROP COLUMN accepted_by;
-- ============================================================
ALTER TABLE dispositions ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE dispositions ADD COLUMN IF NOT EXISTS accepted_by JSONB DEFAULT '{}';

-- ============================================================
-- Migration: Drop ASTINA/document-register/numbering-settings
--              and align local_cases with new status workflow
--              (Wave 5, Todo 41)
-- Removes the ASTINA-side tables and per-user ASTINA/Zimbra
-- credentials, plus the legacy `synced_to_astina` flag on
-- local_cases. Adds `status` and `resolusi` columns to
-- local_cases to back the new workflow constants in
-- frontend/lib/status.js (Wave 4, Todo 24).
--
-- UP:
--   DROP TABLE IF EXISTS astina_sessions;
--   DROP TABLE IF EXISTS document_register;
--   DROP TABLE IF EXISTS numbering_settings;
--   ALTER TABLE user_credentials
--     DROP COLUMN IF EXISTS astina_email,
--     DROP COLUMN IF EXISTS astina_password,
--     DROP COLUMN IF EXISTS zimbra_email,
--     DROP COLUMN IF EXISTS zimbra_password;
--   ALTER TABLE local_cases DROP COLUMN IF EXISTS synced_to_astina;
--   ALTER TABLE local_cases
--     ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Surat Masuk Polda Jabar';
--   ALTER TABLE local_cases
--     ADD COLUMN IF NOT EXISTS resolusi TEXT;
--   -- dispositions.accepted_at already added in Wave 4 (Todo 32);
--   -- IF NOT EXISTS keeps this block idempotent.
--   ALTER TABLE dispositions
--     ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
--
-- DOWN:
--   ALTER TABLE dispositions DROP COLUMN IF EXISTS accepted_at;
--   ALTER TABLE local_cases DROP COLUMN IF EXISTS resolusi;
--   ALTER TABLE local_cases DROP COLUMN IF EXISTS status;
--   ALTER TABLE local_cases
--     ADD COLUMN IF NOT EXISTS synced_to_astina BOOLEAN DEFAULT FALSE;
--   ALTER TABLE user_credentials
--     ADD COLUMN IF NOT EXISTS astina_email    TEXT,
--     ADD COLUMN IF NOT EXISTS astina_password TEXT,
--     ADD COLUMN IF NOT EXISTS zimbra_email    TEXT,
--     ADD COLUMN IF NOT EXISTS zimbra_password TEXT;
--   CREATE TABLE IF NOT EXISTS numbering_settings (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     document_type TEXT UNIQUE NOT NULL,
--     template TEXT NOT NULL,
--     next_seq INTEGER DEFAULT 1,
--     reset_yearly BOOLEAN DEFAULT TRUE,
--     last_year INTEGER,
--     updated_at TIMESTAMPTZ DEFAULT NOW()
--   );
--   ALTER TABLE numbering_settings ENABLE ROW LEVEL SECURITY;
--   CREATE TABLE IF NOT EXISTS document_register (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     document_type TEXT NOT NULL,
--     number TEXT NOT NULL,
--     date TIMESTAMPTZ,
--     perihal TEXT DEFAULT '',
--     requesting_unit TEXT DEFAULT '',
--     keterangan TEXT DEFAULT '',
--     is_manual BOOLEAN DEFAULT FALSE,
--     prepetrator_id TEXT,
--     created_at TIMESTAMPTZ DEFAULT NOW(),
--     updated_at TIMESTAMPTZ
--   );
--   CREATE INDEX IF NOT EXISTS idx_docreg_type
--     ON document_register(document_type, created_at DESC);
--   ALTER TABLE document_register ENABLE ROW LEVEL SECURITY;
--   CREATE TABLE IF NOT EXISTS astina_sessions (
--     username TEXT PRIMARY KEY,
--     access_token TEXT,
--     email TEXT,
--     "user" JSONB,
--     obtained_at BIGINT,
--     otp_verified BOOLEAN DEFAULT FALSE,
--     updated_at TIMESTAMPTZ DEFAULT NOW()
--   );
--   ALTER TABLE astina_sessions ENABLE ROW LEVEL SECURITY;
-- ============================================================
DROP TABLE IF EXISTS astina_sessions;
DROP TABLE IF EXISTS document_register;
DROP TABLE IF EXISTS numbering_settings;

ALTER TABLE user_credentials
  DROP COLUMN IF EXISTS astina_email,
  DROP COLUMN IF EXISTS astina_password,
  DROP COLUMN IF EXISTS zimbra_email,
  DROP COLUMN IF EXISTS zimbra_password;

ALTER TABLE local_cases DROP COLUMN IF EXISTS synced_to_astina;

ALTER TABLE local_cases
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Surat Masuk Polda Jabar';
ALTER TABLE local_cases
  ADD COLUMN IF NOT EXISTS resolusi TEXT;

-- accepted_at already exists from Wave 4 (Todo 32); IF NOT EXISTS
-- keeps this block safe to re-run.
ALTER TABLE dispositions
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- ============================================================
-- Migration: Users table (Wave 6)
-- Replaces hardcoded auth.js user list with DB-backed users.
-- Backward-compatible: auth.js falls back to hardcoded list.
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL, -- ponytail: plaintext, hash with scrypt later
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  unit TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Seed default users from auth.js
INSERT INTO users (username, password, name, role, unit) VALUES
  ('kasubbid', 'kasubbid123', 'Kasubbid Paminal Polda Jabar', 'kasubbid_paminal', NULL),
  ('kasubbid_paminal', 'paminal123', 'Kasubbid Paminal Polda Jabar', 'kasubbid_paminal', NULL),
  ('kasubbid_provos', 'provos123', 'Kasubbid Provos Polda Jabar', 'kasubbid_provos', NULL),
  ('kasubbid_wabprof', 'wabprof123', 'Kasubbid Wabprof Polda Jabar', 'kasubbid_wabprof', NULL),
  ('kabid_propam', 'kabid123', 'Kabid Propam Polda Jabar', 'kabid_propam', NULL),
  ('kasubbag_yanduan', 'yanduan123', 'Kasubbag Yanduan Polda Jabar', 'kasubbag_yanduan', NULL),
  ('kasubbag_rehabpers', 'rehabpers123', 'Kasubbag Rehabpers Polda Jabar', 'kasubbag_rehabpers', NULL),
  ('admin', 'admin123', 'Admin/Operator Propam', 'admin', NULL),
  ('super_admin', 'superadmin123', 'Super Admin', 'super_admin', NULL),
  ('unit1', 'unit123', 'Kanit 1 Paminal Polda Jabar', 'unit', 'UNIT 1 SUBBID PAMINAL POLDA JAWA BARAT'),
  ('unit2', 'unit123', 'Kanit 2 Paminal Polda Jabar', 'unit', 'UNIT 2 SUBBID PAMINAL POLDA JAWA BARAT'),
  ('unit3', 'unit123', 'Kanit 3 Paminal Polda Jabar', 'unit', 'UNIT 3 SUBBID PAMINAL POLDA JAWA BARAT'),
  ('urbinpam', 'unit123', 'Ur Binpam Paminal Polda Jabar', 'unit', 'UR BINPAM SUBBID PAMINAL POLDA JAWA BARAT'),
  ('urlitpers', 'unit123', 'Ur Litpers Paminal Polda Jabar', 'unit', 'UR LITPERS SUBBID PAMINAL POLDA JAWA BARAT'),
  ('urprodok', 'unit123', 'Ur Prodok Paminal Polda Jabar', 'unit', 'UR PRODOK SUBBID PAMINAL POLDA JAWA BARAT')
ON CONFLICT (username) DO NOTHING;
