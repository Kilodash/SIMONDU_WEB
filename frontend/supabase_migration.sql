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

-- Satker/Satwil master data (tujuan pelimpahan)
CREATE TABLE IF NOT EXISTS satker_satwil (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 99,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Enable RLS (service_role bypassed, but good practice)
ALTER TABLE satker_satwil ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE units_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE completions ENABLE ROW LEVEL SECURITY;

-- Personel master (data personel untuk penomoran dokumen)
-- Document register (buku register dokumen)
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

-- App users (managed by super admin via /admin/users API)
CREATE TABLE IF NOT EXISTS app_users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'unit',
  unit TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
