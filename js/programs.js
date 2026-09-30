// Scholarship Programs & Academic Requirements Management Module

window.ProgramsModule = {
  programs: [],

  async init() {
    await this.loadPrograms();
    this.bindEvents();
  },

  async loadPrograms() {
    this.programs = await window.DB.getPrograms();
    this.renderTable();
    this.populateSelects();
  },

  renderTable() {
    const tbody = document.getElementById('programsTableBody');
    if (!tbody) return;

    if (this.programs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No scholarship programs found.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.programs.map(prog => `
      <tr>
        <td style="font-weight: 600;">${prog.program_name}</td>
        <td>&le; ${Number(prog.required_gwa).toFixed(2)}</td>
        <td>${prog.min_units} units</td>
        <td>
          ${prog.allow_failing_grade 
            ? '<span class="badge badge-pending">Allowed</span>' 
            : '<span class="badge badge-inactive">Not Allowed (0 Failed)</span>'}
        </td>
        <td>
          <span class="badge ${prog.active ? 'badge-active' : 'badge-inactive'}">
            ${prog.active ? 'Active' : 'Inactive'}
          </span>
        </td>
      </tr>
    `).join('');
  },

  populateSelects() {
    // Populate scholar form program select
    const scholarSelect = document.getElementById('scholarshipSelect');
    if (scholarSelect) {
      scholarSelect.innerHTML = '<option value="">-- Select Scholarship Program --</option>' +
        this.programs.filter(p => p.active).map(p => `
          <option value="${p.id}">${p.program_name} (Req: &le;${p.required_gwa}, Min ${p.min_units}u)</option>
        `).join('');
    }

    // Populate filter select in Scholars tab
    const filterSelect = document.getElementById('scholarProgramFilter');
    if (filterSelect) {
      const currentVal = filterSelect.value;
      filterSelect.innerHTML = '<option value="">All Programs</option>' +
        this.programs.map(p => `<option value="${p.id}">${p.program_name}</option>`).join('');
      filterSelect.value = currentVal;
    }
  },

  bindEvents() {
    const openBtn = document.getElementById('btnOpenAddProgram');
    const modal = document.getElementById('programModal');
    const form = document.getElementById('programForm');

    if (openBtn && modal) {
      openBtn.addEventListener('click', () => {
        form.reset();
        modal.classList.add('active');
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('programNameInput').value.trim();
        const gwa = parseFloat(document.getElementById('requiredGwaInput').value);
        const units = parseInt(document.getElementById('minUnitsInput').value, 10);
        const allowFailing = document.getElementById('allowFailingCheck').checked;

        // Validations
        if (!name) {
          window.App.showAlert('Program name is required.', 'danger');
          return;
        }
        if (isNaN(gwa) || gwa < 1.00 || gwa > 5.00) {
          window.App.showAlert('Required GWA must be between 1.00 and 5.00.', 'danger');
          return;
        }
        if (isNaN(units) || units <= 0) {
          window.App.showAlert('Minimum units must be greater than zero.', 'danger');
          return;
        }

        const newProg = {
          program_name: name,
          required_gwa: gwa,
          min_units: units,
          allow_failing_grade: allowFailing,
          active: true
        };

        await window.DB.addProgram(newProg);
        window.App.showAlert(`Program "${name}" added successfully.`, 'success');
        modal.classList.remove('active');
        await this.loadPrograms();
        if (window.ScholarsModule) await window.ScholarsModule.loadScholars();
      });
    }
  }
};
