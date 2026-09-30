// Scholars Management for ScholarTrack

(() => {
  let scholars = [];
  let programs = [];

  const escapeHtml = (val) => String(val ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const STATUS_OPTIONS = [
    'Active',
    'Pending Submission',
    'For Verification',
    'Compliant',
    'With Deficiency',
    'Probationary',
    'For Renewal',
    'Renewed',
    'Disqualified'
  ];

  async function loadData() {
    // 1. Load scholarship programs for filter and modal select
    const { data: progsData } = await window.db.from('scholarship_programs').select('*').order('program_name');
    programs = progsData || [];

    const progFilter = document.querySelector('#scholarship-filter');
    if (progFilter) {
      const cur = progFilter.value;
      progFilter.innerHTML = '<option value="">All programs</option>' + programs.map(p => `<option value="${p.id}">${escapeHtml(p.program_name)}</option>`).join('');
      progFilter.value = cur;
    }

    const formProgSelect = document.querySelector('[name="scholarship_id"]');
    if (formProgSelect) {
      formProgSelect.innerHTML = '<option value="">Select program</option>' + programs.filter(p => p.active).map(p => `<option value="${p.id}">${escapeHtml(p.program_name)}</option>`).join('');
    }

    // Status filter & form options
    const statusFilter = document.querySelector('#status-filter');
    if (statusFilter && statusFilter.options.length <= 1) {
      statusFilter.innerHTML = '<option value="">All statuses</option>' + STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    const formStatusSelect = document.querySelector('[name="status"]');
    if (formStatusSelect && formStatusSelect.options.length === 0) {
      formStatusSelect.innerHTML = STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    // 2. Load scholars
    const { data: scData, error } = await window.db.from('scholars').select('*,scholarship_programs(*)').order('full_name');
    if (error) {
      const msg = document.querySelector('#page-message');
      if (msg) msg.textContent = error.message;
      return;
    }

    scholars = scData || [];
    renderScholars();
  }

  function renderScholars() {
    const tbody = document.querySelector('#scholars-table');
    if (!tbody) return;

    const search = (document.querySelector('#scholar-search')?.value || '').toLowerCase().trim();
    const progId = document.querySelector('#scholarship-filter')?.value || '';
    const status = document.querySelector('#status-filter')?.value || '';

    const filtered = scholars.filter(s => {
      const matchSearch = !search || s.student_id.toLowerCase().includes(search) || s.full_name.toLowerCase().includes(search);
      const matchProg = !progId || String(s.scholarship_id) === String(progId);
      const matchStatus = !status || s.status === status;
      return matchSearch && matchProg && matchStatus;
    });

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No scholars found.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(s => {
      const p = programs.find(item => item.id === s.scholarship_id) || s.scholarship_programs;
      const progName = p ? p.program_name : 'None';
      let badgeCls = 'active';
      if (s.status === 'Compliant') badgeCls = 'compliant';
      if (s.status === 'With Deficiency') badgeCls = 'deficiency';
      if (s.status === 'For Verification' || s.status === 'Pending Submission') badgeCls = 'pending';

      return `
        <tr>
          <td style="font-weight:600;">${escapeHtml(s.student_id)}</td>
          <td>${escapeHtml(s.full_name)}</td>
          <td>${escapeHtml(s.degree_program)}</td>
          <td>${s.year_level}</td>
          <td><span style="font-size:12px; color:var(--muted);">${escapeHtml(progName)}</span></td>
          <td><span class="badge ${badgeCls}">${escapeHtml(s.status)}</span></td>
          <td><button class="table-action" data-edit="${s.id}">Edit</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = scholars.find(s => String(s.id) === String(btn.dataset.edit));
        openDialog(item);
      });
    });
  }

  function openDialog(scholar = null) {
    const form = document.querySelector('#scholar-form');
    if (!form) return;
    form.reset();

    const title = document.querySelector('#scholar-dialog-title');
    if (title) title.textContent = scholar ? 'Edit scholar' : 'Add scholar';

    form.elements.id.value = scholar?.id || '';
    form.elements.student_id.value = scholar?.student_id || '';
    form.elements.full_name.value = scholar?.full_name || '';
    form.elements.degree_program.value = scholar?.degree_program || '';
    form.elements.year_level.value = scholar?.year_level || '1';
    form.elements.scholarship_id.value = scholar?.scholarship_id || '';
    form.elements.status.value = scholar?.status || 'Active';

    const msg = document.querySelector('#scholar-form-message');
    if (msg) msg.textContent = '';

    const dialog = document.querySelector('#scholar-dialog');
    if (dialog?.showModal) dialog.showModal();
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Open Add Scholar Dialog
    document.querySelector('#new-scholar')?.addEventListener('click', () => openDialog());

    // Close Dialog
    document.querySelectorAll('[data-close-dialog]').forEach(btn => {
      btn.addEventListener('click', () => document.querySelector('#scholar-dialog')?.close());
    });

    // Search and Filter Listeners
    document.querySelector('#scholar-search')?.addEventListener('input', renderScholars);
    document.querySelector('#scholarship-filter')?.addEventListener('change', renderScholars);
    document.querySelector('#status-filter')?.addEventListener('change', renderScholars);

    // Form Submit
    const form = document.querySelector('#scholar-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = form.elements.id.value;
        const studentId = form.elements.student_id.value.trim();
        const fullName = form.elements.full_name.value.trim();
        const degree = form.elements.degree_program.value.trim();
        const year = parseInt(form.elements.year_level.value, 10);
        const scholarshipId = form.elements.scholarship_id.value;
        const status = form.elements.status.value;
        const msg = document.querySelector('#scholar-form-message');

        if (!studentId) {
          if (msg) msg.textContent = 'Student ID cannot be blank.';
          return;
        }
        if (!scholarshipId) {
          if (msg) msg.textContent = 'Scholarship program must be selected.';
          return;
        }

        const record = {
          student_id: studentId,
          full_name: fullName,
          degree_program: degree,
          year_level: year,
          scholarship_id: scholarshipId,
          status: status
        };

        const query = id ? window.db.from('scholars').update(record).eq('id', id) : window.db.from('scholars').insert(record);
        const { error } = await query;
        if (error) {
          if (msg) msg.textContent = error.code === '23505' ? 'A scholar with this Student ID already exists.' : error.message;
          return;
        }

        document.querySelector('#scholar-dialog')?.close();
        const pageMsg = document.querySelector('#page-message');
        if (pageMsg) {
          pageMsg.textContent = 'Scholar record saved successfully.';
          pageMsg.classList.add('success');
        }
        await loadData();
      });
    }

    loadData();
  });
})();
