-- ============================================================
-- Migration: run in Supabase SQL Editor
-- Adds: user_profiles, provider_signals, curated health centres
-- Safe to run on any existing database state
-- ============================================================

-- 1. User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  age INT,
  sex TEXT CHECK (sex IN ('male', 'female', 'other', 'prefer-not-to-say')),
  height_cm DOUBLE PRECISION,
  weight_kg DOUBLE PRECISION,
  conditions JSONB DEFAULT '[]'::jsonb,
  medications JSONB DEFAULT '[]'::jsonb,
  allergies JSONB DEFAULT '[]'::jsonb,
  lab_results JSONB DEFAULT '[]'::jsonb,
  health_summary TEXT,
  summary_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- 2. Provider signals
CREATE TABLE IF NOT EXISTS provider_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID,
  facility_id TEXT NOT NULL,
  facility_name TEXT NOT NULL,
  ctas_level INT NOT NULL,
  chief_complaint TEXT NOT NULL,
  symptoms JSONB DEFAULT '[]'::jsonb,
  eta_minutes INT NOT NULL DEFAULT 15,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  suggested_ward TEXT,
  prep_checklist JSONB DEFAULT '[]'::jsonb,
  report_data JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  reported_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE provider_signals DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_provider_signals_facility_id ON provider_signals(facility_id);
CREATE INDEX IF NOT EXISTS idx_provider_signals_status ON provider_signals(status);
CREATE INDEX IF NOT EXISTS idx_provider_signals_reported_at ON provider_signals(reported_at DESC);

-- 3. Community centres + resources tables (create if missing)
CREATE TABLE IF NOT EXISTS community_centres (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'community-centre',
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  hours TEXT NOT NULL,
  is_open BOOLEAN DEFAULT true,
  closing_time TEXT,
  services JSONB DEFAULT '[]'::jsonb,
  is_free BOOLEAN DEFAULT true,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE community_centres DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS centre_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES community_centres(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  in_stock BOOLEAN DEFAULT true,
  donation_needed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE centre_resources DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_centre_resources_centre_id ON centre_resources(centre_id);

-- 4. Clear old data and seed health-focused centres
DELETE FROM centre_resources;
DELETE FROM community_centres;

INSERT INTO community_centres (name, type, address, latitude, longitude, hours, is_open, closing_time, services, is_free, phone) VALUES
  ('Parkdale Queen West Community Health Centre', 'community-centre', '1229 Queen St W, Toronto', 43.6401, -79.4338, '8:30 AM - 8 PM', true, '8:00 PM', '["Harm reduction", "Naloxone distribution", "Primary care", "Mental health", "Needle exchange", "Wound care"]', true, '416-537-2455'),
  ('South Riverdale Community Health Centre', 'community-centre', '955 Queen St E, Toronto', 43.6603, -79.3387, '9 AM - 5 PM', true, '5:00 PM', '["Harm reduction", "Naloxone training", "Hepatitis C testing", "HIV testing", "Chronic disease management", "Diabetes education"]', true, '416-461-1925'),
  ('Regent Park Community Health Centre', 'community-centre', '465 Dundas St E, Toronto', 43.6598, -79.3622, '8 AM - 8 PM', true, '8:00 PM', '["Primary care", "Prenatal care", "Sexual health clinic", "Mental health counselling", "Harm reduction", "Foot care"]', true, '416-364-2261'),
  ('Sherbourne Health', 'wellness-centre', '333 Sherbourne St, Toronto', 43.6619, -79.3713, '9 AM - 5 PM', true, '5:00 PM', '["LGBTQ+ health", "Primary care", "Mental health", "Harm reduction", "Sexual health", "Counselling"]', true, '416-324-4180'),
  ('Unison Health & Community Services — Jane St', 'community-centre', '1651 Keele St, Toronto', 43.6871, -79.4671, '8:30 AM - 4:30 PM', true, '4:30 PM', '["Primary care", "Mental health", "Diabetes education", "Prenatal care", "Health education", "Immunizations"]', true, '416-653-5400'),
  ('Centre for Addiction & Mental Health — Community', 'wellness-centre', '60 White Squirrel Way, Toronto', 43.6490, -79.4020, '8 AM - 8 PM', true, '8:00 PM', '["Addiction services", "Mental health counselling", "Crisis support", "Group therapy", "Harm reduction", "Naloxone distribution"]', true, '416-535-8501');

-- 5. Seed resources for Toronto centres
INSERT INTO centre_resources (centre_id, name, category, in_stock, donation_needed)
SELECT id, r.name, r.category, r.in_stock, r.donation_needed
FROM community_centres, (VALUES
  ('Naloxone kits (nasal)', 'medical', true, false),
  ('Naloxone kits (injectable)', 'medical', false, true),
  ('Sterile needle kits', 'medical', true, false),
  ('Fentanyl test strips', 'medical', true, false),
  ('Sharps disposal containers', 'medical', false, true),
  ('Wound care supplies', 'medical', true, false),
  ('Menstrual products', 'hygiene', true, false)
) AS r(name, category, in_stock, donation_needed)
WHERE community_centres.name = 'Parkdale Queen West Community Health Centre';

INSERT INTO centre_resources (centre_id, name, category, in_stock, donation_needed)
SELECT id, r.name, r.category, r.in_stock, r.donation_needed
FROM community_centres, (VALUES
  ('Naloxone kits', 'medical', true, false),
  ('Sterile injection supplies', 'medical', true, false),
  ('Safer inhalation kits', 'medical', true, false),
  ('Hepatitis C rapid test kits', 'medical', true, false),
  ('HIV rapid test kits', 'medical', false, true),
  ('Wound care kits', 'medical', true, false),
  ('Condoms & dental dams', 'hygiene', true, false)
) AS r(name, category, in_stock, donation_needed)
WHERE community_centres.name = 'South Riverdale Community Health Centre';

INSERT INTO centre_resources (centre_id, name, category, in_stock, donation_needed)
SELECT id, r.name, r.category, r.in_stock, r.donation_needed
FROM community_centres, (VALUES
  ('Menstrual products (pads & tampons)', 'hygiene', true, false),
  ('Prenatal vitamins', 'medical', false, true),
  ('Naloxone kits', 'medical', true, false),
  ('Condoms', 'hygiene', true, false),
  ('Pregnancy tests', 'medical', true, false),
  ('Foot care supplies', 'medical', true, false),
  ('Blood glucose monitors', 'medical', true, false)
) AS r(name, category, in_stock, donation_needed)
WHERE community_centres.name = 'Regent Park Community Health Centre';

INSERT INTO centre_resources (centre_id, name, category, in_stock, donation_needed)
SELECT id, r.name, r.category, r.in_stock, r.donation_needed
FROM community_centres, (VALUES
  ('STI testing kits', 'medical', true, false),
  ('Condoms & contraceptives', 'hygiene', true, false),
  ('Naloxone kits', 'medical', true, false),
  ('Mental health counselling slots', 'mental-health', true, false),
  ('Hormone therapy resources', 'medical', true, false),
  ('Safer sex kits', 'hygiene', true, false)
) AS r(name, category, in_stock, donation_needed)
WHERE community_centres.name = 'Sherbourne Health';

INSERT INTO centre_resources (centre_id, name, category, in_stock, donation_needed)
SELECT id, r.name, r.category, r.in_stock, r.donation_needed
FROM community_centres, (VALUES
  ('Flu vaccines', 'medical', true, false),
  ('Prenatal vitamins', 'medical', false, true),
  ('Diabetes testing supplies', 'medical', true, false),
  ('Menstrual products', 'hygiene', true, false),
  ('Mental health counselling slots', 'mental-health', false, false)
) AS r(name, category, in_stock, donation_needed)
WHERE community_centres.name = 'Unison Health & Community Services — Jane St';

INSERT INTO centre_resources (centre_id, name, category, in_stock, donation_needed)
SELECT id, r.name, r.category, r.in_stock, r.donation_needed
FROM community_centres, (VALUES
  ('Naloxone kits (nasal)', 'medical', true, false),
  ('Naloxone kits (injectable)', 'medical', true, false),
  ('Crisis walk-in sessions', 'mental-health', true, false),
  ('Group therapy sessions', 'mental-health', true, false),
  ('Addiction counselling slots', 'mental-health', false, false),
  ('Fentanyl test strips', 'medical', true, false)
) AS r(name, category, in_stock, donation_needed)
WHERE community_centres.name = 'Centre for Addiction & Mental Health — Community';
