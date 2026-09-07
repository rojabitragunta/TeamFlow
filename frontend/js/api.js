const API_BASE_URL = "http://localhost:8000/api";

const TeamFlowAPI = (() => {
  function getToken() {
    return localStorage.getItem("tf_token");
  }

  function setToken(token) {
    localStorage.setItem("tf_token", token);
  }

  function clearSession() {
    localStorage.removeItem("tf_token");
    localStorage.removeItem("tf_user");
  }

  function getUser() {
    const raw = localStorage.getItem("tf_user");
    return raw ? JSON.parse(raw) : null;
  }

  function setUser(user) {
    localStorage.setItem("tf_user", JSON.stringify(user));
  }

  async function request(path, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    } catch (err) {
      throw new Error("Cannot reach the TeamFlow server. Is the backend running?");
    }

    if (response.status === 401) {
      clearSession();
      if (!window.location.pathname.endsWith("login.html") && !window.location.pathname.endsWith("index.html") && window.location.pathname !== "/") {
        window.location.href = "login.html";
      }
      throw new Error("Your session has expired. Please log in again.");
    }

    if (response.status === 204) {
      return null;
    }

    let data = null;
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      throw new Error(friendlyErrorMessage(response.status, data));
    }

    return data;
  }

  function friendlyErrorMessage(status, data) {
    const detail = data && typeof data === "object" ? data.detail : null;
    const detailText = typeof detail === "string" ? detail : Array.isArray(detail) ? formatValidationErrors(detail) : null;

    switch (status) {
      case 400:
        return detailText || "That request could not be processed. Please check the form and try again.";
      case 403:
        return detailText || "You do not have permission to perform this action.";
      case 404:
        return detailText || "The requested item could not be found.";
      case 409:
        return detailText || "This already exists — please use a different value.";
      case 422:
        return detailText || "Some of the information provided is invalid.";
      case 500:
      case 502:
      case 503:
        return "Something went wrong on the server. Please try again.";
      default:
        return detailText || `Request failed (${status}).`;
    }
  }

  function formatValidationErrors(errors) {
    try {
      return errors
        .map((e) => {
          const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : "field";
          return `${field}: ${e.msg}`;
        })
        .join("; ");
    } catch {
      return "Some of the information provided is invalid.";
    }
  }

  const get = (path) => request(path, { method: "GET" });
  const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });
  const put = (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) });
  const del = (path) => request(path, { method: "DELETE" });

  return { getToken, setToken, clearSession, getUser, setUser, get, post, put, del };
})();
