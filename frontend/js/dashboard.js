let TF_DASHBOARD_SUMMARY = null;
let TF_CHARTS = [];

document.addEventListener("DOMContentLoaded", async () => {
  if (!TFLayout.requireAuth()) return;
  const content = TFLayout.render("dashboard.html", "Dashboard");
  content.innerHTML = TFLayout.loadingState();

  try {
    const summary = await TeamFlowAPI.get("/dashboard/summary");
    TF_DASHBOARD_SUMMARY = summary;
    renderDashboard(content, summary);
  } catch (err) {
    content.innerHTML = TFLayout.emptyState("bi-exclamation-circle", "Could not load dashboard", err.message);
  }
});

document.addEventListener("tf-theme-changed", () => {
  if (TF_DASHBOARD_SUMMARY) {
    renderStatusChart(TF_DASHBOARD_SUMMARY.status_distribution);
    renderPriorityChart(TF_DASHBOARD_SUMMARY.priority_distribution);
  }
});

function chartTextColor() {
  return TFTheme.get() === "dark" ? "#c7cae0" : "#4b5266";
}

function chartGridColor() {
  return TFTheme.get() === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
}

function renderDashboard(content, s) {
  const cards = [
    { label: "Total Projects", value: s.total_projects, icon: "bi-kanban-fill", cls: "primary", href: "projects.html" },
    { label: "Active Projects", value: s.active_projects, icon: "bi-play-circle-fill", cls: "info", href: "projects.html?status=active" },
    { label: "Total Tasks", value: s.total_tasks, icon: "bi-list-check", cls: "primary", href: "tasks.html" },
    { label: "Completed Tasks", value: s.completed_tasks, icon: "bi-check-circle-fill", cls: "success", href: "tasks.html?status=completed" },
    { label: "In Progress", value: s.in_progress_tasks, icon: "bi-hourglass-split", cls: "info", href: "tasks.html?status=in_progress" },
    { label: "Overdue Tasks", value: s.overdue_tasks, icon: "bi-alarm-fill", cls: "danger", href: "tasks.html?overdue=true" },
    { label: "Critical Tasks", value: s.critical_tasks, icon: "bi-exclamation-triangle-fill", cls: "warning", href: "tasks.html?priority=critical" },
  ];

  content.innerHTML = `
    <div class="row g-3 mb-4">
      ${cards
        .map(
          (c) => `
        <div class="col-6 col-md-4 col-xl-3">
          <a class="tf-stat-card tf-stat-card-clickable" href="${c.href}" role="button" aria-label="View ${TFLayout.escapeHtml(c.label)}">
            <div class="tf-stat-top">
              <div>
                <div class="tf-stat-value">${c.value}</div>
                <div class="tf-stat-label">${c.label}</div>
              </div>
              <div class="tf-stat-icon bg-soft-${c.cls}"><i class="bi ${c.icon}"></i></div>
            </div>
          </a>
        </div>`
        )
        .join("")}
    </div>

    <div class="row g-3 mb-4">
      <div class="col-lg-4">
        <div class="tf-chart-card">
          <h3>Task Status Distribution</h3>
          <div class="tf-chart-wrap"><canvas id="statusChart"></canvas></div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="tf-chart-card">
          <h3>Priority Distribution</h3>
          <div class="tf-chart-wrap"><canvas id="priorityChart"></canvas></div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="tf-chart-card">
          <h3>Recent Tasks</h3>
          <div id="recentTasksBox"></div>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-12">
        <div class="tf-card">
          <div class="tf-card-header">
            <h3>Team Workload</h3>
          </div>
          <div class="tf-card-body" id="workloadBox"></div>
        </div>
      </div>
    </div>
  `;

  renderStatusChart(s.status_distribution);
  renderPriorityChart(s.priority_distribution);
  renderRecentTasks(s.recent_tasks);
  renderWorkload(s.workload);
}

function renderStatusChart(dist) {
  const labels = { todo: "To Do", in_progress: "In Progress", review: "Review", completed: "Completed" };
  const canvas = document.getElementById("statusChart");
  if (!canvas) return;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: Object.keys(dist).map((k) => labels[k] || k),
      datasets: [
        {
          data: Object.values(dist),
          backgroundColor: ["#8990a8", "#0891b2", "#d97706", "#16a34a"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 }, color: chartTextColor() } },
      },
    },
  });
}

function renderPriorityChart(dist) {
  const labels = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
  const order = ["low", "medium", "high", "critical"];
  const canvas = document.getElementById("priorityChart");
  if (!canvas) return;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: order.map((k) => labels[k]),
      datasets: [
        {
          label: "Tasks",
          data: order.map((k) => dist[k] || 0),
          backgroundColor: ["#8990a8", "#0891b2", "#d97706", "#dc2626"],
          borderRadius: 6,
          maxBarThickness: 40,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, color: chartTextColor() }, grid: { color: chartGridColor() } },
        x: { ticks: { color: chartTextColor() }, grid: { display: false } },
      },
    },
  });
}

function renderRecentTasks(tasks) {
  const box = document.getElementById("recentTasksBox");
  if (!tasks.length) {
    box.innerHTML = TFLayout.emptyState("bi-inbox", "No tasks yet", "Create your first task to see it here.");
    return;
  }
  box.innerHTML = tasks
    .map(
      (t) => `
      <div class="tf-recent-task-row">
        <div>
          <div class="tf-recent-task-title">${TFLayout.escapeHtml(t.title)}</div>
          <div class="tf-recent-task-sub">${TFLayout.formatDate(t.due_date)} ${t.is_overdue ? "· <span class='text-danger fw-semibold'>Overdue</span>" : ""}</div>
        </div>
        ${TFLayout.badgeForPriority(t.priority)}
      </div>`
    )
    .join("");
}

function renderWorkload(workload) {
  const box = document.getElementById("workloadBox");
  if (!workload.length) {
    box.innerHTML = TFLayout.emptyState("bi-people", "No workload data", "Assign tasks to team members to see workload here.");
    return;
  }
  box.innerHTML = workload
    .map((w) => {
      const pct = Math.min(100, w.workload_score);
      const color = pct > 70 ? "#dc2626" : pct > 40 ? "#d97706" : "#16a34a";
      return `
      <div class="tf-workload-row">
        <div class="tf-workload-name">
          <span class="tf-avatar">${TFLayout.initials(w.name)}</span>
          <span>${TFLayout.escapeHtml(w.name)}</span>
        </div>
        <div class="tf-workload-bar-wrap">
          <div class="tf-progress"><div class="tf-progress-bar" style="width:${pct}%; background:${color};"></div></div>
        </div>
        <div class="tf-workload-pct">${pct}%</div>
      </div>`;
    })
    .join("");
}
