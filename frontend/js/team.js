let TF_TEAM_USERS = [];
let TF_TEAM_WORKLOAD = new Map();

const ROLE_LABELS = { admin: "Admin", project_manager: "Manager", team_member: "Member" };

document.addEventListener("DOMContentLoaded", async () => {
  if (!TFLayout.requireAuth()) return;
  const content = TFLayout.render("team.html", "Team");
  const currentUser = TeamFlowAPI.getUser();
  const canManageTeam = currentUser.role === "admin" || currentUser.role === "project_manager";

  content.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div class="tf-search-input" style="max-width:280px;">
        <i class="bi bi-search"></i>
        <input type="text" class="form-control" id="employeeWorkloadSearch" placeholder="Search employee workload...">
      </div>
      ${canManageTeam ? `<button class="btn btn-primary btn-sm" id="addMemberBtn"><i class="bi bi-person-plus me-1"></i>Add Member</button>` : ""}
    </div>

    <div id="employeeWorkloadPanel" class="mb-3"></div>

    <div class="tf-card">
      <div class="tf-table-wrap">
        <table class="tf-table">
          <thead>
            <tr>
              <th>Name</th><th>Role</th><th>Status</th><th>Active Tasks</th><th>Completed</th><th>Overdue</th><th>Completion Rate</th><th>Workload</th><th></th>
            </tr>
          </thead>
          <tbody id="teamBody"><tr><td colspan="9">${TFLayout.loadingState()}</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("employeeWorkloadSearch").addEventListener("input", (e) => renderWorkloadPanel(e.target.value));

  if (canManageTeam) {
    document.getElementById("addMemberBtn").addEventListener("click", () => openMemberModal());
  }

  await loadTeam();
});

async function loadTeam() {
  try {
    const [users, workload] = await Promise.all([
      TeamFlowAPI.get("/users"),
      TeamFlowAPI.get("/workload").catch(() => []),
    ]);
    TF_TEAM_USERS = users;
    TF_TEAM_WORKLOAD = new Map(workload.map((w) => [w.user_id, w]));
    renderTeamTable();
  } catch (err) {
    document.getElementById("teamBody").innerHTML = `<tr><td colspan="9">${TFLayout.emptyState("bi-exclamation-circle", "Could not load team", err.message)}</td></tr>`;
  }
}

function renderTeamTable() {
  const body = document.getElementById("teamBody");
  const currentUser = TeamFlowAPI.getUser();
  const isAdmin = currentUser.role === "admin";
  const canManageTeam = currentUser.role === "admin" || currentUser.role === "project_manager";

  if (!TF_TEAM_USERS.length) {
    body.innerHTML = `<tr><td colspan="9">${TFLayout.emptyState("bi-people", "No team members yet", "")}</td></tr>`;
    return;
  }

  body.innerHTML = TF_TEAM_USERS.map((u) => {
    const w = TF_TEAM_WORKLOAD.get(u.id);
    const pct = w ? Math.min(100, w.workload_score) : 0;
    const color = pct > 70 ? "#dc2626" : pct > 40 ? "#d97706" : "#16a34a";
    const canEditThis = isAdmin || (canManageTeam && u.role === "team_member");

    return `
      <tr>
        <td>
          <div class="d-flex align-items-center gap-2">
            <span class="tf-avatar">${TFLayout.initials(u.name)}</span>
            <div>
              <div class="fw-semibold">${TFLayout.escapeHtml(u.name)}</div>
              <div class="text-muted" style="font-size:0.74rem;">${TFLayout.escapeHtml(u.email)}</div>
            </div>
          </div>
        </td>
        <td>
          ${
            isAdmin && u.id !== currentUser.id
              ? `<select class="form-select form-select-sm" style="width:130px;" data-role-select="${u.id}">
                  ${Object.entries(ROLE_LABELS).map(([k, v]) => `<option value="${k}" ${u.role === k ? "selected" : ""}>${v}</option>`).join("")}
                </select>`
              : `<span class="tf-badge bg-soft-primary">${ROLE_LABELS[u.role] || u.role}</span>`
          }
        </td>
        <td>${u.is_active === false ? `<span class="tf-badge bg-soft-danger">Inactive</span>` : `<span class="tf-badge bg-soft-success">Active</span>`}</td>
        <td>${w ? w.active_tasks : "—"}</td>
        <td>${w ? w.completed_tasks : "—"}</td>
        <td>${w ? (w.overdue_tasks > 0 ? `<span class="text-danger fw-semibold">${w.overdue_tasks}</span>` : "0") : "—"}</td>
        <td>${w ? `${w.completion_rate}%` : "—"}</td>
        <td style="min-width:120px;">${w ? `<div class="tf-progress"><div class="tf-progress-bar" style="width:${pct}%; background:${color};"></div></div>` : "—"}</td>
        <td class="text-end">
          ${canEditThis ? `<button class="tf-icon-btn" data-edit-member="${u.id}" title="Edit"><i class="bi bi-pencil"></i></button>` : ""}
          ${isAdmin && u.id !== currentUser.id ? `<button class="tf-icon-btn" data-delete-member="${u.id}" title="Remove"><i class="bi bi-trash text-danger"></i></button>` : ""}
        </td>
      </tr>`;
  }).join("");

  body.querySelectorAll("[data-role-select]").forEach((select) => {
    select.addEventListener("change", () => changeRole(select.dataset.roleSelect, select.value, select));
  });
  body.querySelectorAll("[data-edit-member]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const u = TF_TEAM_USERS.find((x) => String(x.id) === btn.dataset.editMember);
      if (u) openMemberModal(u);
    })
  );
  body.querySelectorAll("[data-delete-member]").forEach((btn) =>
    btn.addEventListener("click", () => deleteMember(btn.dataset.deleteMember))
  );

  renderWorkloadPanel(document.getElementById("employeeWorkloadSearch").value);
}

async function changeRole(userId, newRole, selectEl) {
  const user = TF_TEAM_USERS.find((u) => String(u.id) === String(userId));
  if (!TFNotify.confirmAction(`Change ${user ? TFLayout.escapeHtml(user.name) : "this user"}'s role to "${ROLE_LABELS[newRole]}"?`)) {
    if (user) selectEl.value = user.role;
    return;
  }
  try {
    await TeamFlowAPI.put(`/users/${userId}`, { role: newRole });
    TFNotify.success("Role updated.");
    await loadTeam();
  } catch (err) {
    TFNotify.error(err.message);
    if (user) selectEl.value = user.role;
  }
}

async function deleteMember(userId) {
  if (!TFNotify.confirmAction("Remove this team member? This cannot be undone.")) return;
  try {
    await TeamFlowAPI.del(`/users/${userId}`);
    TFNotify.success("Team member removed.");
    await loadTeam();
  } catch (err) {
    TFNotify.error(err.message);
  }
}

function renderWorkloadPanel(keyword) {
  const panel = document.getElementById("employeeWorkloadPanel");
  const kw = (keyword || "").trim().toLowerCase();
  if (!kw) {
    panel.innerHTML = "";
    return;
  }

  const matches = TF_TEAM_USERS.filter((u) => u.name.toLowerCase().includes(kw));
  if (!matches.length) {
    panel.innerHTML = `<div class="tf-card"><div class="tf-card-body">${TFLayout.emptyState("bi-person-x", "No matching employee", "")}</div></div>`;
    return;
  }

  panel.innerHTML = matches
    .map((u) => {
      const w = TF_TEAM_WORKLOAD.get(u.id);
      return `
      <div class="tf-card mb-2">
        <div class="tf-card-body">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="d-flex align-items-center gap-2">
              <span class="tf-avatar">${TFLayout.initials(u.name)}</span>
              <strong>${TFLayout.escapeHtml(u.name)}</strong>
              <span class="tf-badge bg-soft-primary">${ROLE_LABELS[u.role] || u.role}</span>
            </div>
            ${w ? `<span class="text-muted" style="font-size:0.8rem;">${w.completion_rate}% completion</span>` : ""}
          </div>
          ${
            w
              ? `<div class="row g-2 text-center mb-2">
                <div class="col-3"><div class="fw-bold">${w.total_tasks}</div><div class="text-muted" style="font-size:0.72rem;">Total</div></div>
                <div class="col-3"><div class="fw-bold">${w.completed_tasks}</div><div class="text-muted" style="font-size:0.72rem;">Completed</div></div>
                <div class="col-3"><div class="fw-bold">${w.active_tasks}</div><div class="text-muted" style="font-size:0.72rem;">Active</div></div>
                <div class="col-3"><div class="fw-bold text-danger">${w.overdue_tasks}</div><div class="text-muted" style="font-size:0.72rem;">Overdue</div></div>
              </div>`
              : `<p class="text-muted mb-2" style="font-size:0.82rem;">No workload data for this role.</p>`
          }
          <div id="employeeTaskList-${u.id}" class="text-muted" style="font-size:0.82rem;">${TFLayout.loadingState()}</div>
        </div>
      </div>`;
    })
    .join("");

  matches.forEach((u) => loadEmployeeTasks(u.id));
}

async function loadEmployeeTasks(userId) {
  const box = document.getElementById(`employeeTaskList-${userId}`);
  if (!box) return;
  try {
    const tasks = await TeamFlowAPI.get(`/tasks?assigned_to=${userId}`);
    if (!tasks.length) {
      box.innerHTML = `<span class="text-muted">No assigned tasks.</span>`;
      return;
    }
    box.innerHTML = tasks
      .map(
        (t) => `
      <div class="d-flex align-items-center justify-content-between py-1" style="border-top:1px solid var(--tf-border);">
        <a href="task-details.html?id=${t.id}" class="text-decoration-none" style="color:var(--tf-text);">${TFLayout.escapeHtml(t.title)}</a>
        ${TFLayout.badgeForStatus(t.status)}
      </div>`
      )
      .join("");
  } catch {
    box.innerHTML = `<span class="text-muted">Could not load tasks.</span>`;
  }
}

function openMemberModal(user = null) {
  const isEdit = !!user;
  const currentUser = TeamFlowAPI.getUser();
  const isAdmin = currentUser.role === "admin";

  const existing = document.getElementById("memberModal");
  if (existing) existing.remove();

  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="modal fade" id="memberModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${isEdit ? "Edit Team Member" : "Add Team Member"}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="memberForm">
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Full Name</label>
                <input type="text" class="form-control" id="mfName" required value="${isEdit ? TFLayout.escapeHtml(user.name) : ""}">
              </div>
              <div class="mb-3">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" id="mfEmail" required value="${isEdit ? TFLayout.escapeHtml(user.email) : ""}">
              </div>
              ${
                !isEdit
                  ? `<div class="mb-3">
                      <label class="form-label">Password</label>
                      <input type="password" class="form-control" id="mfPassword" required minlength="6" placeholder="At least 6 characters">
                    </div>`
                  : ""
              }
              <div class="mb-3">
                <label class="form-label">Role</label>
                <select class="form-select" id="mfRole" ${!isAdmin ? "disabled" : ""}>
                  ${Object.entries(ROLE_LABELS)
                    .map(([k, v]) => `<option value="${k}" ${(isEdit ? user.role : "team_member") === k ? "selected" : ""}>${v}</option>`)
                    .join("")}
                </select>
                ${!isAdmin ? `<div class="form-text">Only an Admin can set roles other than Member.</div>` : ""}
              </div>
              ${
                isEdit && isAdmin
                  ? `<div class="form-check">
                      <input class="form-check-input" type="checkbox" id="mfActive" ${user.is_active !== false ? "checked" : ""}>
                      <label class="form-check-label" for="mfActive">Account active</label>
                    </div>`
                  : ""
              }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? "Save Changes" : "Add Member"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>`
  );

  const modalEl = document.getElementById("memberModal");
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  modalEl.addEventListener("hidden.bs.modal", () => modalEl.remove());

  document.getElementById("memberForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      if (isEdit) {
        const payload = {
          name: document.getElementById("mfName").value.trim(),
          email: document.getElementById("mfEmail").value.trim(),
        };
        if (isAdmin) {
          payload.role = document.getElementById("mfRole").value;
          payload.is_active = document.getElementById("mfActive").checked;
        }
        await TeamFlowAPI.put(`/users/${user.id}`, payload);
        TFNotify.success("Team member updated.");
      } else {
        const payload = {
          name: document.getElementById("mfName").value.trim(),
          email: document.getElementById("mfEmail").value.trim(),
          password: document.getElementById("mfPassword").value,
          role: document.getElementById("mfRole").value,
        };
        await TeamFlowAPI.post("/users", payload);
        TFNotify.success("Team member added.");
      }
      modal.hide();
      await loadTeam();
    } catch (err) {
      TFNotify.error(err.message);
      submitBtn.disabled = false;
    }
  });
}
