document.addEventListener("DOMContentLoaded", async () => {
  if (!TFLayout.requireAuth()) return;
  const content = TFLayout.render("profile.html", "Profile");
  await renderProfile(content);
});

async function renderProfile(content) {
  const user = TeamFlowAPI.getUser();

  let workload = null;
  try {
    workload = await TeamFlowAPI.get("/workload/me");
  } catch {}

  content.innerHTML = `
    <div class="row g-3">
      <div class="col-lg-5">
        <div class="tf-card mb-3">
          <div class="tf-card-body text-center py-4">
            <span class="tf-avatar tf-avatar-lg mx-auto mb-3" style="display:flex;">${TFLayout.initials(user.name)}</span>
            <h3 style="font-size:1.1rem; font-weight:700;">${TFLayout.escapeHtml(user.name)}</h3>
            <p class="text-muted mb-2">${TFLayout.escapeHtml(user.email)}</p>
            <div class="d-flex justify-content-center gap-2">
              <span class="tf-badge bg-soft-primary"><i class="bi bi-shield-check"></i>${TFLayout.roleLabel(user.role)}</span>
              ${user.is_active === false ? `<span class="tf-badge bg-soft-danger">Inactive</span>` : `<span class="tf-badge bg-soft-success">Active</span>`}
            </div>
          </div>
        </div>

        <div class="tf-card">
          <div class="tf-card-header"><h3>Edit Profile</h3></div>
          <div class="tf-card-body">
            <div class="alert alert-danger d-none" id="profileError"></div>
            <form id="profileForm">
              <div class="mb-3">
                <label class="form-label">Full Name</label>
                <input type="text" class="form-control" id="pfName" required value="${TFLayout.escapeHtml(user.name)}">
              </div>
              <div class="mb-3">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" id="pfEmail" required value="${TFLayout.escapeHtml(user.email)}">
              </div>
              <button type="submit" class="btn btn-primary btn-sm" id="profileSaveBtn">Save Changes</button>
            </form>
          </div>
        </div>

        <div class="tf-card mt-3">
          <div class="tf-card-header"><h3>Change Password</h3></div>
          <div class="tf-card-body">
            <div class="alert alert-danger d-none" id="passwordError"></div>
            <form id="passwordForm">
              <div class="mb-3">
                <label class="form-label">Current Password</label>
                <input type="password" class="form-control" id="pfCurrentPassword" required>
              </div>
              <div class="mb-3">
                <label class="form-label">New Password</label>
                <input type="password" class="form-control" id="pfNewPassword" required minlength="6">
              </div>
              <div class="mb-3">
                <label class="form-label">Confirm New Password</label>
                <input type="password" class="form-control" id="pfConfirmPassword" required minlength="6">
              </div>
              <button type="submit" class="btn btn-primary btn-sm" id="passwordSaveBtn">Update Password</button>
            </form>
          </div>
        </div>
      </div>

      <div class="col-lg-7">
        <div class="tf-card">
          <div class="tf-card-header"><h3>My Workload</h3></div>
          <div class="tf-card-body">
            ${
              workload
                ? `
              <div class="row g-3 text-center">
                <div class="col-3"><div class="tf-stat-value" style="font-size:1.4rem;">${workload.active_tasks}</div><div class="tf-stat-label">Active</div></div>
                <div class="col-3"><div class="tf-stat-value" style="font-size:1.4rem;">${workload.completed_tasks}</div><div class="tf-stat-label">Completed</div></div>
                <div class="col-3"><div class="tf-stat-value" style="font-size:1.4rem; color:var(--tf-danger);">${workload.overdue_tasks}</div><div class="tf-stat-label">Overdue</div></div>
                <div class="col-3"><div class="tf-stat-value" style="font-size:1.4rem;">${workload.completion_rate}%</div><div class="tf-stat-label">Completion</div></div>
              </div>
              <div class="tf-progress mt-4"><div class="tf-progress-bar" style="width:${Math.min(100, workload.workload_score)}%"></div></div>
              <div class="text-muted mt-2" style="font-size:0.8rem;">Workload score: ${Math.min(100, workload.workload_score)}%</div>
            `
                : TFLayout.emptyState("bi-bar-chart", "No workload data", "")
            }
          </div>
        </div>
      </div>
    </div>
  `;

  wireProfileForm();
  wirePasswordForm();
}

function wireProfileForm() {
  const form = document.getElementById("profileForm");
  const errorBox = document.getElementById("profileError");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("d-none");
    const user = TeamFlowAPI.getUser();
    const btn = document.getElementById("profileSaveBtn");
    btn.disabled = true;

    try {
      const updated = await TeamFlowAPI.put(`/users/${user.id}`, {
        name: document.getElementById("pfName").value.trim(),
        email: document.getElementById("pfEmail").value.trim(),
      });
      TeamFlowAPI.setUser(updated);
      TFNotify.success("Profile updated.");
      const refreshedContent = TFLayout.render("profile.html", "Profile");
      await renderProfile(refreshedContent);
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove("d-none");
    } finally {
      btn.disabled = false;
    }
  });
}

function wirePasswordForm() {
  const form = document.getElementById("passwordForm");
  const errorBox = document.getElementById("passwordError");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("d-none");

    const currentPassword = document.getElementById("pfCurrentPassword").value;
    const newPassword = document.getElementById("pfNewPassword").value;
    const confirmPassword = document.getElementById("pfConfirmPassword").value;

    if (newPassword !== confirmPassword) {
      errorBox.textContent = "New password and confirmation do not match.";
      errorBox.classList.remove("d-none");
      return;
    }

    const user = TeamFlowAPI.getUser();
    const btn = document.getElementById("passwordSaveBtn");
    btn.disabled = true;

    try {
      await TeamFlowAPI.put(`/users/${user.id}`, {
        password: newPassword,
        current_password: currentPassword,
      });
      TFNotify.success("Password updated.");
      form.reset();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove("d-none");
    } finally {
      btn.disabled = false;
    }
  });
}
