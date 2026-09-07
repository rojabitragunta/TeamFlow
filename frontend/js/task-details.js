let TF_TASK = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!TFLayout.requireAuth()) return;
  const content = TFLayout.render("tasks.html", "Task Details");
  const params = new URLSearchParams(window.location.search);
  const taskId = params.get("id");

  if (!taskId) {
    content.innerHTML = TFLayout.emptyState("bi-exclamation-circle", "No task specified", "");
    return;
  }

  content.innerHTML = TFLayout.loadingState();

  try {
    const [task, comments, project] = await Promise.all([
      TeamFlowAPI.get(`/tasks/${taskId}`),
      TeamFlowAPI.get(`/tasks/${taskId}/comments`),
      null,
    ]);
    TF_TASK = task;
    let projectInfo = null;
    try {
      projectInfo = await TeamFlowAPI.get(`/projects/${task.project_id}`);
    } catch {}
    renderTask(content, task, comments, projectInfo);
  } catch (err) {
    content.innerHTML = TFLayout.emptyState("bi-exclamation-circle", "Could not load task", err.message);
  }
});

function renderTask(content, task, comments, project) {
  const user = TeamFlowAPI.getUser();
  const canEditFull = user.role === "admin" || user.role === "project_manager";
  const isAssignee = task.assigned_to === user.id;
  const canChangeStatus = canEditFull || isAssignee;
  const canComment = canEditFull || isAssignee;

  content.innerHTML = `
    <div class="row g-3">
      <div class="col-lg-8">
        <div class="tf-card mb-3">
          <div class="tf-card-body">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
              <h2 style="font-size:1.2rem; font-weight:700;" class="mb-0">${TFLayout.escapeHtml(task.title)}</h2>
              ${task.is_overdue ? `<span class="tf-badge tf-badge-overdue">Overdue</span>` : ""}
            </div>
            <p class="text-muted">${TFLayout.escapeHtml(task.description) || "No description provided."}</p>
            <div class="d-flex flex-wrap gap-2 mt-3">
              ${TFLayout.badgeForStatus(task.status)}
              ${TFLayout.badgeForPriority(task.priority)}
              ${project ? `<a href="project-details.html?id=${project.id}" class="tf-badge bg-soft-primary text-decoration-none"><i class="bi bi-kanban-fill"></i>${TFLayout.escapeHtml(project.name)}</a>` : ""}
            </div>
          </div>
        </div>

        <div class="tf-card">
          <div class="tf-card-header"><h3>Comments</h3></div>
          <div class="tf-card-body">
            <div id="commentsBox">${renderComments(comments)}</div>
            ${
              canComment
                ? `<form id="commentForm" class="mt-3 d-flex gap-2">
                  <input type="text" class="form-control" id="commentInput" placeholder="Add a comment..." required>
                  <button class="btn btn-primary" type="submit"><i class="bi bi-send"></i></button>
                </form>`
                : `<p class="text-muted mt-3 mb-0" style="font-size:0.82rem;">Only the assignee or a manager can comment.</p>`
            }
          </div>
        </div>
      </div>

      <div class="col-lg-4">
        <div class="tf-card">
          <div class="tf-card-header"><h3>Details</h3></div>
          <div class="tf-card-body">
            <div class="mb-3">
              <div class="text-muted" style="font-size:0.78rem;">Assignee</div>
              <div class="fw-semibold" id="assigneeName">${task.assignee ? TFLayout.escapeHtml(task.assignee.name) : "Unassigned"}</div>
            </div>
            <div class="mb-3">
              <div class="text-muted" style="font-size:0.78rem;">Created by</div>
              <div class="fw-semibold">${task.creator ? TFLayout.escapeHtml(task.creator.name) : "—"}</div>
            </div>
            <div class="mb-3">
              <div class="text-muted" style="font-size:0.78rem;">Due Date</div>
              <div class="fw-semibold">${TFLayout.formatDate(task.due_date)}</div>
            </div>
            ${
              canChangeStatus
                ? `<div class="mb-1">
                  <label class="form-label">Update Status</label>
                  <select class="form-select" id="statusSelect">
                    <option value="todo" ${task.status === "todo" ? "selected" : ""}>To Do</option>
                    <option value="in_progress" ${task.status === "in_progress" ? "selected" : ""}>In Progress</option>
                    <option value="review" ${task.status === "review" ? "selected" : ""}>Review</option>
                    <option value="completed" ${task.status === "completed" ? "selected" : ""}>Completed</option>
                  </select>
                </div>`
                : ""
            }
          </div>
        </div>
      </div>
    </div>
  `;

  if (canChangeStatus) {
    document.getElementById("statusSelect").addEventListener("change", async (e) => {
      try {
        await TeamFlowAPI.put(`/tasks/${task.id}`, { status: e.target.value });
        TFNotify.success("Status updated.");
      } catch (err) {
        TFNotify.error(err.message);
      }
    });
  }

  if (canComment) {
    document.getElementById("commentForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("commentInput");
      const text = input.value.trim();
      if (!text) return;
      try {
        const comment = await TeamFlowAPI.post(`/tasks/${task.id}/comments`, { comment: text });
        input.value = "";
        const box = document.getElementById("commentsBox");
        const updatedComments = await TeamFlowAPI.get(`/tasks/${task.id}/comments`);
        box.innerHTML = renderComments(updatedComments);
        wireCommentDeletes(task.id);
      } catch (err) {
        TFNotify.error(err.message);
      }
    });
  }

  wireCommentDeletes(task.id);
}

function renderComments(comments) {
  if (!comments.length) {
    return TFLayout.emptyState("bi-chat-square-text", "No comments yet", "Be the first to add an update.");
  }
  const currentUser = TeamFlowAPI.getUser();
  return comments
    .map(
      (c) => `
    <div class="tf-comment">
      <span class="tf-avatar">${TFLayout.initials(c.user ? c.user.name : "?")}</span>
      <div class="tf-comment-body">
        <div class="tf-comment-meta">
          <span class="tf-comment-author">${c.user ? TFLayout.escapeHtml(c.user.name) : "Unknown"}</span>
          <span class="tf-comment-time">${TFLayout.timeAgo(c.created_at)}</span>
          ${
            currentUser && (currentUser.role === "admin" || currentUser.id === c.user_id)
              ? `<button class="btn btn-link btn-sm text-danger p-0 ms-auto" data-delete-comment="${c.id}" style="font-size:0.75rem;">Delete</button>`
              : ""
          }
        </div>
        <div>${TFLayout.escapeHtml(c.comment)}</div>
      </div>
    </div>`
    )
    .join("");
}

function wireCommentDeletes(taskId) {
  document.querySelectorAll("[data-delete-comment]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!TFNotify.confirmAction("Delete this comment?")) return;
      try {
        await TeamFlowAPI.del(`/comments/${btn.dataset.deleteComment}`);
        const box = document.getElementById("commentsBox");
        const updatedComments = await TeamFlowAPI.get(`/tasks/${taskId}/comments`);
        box.innerHTML = renderComments(updatedComments);
        wireCommentDeletes(taskId);
        TFNotify.success("Comment deleted.");
      } catch (err) {
        TFNotify.error(err.message);
      }
    })
  );
}
