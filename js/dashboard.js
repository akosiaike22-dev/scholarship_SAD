// Dashboard Controller for ScholarTrack

(() => {
  const escapeHtml = (val) => String(val ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  async function loadDashboard() {
    // 1. Fetch scholars
    const { data: scholars } = await window.db.from('scholars').select('*');
    const allScholars = scholars || [];

    // 2. Fetch submissions
    const { data: submissions } = await window.db.from('grade_submissions').select('*,scholars(*)').order('submitted_at', { ascending: false });
    const allSubs = submissions || [];

    // Calculate indicators
    const totalScholars = allScholars.filter(s => s.status !== 'Disqualified').length;
    const pendingSubs = allSubs.filter(s => s.submission_status === 'Pending').length;
    const verifiedSubs = allSubs.filter(s => s.submission_status === 'Verified').length;
    const compliantScholars = allScholars.filter(s => s.status === 'Compliant').length;
    const deficiencyScholars = allScholars.filter(s => s.status === 'With Deficiency').length;

    // Update DOM counts
    const elTotal = document.querySelector('#stat-total-scholars');
    const elPending = document.querySelector('#stat-pending-subs');
    const elVerified = document.querySelector('#stat-verified-subs');
    const elCompliant = document.querySelector('#stat-compliant-scholars');
    const elDeficiency = document.querySelector('#stat-deficiency-scholars');

    if (elTotal) elTotal.textContent = totalScholars;
    if (elPending) elPending.textContent = pendingSubs;
    if (elVerified) elVerified.textContent = verifiedSubs;
    if (elCompliant) elCompliant.textContent = compliantScholars;
    if (elDeficiency) elDeficiency.textContent = deficiencyScholars;

    // Render Recent Submissions
    const tbody = document.querySelector('#dashboard-recent-table');
    if (!tbody) return;

    if (!allSubs.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No grade submissions found.</td></tr>';
      return;
    }

    const recent = allSubs.slice(0, 5);
    tbody.innerHTML = recent.map(g => {
      const s = g.scholars;
      const sName = s ? s.full_name : 'Unknown';
      const sId = s ? s.student_id : '';
      const isPending = g.submission_status === 'Pending';

      return `
        <tr>
          <td style="font-weight:600;">${escapeHtml(sName)}</td>
          <td>${escapeHtml(sId)}</td>
          <td>${escapeHtml(g.academic_year)} · ${escapeHtml(g.semester)}</td>
          <td>${Number(g.gwa).toFixed(2)}</td>
          <td><span class="badge ${isPending ? 'pending' : 'verified'}">${escapeHtml(g.submission_status)}</span></td>
          <td>
            <span class="badge ${g.compliance_result === 'Compliant' ? 'compliant' : g.compliance_result === 'With Deficiency' ? 'deficiency' : 'active'}">
              ${escapeHtml(g.compliance_result || 'Awaiting Verification')}
            </span>
          </td>
          <td>
            ${isPending ? `<a href="grades.html" class="table-action">Verify in Grades</a>` : '<span style="font-size:12px; color:var(--muted);">Completed</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('#refresh-dashboard')?.addEventListener('click', loadDashboard);
    loadDashboard();
  });
})();
