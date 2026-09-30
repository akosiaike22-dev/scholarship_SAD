(() => {
  let programs = [];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  async function load() {
    const { data, error } = await window.db.from('scholarship_programs').select('*').order('program_name');
    if (error) { document.querySelector('#page-message').textContent = error.message; return; }
    programs = data;
    const tbody = document.querySelector('#programs-table');
    tbody.innerHTML = data.length ? data.map((p) => `<tr><td>${escapeHtml(p.program_name)}</td><td>${Number(p.required_gwa).toFixed(2)}</td><td>${p.min_units}</td><td>${p.allow_failing_grade ? 'Yes' : 'No'}</td><td>${p.active ? 'Active' : 'Inactive'}</td><td><button class="table-action" data-edit="${p.id}">Edit</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty">No scholarship programs have been added.</td></tr>';
    tbody.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => openEditor(programs.find((p) => p.id === button.dataset.edit))));
  }
  function openEditor(program = null) {
    const form = document.querySelector('#program-form'); form.reset();
    document.querySelector('#program-dialog-title').textContent = program ? 'Edit program' : 'Add program';
    form.elements.id.value = program?.id || ''; form.elements.program_name.value = program?.program_name || ''; form.elements.required_gwa.value = program?.required_gwa ?? '';
    form.elements.min_units.value = program?.min_units ?? ''; form.elements.allow_failing_grade.checked = program?.allow_failing_grade ?? false; form.elements.active.checked = program?.active ?? true;
    document.querySelector('#program-form-message').textContent = '';
    document.querySelector('#program-dialog').showModal();
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('#new-program').addEventListener('click', () => openEditor());
    document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => document.querySelector('#program-dialog').close()));
    document.querySelector('#program-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget; const values = new FormData(form); const id = values.get('id');
      const gwa = Number(values.get('required_gwa')); const units = Number(values.get('min_units'));
      const message = document.querySelector('#program-form-message');
      if (gwa < 1 || gwa > 5 || !Number.isFinite(gwa)) { message.textContent = 'GWA must be between 1.00 and 5.00.'; return; }
      if (units < 0 || !Number.isInteger(units)) { message.textContent = 'Minimum units must be a non-negative whole number.'; return; }
      const record = { program_name: String(values.get('program_name')).trim(), required_gwa: gwa, min_units: units, allow_failing_grade: form.elements.allow_failing_grade.checked, active: form.elements.active.checked };
      const query = id ? window.db.from('scholarship_programs').update(record).eq('id', id) : window.db.from('scholarship_programs').insert(record);
      const { error } = await query;
      if (error) { message.textContent = error.code === '23505' ? 'A program with that name already exists.' : error.message; return; }
      document.querySelector('#program-dialog').close(); document.querySelector('#page-message').textContent = 'Scholarship program saved.'; await load();
    });
    load();
  });
})();
