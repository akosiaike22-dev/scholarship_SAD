// Semester Grade Submission & Verification Module

window.SubmissionsModule = {
  submissions: [],

  async init() {
    await this.loadSubmissions();
    this.bindEvents();
  },

  async loadSubmissions() {
    this.submissions = await window.DB.getSubmissions();
    this.renderTable();
    if (window.App) window.App.updateDashboardMetrics();
    if (window.ComplianceModule) window.ComplianceModule.renderTable();
  },

  getScholarName(scholarId) {
    const s = window.ScholarsModule?.scholars?.find(x => x.id === Number(scholarId));
    return s ? `${s.full_name} (${s.student_id})` : `Scholar #${scholarId}`;
  },

  renderTable() {
    const tbody = document.getElementById('submissionsTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('submissionSearchInput')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('submissionStatusFilter')?.value || '';

    const filtered = this.submissions.filter(sub => {
      const scholarName = this.getScholarName(sub.scholar_id).toLowerCase();
      const matchSearch = !searchTerm || scholarName.includes(searchTerm);
      const matchStatus = !statusFilter || sub.submission_status === statusFilter;
      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">No grade submissions found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(sub => {
      const isPending = sub.submission_status === 'Pending';
      const isVerified = sub.submission_status === 'Verified';

      let statusBadge = 'badge-pending';
      if (isVerified) statusBadge = 'badge-verified';
      if (sub.submission_status === 'Returned') statusBadge = 'badge-deficiency';

      return `
        <tr>
          <td style="font-weight: 600;">${this.getScholarName(sub.scholar_id)}</td>
          <td>${sub.academic_year} - ${sub.semester}</td>
          <td><strong>${Number(sub.gwa).toFixed(2)}</strong></td>
          <td>${sub.units_enrolled}</td>
          <td>${sub.failed_subjects > 0 ? `<span style="color:var(--danger); font-weight:600;">${sub.failed_subjects}</span>` : '0'}</td>
          <td>${sub.incomplete_subjects > 0 ? `<span style="color:var(--warning); font-weight:600;">${sub.incomplete_subjects}</span>` : '0'}</td>
          <td><span class="badge ${statusBadge}">${sub.submission_status}</span></td>
          <td>
            <small style="color: var(--text-muted);">
              ${sub.verified_by ? `${sub.verified_by} <br>(${new Date(sub.verified_at).toLocaleDateString()})` : 'Awaiting Verification'}
            </small>
          </td>
          <td>
            ${isPending ? `
              <button class="btn btn-primary btn-sm" onclick="window.SubmissionsModule.verifySubmission(${sub.id})">
                Verify
              </button>
            ` : `
              <span class="badge badge-compliant" style="font-size: 11px;">Verified</span>
            `}
          </td>
        </tr>
      `;
    }).join('');
  },

  async verifySubmission(id) {
    const user = window.Auth.getCurrentUser();
    if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
      window.App.showAlert('Only authorized scholarship staff or admin may verify submissions.', 'danger');
      return;
    }

    const sub = this.submissions.find(s => s.id === Number(id));
    if (!sub) return;

    if (sub.submission_status === 'Verified') {
      window.App.showAlert('This submission has already been verified.', 'danger');
      return;
    }

    const updates = {
      submission_status: 'Verified',
      verified_by: `${user.full_name} (${user.role.toUpperCase()})`,
      verified_at: new Date().toISOString()
    };

    // Automatically trigger compliance evaluation upon verification
    const evaluated = window.ComplianceModule.evaluateSingleSubmission(sub, updates);
    updates.evaluation_status = evaluated.evaluation_status;
    updates.deficiency_reasons = evaluated.deficiency_reasons;

    await window.DB.updateSubmission(id, updates);

    // Update the scholar's official status
    await window.DB.updateScholar(sub.scholar_id, {
      status: evaluated.evaluation_status
    });

    window.App.showAlert(`Submission for ${this.getScholarName(sub.scholar_id)} successfully verified! Evaluation: ${evaluated.evaluation_status}`, 'success');
    
    await this.loadSubmissions();
    if (window.ScholarsModule) await window.ScholarsModule.loadScholars();
    if (window.ComplianceModule) window.ComplianceModule.renderTable();
  },

  bindEvents() {
    const openBtn = document.getElementById('btnOpenSubmitGrade');
    const modal = document.getElementById('submissionModal');
    const form = document.getElementById('submissionForm');

    if (openBtn && modal) {
      openBtn.addEventListener('click', () => {
        form.reset();
        document.getElementById('subAcademicYear').value = '2025-2026';
        modal.classList.add('active');
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const scholarId = document.getElementById('subScholarSelect').value;
        const ay = document.getElementById('subAcademicYear').value.trim();
        const sem = document.getElementById('subSemester').value;
        const gwa = parseFloat(document.getElementById('subGwa').value);
        const units = parseInt(document.getElementById('subUnits').value, 10);
        const failed = parseInt(document.getElementById('subFailed').value, 10);
        const inc = parseInt(document.getElementById('subIncomplete').value, 10);

        // Required Validations
        if (!scholarId) {
          window.App.showAlert('Please select a scholar.', 'danger');
          return;
        }
        if (!ay) {
          window.App.showAlert('Academic Year is required.', 'danger');
          return;
        }
        if (isNaN(gwa) || gwa < 1.00 || gwa > 5.00) {
          window.App.showAlert('GWA must be within the valid range of 1.00 to 5.00.', 'danger');
          return;
        }
        if (isNaN(units) || units < 0) {
          window.App.showAlert('Units cannot be negative.', 'danger');
          return;
        }
        if (isNaN(failed) || failed < 0) {
          window.App.showAlert('Failed subjects count cannot be negative.', 'danger');
          return;
        }
        if (isNaN(inc) || inc < 0) {
          window.App.showAlert('Incomplete subjects count cannot be negative.', 'danger');
          return;
        }

        const newSub = {
          scholar_id: Number(scholarId),
          academic_year: ay,
          semester: sem,
          gwa: gwa,
          units_enrolled: units,
          failed_subjects: failed,
          incomplete_subjects: inc,
          submission_status: 'Pending',
          verified_by: null,
          verified_at: null,
          evaluation_status: 'None',
          deficiency_reasons: ''
        };

        await window.DB.addSubmission(newSub);

        // Update scholar status to Pending Submission / For Verification
        await window.DB.updateScholar(scholarId, {
          status: 'For Verification'
        });

        window.App.showAlert('Semester grade submission saved as Pending / For Verification.', 'success');
        modal.classList.remove('active');
        await this.loadSubmissions();
        if (window.ScholarsModule) await window.ScholarsModule.loadScholars();
      });
    }

    // Filters
    ['submissionSearchInput', 'submissionStatusFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.renderTable());
        el.addEventListener('change', () => this.renderTable());
      }
    });
  }
};
