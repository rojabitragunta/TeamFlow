const KANBAN_COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "completed", label: "Completed" },
];

let TF_KANBAN_TASKS = [];
let TF_KANBAN_USERS = new Map();

document.addEventListener("DOMContentLoaded", async () => {
  if (!TFLayout.requireAuth()) return;
  const content = TFLayout.render("kanban.html", "Kanban Board");

  content.innerHTML = `
    <div class="mb-3">
      <select class="form-select" id="kanbanProjectFilter" style="max-width:280px;">
        <option value="">All Projects</option>
      </select>
    </div>
    <div class="tf-kanban" id="kanbanBoard">${TFLayout.loadingState()}</div>
  `;

  await loadKanban();

  document.getElementById("kanbanProjectFilter").addEventListener("change", (e) => {
    renderBoard(e.target.value ? TF_KANBAN_TASKS.filter((t) => String(t.project_id) === e.target.value) : TF_KANBAN_TASKS);
  });
});

async function loadKanban() {
  try {
    const [tasks, projects, users] = await Promise.all([
      TeamFlowAPI.get("/tasks"),
      TeamFlowAPI.get("/projects"),
      TeamFlowAPI.get("/users").catch(() => []),
    ]);
    TF_KANBAN_TASKS = tasks;
    TF_KANBAN_USERS = new Map(users.map((u) => [u.id, u]));

    const select = document.getElementById("kanbanProjectFilter");
    projects.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });

    renderBoard(tasks);
  } catch (err) {
    document.getElementById("kanbanBoard").innerHTML = TFLayout.emptyState("bi-exclamation-circle", "Could not load board", err.message);
  }
}

function renderBoard(tasks) {
  const board = document.getElementById("kanbanBoard");
  board.innerHTML = KANBAN_COLUMNS.map((col) => {
    const colTasks = tasks.filter((t) => t.status === col.key);
    return `
      <div class="tf-kanban-col" data-status="${col.key}">
        <div class="tf-kanban-col-header">
          <span>${col.label}</span>
          <span class="tf-kanban-count">${colTasks.length}</span>
        </div>
        <div class="tf-kanban-cards" data-dropzone="${col.key}">
          ${colTasks.map((t) => cardHtml(t)).join("") || ""}
        </div>
      </div>`;
  }).join("");

  wireDragAndDrop();
}

function cardHtml(t) {
  const assignee = t.assigned_to ? TF_KANBAN_USERS.get(t.assigned_to) : null;
  return `
    <div class="tf-kanban-card" draggable="true" data-task-id="${t.id}">
      <div class="tf-kanban-card-title"><a href="task-details.html?id=${t.id}" class="text-decoration-none" style="color:inherit;">${t.title}</a></div>
      <div class="d-flex align-items-center justify-content-between">
        ${TFLayout.badgeForPriority(t.priority)}
        ${assignee ? `<span class="tf-avatar" title="${assignee.name}">${TFLayout.initials(assignee.name)}</span>` : ""}
      </div>
      <div class="tf-kanban-card-meta">
        <span class="tf-kanban-card-due ${t.is_overdue ? "tf-overdue" : ""}">
          <i class="bi ${t.is_overdue ? "bi-alarm-fill" : "bi-calendar3"}"></i>
          ${t.due_date ? TFLayout.formatDate(t.due_date) : "No due date"}
        </span>
      </div>
    </div>`;
}

function wireDragAndDrop() {
  document.querySelectorAll(".tf-kanban-card").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      card.classList.add("tf-dragging");
      e.dataTransfer.setData("text/plain", card.dataset.taskId);
    });
    card.addEventListener("dragend", () => card.classList.remove("tf-dragging"));
  });

  document.querySelectorAll(".tf-kanban-col").forEach((col) => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("tf-drop-hover");
    });
    col.addEventListener("dragleave", () => col.classList.remove("tf-drop-hover"));
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      col.classList.remove("tf-drop-hover");
      const taskId = e.dataTransfer.getData("text/plain");
      const newStatus = col.dataset.status;
      const task = TF_KANBAN_TASKS.find((t) => String(t.id) === taskId);
      if (!task || task.status === newStatus) return;

      const prevStatus = task.status;
      task.status = newStatus;
      renderBoard(currentFilteredTasks());

      try {
        await TeamFlowAPI.put(`/tasks/${taskId}`, { status: newStatus });
        TFNotify.success("Task status updated.");
      } catch (err) {
        task.status = prevStatus;
        renderBoard(currentFilteredTasks());
        TFNotify.error(err.message);
      }
    });
  });
}

function currentFilteredTasks() {
  const val = document.getElementById("kanbanProjectFilter").value;
  return val ? TF_KANBAN_TASKS.filter((t) => String(t.project_id) === val) : TF_KANBAN_TASKS;
}
