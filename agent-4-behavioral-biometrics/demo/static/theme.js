/* Light / dark toggle shared by both pages. Storage is a convenience only: every access is guarded. */
(function () {
  "use strict";
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem("pip-demo-theme");
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  } catch (e) { /* storage blocked: follow the OS setting */ }

  function current() {
    var forced = root.getAttribute("data-theme");
    if (forced) return forced;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var button = document.getElementById("theme-toggle");
    if (!button) return;
    function label() { button.textContent = current() === "dark" ? "Light mode" : "Dark mode"; }
    label();
    button.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("pip-demo-theme", next); } catch (e) { /* ignore */ }
      label();
      document.dispatchEvent(new Event("themechange"));
    });
  });
})();
