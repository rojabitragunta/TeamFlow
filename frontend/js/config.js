// TeamFlow frontend configuration.
//
// This is a static HTML/CSS/JS app with no build step, so configuration is a
// plain JS file loaded before api.js, rather than a bundler env var.
//
// Local development (served from localhost/127.0.0.1) automatically points at
// the local backend on port 8000 — no setup needed to run the app locally.
//
// For production, set PRODUCTION_API_BASE_URL below to your deployed backend's
// URL (e.g. "https://api.yourdomain.com/api"). Leaving it blank falls back to
// "<same origin>/api", which works if the backend is reverse-proxied under
// /api on the same domain as the frontend.
const TF_CONFIG = (() => {
  const PRODUCTION_API_BASE_URL = ""; // e.g. "https://api.yourdomain.com/api"

  const { hostname, protocol, origin } = window.location;
  const isLocalDev = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";

  const API_BASE_URL = isLocalDev
    ? "http://localhost:8000/api"
    : PRODUCTION_API_BASE_URL || `${origin}/api`;

  return { API_BASE_URL };
})();
