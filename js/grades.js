(() => {
  let scholars = [];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const setMessage = (text, success = false) => { const node = document.querySelector('#page-message'); node.textContent = text; node.classList.toggle('success', success); };
  const badgeClass = (status, result) => result === 'With Deficiency' ? 'deficiency' : result === 'Compliant' || status === 'Verified' ? 'verified' : status.toLowerCase();

  async function loadScholars() {
    const { data, error } = await window.db.from('scholars').select('id,student_id,full_name').order('full_name');
    if (error) { setMessage(error.message); return; }
    scholars = data;
    document.querySelector('[name="scholar_id"]').innerHTML = '<option value="">Select a scholar</option>' + data.map((s) => `<option value="${s.id}">${escapeHtml(s.student_id)} · ${escapeHtml(s.full_name)}</option>`).join('');
  }
  async function loadGrades() {
    const status = document.querySelector('#grade-status-filter').value;
    let query = window.db.from('grade_submissions').select('id,scholar_id,academic_year,semester,gwa,units_enrolled,submission_status,submitted_at,compliance_result,deficiency_reasons,scholars(student_id,full_name)').order('submitted_at', { ascending: false });
    if (status) query = query.eq('submission_status', status);
    const { data, error } = await query;
    const tbody = document.querySelector('#grades-table');
    if (error) { tbody.innerHTML = `<tr><td colspan="9">${escapeHtml(error.message)}</td></tr>`; return; }
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty">No grade submissions found.</td></tr>'; return; }
    tbody.innerHTML = data.map((g) => `<tr><td>${escapeHtml(g.scholars?.full_name)}</td><td>${escapeHtml(g.scholars?.student_id)}</td><td>${escapeHtml(g.academic_year)} · ${escapeHtml(g.semester)}</td><td>${Number(g.gwa).toFixed(2)}</td><td>${g.units_enrolled}</td><td>${new Date(g.submitted_at).toLocaleDateString()}</td><td><span class="badge ${badgeClass(g.submission_status, g.compliance_result)}">${escapeHtml(g.submission_status)}</span></td><td>${g.compliance_result ? `<span class="badge ${badgeClass(g.submission_status, g.compliance_result)}">${escapeHtml(g.compliance_result)}</span>` : 'Not evaluated'}</td><td>${g.submission_status === 'Pending' ? `<button class="table-action" data-verify="${g.id}">Verify & evaluate</button>` : '—'}</td></tr>`).join('');
    tbody.querySelectorAll('[data-verify]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      const { data: result, error: verifyError } = await window.db.rpc('verify_and_evaluate_submission', { p_submission_id: button.dataset.verify });
      if (verifyError) { setMessage(verifyError.message); button.disabled = false; return; }
      const reasons = result.reasons?.length ? ` ${result.reasons.join(' ')}` : '';
      setMessage(`Submission verified. Result: ${result.result}.${reasons}`, result.result === 'Compliant');
      await Promise.all([loadGrades(), loadScholars()]);
    }));
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('#grade-status-filter').addEventListener('change', loadGrades);
    document.querySelector('#grade-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const gwa = Number(form.get('gwa'));
      const units = Number(form.get('units_enrolled'));
      const failed = Number(form.get('failed_subjects'));
      const incomplete = Number(form.get('incomplete_subjects'));
      if (!form.get('scholar_id')) return setMessage('Select a scholar.');
      if (gwa < 1 || gwa > 5 || !Number.isFinite(gwa)) return setMessage('GWA must be between 1.00 and 5.00.');
      if ([units, failed, incomplete].some((value) => !Number.isInteger(value) || value < 0)) return setMessage('Units, failed subjects, and incomplete subjects must be zero or greater whole numbers.');
      const { error } = await window.db.from('grade_submissions').insert({ scholar_id: form.get('scholar_id'), academic_year: String(form.get('academic_year')).trim(), semester: form.get('semester'), gwa, units_enrolled: units, failed_subjects: failed, incomplete_subjects: incomplete, submission_status: 'Pending' });
      if (error) { setMessage(error.code === '23505' ? 'A submission already exists for this scholar, academic year, and semester.' : error.message); return; }
      event.currentTarget.reset();
      setMessage('Grades submitted and marked Pending for verification.', true);
      await Promise.all([loadGrades(), loadScholars()]);
    });
    loadScholars(); loadGrades();
  });
})();
