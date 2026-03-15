-- Medunity: Database Setup
-- Run this in Supabase SQL Editor

-- Entries table
CREATE TABLE IF NOT EXISTS entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'demo-user',
  raw_text TEXT NOT NULL,
  photo_url TEXT,
  extracted_symptoms JSONB DEFAULT '[]'::jsonb,
  ctas_level INT,
  ctas_label TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  assessment TEXT,
  recommended_action TEXT,
  triage_report JSONB,
  triage_questions JSONB DEFAULT '[]'::jsonb,
  linked_entry_id UUID REFERENCES entries(id),
  link_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Thread messages table
CREATE TABLE IF NOT EXISTS thread_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clinics table
CREATE TABLE IF NOT EXISTS clinics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  wait_minutes INT NOT NULL DEFAULT 30,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  hours TEXT NOT NULL,
  is_open BOOLEAN DEFAULT true,
  closing_time TEXT,
  services JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Community centres / wellness centres table
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

-- Centre resources table
CREATE TABLE IF NOT EXISTS centre_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES community_centres(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  in_stock BOOLEAN DEFAULT true,
  donation_needed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Location reports (anonymous)
CREATE TABLE IF NOT EXISTS location_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id TEXT NOT NULL,
  reporter_type TEXT NOT NULL CHECK (reporter_type IN ('visitor', 'medical-professional')),
  message TEXT NOT NULL,
  wait_time_update INT,
  strain_level TEXT CHECK (strain_level IN ('low', 'moderate', 'high', 'critical')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User profiles table (health profile, cached AI summary, lab results)
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

-- Provider signals table (incoming patient signals for provider view)
CREATE TABLE IF NOT EXISTS provider_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID REFERENCES entries(id),
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

-- Disable RLS (no auth for hackathon)
ALTER TABLE entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE thread_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE clinics DISABLE ROW LEVEL SECURITY;
ALTER TABLE community_centres DISABLE ROW LEVEL SECURITY;
ALTER TABLE centre_resources DISABLE ROW LEVEL SECURITY;
ALTER TABLE location_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE provider_signals DISABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_thread_messages_entry_id ON thread_messages(entry_id);
CREATE INDEX IF NOT EXISTS idx_clinics_type ON clinics(type);
CREATE INDEX IF NOT EXISTS idx_centre_resources_centre_id ON centre_resources(centre_id);
CREATE INDEX IF NOT EXISTS idx_location_reports_facility_id ON location_reports(facility_id);
CREATE INDEX IF NOT EXISTS idx_location_reports_created_at ON location_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_signals_facility_id ON provider_signals(facility_id);
CREATE INDEX IF NOT EXISTS idx_provider_signals_status ON provider_signals(status);
CREATE INDEX IF NOT EXISTS idx_provider_signals_reported_at ON provider_signals(reported_at DESC);

-- Seed community health centres (Toronto, health & wellness focused only)
INSERT INTO community_centres (name, type, address, latitude, longitude, hours, is_open, closing_time, services, is_free, phone) VALUES
  ('Parkdale Queen West Community Health Centre', 'community-centre', '1229 Queen St W, Toronto', 43.6401, -79.4338, '8:30 AM - 8 PM', true, '8:00 PM', '["Harm reduction", "Naloxone distribution", "Primary care", "Mental health", "Needle exchange", "Wound care"]', true, '416-537-2455'),
  ('South Riverdale Community Health Centre', 'community-centre', '955 Queen St E, Toronto', 43.6603, -79.3387, '9 AM - 5 PM', true, '5:00 PM', '["Harm reduction", "Naloxone training", "Hepatitis C testing", "HIV testing", "Chronic disease management", "Diabetes education"]', true, '416-461-1925'),
  ('Regent Park Community Health Centre', 'community-centre', '465 Dundas St E, Toronto', 43.6598, -79.3622, '8 AM - 8 PM', true, '8:00 PM', '["Primary care", "Prenatal care", "Sexual health clinic", "Mental health counselling", "Harm reduction", "Foot care"]', true, '416-364-2261'),
  ('Sherbourne Health', 'wellness-centre', '333 Sherbourne St, Toronto', 43.6619, -79.3713, '9 AM - 5 PM', true, '5:00 PM', '["LGBTQ+ health", "Primary care", "Mental health", "Harm reduction", "Sexual health", "Counselling"]', true, '416-324-4180'),
  ('Unison Health & Community Services — Jane St', 'community-centre', '1651 Keele St, Toronto', 43.6871, -79.4671, '8:30 AM - 4:30 PM', true, '4:30 PM', '["Primary care", "Mental health", "Diabetes education", "Prenatal care", "Health education", "Immunizations"]', true, '416-653-5400'),
  ('Centre for Addiction & Mental Health — Community', 'wellness-centre', '60 White Squirrel Way, Toronto', 43.6490, -79.4020, '8 AM - 8 PM', true, '8:00 PM', '["Addiction services", "Mental health counselling", "Crisis support", "Group therapy", "Harm reduction", "Naloxone distribution"]', true, '416-535-8501');
