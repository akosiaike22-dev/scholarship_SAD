-- ====================================================================
-- STUDENT SCHOLARSHIP MONITORING AND ACADEMIC COMPLIANCE SYSTEM
-- Supabase PostgreSQL Schema & Security Policies
-- ====================================================================

-- 1. PROFILES TABLE (Role-based access control)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'staff', 'scholar')) NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SCHOLARSHIP PROGRAMS TABLE
CREATE TABLE IF NOT EXISTS scholarship_programs (
  id BIGSERIAL PRIMARY KEY,
  program_name TEXT NOT NULL UNIQUE,
  required_gwa NUMERIC(3,2) NOT NULL CHECK (required_gwa >= 1.00 AND required_gwa <= 5.00),
  min_units INTEGER NOT NULL CHECK (min_units > 0),
  allow_failing_grade BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SCHOLARS TABLE
CREATE TABLE IF NOT EXISTS scholars (
  id BIGSERIAL PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  degree_program TEXT NOT NULL,
  year_level TEXT NOT NULL,
  scholarship_id BIGINT REFERENCES scholarship_programs(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN (
    'Active', 
    'Pending Submission', 
    'For Verification', 
    'Compliant', 
    'With Deficiency', 
    'Probationary', 
    'For Renewal', 
    'Renewed', 
    'Disqualified'
  )) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. GRADE SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS grade_submissions (
  id BIGSERIAL PRIMARY KEY,
  scholar_id BIGINT NOT NULL REFERENCES scholars(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  semester TEXT NOT NULL,
  gwa NUMERIC(3,2) NOT NULL CHECK (gwa >= 1.00 AND gwa <= 5.00),
  units_enrolled INTEGER NOT NULL CHECK (units_enrolled >= 0),
  failed_subjects INTEGER NOT NULL DEFAULT 0 CHECK (failed_subjects >= 0),
  incomplete_subjects INTEGER NOT NULL DEFAULT 0 CHECK (incomplete_subjects >= 0),
  submission_status TEXT CHECK (submission_status IN ('Pending', 'Verified', 'Returned')) NOT NULL DEFAULT 'Pending',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  evaluation_status TEXT CHECK (evaluation_status IN ('None', 'Compliant', 'With Deficiency')) DEFAULT 'None',
  deficiency_reasons TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_scholar_semester UNIQUE (scholar_id, academic_year, semester)
);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scholarship_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scholars ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_submissions ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated users can view profile
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (true);

-- Scholarship Programs: All authenticated users can view, Admin/Staff can manage
CREATE POLICY "programs_read_all" ON scholarship_programs
  FOR SELECT USING (true);

CREATE POLICY "programs_write_staff_admin" ON scholarship_programs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Scholars: All authenticated can read, Staff/Admin can manage
CREATE POLICY "scholars_read_all" ON scholars
  FOR SELECT USING (true);

CREATE POLICY "scholars_write_staff_admin" ON scholars
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Grade Submissions: Reversible access based on role
CREATE POLICY "submissions_read_all" ON grade_submissions
  FOR SELECT USING (true);

CREATE POLICY "submissions_insert_all" ON grade_submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "submissions_update_staff_admin" ON grade_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- ====================================================================
-- SAMPLE SEED DATA
-- ====================================================================

INSERT INTO scholarship_programs (program_name, required_gwa, min_units, allow_failing_grade, active)
VALUES 
  ('University Academic Excellence Scholarship', 1.75, 18, false, true),
  ('DOST-SEI Merit Scholarship', 2.25, 15, false, true),
  ('Provincial Leadership & Service Grant', 2.50, 15, true, true)
ON CONFLICT (program_name) DO NOTHING;

INSERT INTO scholars (student_id, full_name, degree_program, year_level, scholarship_id, status)
VALUES
  ('2023-00101', 'Ana Patricia Reyes', 'BS Information Technology', '3rd Year', 1, 'Compliant'),
  ('2023-00102', 'Carlos Mendoza', 'BS Computer Science', '2nd Year', 2, 'For Verification'),
  ('2023-00103', 'Bea Beatrice Castro', 'BS Civil Engineering', '4th Year', 1, 'With Deficiency')
ON CONFLICT (student_id) DO NOTHING;

INSERT INTO grade_submissions (scholar_id, academic_year, semester, gwa, units_enrolled, failed_subjects, incomplete_subjects, submission_status, submitted_at, verified_by, verified_at, evaluation_status, deficiency_reasons)
VALUES
  (1, '2025-2026', '1st Semester', 1.50, 18, 0, 0, 'Verified', NOW() - INTERVAL '10 days', 'Staff Juan Dela Cruz', NOW() - INTERVAL '9 days', 'Compliant', ''),
  (2, '2025-2026', '1st Semester', 1.85, 18, 0, 0, 'Pending', NOW() - INTERVAL '2 days', NULL, NULL, 'None', ''),
  (3, '2025-2026', '1st Semester', 2.30, 15, 1, 0, 'Verified', NOW() - INTERVAL '5 days', 'Staff Juan Dela Cruz', NOW() - INTERVAL '4 days', 'With Deficiency', 'GWA exceeds maximum allowed (2.30 > 1.75); Failed 1 subject(s); Units below minimum (15 < 18)')
ON CONFLICT DO NOTHING;
