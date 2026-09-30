// Main Application Coordinator & Dashboard Controller

window.App = {
  currentTab: 'dashboard',

  async init() {
    this.bindGlobalEvents();
    this.checkSession();
  },

  checkSession() {
    const user = window.Auth.getCurrentUser();
    const navLinks = document.getElementById('navLinks');
    const userSection = document.getElementById('userSection');
    const loginSection = document.getElementById('loginSection');

    if (user) {
      navLinks.style.display = 'flex';
      userSection.style.display = 'flex';
      document.getElementById('userNameDisplay').innerText = user.full_name || user.email;
      document.getElementById('userRoleBadge').innerText = user.role;
      loginSection.classList.remove('active');

      // Initialize all modules
      window.ProgramsModule.init();
      window.ScholarsModule.init();
      window.SubmissionsModule.init();
      window.ComplianceModule.init();

      this.switchTab('dashboard');
    } else {
      navLinks.style.display = 'none';
      userSection.style.display = 'none';
      this.hideAllTabs();
      loginSection.classList.add('active');
    }
  },

  hideAllTabs() {
    document.querySelectorAll('.tab-content').forEach(section => {
      section.classList.remove('active');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
  },

  switchTab(tabName) {
    this.hideAllTabs();
    this.currentTab = tabName;

    const targetSection = document.getElementById(`${tabName}Section`);
    const targetBtn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);

    if (targetSection) targetSection.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');

    // Trigger tab-specific refresh
    if (tabName === 'dashboard') this.updateDashboardMetrics();
    if (tabName === 'scholars') window.ScholarsModule?.loadScholars();
    if (tabName === 'programs') window.ProgramsModule?.loadPrograms();
    if (tabName === 'submissions') window.SubmissionsModule?.loadSubmissions();
    if (tabName === 'compliance') window.ComplianceModule?.renderTable();
  },

  async updateDashboardMetrics() {
    const scholars = await window.DB.getScholars();
    const submissions = await window.DB.getSubmissions();

    // 1. Total Scholars (active)
    const totalScholars = scholars.filter(s => s.status !== 'Disqualified').length;
    // 2. Pending Submissions
    const pendingSubs = submissions.filter(s => s.submission_status === 'Pending').length;
    // 3. Verified Submissions
    const verifiedSubs = submissions.filter(s => s.submission_status === 'Verified').length;
    // 4. Compliant Scholars
    const compliantScholars = scholars.filter(s => s.status === 'Compliant').length;
    // 5. With Deficiency Scholars
    const deficiencyScholars = scholars.filter(s => s.status === 'With Deficiency').length;

    document.getElementById('statTotalScholars').innerText = totalScholars;
    document.getElementById('statPendingSubmissions').innerText = pendingSubs;
    document.getElementById('statVerifiedSubmissions').innerText = verifiedSubs;
    document.getElementById('statCompliantScholars').innerText = compliantScholars;
    document.getElementById('statDeficiencyScholars').innerText = deficiencyScholars;

    this.renderDashboardRecentTable(submissions, scholars);
  },

  renderDashboardRecentTable(submissions, scholars) {
    const tbody = document.getElementById('dashboardRecentTableBody');
    if (!tbody) return;

    if (!submissions || submissions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No recent grade submissions found.</td></tr>`;
      return;
    }

    const recent = submissions.slice(0, 5);
    tbody.innerHTML = recent.map(sub => {
      const scholar = scholars.find(s => s.id === Number(sub.scholar_id));
      const sName = scholar ? scholar.full_name : `Scholar #${sub.scholar_id}`;
      const isPending = sub.submission_status === 'Pending';
      const evalStatus = sub.evaluation_status || 'None';

      let evalBadge = 'badge-inactive';
      if (evalStatus === 'Compliant') evalBadge = 'badge-compliant';
      if (evalStatus === 'With Deficiency') evalBadge = 'badge-deficiency';

      return `
        <tr>
          <td style="font-weight: 600;">${sName}</td>
          <td>${sub.academic_year} ${sub.semester}</td>
          <td>${Number(sub.gwa).toFixed(2)}</td>
          <td>${sub.units_enrolled}</td>
          <td>
            <span class="badge ${isPending ? 'badge-pending' : 'badge-verified'}">
              ${sub.submission_status}
            </span>
          </td>
          <td>
            <span class="badge ${evalBadge}">${evalStatus}</span>
          </td>
          <td>
            ${isPending ? `
              <button class="btn btn-primary btn-sm" onclick="window.SubmissionsModule.verifySubmission(${sub.id})">Verify Now</button>
            ` : `
              <span style="font-size: 11px; color: var(--text-muted);">Evaluated</span>
            `}
          </td>
        </tr>
      `;
    }).join('');
  },

  showAlert(message, type = 'info') {
    const box = document.getElementById('alertBox');
    if (!box) return;

    box.className = `alert alert-${type}`;
    box.innerText = message;
    box.style.display = 'block';

    setTimeout(() => {
      box.style.display = 'none';
    }, 4500);
  },

  bindGlobalEvents() {
    // Nav Tab Switching
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Refresh Dashboard Button
    const refreshBtn = document.getElementById('btnRefreshDashboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.updateDashboardMetrics();
        this.showAlert('Dashboard refreshed.', 'info');
      });
    }

    // Modal Close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetModalId = btn.getAttribute('data-close');
        const modal = document.getElementById(targetModalId);
        if (modal) modal.classList.remove('active');
      });
    });

    // Close modal when clicking on overlay background
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });

    // Login Form Submit
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const role = document.getElementById('loginRole').value;

        const res = await window.Auth.login(email, password, role);
        if (res.success) {
          this.checkSession();
          this.showAlert(`Welcome back, ${res.user.full_name}!`, 'success');
        } else {
          this.showAlert('Login failed. Please check your credentials.', 'danger');
        }
      });
    }

    // Logout
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        window.Auth.logout();
      });
    }
  }
};

// Initialize Application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
