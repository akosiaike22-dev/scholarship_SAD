// ====================================================================
// Supabase Configuration and Resilient Storage Adapter
// ====================================================================

// Replace both values with Project Settings > API values in your Supabase project.
window.SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
window.SUPABASE_ANON_KEY = 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY';

const hasValidKeys = () => {
  return (
    window.SUPABASE_URL &&
    window.SUPABASE_ANON_KEY &&
    !window.SUPABASE_URL.includes('YOUR_PROJECT_ID') &&
    typeof window.supabase !== 'undefined'
  );
};

// Seed sample data for local storage resilience
const SEED_PROGRAMS = [
  { id: '11111111-0000-0000-0000-000000000001', program_name: 'University Academic Excellence Scholarship', required_gwa: 1.75, min_units: 18, allow_failing_grade: false, active: true },
  { id: '11111111-0000-0000-0000-000000000002', program_name: 'DOST-SEI Merit Scholarship', required_gwa: 2.25, min_units: 15, allow_failing_grade: false, active: true },
  { id: '11111111-0000-0000-0000-000000000003', program_name: 'Provincial Leadership & Service Grant', required_gwa: 2.50, min_units: 15, allow_failing_grade: true, active: true }
];

const SEED_SCHOLARS = [
  { id: '22222222-0000-0000-0000-000000000001', student_id: '2023-00101', full_name: 'Ana Patricia Reyes', degree_program: 'BS Information Technology', year_level: 3, scholarship_id: '11111111-0000-0000-0000-000000000001', status: 'Compliant' },
  { id: '22222222-0000-0000-0000-000000000002', student_id: '2023-00102', full_name: 'Carlos Mendoza', degree_program: 'BS Computer Science', year_level: 2, scholarship_id: '11111111-0000-0000-0000-000000000002', status: 'For Verification' },
  { id: '22222222-0000-0000-0000-000000000003', student_id: '2023-00103', full_name: 'Bea Beatrice Castro', degree_program: 'BS Civil Engineering', year_level: 4, scholarship_id: '11111111-0000-0000-0000-000000000001', status: 'With Deficiency' }
];

const SEED_SUBMISSIONS = [
  {
    id: '33333333-0000-0000-0000-000000000001',
    scholar_id: '22222222-0000-0000-0000-000000000001',
    academic_year: '2025-2026',
    semester: '1st Semester',
    gwa: 1.50,
    units_enrolled: 18,
    failed_subjects: 0,
    incomplete_subjects: 0,
    submission_status: 'Verified',
    submitted_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    verified_by: 'staff-user',
    verified_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    compliance_result: 'Compliant',
    deficiency_reasons: []
  },
  {
    id: '33333333-0000-0000-0000-000000000002',
    scholar_id: '22222222-0000-0000-0000-000000000002',
    academic_year: '2025-2026',
    semester: '1st Semester',
    gwa: 1.85,
    units_enrolled: 18,
    failed_subjects: 0,
    incomplete_subjects: 0,
    submission_status: 'Pending',
    submitted_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    verified_by: null,
    verified_at: null,
    compliance_result: null,
    deficiency_reasons: []
  },
  {
    id: '33333333-0000-0000-0000-000000000003',
    scholar_id: '22222222-0000-0000-0000-000000000003',
    academic_year: '2025-2026',
    semester: '1st Semester',
    gwa: 2.30,
    units_enrolled: 15,
    failed_subjects: 1,
    incomplete_subjects: 0,
    submission_status: 'Verified',
    submitted_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    verified_by: 'staff-user',
    verified_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    compliance_result: 'With Deficiency',
    deficiency_reasons: ['GWA 2.30 is above the program maximum 1.75.', 'Enrolled units 15 are below the program minimum 18.', 'The program does not allow failing grades.']
  }
];

// Helper to seed localStorage once
const ensureLocalSeed = () => {
  if (!localStorage.getItem('sms_programs')) {
    localStorage.setItem('sms_programs', JSON.stringify(SEED_PROGRAMS));
  }
  if (!localStorage.getItem('sms_scholars')) {
    localStorage.setItem('sms_scholars', JSON.stringify(SEED_SCHOLARS));
  }
  if (!localStorage.getItem('sms_submissions')) {
    localStorage.setItem('sms_submissions', JSON.stringify(SEED_SUBMISSIONS));
  }
};
ensureLocalSeed();

// Create Local Fallback Client
const createMockClient = () => {
  return {
    from(tableName) {
      const storageKey = `sms_${tableName === 'scholarship_programs' ? 'programs' : tableName === 'grade_submissions' ? 'submissions' : tableName}`;
      let data = JSON.parse(localStorage.getItem(storageKey) || '[]');

      let currentQuery = {
        data: [...data],
        filters: [],
        sortField: null,
        sortAsc: true
      };

      const builder = {
        select(fields = '*') {
          return builder;
        },
        order(field, { ascending = true } = {}) {
          currentQuery.sortField = field;
          currentQuery.sortAsc = ascending;
          return builder;
        },
        eq(field, value) {
          currentQuery.filters.push({ field, value });
          return builder;
        },
        then(resolve) {
          let list = [...currentQuery.data];
          // Apply filters
          currentQuery.filters.forEach(f => {
            list = list.filter(item => String(item[f.field]) === String(f.value));
          });
          // Join relations if needed
          if (tableName === 'grade_submissions') {
            const scholars = JSON.parse(localStorage.getItem('sms_scholars') || '[]');
            list = list.map(item => ({
              ...item,
              scholars: scholars.find(s => s.id === item.scholar_id) || null
            }));
          }
          if (tableName === 'scholars') {
            const progs = JSON.parse(localStorage.getItem('sms_programs') || '[]');
            list = list.map(item => ({
              ...item,
              scholarship_programs: progs.find(p => p.id === item.scholarship_id) || null
            }));
          }
          // Sort
          if (currentQuery.sortField) {
            list.sort((a, b) => {
              const valA = a[currentQuery.sortField] ?? '';
              const valB = b[currentQuery.sortField] ?? '';
              if (valA < valB) return currentQuery.sortAsc ? -1 : 1;
              if (valA > valB) return currentQuery.sortAsc ? 1 : -1;
              return 0;
            });
          }
          resolve({ data: list, error: null });
        },
        async insert(record) {
          const records = Array.isArray(record) ? record : [record];
          const fullList = JSON.parse(localStorage.getItem(storageKey) || '[]');
          
          for (let r of records) {
            // Uniqueness checks
            if (tableName === 'scholarship_programs' && fullList.some(p => p.program_name.toLowerCase() === r.program_name.toLowerCase())) {
              return { data: null, error: { code: '23505', message: 'Program name already exists' } };
            }
            if (tableName === 'scholars' && fullList.some(s => s.student_id.toLowerCase() === r.student_id.toLowerCase())) {
              return { data: null, error: { code: '23505', message: 'Student ID already exists' } };
            }
            if (tableName === 'grade_submissions' && fullList.some(g => g.scholar_id === r.scholar_id && g.academic_year === r.academic_year && g.semester === r.semester)) {
              return { data: null, error: { code: '23505', message: 'A submission already exists for this semester' } };
            }

            r.id = r.id || 'id_' + Math.random().toString(36).substr(2, 9);
            r.created_at = r.created_at || new Date().toISOString();
            if (tableName === 'grade_submissions') {
              r.submitted_at = r.submitted_at || new Date().toISOString();
              // Update scholar to For Verification
              const scholars = JSON.parse(localStorage.getItem('sms_scholars') || '[]');
              const scIdx = scholars.findIndex(s => s.id === r.scholar_id);
              if (scIdx !== -1) {
                scholars[scIdx].status = 'For Verification';
                localStorage.setItem('sms_scholars', JSON.stringify(scholars));
              }
            }
            fullList.push(r);
          }
          localStorage.setItem(storageKey, JSON.stringify(fullList));
          return { data: records, error: null };
        },
        async update(updates) {
          return {
            eq: async (field, value) => {
              const fullList = JSON.parse(localStorage.getItem(storageKey) || '[]');
              const idx = fullList.findIndex(item => String(item[field]) === String(value));
              if (idx !== -1) {
                fullList[idx] = { ...fullList[idx], ...updates };
                localStorage.setItem(storageKey, JSON.stringify(fullList));
                return { data: [fullList[idx]], error: null };
              }
              return { data: null, error: { message: 'Item not found' } };
            }
          };
        }
      };

      return builder;
    },

    async rpc(funcName, params) {
      if (funcName === 'verify_and_evaluate_submission') {
        const subId = params.p_submission_id;
        const subs = JSON.parse(localStorage.getItem('sms_submissions') || '[]');
        const scholars = JSON.parse(localStorage.getItem('sms_scholars') || '[]');
        const progs = JSON.parse(localStorage.getItem('sms_programs') || '[]');

        const sub = subs.find(s => s.id === subId);
        if (!sub) return { data: null, error: { message: 'Grade submission not found.' } };

        const scholar = scholars.find(s => s.id === sub.scholar_id);
        const program = scholar ? progs.find(p => p.id === scholar.scholarship_id) : null;
        if (!program) return { data: null, error: { message: 'Scholar must have an assigned scholarship program.' } };

        const reasons = [];
        if (Number(sub.gwa) > Number(program.required_gwa)) {
          reasons.push(`GWA ${Number(sub.gwa).toFixed(2)} is above the program maximum ${Number(program.required_gwa).toFixed(2)}.`);
        }
        if (Number(sub.units_enrolled) < Number(program.min_units)) {
          reasons.push(`Enrolled units ${sub.units_enrolled} are below the program minimum ${program.min_units}.`);
        }
        if (!program.allow_failing_grade && Number(sub.failed_subjects) > 0) {
          reasons.push('The program does not allow failing grades.');
        }
        if (Number(sub.incomplete_subjects) > 0) {
          reasons.push('Incomplete subjects remain unresolved.');
        }

        const result = reasons.length === 0 ? 'Compliant' : 'With Deficiency';

        sub.submission_status = 'Verified';
        sub.verified_by = 'Staff User';
        sub.verified_at = new Date().toISOString();
        sub.compliance_result = result;
        sub.deficiency_reasons = reasons;
        localStorage.setItem('sms_submissions', JSON.stringify(subs));

        if (scholar) {
          scholar.status = result;
          localStorage.setItem('sms_scholars', JSON.stringify(scholars));
        }

        return { data: { result, reasons }, error: null };
      }
      return { data: null, error: { message: 'Unknown RPC function' } };
    }
  };
};

if (hasValidKeys()) {
  try {
    window.db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  } catch (err) {
    console.warn('Could not initialize Supabase, activating mock client:', err);
    window.db = createMockClient();
  }
} else {
  window.db = createMockClient();
}
