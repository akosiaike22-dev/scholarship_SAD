// Scholar Records Management Module

window.ScholarsModule = {
  scholars: [],

  async init() {
    await this.loadScholars();
    this.bindEvents();
  },

  async loadScholars() {
    this.scholars = await window.DB.getScholars();
    this.renderTable();
    this.populateSubmissionsSelect();
    if (window.App) window.App.updateDashboardMetrics();
  },

  populateSubmissionsSelect() {
    const subSelect = document.getElementById('subScholarSelect');
    if (subSelect) {
      subSelect.innerHTML = '<option value="">-- Choose Scholar --</option>' +
        this.scholars.map(s => `
          <option value="${s.id}">${s.student_id} - ${s.full_name} (${s.degree_program})</option>
        `).join('');
    }
  },

  getProgramName(progId) {
    if (!progId) return 'None Assigned';
    const prog = window.ProgramsModule?.programs?.find(p => p.id === Number(progId));
    return prog ? prog.program_name : `Program #${progId}`;
  },

  getStatusBadgeClass(status) {
    switch (status) {
      case 'Compliant': return 'badge-compliant';
      case 'With Deficiency': return 'badge-deficiency';
      case 'For Verification':
      case 'Pending Submission': return 'badge-pending';
      case 'Active': return 'badge-active';
      default: return 'badge-inactive';
    }
  },

  renderTable() {
    const tbody = document.getElementById('scholarsTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('scholarSearchInput')?.value || '').toLowerCase().trim();
    const progFilter = document.getElementById('scholarProgramFilter')?.value || '';
    const statusFilter = document.getElementById('scholarStatusFilter')?.value || '';

    const filtered = this.scholars.filter(s => {
      const matchSearch = !searchTerm || 
        s.student_id.toLowerCase().includes(searchTerm) || 
        s.full_name.toLowerCase().includes(searchTerm);
      const matchProg = !progFilter || String(s.scholarship_id) === String(progFilter);
      const matchStatus = !statusFilter || s.status === statusFilter;
      return matchSearch && matchProg && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No matching scholars found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(s => `
      <tr>
        <td style="font-weight: 600;">${s.student_id}</td>
        <td>${s.full_name}</td>
        <td>${s.degree_program}</td>
        <td>${s.year_level}</td>
        <td><span style="font-size: 12px; color: var(--text-muted);">${this.getProgramName(s.scholarship_id)}</span></td>
        <td><span class="badge ${this.getStatusBadgeClass(s.status)}">${s.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="window.ScholarsModule.openEditModal(${s.id})">Edit</button>
        </td>
      </tr>
    `).join('');
  },

  openAddModal() {
    const modal = document.getElementById('scholarModal');
    const form = document.getElementById('scholarForm');
    document.getElementById('scholarModalTitle').innerText = 'Register New Scholar';
    document.getElementById('scholarEditId').value = '';
    form.reset();
    modal.classList.add('active');
  },

  openEditModal(id) {
    const scholar = this.scholars.find(s => s.id === Number(id));
    if (!scholar) return;

    document.getElementById('scholarModalTitle').innerText = 'Edit Scholar Record';
    document.getElementById('scholarEditId').value = scholar.id;
    document.getElementById('studentIdInput').value = scholar.student_id;
    document.getElementById('fullNameInput').value = scholar.full_name;
    document.getElementById('degreeProgramInput').value = scholar.degree_program;
    document.getElementById('yearLevelInput').value = scholar.year_level;
    document.getElementById('scholarshipSelect').value = scholar.scholarship_id || '';
    document.getElementById('scholarStatusSelect').value = scholar.status || 'Active';

    document.getElementById('scholarModal').classList.add('active');
  },

  bindEvents() {
    const addBtn = document.getElementById('btnOpenAddScholar');
    if (addBtn) addBtn.addEventListener('click', () => this.openAddModal());

    const form = document.getElementById('scholarForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('scholarEditId').value;
        const studentId = document.getElementById('studentIdInput').value.trim();
        const fullName = document.getElementById('fullNameInput').value.trim();
        const degree = document.getElementById('degreeProgramInput').value.trim();
        const yearLevel = document.getElementById('yearLevelInput').value;
        const scholarshipId = document.getElementById('scholarshipSelect').value;
        const status = document.getElementById('scholarStatusSelect').value;

        // Validations
        if (!studentId) {
          window.App.showAlert('Student ID cannot be blank.', 'danger');
          return;
        }
        if (!scholarshipId) {
          window.App.showAlert('Scholarship program must be selected.', 'danger');
          return;
        }

        // Uniqueness check for student ID
        const existing = this.scholars.find(s => 
          s.student_id.toLowerCase() === studentId.toLowerCase() && 
          (!editId || s.id !== Number(editId))
        );
        if (existing) {
          window.App.showAlert(`Student ID "${studentId}" is already registered.`, 'danger');
          return;
        }

        const scholarData = {
          student_id: studentId,
          full_name: fullName,
          degree_program: degree,
          year_level: yearLevel,
          scholarship_id: Number(scholarshipId),
          status: status
        };

        if (editId) {
          await window.DB.updateScholar(editId, scholarData);
          window.App.showAlert(`Scholar "${fullName}" updated successfully.`, 'success');
        } else {
          await window.DB.addScholar(scholarData);
          window.App.showAlert(`Scholar "${fullName}" registered successfully.`, 'success');
        }

        document.getElementById('scholarModal').classList.remove('active');
        await this.loadScholars();
      });
    }

    // Search and Filter Listeners
    ['scholarSearchInput', 'scholarProgramFilter', 'scholarStatusFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.renderTable());
        el.addEventListener('change', () => this.renderTable());
      }
    });
  }
};
