const TFNotify = (() => {
  function ensureStack() {
    let stack = document.querySelector(".tf-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "tf-toast-stack";
      document.body.appendChild(stack);
    }
    return stack;
  }

  const ICONS = {
    success: "bi-check-circle-fill",
    danger: "bi-x-circle-fill",
    warning: "bi-exclamation-triangle-fill",
    info: "bi-info-circle-fill",
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function show(message, type = "info", timeout = 3800) {
    const stack = ensureStack();
    const toast = document.createElement("div");
    toast.className = `tf-toast tf-toast-${type}`;
    toast.innerHTML = `<i class="bi ${ICONS[type] || ICONS.info}"></i><div>${escapeHtml(message)}</div>`;
    stack.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = "opacity 0.2s ease";
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 200);
    }, timeout);
  }

  function success(msg) { show(msg, "success"); }
  function error(msg) { show(msg, "danger"); }
  function warning(msg) { show(msg, "warning"); }
  function info(msg) { show(msg, "info"); }

  function confirmAction(message) {
    return window.confirm(message);
  }

  return { show, success, error, warning, info, confirmAction };
})();
