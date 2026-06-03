/* ============================================================
   main.js — interactions: custom cursor, magnetic buttons,
   scroll-reveal, scroll progress, copy-to-clipboard, icons.
   Lightweight & reduced-motion aware.
   ============================================================ */
(function () {
  "use strict";
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // ---- Lucide icons ----
  function icons() { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); }
  if (document.readyState !== "loading") icons();
  else document.addEventListener("DOMContentLoaded", icons);

  // ---- custom cursor (lerped ring) ----
  if (fine && !REDUCED) {
    const dot = document.getElementById("cursor");
    const ring = document.getElementById("cursorRing");
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    });
    (function follow() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(follow);
    })();
    const hoverOn = () => ring.classList.add("is-hover");
    const hoverOff = () => ring.classList.remove("is-hover");
    document.querySelectorAll("[data-cursor], a, button").forEach((el) => {
      el.addEventListener("mouseenter", hoverOn);
      el.addEventListener("mouseleave", hoverOff);
    });
    // hide system cursor only on fine pointers
    document.documentElement.style.cursor = "none";
  } else {
    const d = document.getElementById("cursor"); const r = document.getElementById("cursorRing");
    if (d) d.style.display = "none"; if (r) r.style.display = "none";
  }

  // ---- magnetic buttons ----
  if (fine && !REDUCED) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      const strength = 0.3;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  // ---- scroll reveal (IO + scroll/timer failsafe) ----
  const reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal:not(.in)"));
  if (REDUCED) {
    reveals.forEach((r) => r.classList.add("in"));
  } else {
    function revealCheck() {
      for (let i = reveals.length - 1; i >= 0; i--) {
        const el = reveals[i];
        const r = el.getBoundingClientRect();
        if (r.top < (window.innerHeight || 0) * 0.94 && r.bottom > 0) {
          el.classList.add("in");
          reveals.splice(i, 1);
        }
      }
    }
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => {
        es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
      }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
      reveals.forEach((r) => io.observe(r));
    }
    // Failsafe: some embedded/headless contexts never drive IO — reveal
    // anything already on-screen via scroll + a couple of timers so the
    // page is never stuck invisible.
    addEventListener("scroll", revealCheck, { passive: true });
    addEventListener("resize", revealCheck);
    setTimeout(revealCheck, 400);
    setTimeout(revealCheck, 1400);
    revealCheck();
  }

  // ---- scroll progress bar ----
  const bar = document.getElementById("progress");
  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const st = document.documentElement.scrollTop || document.body.scrollTop;
      const sh = (document.documentElement.scrollHeight || 0) - innerHeight;
      bar.style.width = (sh > 0 ? (st / sh) * 100 : 0) + "%";
      ticking = false;
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---- smooth anchor scroll ----
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id === "#" || id.length < 2) return;
      const t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
    });
  });

  // ---- copy email ----
  const copyBtn = document.getElementById("copyBtn");
  if (copyBtn) {
    const EMAIL = "work.kaiserlautern@gmail.com";
    const txt = document.getElementById("copyTxt");
    const ico = document.getElementById("copyIco");
    copyBtn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(EMAIL); }
      catch (_) {
        const ta = document.createElement("textarea"); ta.value = EMAIL; document.body.appendChild(ta);
        ta.select(); try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta);
      }
      copyBtn.classList.add("copied");
      txt.textContent = "copied to clipboard";
      ico.setAttribute("data-lucide", "check"); icons();
      clearTimeout(copyBtn._t);
      copyBtn._t = setTimeout(() => {
        copyBtn.classList.remove("copied");
        txt.textContent = EMAIL;
        ico.setAttribute("data-lucide", "copy"); icons();
      }, 1900);
    });
  }
})();
