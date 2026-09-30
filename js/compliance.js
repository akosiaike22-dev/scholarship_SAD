// Academic Compliance Results Module for ScholarTrack

(() => {
  let records = [];
  let programs = [];

  const escapeHtml = (val) => String(val ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const badgeClass = (status, result) => {
    if (result === 'With Deficiency') return 'deficiency';
    if (result === 'Compliant' || status === 'Verified') return 'compliant';
    return status.toLowerCase();
  };

  async function loadData() {
    // 1. Load programs
    const { data: progs } = await window.db.from('scholarship_programs').select('*').order('program_name');
    programs = progs || [];

    const progFilter = document.querySelector('#compliance-program-filter');
    if (progFilter) {
      const cur = progFilter.value;
      progFilter.innerHTML = '<option value="">All programs</option>' + programs.map(p => `<option value="${p.id}">${escapeHtml(p.program_name)}</option>`).join('');
      progFilter.value = cur;
    }

    // 2. Load verified submissions with scholars and programs
    const { data: subs, error } = await window.db.from('grade_submissions').select('*,scholars(*,scholarship_programs(*))').order('submitted_at', { ascending: false });

    if (error) {
      const msg = document.querySelector('#page-message');
      if (msg) msg.textContent = error.message;
      return;
    }

    records = subs || [];
    renderTable();
  }

  function renderTable() {
    const tbody = document.querySelector('#compliance-table');
    if (!tbody) return;

    const search = (document.querySelector('#compliance-search')?.value || '').toLowerCase().trim();
    const progId = document.querySelector('#compliance-program-filter')?.value || '';
    const status = document.querySelector('#compliance-status-filter')?.value || '';

    const filtered = records.filter(item => {
      const s = item.scholars;
      if (!s) return false;
      const matchSearch = !search || s.student_id?.toLowerCase().includes(search) || s.full_name?.toLowerCase().includes(search);
      const matchProg = !progId || String(s.scholarship_id) === String(progId);
      const matchStatus = !status || s.status === status || item.compliance_result === status;
      return matchSearch && matchProg && matchStatus;
    });

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No compliance records found.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const s = item.scholars;
      const p = programs.find(x => x.id === s.scholarship_id) || s.scholarship_programs;
      const progName = p ? p.program_name : 'None';
      const reasons = Array.isArray(item.deficiency_reasons) ? item.deficiency_reasons.join('; ') : (item.deficiency_reasons || '');

      return `
        <tr>
          <td style="font-weight:600;">${escapeHtml(s.student_id)}</td>
          <td>${escapeHtml(s.full_name)}</td>
          <td><span style="font-size:12px; color:var(--muted);">${escapeHtml(progName)}</span></td>
          <td>${escapeHtml(item.academic_year)} · ${escapeHtml(item.semester)}</td>
          <td><span class="badge ${s.status === 'Compliant' ? 'compliant' : s.status === 'With Deficiency' ? 'deficiency' : 'pending'}">${escapeHtml(s.status)}</span></td>
          <td>
            <span class="badge ${badgeClass(item.submission_status, item.compliance_result)}">
              ${escapeHtml(item.compliance_result || item.submission_status)}
            </span>
          </td>
          <td>
            ${reasons ? `<span style="font-size:11px; color:var(--danger);">${escapeHtml(reasons)}</span>` : '<span style="font-size:11px; color:var(--success);">All requirements satisfied</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('#refresh-compliance')?.addEventListener('click', loadData);
    document.querySelector('#compliance-search')?.addEventListener('input', renderTable);
    document.querySelector('#compliance-program-filter')?.addEventListener('change', renderTable);
    document.querySelector('#compliance-status-filter')?.addEventListener('change', renderTable);
    loadData();
  });
})();
