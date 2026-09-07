let TF_PROJECT = null;
let TF_ALL_USERS = [];

document.addEventListener("DOMContentLoaded", async () => {
  if (!TFLayout.requireAuth()) return;
  const content = TFLayout.render("projects.html", "Project Details");
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("id");

  if (!projectId) {
    content.innerHTML = TFLayout.emptyState("bi-exclamation-circle", "No project specified", "");
    return;
  }

  content.innerHTML = TFLayout.loadingState();

  try {
    const [project, tasks, users] = await Promise.all([
      TeamFlowAPI.get(`/projects/${projectId}`),
      TeamFlowAPI.get(`/tasks?project_id=${projectId}`),
      TeamFlowAPI.get(`/users`).catch(() => []),
    ]);
    TF_PROJECT = project;
    TF_ALL_USERS = users;
    renderDetails(content, project, tasks);
  } catch (err) {
    content.innerHTML = TFLayout.emptyState("bi-exclamation-circle", "Could not load project", err.message);
  }
});

const STATUS_LABELS = { planned: "Planned", active: "Active", on_hold: "On Hold", completed: "Completed" };

function renderDetails(content, project, tasks) {
  const user = TeamFlowAPI.getUser();
  const canManage = user.role === "admin" || user.role === "project_manager";

  content.innerHTML = `
    <div class="tf-card mb-4">
      <div class="tf-card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <h2 class="mb-0" style="font-size:1.25rem; font-weight:700;">${TFLayout.escapeHtml(project.name)}</h2>
              <span class="tf-badge tf-status-${project.status === "active" ? "in_progress" : project.status === "completed" ? "completed" : "todo"}">${STATUS_LABELS[project.status]}</span>
            </div>
            <p class="text-muted mb-0" style="max-width:560px;">${TFLayout.escapeHtml(project.description) || "No description provided."}</p>
          </div>
          ${canManage ? `<button class="btn btn-primary btn-sm" id="newTaskBtn"><i class="bi bi-plus-lg me-1"></i>New Task</button>` : ""}
        </div>
        <div class="row g-3 mt-3">
          <div class="col-md-4">
            <div class="text-muted" style="font-size:0.78rem;">Progress</div>
            <div class="tf-progress mt-1 mb-1"><div class="tf-progress-bar" style="width:${project.progress}%"></div></div>
            <div style="font-size:0.8rem;" class="fw-semibold">${project.progress}% (${project.completed_task_count}/${project.task_count} tasks)</div>
          </div>
          <div class="col-md-4">
            <div class="text-muted" style="font-size:0.78rem;">Timeline</div>
            <div class="fw-semibold" style="font-size:0.85rem;">${TFLayout.formatDate(project.start_date)} → ${TFLayout.formatDate(project.end_date)}</div>
          </div>
          <div class="col-md-4">
            <div class="text-muted" style="font-size:0.78rem;">Members</div>
            <div class="tf-avatar-group mt-1">
              ${project.members.slice(0, 6).map((m) => `<span class="tf-avatar" title="${TFLayout.escapeHtml(m.user.name)}">${TFLayout.initials(m.user.name)}</span>`).join("")}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-8">
        <div class="tf-card">
          <div class="tf-card-header"><h3>Tasks</h3></div>
          <div class="tf-table-wrap">
            <table class="tf-table">
              <thead><tr><th>Title</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead>
              <tbody id="projectTasksBody"></tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="tf-card">
          <div class="tf-card-header">
            <h3>Members</h3>
            ${canManage ? `<button class="tf-icon-btn" id="addMemberBtn" title="Add member"><i class="bi bi-person-plus"></i></button>` : ""}
          </div>
          <div class="tf-card-body" id="membersBox"></div>
        </div>
      </div>
    </div>
  `;

  renderTasksTable(tasks);
  renderMembers(project, canManage);

  if (canManage) {
    document.getElementById("newTaskBtn").addEventListener("click", () => openTaskModal(project));
    document.getElementById("addMemberBtn").addEventListener("click", () => openAddMemberModal(project));
  }
}

function renderTasksTable(tasks) {
  const body = document.getElementById("projectTasksBody");
  if (!tasks.length) {
    body.innerHTML = `<tr><td colspan="5">${TFLayout.emptyState("bi-list-check", "No tasks yet", "Create the first task for this project.")}</td></tr>`;
    return;
  }
  const userMap = new Map(TF_ALL_USERS.map((u) => [u.id, u]));
  body.innerHTML = tasks
    .map((t) => {
      const assignee = t.assigned_to ? userMap.get(t.assigned_to) : null;
      return `
    <tr>
      <td><a href="task-details.html?id=${t.id}" class="text-decoration-none fw-semibold" style="color:var(--tf-text);">${TFLayout.escapeHtml(t.title)}</a></td>
      <td>${assignee ? `<span class="tf-avatar" title="${TFLayout.escapeHtml(assignee.name)}">${TFLayout.initials(assignee.name)}</span>` : "—"}</td>
      <td>${TFLayout.badgeForPriority(t.priority)}</td>
      <td>${TFLayout.badgeForStatus(t.status)}</td>
      <td>${TFLayout.formatDate(t.due_date)} ${t.is_overdue ? `<span class="tf-badge tf-badge-overdue ms-1">Overdue</span>` : ""}</td>
    </tr>`;
    })
    .join("");
}

function renderMembers(project, canManage) {
  const box = document.getElementById("membersBox");
  if (!project.members.length) {
    box.innerHTML = TFLayout.emptyState("bi-people", "No members yet", "");
    return;
  }
  box.innerHTML = project.members
    .map(
      (m) => `
    <div class="d-flex align-items-center justify-content-between py-2" style="border-bottom:1px solid var(--tf-border);">
      <div class="d-flex align-items-center gap-2">
        <span class="tf-avatar">${TFLayout.initials(m.user.name)}</span>
        <div>
          <div style="font-size:0.85rem; font-weight:600;">${TFLayout.escapeHtml(m.user.name)}</div>
          <div style="font-size:0.72rem; color:var(--tf-text-muted);">${TFLayout.roleLabel(m.user.role)}</div>
        </div>
      </div>
      ${canManage ? `<button class="tf-icon-btn" data-remove-member="${m.user_id}" title="Remove"><i class="bi bi-x-lg"></i></button>` : ""}
    </div>`
    )
    .join("");

  box.querySelectorAll("[data-remove-member]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!TFNotify.confirmAction("Remove this member from the project?")) return;
      try {
        await TeamFlowAPI.del(`/projects/${project.id}/members/${btn.dataset.removeMember}`);
        TFNotify.success("Member removed.");
        window.location.reload();
      } catch (err) {
        TFNotify.error(err.message);
      }
    })
  );
}

async function openAddMemberModal(project) {
  if (!TF_ALL_USERS.length) {
    try {
      TF_ALL_USERS = await TeamFlowAPI.get("/users");
    } catch (err) {
      TFNotify.error(err.message);
      return;
    }
  }
  const memberIds = new Set(project.members.map((m) => m.user_id));
  const available = TF_ALL_USERS.filter((u) => !memberIds.has(u.id));

  const existing = document.getElementById("memberModal");
  if (existing) existing.remove();

  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="modal fade" id="memberModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Add Member</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="memberForm">
            <div class="modal-body">
              <label class="form-label">Select user</label>
              <select class="form-select" id="memberSelect" required>
                ${available.map((u) => `<option value="${u.id}">${TFLayout.escapeHtml(u.name)} (${TFLayout.roleLabel(u.role)})</option>`).join("")}
              </select>
              ${!available.length ? `<p class="text-muted mt-2 mb-0" style="font-size:0.82rem;">All users are already members.</p>` : ""}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary" ${!available.length ? "disabled" : ""}>Add Member</button>
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
    try {
      await TeamFlowAPI.post(`/projects/${project.id}/members`, {
        user_id: parseInt(document.getElementById("memberSelect").value, 10),
      });
      TFNotify.success("Member added.");
      modal.hide();
      window.location.reload();
    } catch (err) {
      TFNotify.error(err.message);
    }
  });
}

async function openTaskModal(project) {
  if (!TF_ALL_USERS.length) {
    try {
      TF_ALL_USERS = await TeamFlowAPI.get("/users");
    } catch (err) {
      TFNotify.error(err.message);
      return;
    }
  }
  const memberIds = new Set(project.members.map((m) => m.user_id));
  const assignable = TF_ALL_USERS.filter((u) => memberIds.has(u.id));

  const existing = document.getElementById("taskModal");
  if (existing) existing.remove();

  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="modal fade" id="taskModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">New Task</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="taskForm">
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Title</label>
                <input type="text" class="form-control" id="tfTitle" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea class="form-control" id="tfDescription" rows="2"></textarea>
              </div>
              <div class="row g-2 mb-3">
                <div class="col-6">
                  <label class="form-label">Priority</label>
                  <select class="form-select" id="tfPriority">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div class="col-6">
                  <label class="form-label">Due Date</label>
                  <input type="date" class="form-control" id="tfDueDate">
                </div>
              </div>
              <div class="mb-2">
                <label class="form-label">Assigned Employee</label>
                <div id="assigneeSearchBox"></div>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <button type="button" class="btn btn-sm btn-outline-secondary" id="recommendBtn">
                  <i class="bi bi-stars me-1"></i>Smart Recommend
                </button>
              </div>
              <div id="recoBox" class="mt-2"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Create Task</button>
            </div>
          </form>
        </div>
      </div>
    </div>`
  );
  const modalEl = document.getElementById("taskModal");
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  modalEl.addEventListener("hidden.bs.modal", () => modalEl.remove());

  const assigneeSearch = TFLayout.employeeSearch(document.getElementById("assigneeSearchBox"), assignable, {});

  document.getElementById("recommendBtn").addEventListener("click", async () => {
    const recoBox = document.getElementById("recoBox");
    recoBox.innerHTML = TFLayout.loadingState();
    try {
      const res = await TeamFlowAPI.get(`/tasks/recommend/${project.id}`);
      if (!res.recommended) {
        recoBox.innerHTML = `<div class="text-muted" style="font-size:0.82rem;">No project members to recommend from yet.</div>`;
        return;
      }
      recoBox.innerHTML = `
        <div class="tf-reco-box">
          <strong>${TFLayout.escapeHtml(res.recommended.name)}</strong> is recommended (score ${res.recommended.score}).<br>
          ${TFLayout.escapeHtml(res.recommended.reason)}
        </div>`;
      assigneeSearch.setValue(res.recommended.user_id);
    } catch (err) {
      recoBox.innerHTML = `<div class="text-danger" style="font-size:0.82rem;">${TFLayout.escapeHtml(err.message)}</div>`;
    }
  });

  document.getElementById("taskForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const assignee = assigneeSearch.getValue();
    const due = document.getElementById("tfDueDate").value;
    const payload = {
      title: document.getElementById("tfTitle").value.trim(),
      description: document.getElementById("tfDescription").value.trim(),
      priority: document.getElementById("tfPriority").value,
      project_id: project.id,
      assigned_to: assignee ? parseInt(assignee, 10) : null,
      due_date: due ? new Date(due).toISOString() : null,
    };
    try {
      await TeamFlowAPI.post("/tasks", payload);
      TFNotify.success("Task created.");
      modal.hide();
      window.location.reload();
    } catch (err) {
      TFNotify.error(err.message);
    }
  });
}
