let TF_TASKS = [];
let TF_PROJECTS_MAP = new Map();
let TF_USERS_MAP = new Map();
let TF_ALL_USERS = [];

document.addEventListener("DOMContentLoaded", async () => {
  if (!TFLayout.requireAuth()) return;
  const content = TFLayout.render("tasks.html", "Tasks");
  const user = TeamFlowAPI.getUser();
  const canManage = user.role === "admin" || user.role === "project_manager";

  content.innerHTML = `
    <div class="tf-card mb-3">
      <div class="tf-card-body">
        <div class="row g-2 align-items-end">
          <div class="col-md-2">
            <label class="form-label">Search</label>
            <div class="tf-search-input">
              <i class="bi bi-search"></i>
              <input type="text" class="form-control" id="fKeyword" placeholder="Task title...">
            </div>
          </div>
          <div class="col-md-2">
            <label class="form-label">Project</label>
            <select class="form-select" id="fProject"><option value="">All</option></select>
          </div>
          <div class="col-md-2">
            <label class="form-label">Employee</label>
            <select class="form-select" id="fAssignee"><option value="">All</option></select>
          </div>
          <div class="col-md-2">
            <label class="form-label">Status</label>
            <select class="form-select" id="fStatus">
              <option value="">All</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label">Priority</label>
            <select class="form-select" id="fPriority">
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div class="col-md-1">
            <div class="form-check mt-4">
              <input class="form-check-input" type="checkbox" id="fOverdue">
              <label class="form-check-label" for="fOverdue" style="font-size:0.85rem;">Overdue</label>
            </div>
          </div>
          <div class="col-md-1 text-end">
            ${canManage ? `<button class="btn btn-primary btn-sm w-100" id="newTaskBtn"><i class="bi bi-plus-lg"></i></button>` : ""}
          </div>
        </div>
      </div>
    </div>
    <div class="tf-card">
      <div class="tf-table-wrap">
        <table class="tf-table">
          <thead>
            <tr><th>Title</th><th>Project</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Due Date</th><th></th></tr>
          </thead>
          <tbody id="tasksBody"><tr><td colspan="7">${TFLayout.loadingState()}</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  ["fKeyword", "fProject", "fAssignee", "fStatus", "fPriority", "fOverdue"].forEach((id) => {
    document.getElementById(id).addEventListener("input", applyFilters);
    document.getElementById(id).addEventListener("change", applyFilters);
  });

  if (canManage) {
    document.getElementById("newTaskBtn").addEventListener("click", () => openTaskModal());
  }

  await loadData();
});

async function loadData() {
  try {
    const [tasks, projects, users] = await Promise.all([
      TeamFlowAPI.get("/tasks"),
      TeamFlowAPI.get("/projects"),
      TeamFlowAPI.get("/users").catch(() => []),
    ]);
    TF_TASKS = tasks;
    TF_ALL_USERS = users;
    TF_PROJECTS_MAP = new Map(projects.map((p) => [p.id, p]));
    TF_USERS_MAP = new Map(users.map((u) => [u.id, u]));

    const projectSelect = document.getElementById("fProject");
    const currentProjectVal = projectSelect.value;
    projectSelect.innerHTML = `<option value="">All</option>`;
    projects.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      projectSelect.appendChild(opt);
    });
    projectSelect.value = currentProjectVal;

    const assigneeSelect = document.getElementById("fAssignee");
    const currentAssigneeVal = assigneeSelect.value;
    assigneeSelect.innerHTML = `<option value="">All</option>`;
    users.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.name;
      assigneeSelect.appendChild(opt);
    });
    assigneeSelect.value = currentAssigneeVal;

    applyFilters();
  } catch (err) {
    document.getElementById("tasksBody").innerHTML = `<tr><td colspan="7">${TFLayout.emptyState("bi-exclamation-circle", "Could not load tasks", err.message)}</td></tr>`;
  }
}

function applyFilters() {
  const kw = document.getElementById("fKeyword").value.toLowerCase();
  const projectId = document.getElementById("fProject").value;
  const assigneeId = document.getElementById("fAssignee").value;
  const status = document.getElementById("fStatus").value;
  const priority = document.getElementById("fPriority").value;
  const overdueOnly = document.getElementById("fOverdue").checked;

  const filtered = TF_TASKS.filter((t) => {
    if (kw && !t.title.toLowerCase().includes(kw)) return false;
    if (projectId && String(t.project_id) !== projectId) return false;
    if (assigneeId && String(t.assigned_to) !== assigneeId) return false;
    if (status && t.status !== status) return false;
    if (priority && t.priority !== priority) return false;
    if (overdueOnly && !t.is_overdue) return false;
    return true;
  });
  renderTable(filtered);
}

function renderTable(tasks) {
  const body = document.getElementById("tasksBody");
  const user = TeamFlowAPI.getUser();
  const canManage = user.role === "admin" || user.role === "project_manager";

  if (!tasks.length) {
    body.innerHTML = `<tr><td colspan="7">${TFLayout.emptyState("bi-list-check", "No tasks found", "Try adjusting your filters.")}</td></tr>`;
    return;
  }

  body.innerHTML = tasks
    .map((t) => {
      const project = TF_PROJECTS_MAP.get(t.project_id);
      const assignee = t.assigned_to ? TF_USERS_MAP.get(t.assigned_to) : null;
      const canEditThis = canManage || t.assigned_to === user.id;
      return `
      <tr>
        <td><a href="task-details.html?id=${t.id}" class="text-decoration-none fw-semibold" style="color:var(--tf-text);">${t.title}</a></td>
        <td>${project ? project.name : "—"}</td>
        <td>${assignee ? `<div class="d-flex align-items-center gap-2"><span class="tf-avatar">${TFLayout.initials(assignee.name)}</span><span>${assignee.name}</span></div>` : "<span class='text-muted'>Unassigned</span>"}</td>
        <td>${TFLayout.badgeForPriority(t.priority)}</td>
        <td>${TFLayout.badgeForStatus(t.status)}</td>
        <td>${TFLayout.formatDate(t.due_date)} ${t.is_overdue ? `<span class="tf-badge tf-badge-overdue ms-1">Overdue</span>` : ""}</td>
        <td class="text-end">
          <div class="d-flex gap-1 justify-content-end">
            <a href="task-details.html?id=${t.id}" class="tf-icon-btn" title="View"><i class="bi bi-eye"></i></a>
            ${canEditThis ? `<button class="tf-icon-btn" data-edit-task="${t.id}" title="Edit"><i class="bi bi-pencil"></i></button>` : ""}
            ${canManage ? `<button class="tf-icon-btn" data-delete-task="${t.id}" title="Delete"><i class="bi bi-trash text-danger"></i></button>` : ""}
          </div>
        </td>
      </tr>`;
    })
    .join("");

  body.querySelectorAll("[data-delete-task]").forEach((btn) =>
    btn.addEventListener("click", () => deleteTask(btn.dataset.deleteTask))
  );
  body.querySelectorAll("[data-edit-task]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const task = TF_TASKS.find((t) => String(t.id) === btn.dataset.editTask);
      if (task) openTaskModal(task);
    })
  );
}

async function deleteTask(id) {
  if (!TFNotify.confirmAction("Delete this task?")) return;
  try {
    await TeamFlowAPI.del(`/tasks/${id}`);
    TFNotify.success("Task deleted.");
    await loadData();
  } catch (err) {
    TFNotify.error(err.message);
  }
}

function openTaskModal(task = null) {
  const isEdit = !!task;
  const currentUser = TeamFlowAPI.getUser();
  const canManage = currentUser.role === "admin" || currentUser.role === "project_manager";
  const projects = Array.from(TF_PROJECTS_MAP.values());

  if (!isEdit && !projects.length) {
    TFNotify.warning("Create a project first.");
    return;
  }

  // Team members may only change status on a task already assigned to them.
  const fieldsLocked = isEdit && !canManage;

  const existing = document.getElementById("taskModal");
  if (existing) existing.remove();

  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="modal fade" id="taskModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${isEdit ? "Edit Task" : "New Task"}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="taskForm">
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Project</label>
                <select class="form-select" id="tfProject" required ${fieldsLocked ? "disabled" : ""}>
                  ${projects.map((p) => `<option value="${p.id}" ${isEdit && task.project_id === p.id ? "selected" : ""}>${p.name}</option>`).join("")}
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Title</label>
                <input type="text" class="form-control" id="tfTitle" required value="${isEdit ? escapeAttr(task.title) : ""}" ${fieldsLocked ? "disabled" : ""}>
              </div>
              <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea class="form-control" id="tfDescription" rows="2" ${fieldsLocked ? "disabled" : ""}>${isEdit ? escapeHtml(task.description || "") : ""}</textarea>
              </div>
              <div class="row g-2 mb-3">
                <div class="col-6">
                  <label class="form-label">Priority</label>
                  <select class="form-select" id="tfPriority" ${fieldsLocked ? "disabled" : ""}>
                    <option value="low" ${isEdit && task.priority === "low" ? "selected" : ""}>Low</option>
                    <option value="medium" ${!isEdit || task.priority === "medium" ? "selected" : ""}>Medium</option>
                    <option value="high" ${isEdit && task.priority === "high" ? "selected" : ""}>High</option>
                    <option value="critical" ${isEdit && task.priority === "critical" ? "selected" : ""}>Critical</option>
                  </select>
                </div>
                <div class="col-6">
                  <label class="form-label">Due Date</label>
                  <input type="date" class="form-control" id="tfDueDate" value="${isEdit && task.due_date ? task.due_date.slice(0, 10) : ""}" ${fieldsLocked ? "disabled" : ""}>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Status</label>
                <select class="form-select" id="tfStatus">
                  <option value="todo" ${!isEdit || task.status === "todo" ? "selected" : ""}>To Do</option>
                  <option value="in_progress" ${isEdit && task.status === "in_progress" ? "selected" : ""}>In Progress</option>
                  <option value="review" ${isEdit && task.status === "review" ? "selected" : ""}>Review</option>
                  <option value="completed" ${isEdit && task.status === "completed" ? "selected" : ""}>Completed</option>
                </select>
              </div>
              <div class="mb-1 ${fieldsLocked ? "opacity-50" : ""}">
                <label class="form-label">Assigned Employee</label>
                <div id="assigneeSearchBox"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? "Save Changes" : "Create Task"}</button>
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

  const assigneeBox = document.getElementById("assigneeSearchBox");
  const assigneeSearch = TFLayout.employeeSearch(assigneeBox, TF_ALL_USERS, {
    initialId: isEdit ? task.assigned_to : "",
  });
  if (fieldsLocked) {
    assigneeBox.querySelector("input").disabled = true;
  }

  document.getElementById("taskForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      if (fieldsLocked) {
        await TeamFlowAPI.put(`/tasks/${task.id}`, { status: document.getElementById("tfStatus").value });
        TFNotify.success("Task status updated.");
      } else {
        const due = document.getElementById("tfDueDate").value;
        const payload = {
          title: document.getElementById("tfTitle").value.trim(),
          description: document.getElementById("tfDescription").value.trim(),
          priority: document.getElementById("tfPriority").value,
          status: document.getElementById("tfStatus").value,
          project_id: parseInt(document.getElementById("tfProject").value, 10),
          assigned_to: assigneeSearch.getValue() ? parseInt(assigneeSearch.getValue(), 10) : null,
          due_date: due ? new Date(due).toISOString() : null,
        };
        if (isEdit) {
          await TeamFlowAPI.put(`/tasks/${task.id}`, payload);
          TFNotify.success("Task updated.");
        } else {
          await TeamFlowAPI.post("/tasks", payload);
          TFNotify.success("Task created.");
        }
      }
      modal.hide();
      await loadData();
    } catch (err) {
      TFNotify.error(err.message);
      submitBtn.disabled = false;
    }
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str);
}
