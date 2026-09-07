document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (TeamFlowAPI.getToken() && (loginForm || registerForm)) {
    window.location.href = "dashboard.html";
    return;
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      const errorBox = document.getElementById("loginError");
      const btn = document.getElementById("loginSubmitBtn");

      errorBox.classList.add("d-none");
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Signing in...`;

      try {
        const res = await TeamFlowAPI.post("/auth/login", { email, password });
        TeamFlowAPI.setToken(res.access_token);
        TeamFlowAPI.setUser(res.user);
        window.location.href = "dashboard.html";
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove("d-none");
        btn.disabled = false;
        btn.innerHTML = "Sign In";
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("regName").value.trim();
      const email = document.getElementById("regEmail").value.trim();
      const password = document.getElementById("regPassword").value;
      const confirm_password = document.getElementById("regConfirmPassword").value;
      const errorBox = document.getElementById("registerError");
      const btn = document.getElementById("registerSubmitBtn");

      errorBox.classList.add("d-none");

      if (password !== confirm_password) {
        errorBox.textContent = "Passwords do not match.";
        errorBox.classList.remove("d-none");
        return;
      }
      if (password.length < 6) {
        errorBox.textContent = "Password must be at least 6 characters.";
        errorBox.classList.remove("d-none");
        return;
      }

      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Creating account...`;

      try {
        const res = await TeamFlowAPI.post("/auth/register", { name, email, password, confirm_password });
        TeamFlowAPI.setToken(res.access_token);
        TeamFlowAPI.setUser(res.user);
        window.location.href = "dashboard.html";
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove("d-none");
        btn.disabled = false;
        btn.innerHTML = "Create Account";
      }
    });
  }
});
