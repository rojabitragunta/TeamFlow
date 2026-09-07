const TFLayout = (() => {
  const NAV_ITEMS = [
    { href: "dashboard.html", icon: "bi-grid-1x2-fill", label: "Dashboard" },
    { href: "projects.html", icon: "bi-kanban-fill", label: "Projects" },
    { href: "tasks.html", icon: "bi-list-check", label: "Tasks" },
    { href: "kanban.html", icon: "bi-columns-gap", label: "Kanban Board" },
    { href: "team.html", icon: "bi-people-fill", label: "Team" },
  ];

  function initials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }

  function roleLabel(role) {
    return { admin: "Admin", project_manager: "Project Manager", team_member: "Team Member" }[role] || role;
  }

  function render(activeHref, pageTitle) {
    const user = TeamFlowAPI.getUser();
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const navHtml = NAV_ITEMS.map(
      (item) => `
      <a class="tf-nav-link ${item.href === activeHref ? "active" : ""}" href="${item.href}">
        <i class="bi ${item.icon}"></i>
        <span>${item.label}</span>
      </a>`
    ).join("");

    const shell = `
      <div class="tf-sidebar-backdrop" id="tfBackdrop"></div>
      <aside class="tf-sidebar" id="tfSidebar">
        <div class="tf-sidebar-brand">
          <span class="tf-logo-mark">TF</span>
          <span>TeamFlow</span>
        </div>
        <nav class="tf-sidebar-nav">
          <div class="tf-nav-section-label">Workspace</div>
          ${navHtml}
        </nav>
        <div class="tf-sidebar-footer">
          <a class="tf-user-chip" href="profile.html" style="color:inherit;">
            <span class="tf-avatar">${initials(user.name)}</span>
            <div>
              <p class="tf-user-name">${user.name}</p>
              <span class="tf-user-role">${roleLabel(user.role)}</span>
            </div>
          </a>
        </div>
      </aside>
      <div class="tf-main">
        <header class="tf-topbar">
          <div class="d-flex align-items-center gap-3">
            <button class="tf-sidebar-toggle" id="tfSidebarToggle"><i class="bi bi-list"></i></button>
            <h1 class="tf-topbar-title">${pageTitle}</h1>
          </div>
          <div class="tf-topbar-actions">
            <span class="tf-badge bg-soft-primary"><i class="bi bi-shield-check"></i>${roleLabel(user.role)}</span>
            <button class="tf-theme-toggle" id="tfThemeToggle" title="Toggle light/dark theme">
              <i class="bi ${TFTheme.get() === "dark" ? "bi-sun" : "bi-moon-stars"}"></i>
            </button>
            <button class="tf-icon-btn" id="tfLogoutBtn" title="Log out"><i class="bi bi-box-arrow-right"></i></button>
          </div>
        </header>
        <main class="tf-content" id="tfContent"></main>
      </div>
    `;

    document.getElementById("tfApp").innerHTML = shell;

    document.getElementById("tfLogoutBtn").addEventListener("click", () => {
      TeamFlowAPI.clearSession();
      window.location.href = "login.html";
    });

    document.getElementById("tfThemeToggle").addEventListener("click", (e) => {
      const next = TFTheme.toggle();
      e.currentTarget.querySelector("i").className = `bi ${next === "dark" ? "bi-sun" : "bi-moon-stars"}`;
      document.dispatchEvent(new CustomEvent("tf-theme-changed", { detail: { theme: next } }));
    });

    const toggle = document.getElementById("tfSidebarToggle");
    const sidebar = document.getElementById("tfSidebar");
    const backdrop = document.getElementById("tfBackdrop");
    if (toggle) {
      toggle.addEventListener("click", () => {
        sidebar.classList.toggle("tf-sidebar-open");
        backdrop.classList.toggle("tf-show");
      });
      backdrop.addEventListener("click", () => {
        sidebar.classList.remove("tf-sidebar-open");
        backdrop.classList.remove("tf-show");
      });
    }

    return document.getElementById("tfContent");
  }

  function requireAuth() {
    if (!TeamFlowAPI.getToken() || !TeamFlowAPI.getUser()) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  }

  function badgeForStatus(status) {
    const labels = { todo: "To Do", in_progress: "In Progress", review: "Review", completed: "Completed" };
    return `<span class="tf-badge tf-status-${status}"><span class="tf-badge-dot"></span>${labels[status] || status}</span>`;
  }

  function badgeForPriority(priority) {
    const labels = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
    return `<span class="tf-badge tf-priority-${priority}">${labels[priority] || priority}</span>`;
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function timeAgo(value) {
    if (!value) return "";
    const diff = (Date.now() - new Date(value).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function emptyState(icon, title, subtitle) {
    return `
      <div class="tf-empty-state">
        <i class="bi ${icon}"></i>
        <h4>${title}</h4>
        <p class="mb-0">${subtitle || ""}</p>
      </div>`;
  }

  function loadingState() {
    return `<div class="tf-loading-wrap"><div class="tf-spinner"></div></div>`;
  }

  /**
   * Renders a searchable "employee" input + suggestion dropdown inside `container`,
   * storing the chosen user's id in a hidden field. Returns { getValue(), setValue(id) }.
   */
  function employeeSearch(container, users, options = {}) {
    const placeholder = options.placeholder || "Search employee name...";
    const allowUnassigned = options.allowUnassigned !== false;
    let selectedId = options.initialId || "";

    container.innerHTML = `
      <div class="tf-employee-search position-relative">
        <div class="tf-search-input">
          <i class="bi bi-search"></i>
          <input type="text" class="form-control" autocomplete="off" placeholder="${placeholder}">
        </div>
        <div class="list-group position-absolute w-100 shadow-sm d-none" style="z-index:1060; max-height:220px; overflow-y:auto;"></div>
      </div>`;

    const input = container.querySelector("input");
    const list = container.querySelector(".list-group");

    function labelFor(id) {
      if (!id) return "";
      const u = users.find((u) => String(u.id) === String(id));
      return u ? u.name : "";
    }

    function renderOptions(filterText) {
      const kw = (filterText || "").toLowerCase();
      const matches = users.filter((u) => u.name.toLowerCase().includes(kw)).slice(0, 8);
      const rows = [];
      if (allowUnassigned && "unassigned".includes(kw)) {
        rows.push(`<button type="button" class="list-group-item list-group-item-action" data-id="">Unassigned</button>`);
      }
      matches.forEach((u) => {
        rows.push(
          `<button type="button" class="list-group-item list-group-item-action" data-id="${u.id}">${u.name} <span class="text-muted" style="font-size:0.76rem;">(${roleLabel(u.role)})</span></button>`
        );
      });
      if (!rows.length) {
        list.innerHTML = `<div class="list-group-item text-muted" style="font-size:0.82rem;">No matching employees</div>`;
      } else {
        list.innerHTML = rows.join("");
      }
      list.classList.remove("d-none");
    }

    input.value = labelFor(selectedId);

    input.addEventListener("focus", () => renderOptions(input.value === labelFor(selectedId) ? "" : input.value));
    input.addEventListener("input", () => {
      selectedId = "";
      renderOptions(input.value);
    });
    input.addEventListener("blur", () => {
      setTimeout(() => list.classList.add("d-none"), 150);
    });
    list.addEventListener("mousedown", (e) => {
      const btn = e.target.closest("[data-id]");
      if (!btn) return;
      selectedId = btn.dataset.id;
      input.value = labelFor(selectedId);
      list.classList.add("d-none");
    });

    return {
      getValue: () => selectedId || "",
      setValue: (id) => {
        selectedId = id || "";
        input.value = labelFor(selectedId);
      },
    };
  }

  return {
    render,
    requireAuth,
    initials,
    roleLabel,
    badgeForStatus,
    badgeForPriority,
    formatDate,
    timeAgo,
    emptyState,
    loadingState,
    employeeSearch,
  };
})();
