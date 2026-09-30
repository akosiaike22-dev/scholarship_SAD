// Academic Compliance Evaluation Engine Module

window.ComplianceModule = {
  async init() {
    this.bindEvents();
    this.renderTable();
  },

  /**
   * Evaluates a submission against its scholar's assigned scholarship program rules
   * Business Rules implemented: BR-02, BR-05, BR-06, BR-07
   * 
   * Rule Logic:
   * Philippine Grading System: 1.00 is highest, 3.00 is passing.
   * GWA satisfies program when: submitted_gwa <= required_gwa.
   * Units satisfy program when: units_enrolled >= min_units.
   * Failing grades: if allow_failing_grade is false, failed_subjects must be 0.
   * Incompletes: incomplete_subjects must be 0 (BR-06).
   */
  evaluateSingleSubmission(submission, overrides = {}) {
    const scholars = window.ScholarsModule?.scholars || [];
    const programs = window.ProgramsModule?.programs || [];

    const scholar = scholars.find(s => s.id === Number(submission.scholar_id));
    if (!scholar) {
      return { evaluation_status: 'None', deficiency_reasons: 'Scholar record not found' };
    }

    const program = programs.find(p => p.id === Number(scholar.scholarship_id));
    if (!program) {
      return { 
        evaluation_status: 'With Deficiency', 
        deficiency_reasons: 'No active scholarship program assigned to scholar.' 
      };
    }

    const subStatus = overrides.submission_status || submission.submission_status;
    if (subStatus !== 'Verified') {
      return { 
        evaluation_status: 'None', 
        deficiency_reasons: 'Submission is pending verification.' 
      };
    }

    const deficiencies = [];
    const gwa = Number(submission.gwa);
    const reqGwa = Number(program.required_gwa);
    const units = Number(submission.units_enrolled);
    const minUnits = Number(program.min_units);
    const failed = Number(submission.failed_subjects || 0);
    const inc = Number(submission.incomplete_subjects || 0);

    // 1. GWA Check (Philippine scale: 1.00 is highest, 5.00 is failed)
    if (gwa > reqGwa) {
      deficiencies.push(`GWA of ${gwa.toFixed(2)} exceeds maximum required threshold of ${reqGwa.toFixed(2)}`);
    }

    // 2. Units Enrolled Check
    if (units < minUnits) {
      deficiencies.push(`Enrolled units (${units}) below required minimum (${minUnits} units)`);
    }

    // 3. Failed Subjects Policy Check
    if (!program.allow_failing_grade && failed > 0) {
      deficiencies.push(`Has ${failed} failed subject(s); failing grades not permitted by scholarship`);
    }

    // 4. Incomplete Subjects Check (BR-06: cannot be compliant with incomplete requirements)
    if (inc > 0) {
      deficiencies.push(`Has ${inc} incomplete (INC) subject(s) requiring resolution`);
    }

    if (deficiencies.length === 0) {
      return {
        evaluation_status: 'Compliant',
        deficiency_reasons: ''
      };
    } else {
      return {
        evaluation_status: 'With Deficiency',
        deficiency_reasons: deficiencies.join('; ')
      };
    }
  },

  async reevaluateAllVerified() {
    const submissions = await window.DB.getSubmissions();
    const verifiedSubs = submissions.filter(s => s.submission_status === 'Verified');
    
    let count = 0;
    for (const sub of verifiedSubs) {
      const result = this.evaluateSingleSubmission(sub);
      await window.DB.updateSubmission(sub.id, {
        evaluation_status: result.evaluation_status,
        deficiency_reasons: result.deficiency_reasons
      });
      await window.DB.updateScholar(sub.scholar_id, {
        status: result.evaluation_status
      });
      count++;
    }

    window.App.showAlert(`Successfully re-evaluated ${count} verified submission(s).`, 'success');
    if (window.SubmissionsModule) await window.SubmissionsModule.loadSubmissions();
    if (window.ScholarsModule) await window.ScholarsModule.loadScholars();
    this.renderTable();
  },

  renderTable() {
    const tbody = document.getElementById('complianceTableBody');
    if (!tbody) return;

    const submissions = window.SubmissionsModule?.submissions || [];
    const verified = submissions.filter(s => s.submission_status === 'Verified');

    if (verified.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No verified submissions found for compliance evaluation.</td></tr>`;
      return;
    }

    tbody.innerHTML = verified.map(sub => {
      const scholar = window.ScholarsModule?.scholars?.find(s => s.id === Number(sub.scholar_id));
      const prog = scholar ? window.ProgramsModule?.programs?.find(p => p.id === Number(scholar.scholarship_id)) : null;

      const evalStatus = sub.evaluation_status || 'None';
      const isCompliant = evalStatus === 'Compliant';

      return `
        <tr>
          <td style="font-weight: 600;">${scholar ? scholar.full_name : `Scholar #${sub.scholar_id}`}</td>
          <td><span style="font-size: 12px; color: var(--text-muted);">${prog ? prog.program_name : 'No Program'}</span></td>
          <td>${sub.academic_year} (${sub.semester})</td>
          <td>
            GWA: <strong>${Number(sub.gwa).toFixed(2)}</strong> | Units: ${sub.units_enrolled} | Failed: ${sub.failed_subjects} | INC: ${sub.incomplete_subjects}
          </td>
          <td>
            ${prog ? `Req GWA: &le;${Number(prog.required_gwa).toFixed(2)} | Min ${prog.min_units}u | Fail: ${prog.allow_failing_grade ? 'Yes' : 'No'}` : 'N/A'}
          </td>
          <td>
            <span class="badge ${isCompliant ? 'badge-compliant' : 'badge-deficiency'}">
              ${evalStatus}
            </span>
          </td>
          <td>
            ${sub.deficiency_reasons ? `<span style="font-size: 11px; color: var(--danger);">${sub.deficiency_reasons}</span>` : '<span style="font-size: 11px; color: var(--success);">All criteria satisfied</span>'}
          </td>
        </tr>
      `;
    }).join('');
  },

  bindEvents() {
    const btnReeval = document.getElementById('btnReevaluateAll');
    if (btnReeval) {
      btnReeval.addEventListener('click', () => this.reevaluateAllVerified());
    }
  }
};
