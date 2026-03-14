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

-- Disable RLS (no auth for hackathon)
ALTER TABLE entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE thread_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE clinics DISABLE ROW LEVEL SECURITY;
ALTER TABLE community_centres DISABLE ROW LEVEL SECURITY;
ALTER TABLE centre_resources DISABLE ROW LEVEL SECURITY;
ALTER TABLE location_reports DISABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_thread_messages_entry_id ON thread_messages(entry_id);
CREATE INDEX IF NOT EXISTS idx_clinics_type ON clinics(type);
CREATE INDEX IF NOT EXISTS idx_centre_resources_centre_id ON centre_resources(centre_id);
CREATE INDEX IF NOT EXISTS idx_location_reports_facility_id ON location_reports(facility_id);
CREATE INDEX IF NOT EXISTS idx_location_reports_created_at ON location_reports(created_at DESC);

-- Seed clinics: KW-area real clinics
INSERT INTO clinics (name, type, wait_minutes, address, latitude, longitude, hours, is_open, closing_time, services) VALUES
  ('Grand River Hospital ER', 'er', 120, '835 King St W, Kitchener', 43.4516, -80.5052, '24/7', true, NULL, '["Emergency care", "Trauma", "Imaging", "Lab work"]'),
  ('St. Mary''s General Hospital ER', 'er', 95, '911 Queen''s Blvd, Kitchener', 43.4372, -80.4865, '24/7', true, NULL, '["Emergency care", "Cardiac care", "Imaging"]'),
  ('Kitchener Walk-In Clinic', 'walk_in', 25, '525 Highland Rd W, Kitchener', 43.4350, -80.5100, '8 AM - 8 PM', true, '8:00 PM', '["General assessment", "Prescriptions", "Blood work on-site"]'),
  ('Waterloo Walk-In Medical Centre', 'walk_in', 35, '170 University Ave W, Waterloo', 43.4680, -80.5250, '9 AM - 5 PM', true, '5:00 PM', '["General assessment", "Prescriptions", "Referrals"]'),
  ('Grand River Urgent Care', 'urgent_care', 45, '405 The Boardwalk, Waterloo', 43.4820, -80.5460, '10 AM - 10 PM', true, '10:00 PM', '["Urgent assessment", "X-ray", "Stitches", "Prescriptions"]'),
  ('UWaterloo Health Services', 'walk_in', 40, 'SLC Building, Room 2040, Waterloo', 43.4723, -80.5449, '9 AM - 4:30 PM', true, '4:30 PM', '["Student care", "Mental health", "Referrals"]'),
  ('Maple Telehealth', 'telehealth', 8, 'Online', NULL, NULL, '24/7', true, NULL, '["Video consult", "Prescriptions", "Specialist referral"]'),
  ('KW After Hours Clinic', 'after_hours', 30, '100 Ainslie St S, Cambridge', 43.3616, -80.3144, '5 PM - 9 PM', true, '9:00 PM', '["After-hours care", "Prescriptions", "General assessment"]'),
  ('Cambridge Memorial Hospital ER', 'er', 75, '700 Coronation Blvd, Cambridge', 43.3616, -80.3144, '24/7', true, NULL, '["Emergency care", "Imaging", "Lab work"]');

-- Seed community centres
INSERT INTO community_centres (name, type, address, latitude, longitude, hours, is_open, closing_time, services, is_free, phone) VALUES
  ('The Working Centre', 'community-centre', '58 Queen St S, Kitchener', 43.4510, -80.4920, '9 AM - 5 PM', true, '5:00 PM', '["Job search support", "Computer access", "Community kitchen", "Affordable housing help"]', true, '519-743-1151'),
  ('House of Friendship', 'community-centre', '51 Charles St E, Kitchener', 43.4480, -80.4900, '8:30 AM - 4:30 PM', true, '4:30 PM', '["Food bank", "Emergency shelter referrals", "Addiction services", "Community meals"]', true, '519-742-8327'),
  ('KW Multicultural Centre', 'community-centre', '102 King St W, Kitchener', 43.4540, -80.4940, '9 AM - 5 PM', true, '5:00 PM', '["Settlement services", "Language classes", "Employment support", "Translation services"]', true, '519-745-2531'),
  ('YMCA of Three Rivers', 'wellness-centre', '250 King St W, Kitchener', 43.4560, -80.4970, '6 AM - 10 PM', true, '10:00 PM', '["Fitness programs", "Swimming", "Youth programs", "Childcare", "Community wellness"]', false, '519-743-5201'),
  ('Langs Community Health Centre', 'wellness-centre', '1145 Concession Rd, Cambridge', 43.3890, -80.3700, '8:30 AM - 8 PM', true, '8:00 PM', '["Primary care", "Mental health counselling", "Diabetes education", "Prenatal care", "Dietitian"]', true, '519-653-1470'),
  ('KW Counselling Services', 'wellness-centre', '480 Charles St E, Kitchener', 43.4505, -80.4880, '9 AM - 9 PM', true, '9:00 PM', '["Individual counselling", "Family therapy", "Group therapy", "Crisis support", "Sliding scale fees"]', false, '519-884-0000'),
  ('Reception House Waterloo Region', 'wellness-centre', '63 Allen St E, Waterloo', 43.4400, -80.4850, '9 AM - 5 PM', true, '5:00 PM', '["Refugee settlement", "Health navigation", "Housing support", "Orientation programs"]', true, '519-743-2397');
