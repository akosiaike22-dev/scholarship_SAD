// Supabase Configuration and Database Interface Layer

window.SUPABASE_CONFIG = {
  url: 'https://xyzcompany.supabase.co', // Replace with your actual Supabase Project URL
  anonKey: 'public-anon-key'              // Replace with your actual Supabase Anon API Key
};

// Check if valid Supabase credentials are configured
const isSupabaseConfigured = () => {
  return (
    window.SUPABASE_CONFIG.url &&
    window.SUPABASE_CONFIG.anonKey &&
    !window.SUPABASE_CONFIG.url.includes('xyzcompany') &&
    !window.SUPABASE_CONFIG.anonKey.includes('public-anon-key') &&
    typeof supabase !== 'undefined'
  );
};

// Seed Data for initial load / offline demo resilience
const SEED_DATA = {
  profiles: [
    { id: '11111111-1111-1111-1111-111111111111', email: 'admin@scholarship.edu', full_name: 'Administrator Maria Santos', role: 'admin' },
    { id: '22222222-2222-2222-2222-222222222222', email: 'staff@scholarship.edu', full_name: 'Staff Juan Dela Cruz', role: 'staff' },
    { id: '33333333-3333-3333-3333-333333333333', email: 'scholar@scholarship.edu', full_name: 'Ana Patricia Reyes', role: 'scholar' }
  ],
  programs: [
    {
      id: 1,
      program_name: 'University Academic Excellence Scholarship',
      required_gwa: 1.75, // Philippine grading: 1.00 is best, 1.75 or better required
      min_units: 18,
      allow_failing_grade: false,
      active: true
    },
    {
      id: 2,
      program_name: 'DOST-SEI Merit Scholarship',
      required_gwa: 2.25,
      min_units: 15,
      allow_failing_grade: false,
      active: true
    },
    {
      id: 3,
      program_name: 'Provincial Leadership & Service Grant',
      required_gwa: 2.50,
      min_units: 15,
      allow_failing_grade: true,
      active: true
    }
  ],
  scholars: [
    {
      id: 1,
      student_id: '2023-00101',
      full_name: 'Ana Patricia Reyes',
      degree_program: 'BS Information Technology',
      year_level: '3rd Year',
      scholarship_id: 1,
      status: 'Compliant'
    },
    {
      id: 2,
      student_id: '2023-00102',
      full_name: 'Carlos Mendoza',
      degree_program: 'BS Computer Science',
      year_level: '2nd Year',
      scholarship_id: 2,
      status: 'For Verification'
    },
    {
      id: 3,
      student_id: '2023-00103',
      full_name: 'Bea Beatrice Castro',
      degree_program: 'BS Civil Engineering',
      year_level: '4th Year',
      scholarship_id: 1,
      status: 'With Deficiency'
    }
  ],
  submissions: [
    {
      id: 1,
      scholar_id: 1,
      academic_year: '2025-2026',
      semester: '1st Semester',
      gwa: 1.50,
      units_enrolled: 18,
      failed_subjects: 0,
      incomplete_subjects: 0,
      submission_status: 'Verified',
      submitted_at: '2025-10-15T09:00:00Z',
      verified_by: 'Staff Juan Dela Cruz',
      verified_at: '2025-10-16T14:30:00Z',
      evaluation_status: 'Compliant',
      deficiency_reasons: ''
    },
    {
      id: 2,
      scholar_id: 2,
      academic_year: '2025-2026',
      semester: '1st Semester',
      gwa: 1.85,
      units_enrolled: 18,
      failed_subjects: 0,
      incomplete_subjects: 0,
      submission_status: 'Pending',
      submitted_at: '2025-10-20T11:20:00Z',
      verified_by: null,
      verified_at: null,
      evaluation_status: 'None',
      deficiency_reasons: ''
    },
    {
      id: 3,
      scholar_id: 3,
      academic_year: '2025-2026',
      semester: '1st Semester',
      gwa: 2.30,
      units_enrolled: 15,
      failed_subjects: 1,
      incomplete_subjects: 0,
      submission_status: 'Verified',
      submitted_at: '2025-10-18T10:15:00Z',
      verified_by: 'Staff Juan Dela Cruz',
      verified_at: '2025-10-19T08:45:00Z',
      evaluation_status: 'With Deficiency',
      deficiency_reasons: 'GWA exceeds maximum allowed (2.30 > 1.75); Failed 1 subject(s); Units below minimum (15 < 18)'
    }
  ]
};

// Initialize Storage
const initLocalStorage = () => {
  if (!localStorage.getItem('sms_programs')) {
    localStorage.setItem('sms_programs', JSON.stringify(SEED_DATA.programs));
  }
  if (!localStorage.getItem('sms_scholars')) {
    localStorage.setItem('sms_scholars', JSON.stringify(SEED_DATA.scholars));
  }
  if (!localStorage.getItem('sms_submissions')) {
    localStorage.setItem('sms_submissions', JSON.stringify(SEED_DATA.submissions));
  }
  if (!localStorage.getItem('sms_profiles')) {
    localStorage.setItem('sms_profiles', JSON.stringify(SEED_DATA.profiles));
  }
};

initLocalStorage();

// Unified Database Adapter Layer
window.DB = {
  // Check if Supabase client instance is active
  getClient() {
    if (isSupabaseConfigured() && window.supabaseClient) {
      return window.supabaseClient;
    }
    return null;
  },

  // SCHOLARSHIP PROGRAMS
  async getPrograms() {
    const sb = this.getClient();
    if (sb) {
      const { data, error } = await sb.from('scholarship_programs').select('*').order('id', { ascending: true });
      if (!error && data) return data;
    }
    return JSON.parse(localStorage.getItem('sms_programs') || '[]');
  },

  async addProgram(program) {
    const sb = this.getClient();
    if (sb) {
      const { data, error } = await sb.from('scholarship_programs').insert([program]).select();
      if (!error && data) return data[0];
    }
    const list = JSON.parse(localStorage.getItem('sms_programs') || '[]');
    program.id = list.length ? Math.max(...list.map(p => p.id)) + 1 : 1;
    list.push(program);
    localStorage.setItem('sms_programs', JSON.stringify(list));
    return program;
  },

  // SCHOLARS
  async getScholars() {
    const sb = this.getClient();
    if (sb) {
      const { data, error } = await sb.from('scholars').select('*, scholarship_programs(*)').order('id', { ascending: true });
      if (!error && data) return data;
    }
    return JSON.parse(localStorage.getItem('sms_scholars') || '[]');
  },

  async addScholar(scholar) {
    const sb = this.getClient();
    if (sb) {
      const { data, error } = await sb.from('scholars').insert([scholar]).select();
      if (!error && data) return data[0];
    }
    const list = JSON.parse(localStorage.getItem('sms_scholars') || '[]');
    scholar.id = list.length ? Math.max(...list.map(s => s.id)) + 1 : 1;
    list.push(scholar);
    localStorage.setItem('sms_scholars', JSON.stringify(list));
    return scholar;
  },

  async updateScholar(id, updates) {
    const sb = this.getClient();
    if (sb) {
      const { data, error } = await sb.from('scholars').update(updates).eq('id', id).select();
      if (!error && data) return data[0];
    }
    const list = JSON.parse(localStorage.getItem('sms_scholars') || '[]');
    const idx = list.findIndex(s => s.id === Number(id));
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      localStorage.setItem('sms_scholars', JSON.stringify(list));
      return list[idx];
    }
    return null;
  },

  // GRADE SUBMISSIONS
  async getSubmissions() {
    const sb = this.getClient();
    if (sb) {
      const { data, error } = await sb.from('grade_submissions').select('*, scholars(*)').order('id', { ascending: false });
      if (!error && data) return data;
    }
    return JSON.parse(localStorage.getItem('sms_submissions') || '[]');
  },

  async addSubmission(sub) {
    const sb = this.getClient();
    if (sb) {
      const { data, error } = await sb.from('grade_submissions').insert([sub]).select();
      if (!error && data) return data[0];
    }
    const list = JSON.parse(localStorage.getItem('sms_submissions') || '[]');
    sub.id = list.length ? Math.max(...list.map(s => s.id)) + 1 : 1;
    sub.submitted_at = new Date().toISOString();
    list.unshift(sub);
    localStorage.setItem('sms_submissions', JSON.stringify(list));
    return sub;
  },

  async updateSubmission(id, updates) {
    const sb = this.getClient();
    if (sb) {
      const { data, error } = await sb.from('grade_submissions').update(updates).eq('id', id).select();
      if (!error && data) return data[0];
    }
    const list = JSON.parse(localStorage.getItem('sms_submissions') || '[]');
    const idx = list.findIndex(s => s.id === Number(id));
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      localStorage.setItem('sms_submissions', JSON.stringify(list));
      return list[idx];
    }
    return null;
  }
};
