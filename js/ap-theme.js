/* ============================================================
   theme.js — light/dark toggle, persisted, broadcasts "themechange"
   so the canvas figures (animations.js) recolor live.
   The initial theme is applied by a tiny inline <head> script to
   avoid a flash; this file only handles the toggle button(s).
   ============================================================ */
(function () {
  "use strict";
  const root = document.documentElement;
  const KEY = "abdk-theme";
  const current = () => (root.getAttribute("data-theme") === "dark" ? "dark" : "light");
  function apply(t) {
    if (t === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
  }
  function setup() {
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.setAttribute("aria-label", "Toggle dark mode");
      btn.addEventListener("click", () => {
        root.classList.add("theme-anim");
        const next = current() === "dark" ? "light" : "dark";
        apply(next);
        try { localStorage.setItem(KEY, next); } catch (e) {}
        window.dispatchEvent(new Event("themechange"));
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();
