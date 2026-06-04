/* ============================================================
   ap-figures.js — interactive figures for papers.
   Canvas 2D, theme-aware (reads apparatus CSS vars), pauses
   off-screen and on hidden tab, honors prefers-reduced-motion.

   A paper embeds a figure with:
     <div class="ap-fig" data-fig="loop" data-cap="..."></div>
   This script finds each .ap-fig, builds a card (canvas + controls
   + caption) and runs the named builder from FIGS.
   ============================================================ */
(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // Live palette, refreshed from CSS vars on theme change (mutated in place
  // so running figures pick up new colors on their next frame).
  const P = {};
  function refresh() {
    const cs = getComputedStyle(document.documentElement);
    const g = (k, d) => { const v = cs.getPropertyValue(k).trim(); return v || d; };
    P.ink = g("--ink", "#17150F"); P.ink2 = g("--ink-2", "#54524A"); P.ink3 = g("--ink-3", "#8A887E");
    P.line = g("--line", "rgba(23,21,15,.14)"); P.line2 = g("--line-2", "rgba(23,21,15,.32)");
    P.blue = g("--blue", "#1B3CFF"); P.red = g("--red", "#FF3B2E");
    P.paper = g("--paper", "#F1F0EA"); P.paper2 = g("--paper-2", "#E8E7DF"); P.surface = g("--surface", "#FBFBF7");
    P.mono = g("--font-mono", "monospace"); P.disp = g("--font-display", "sans-serif"); P.body = g("--font-body", "sans-serif");
  }
  refresh();
  new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function arrowHead(ctx, x, y, ang, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-s, -s * 0.55); ctx.lineTo(-s, s * 0.55); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ---------------------------------------------------------------
     FIGURE 1 — the perceive / decide / act loop
     --------------------------------------------------------------- */
  const FIGS = {};

  FIGS.loop = function (ctx, ui, dim) {
    const pace = ui.slider({ label: "loop pace", min: 6, max: 60, value: 22, step: 1, unit: "/min" });
    const playing = ui.toggle({ label: "run", value: true });
    const out = ui.readout("≈ actions / minute");
    const STATIONS = [
      { t: "CAPTURE", s: "video / screenshot" },
      { t: "DECIDE", s: "vision + policy" },
      { t: "ACT", s: "HID · inject" },
      { t: "SURFACE", s: "state changes" },
    ];
    let phase = 0;
    return function (time, dt) {
      const { W, H } = dim();
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2 + 4;
      const R = Math.min(W, H) * 0.33;
      const rpm = pace();
      out(rpm + "");
      if (playing()) phase = (phase + (rpm / 60) * dt) % 1;
      const n = STATIONS.length;
      // ring arcs with arrowheads
      ctx.strokeStyle = P.line2; ctx.lineWidth = 1.5;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU - Math.PI / 2 + 0.34;
        const a1 = ((i + 1) / n) * TAU - Math.PI / 2 - 0.34;
        ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();
        const ae = a1, hx = cx + Math.cos(ae) * R, hy = cy + Math.sin(ae) * R;
        arrowHead(ctx, hx, hy, ae + Math.PI / 2, 6, P.line2);
      }
      // travelling token
      const ta = phase * TAU - Math.PI / 2;
      const tx = cx + Math.cos(ta) * R, ty = cy + Math.sin(ta) * R;
      const active = Math.round(phase * n) % n;
      ctx.fillStyle = P.blue;
      ctx.beginPath(); ctx.arc(tx, ty, 5.5, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(tx, ty, 11, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      // stations
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU - Math.PI / 2;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        const on = i === active;
        const bw = 116, bh = 40;
        ctx.fillStyle = on ? P.blue : P.surface;
        ctx.strokeStyle = on ? P.blue : P.line2; ctx.lineWidth = 1.4;
        rr(ctx, x - bw / 2, y - bh / 2, bw, bh, 8); ctx.fill(); ctx.stroke();
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = on ? P.surface : P.ink;
        ctx.font = "600 12px " + P.mono;
        ctx.fillText(STATIONS[i].t, x, y - 6);
        ctx.fillStyle = on ? "rgba(255,255,255,.78)" : P.ink3;
        ctx.font = "10px " + P.mono;
        ctx.fillText(STATIONS[i].s, x, y + 9);
      }
      // hub label
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = P.ink3; ctx.font = "10px " + P.mono;
      ctx.fillText("see → decide → act → see", cx, cy);
    };
  };

  /* ---------------------------------------------------------------
     FIGURE 2 — reach: in-band ⊆ out-of-band
     --------------------------------------------------------------- */
  FIGS.reach = function (ctx, ui, dim) {
    const mode = ui.segmented({
      label: "body", value: "out",
      options: [{ v: "in", label: "In-band" }, { v: "out", label: "Out-of-band" }],
    });
    const out = ui.readout("reaches");
    const T = [
      { n: "Cloud VM", in: 1 }, { n: "Willing desktop app", in: 1 },
      { n: "Managed / locked-down PC", in: 0 }, { n: "Air-gapped box", in: 0 },
      { n: "BIOS / recovery", in: 0 }, { n: "Kiosk · HMI", in: 0 },
      { n: "ATM", in: 0 }, { n: "Smart TV", in: 0 },
    ];
    const lit = T.map((t) => (t.in ? 1 : 0));
    return function (time, dt) {
      const { W, H } = dim();
      ctx.clearRect(0, 0, W, H);
      const m = mode();
      let count = 0;
      const cols = W < 460 ? 2 : 4;
      const rows = Math.ceil(T.length / cols);
      const padX = 8, padY = 6, gap = 10;
      const cw = (W - padX * 2 - gap * (cols - 1)) / cols;
      const ch = (H - padY * 2 - gap * (rows - 1)) / rows;
      for (let i = 0; i < T.length; i++) {
        const target = m === "in" ? (T[i].in ? 1 : 0) : 1;
        lit[i] += (target - lit[i]) * Math.min(1, dt * 7);
        const L = lit[i];
        if (L > 0.5) count++;
        const c = i % cols, r = (i / cols) | 0;
        const x = padX + c * (cw + gap), y = padY + r * (ch + gap);
        // chip
        ctx.save();
        ctx.globalAlpha = lerp(0.45, 1, L);
        ctx.fillStyle = P.surface;
        rr(ctx, x, y, cw, ch, 9); ctx.fill();
        ctx.lineWidth = lerp(1, 1.6, L);
        ctx.strokeStyle = L > 0.5 ? P.blue : P.line2;
        if (L <= 0.5) ctx.setLineDash([4, 4]);
        rr(ctx, x, y, cw, ch, 9); ctx.stroke();
        ctx.setLineDash([]);
        // check / dot
        const dx = x + 14, dy = y + ch / 2;
        if (L > 0.5) {
          ctx.strokeStyle = P.blue; ctx.lineWidth = 2; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(dx - 4, dy); ctx.lineTo(dx - 1, dy + 4); ctx.lineTo(dx + 5, dy - 5); ctx.stroke();
        } else {
          ctx.fillStyle = P.ink3; ctx.beginPath(); ctx.arc(dx, dy, 2, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = L > 0.5 ? P.ink : P.ink3;
        ctx.font = "11px " + P.mono; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        wrapLeft(ctx, T[i].n, x + 26, dy, cw - 32, 12);
        ctx.restore();
      }
      out(count + " of " + T.length + " target classes");
    };
  };

  function wrapLeft(ctx, text, x, cy, maxw, lh) {
    const words = text.split(" "); const lines = []; let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxw && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    const y0 = cy - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh));
  }

  /* ---------------------------------------------------------------
     FIGURE 3 — lossy by design: pixel fidelity falls, the act survives
     --------------------------------------------------------------- */
  FIGS.lossy = function (ctx, ui, dim) {
    const budget = ui.slider({ label: "information budget", min: 4, max: 100, value: 100, step: 1, unit: "%" });
    const kept = ui.readout("pixels kept");
    const act = ui.readout("next action recoverable");
    // offscreen scene buffer
    const buf = document.createElement("canvas");
    const bx = buf.getContext("2d");
    // target button in normalized scene coords
    const BTN = { x: 0.30, y: 0.60, w: 0.40, h: 0.18 };
    function scene(g, n, m) {
      g.fillStyle = P.surface; g.fillRect(0, 0, n, m);
      // top bar
      g.fillStyle = P.paper2; g.fillRect(0, 0, n, Math.max(1, m * 0.16));
      // a couple of "text" rows
      g.fillStyle = P.line2;
      g.fillRect(n * 0.08, m * 0.30, n * 0.5, Math.max(1, m * 0.04));
      g.fillRect(n * 0.08, m * 0.40, n * 0.66, Math.max(1, m * 0.04));
      // the target button (the thing the agent must click)
      g.fillStyle = P.blue;
      g.fillRect(n * BTN.x, m * BTN.y, n * BTN.w, m * BTN.h);
    }
    return function (time, dt) {
      const { W, H } = dim();
      ctx.clearRect(0, 0, W, H);
      const b = budget();
      // map budget% -> grid resolution N (cols), 4%..100% -> 6..52
      const N = Math.round(lerp(6, 52, Math.pow(b / 100, 0.7)));
      const aspect = 0.66; // screen h/w
      const sx = 8, sy = 8;
      const sw = Math.min(W * 0.56, (H - 16) / aspect);
      const sh = sw * aspect;
      const M = Math.max(4, Math.round(N * aspect));
      buf.width = N; buf.height = M;
      scene(bx, N, M);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(buf, sx, sy, sw, sh);
      ctx.imageSmoothingEnabled = true;
      // frame
      ctx.strokeStyle = P.line2; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, sw, sh);
      // recoverability: the button must still span ~>=1 cell to be locatable
      const cellsAcrossBtn = N * BTN.w;
      const ok = cellsAcrossBtn >= 1.15;
      // where the agent thinks the target is (centroid of the lit blue region, snapped to grid)
      const gx = Math.round((BTN.x + BTN.w / 2) * N) / N;
      const gy = Math.round((BTN.y + BTN.h / 2) * M) / M;
      const px = sx + gx * sw, py = sy + gy * sh;
      ctx.strokeStyle = ok ? P.blue : P.red; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 10, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - 15, py); ctx.lineTo(px - 6, py); ctx.moveTo(px + 6, py); ctx.lineTo(px + 15, py); ctx.stroke();
      // right column labels
      const rx = sx + sw + 22;
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillStyle = P.ink3; ctx.font = "10px " + P.mono;
      ctx.fillText("WHAT THE MODEL SEES", sx, sy + sh + 9);
      ctx.fillStyle = P.ink2; ctx.font = "11px " + P.mono;
      ctx.fillText(N + " × " + M + " cells", rx, sy + 4);
      // readouts (also rendered as DOM)
      const pk = Math.round((N * M) / (52 * Math.round(52 * aspect)) * 100);
      kept(clamp(pk, 1, 100) + "%");
      act(ok ? "YES" : "NO", ok ? P.blue : P.red);
    };
  };

  /* ---------------------------------------------------------------
     mount + control UI
     --------------------------------------------------------------- */
  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function mount(root) {
    const name = root.getAttribute("data-fig");
    const builder = FIGS[name];
    if (!builder || root.dataset.built) return;
    root.dataset.built = "1";

    const stage = el("div", "fig__stage");
    const canvas = el("canvas");
    stage.appendChild(canvas);
    const ctrls = el("div", "fig__ctrls");
    const cap = el("figcaption", "fig__cap");
    cap.innerHTML = root.getAttribute("data-cap") || "";
    root.appendChild(stage);
    root.appendChild(ctrls);
    if (cap.innerHTML) root.appendChild(cap);

    const ctx = canvas.getContext("2d");
    let W = 0, H = 0;
    function size() {
      const r = stage.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    // --- control builders (return getters/setters) ---
    const ui = {
      slider(o) {
        const row = el("label", "fig__ctl");
        const head = el("span", "fig__ctl-l"); head.textContent = o.label;
        const val = el("span", "fig__ctl-v");
        const inp = el("input"); inp.type = "range";
        inp.min = o.min; inp.max = o.max; inp.step = o.step || 1; inp.value = o.value;
        const fmt = () => { val.textContent = inp.value + (o.unit || ""); };
        fmt(); inp.addEventListener("input", fmt);
        head.appendChild(val);
        row.appendChild(head); row.appendChild(inp);
        ctrls.appendChild(row);
        return () => +inp.value;
      },
      toggle(o) {
        const btn = el("button", "fig__btn");
        let on = o.value !== false;
        const paint = () => { btn.textContent = (on ? "❚❚ " : "▶ ") + o.label; btn.setAttribute("aria-pressed", on); btn.classList.toggle("on", on); };
        paint();
        btn.addEventListener("click", () => { on = !on; paint(); });
        ctrls.appendChild(btn);
        return () => on;
      },
      segmented(o) {
        const wrap = el("div", "fig__seg");
        let cur = o.value;
        const lab = el("span", "fig__ctl-l"); lab.textContent = o.label; wrap.appendChild(lab);
        const grp = el("div", "fig__seg-grp");
        o.options.forEach((op) => {
          const b = el("button", "fig__seg-b"); b.textContent = op.label;
          b.classList.toggle("on", op.v === cur);
          b.addEventListener("click", () => { cur = op.v; [...grp.children].forEach((c) => c.classList.toggle("on", c === b)); });
          grp.appendChild(b);
        });
        wrap.appendChild(grp); ctrls.appendChild(wrap);
        return () => cur;
      },
      readout(label) {
        const row = el("div", "fig__out");
        const l = el("span", "fig__out-l"); l.textContent = label;
        const v = el("span", "fig__out-v");
        row.appendChild(l); row.appendChild(v); ctrls.appendChild(row);
        return (text, color) => { v.textContent = text; v.style.color = color || ""; };
      },
    };

    const frame = builder(ctx, ui, () => ({ W, H }));
    size();

    let raf = 0, last = 0, visible = false;
    function tick(ts) {
      if (!visible) { raf = 0; return; }
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
      last = ts;
      frame(ts / 1000, dt);
      raf = requestAnimationFrame(tick);
    }
    function start() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    new ResizeObserver(() => { size(); if (REDUCED) frame(0, 0); }).observe(stage);
    const io = new IntersectionObserver((es) => {
      visible = es[0].isIntersecting && !document.hidden;
      if (REDUCED) { frame(0, 0); return; }
      visible ? start() : stop();
    }, { threshold: 0.05 });
    io.observe(root);
    document.addEventListener("visibilitychange", () => {
      visible = !document.hidden && root.getBoundingClientRect().top < innerHeight;
      if (!REDUCED) (visible ? start() : stop());
    });
    if (REDUCED) frame(0, 0);
  }

  function init() { document.querySelectorAll(".ap-fig[data-fig]").forEach(mount); }
  window.APFigures = { init, FIGS };
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
