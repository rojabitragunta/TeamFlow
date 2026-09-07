let TF_ALL_PROJECTS = [];

document.addEventListener("DOMContentLoaded", async () => {
  if (!TFLayout.requireAuth()) return;
  const content = TFLayout.render("projects.html", "Projects");
  const user = TeamFlowAPI.getUser();
  const canManage = user.role === "admin" || user.role === "project_manager";

  content.innerHTML = `
    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
      <div class="tf-search-input" style="max-width:320px;">
        <i class="bi bi-search"></i>
        <input type="text" class="form-control" id="projectSearch" placeholder="Search projects...">
      </div>
      ${canManage ? `<button class="btn btn-primary" id="newProjectBtn"><i class="bi bi-plus-lg me-1"></i>New Project</button>` : ""}
    </div>
    <div id="projectsGrid">${TFLayout.loadingState()}</div>
  `;

  document.getElementById("projectSearch").addEventListener("input", (e) => {
    renderGrid(filterProjects(e.target.value));
  });

  if (canManage) {
    document.getElementById("newProjectBtn").addEventListener("click", () => openProjectModal());
  }

  await loadProjects();
});

function filterProjects(keyword) {
  const kw = (keyword || "").toLowerCase();
  return TF_ALL_PROJECTS.filter((p) => p.name.toLowerCase().includes(kw));
}

async function loadProjects() {
  try {
    TF_ALL_PROJECTS = await TeamFlowAPI.get("/projects");
    renderGrid(TF_ALL_PROJECTS);
  } catch (err) {
    document.getElementById("projectsGrid").innerHTML = TFLayout.emptyState("bi-exclamation-circle", "Could not load projects", err.message);
  }
}

const STATUS_LABELS = { planned: "Planned", active: "Active", on_hold: "On Hold", completed: "Completed" };

function renderGrid(projects) {
  const grid = document.getElementById("projectsGrid");
  if (!projects.length) {
    grid.innerHTML = TFLayout.emptyState("bi-kanban", "No projects found", "Create a project to get your team moving.");
    return;
  }
  const user = TeamFlowAPI.getUser();
  const canManage = user.role === "admin" || user.role === "project_manager";

  grid.innerHTML = `<div class="row g-3">${projects
    .map(
      (p) => `
    <div class="col-md-6 col-xl-4">
      <div class="tf-card h-100">
        <div class="tf-card-body d-flex flex-column h-100">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <a href="project-details.html?id=${p.id}" class="fw-bold text-decoration-none" style="color:var(--tf-text); font-size:1rem;">${TFLayout.escapeHtml(p.name)}</a>
            <span class="tf-badge tf-status-${p.status === "active" ? "in_progress" : p.status === "completed" ? "completed" : "todo"}">${STATUS_LABELS[p.status]}</span>
          </div>
          <p class="text-muted mb-3" style="font-size:0.84rem; min-height: 40px;">${p.description ? TFLayout.escapeHtml(p.description.slice(0, 110)) : "No description provided."}</p>
          <div class="mt-auto d-flex align-items-center justify-content-between">
            <a href="project-details.html?id=${p.id}" class="btn btn-outline-secondary btn-sm">View Details</a>
            ${
              canManage
                ? `<div class="d-flex gap-1">
                  <button class="tf-icon-btn" data-edit="${p.id}" title="Edit"><i class="bi bi-pencil"></i></button>
                  <button class="tf-icon-btn" data-delete="${p.id}" title="Delete"><i class="bi bi-trash text-danger"></i></button>
                </div>`
                : ""
            }
          </div>
        </div>
      </div>
    </div>`
    )
    .join("")}</div>`;

  grid.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const project = TF_ALL_PROJECTS.find((p) => p.id == btn.dataset.edit);
      openProjectModal(project);
    })
  );
  grid.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteProject(btn.dataset.delete))
  );
}

function openProjectModal(project = null) {
  const isEdit = !!project;
  const existing = document.getElementById("projectModal");
  if (existing) existing.remove();

  const modalHtml = `
    <div class="modal fade" id="projectModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${isEdit ? "Edit Project" : "New Project"}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="projectForm">
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Project Name</label>
                <input type="text" class="form-control" id="pfName" required value="${project ? TFLayout.escapeHtml(project.name) : ""}">
              </div>
              <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea class="form-control" id="pfDescription" rows="3">${project ? TFLayout.escapeHtml(project.description || "") : ""}</textarea>
              </div>
              <div class="row g-2 mb-3">
                <div class="col-6">
                  <label class="form-label">Start Date</label>
                  <input type="date" class="form-control" id="pfStart" value="${project?.start_date || ""}">
                </div>
                <div class="col-6">
                  <label class="form-label">End Date</label>
                  <input type="date" class="form-control" id="pfEnd" value="${project?.end_date || ""}">
                </div>
              </div>
              <div class="mb-1">
                <label class="form-label">Status</label>
                <select class="form-select" id="pfStatus">
                  ${Object.entries(STATUS_LABELS)
                    .map(([k, v]) => `<option value="${k}" ${project?.status === k ? "selected" : ""}>${v}</option>`)
                    .join("")}
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? "Save Changes" : "Create Project"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
  const modalEl = document.getElementById("projectModal");
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  modalEl.addEventListener("hidden.bs.modal", () => modalEl.remove());

  document.getElementById("projectForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById("pfName").value.trim(),
      description: document.getElementById("pfDescription").value.trim(),
      start_date: document.getElementById("pfStart").value || null,
      end_date: document.getElementById("pfEnd").value || null,
      status: document.getElementById("pfStatus").value,
    };
    try {
      if (isEdit) {
        await TeamFlowAPI.put(`/projects/${project.id}`, payload);
        TFNotify.success("Project updated.");
      } else {
        await TeamFlowAPI.post("/projects", payload);
        TFNotify.success("Project created.");
      }
      modal.hide();
      await loadProjects();
    } catch (err) {
      TFNotify.error(err.message);
    }
  });
}

async function deleteProject(id) {
  if (!TFNotify.confirmAction("Delete this project? This cannot be undone.")) return;
  try {
    await TeamFlowAPI.del(`/projects/${id}`);
    TFNotify.success("Project deleted.");
    await loadProjects();
  } catch (err) {
    TFNotify.error(err.message);
  }
}
