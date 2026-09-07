/* Centralized light/dark theme control. Loaded as early as possible (before
   layout render) so pages don't flash the wrong theme. */
const TFTheme = (() => {
  const KEY = "tf_theme";

  function get() {
    return localStorage.getItem(KEY) || "light";
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function set(theme) {
    localStorage.setItem(KEY, theme);
    apply(theme);
  }

  function toggle() {
    const next = get() === "dark" ? "light" : "dark";
    set(next);
    return next;
  }

  function init() {
    apply(get());
  }

  return { get, set, toggle, init };
})();

TFTheme.init();
