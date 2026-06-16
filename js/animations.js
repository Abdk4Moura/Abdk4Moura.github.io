/* ============================================================
   animations.js, live "figures" for the portfolio.
   All Canvas 2D. Thin ink strokes + coral accents on warm paper.
   Each animation only runs while on-screen (IntersectionObserver),
   pauses when the tab is hidden, caps DPR, and renders a single
   static frame when prefers-reduced-motion is set.
   ============================================================ */
(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  const C = {
    paper:      "#FCFBF7",
    paperWell:  "#F4F1EA",
    heroBg:     "#F4F1EA",
    fade:       "rgba(244,241,234,0.05)",
    heroInk:    "rgba(26,25,22,0.06)",
    heroAccent: "rgba(255,122,61,0.22)",
    ink:        "#1A1916",
    line:       "rgba(26,25,22,0.16)",
    lineSoft:   "rgba(26,25,22,0.09)",
    lineStrong: "rgba(26,25,22,0.42)",
    muted:      "#9A958A",
    coral:      "#FF7A3D",
    pink:       "#F5447F",
    plum:       "#9B3AA8",
    rose:       "#FF6A7F",
    err:        "rgba(242,106,106,0.5)",
  };

  // Pull the live palette from CSS custom properties so the figures
  // recolor with the theme (light / dark) and across design directions.
  // Mutating C in place means running animations pick up new colors
  // on their next frame, no re-init needed.
  const CSS_KEYS = {
    "--anim-paper": "paper", "--anim-hero-bg": "heroBg", "--anim-fade": "fade",
    "--anim-hero-ink": "heroInk", "--anim-hero-accent": "heroAccent",
    "--anim-ink": "ink", "--anim-line": "line", "--anim-line-soft": "lineSoft",
    "--anim-line-strong": "lineStrong", "--anim-muted": "muted",
    "--anim-coral": "coral", "--anim-pink": "pink", "--anim-plum": "plum",
    "--anim-rose": "rose", "--anim-err": "err",
  };
  function refreshPalette() {
    const cs = getComputedStyle(document.documentElement);
    for (const k in CSS_KEYS) {
      const v = cs.getPropertyValue(k).trim();
      if (v) C[CSS_KEYS[k]] = v;
    }
  }

  // -- helpers ----------------------------------------------------
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (t) => t * t * (3 - 2 * t);

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

  // cheap smooth pseudo-noise (summed sines), avoids a noise lib
  function noise2(x, y, t) {
    return (
      Math.sin(x * 1.7 + t) * 0.5 +
      Math.cos(y * 1.9 - t * 0.8) * 0.5 +
      Math.sin((x + y) * 1.1 + t * 0.6) * 0.5
    );
  }

  /* ============================================================
     Mount controller, wires DPR sizing, rAF, IO, visibility.
     factory(ctx, w, h) -> { frame(t, dt), draw?(static), resize() }
     ============================================================ */
  function mount(canvas, factory) {
    const ctx = canvas.getContext("2d", { alpha: true });
    let w = 0, h = 0, inst = null, raf = 0, last = 0, running = false, visible = false;

    function size() {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * DPR);
      canvas.height = Math.round(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      inst = factory(ctx, w, h);
      if (REDUCED) { renderStatic(); }
    }

    function renderStatic() {
      ctx.clearRect(0, 0, w, h);
      // advance to a representative frame, then draw it once
      if (inst && inst.frame) inst.frame(1.6, 0);
    }

    function loop(now) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      inst.frame(now / 1000, dt);
      raf = requestAnimationFrame(loop);
    }

    function start() {
      if (running || REDUCED) return;
      running = true; last = performance.now();
      raf = requestAnimationFrame(loop);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }

    function inView() {
      const r = canvas.getBoundingClientRect();
      return r.bottom > 0 && r.top < (window.innerHeight || 0) &&
             r.right > 0 && r.left < (window.innerWidth || 0);
    }

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => {
        es.forEach((e) => {
          visible = e.isIntersecting;
          if (visible && !document.hidden) start(); else stop();
        });
      }, { threshold: 0.08 });
      io.observe(canvas);
      // Fallback: if the IO callback hasn't fired shortly after mount
      // (some embedded/headless contexts never drive it), start anything
      // already on-screen so a figure is never silently blank.
      setTimeout(() => {
        if (!running && !document.hidden && inView()) { visible = true; start(); }
      }, 500);
    } else {
      // No IO support, start when on-screen, re-check on scroll.
      const check = () => {
        const iv = inView();
        if (iv && !running && !document.hidden) { visible = true; start(); }
        else if (!iv && running) { visible = false; stop(); }
      };
      window.addEventListener("scroll", check, { passive: true });
      check();
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else if (visible) start();
    });

    let rt;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => { const wasRun = running; stop(); size(); if (wasRun) start(); }, 150);
    });

    size();
  }

  /* ============================================================
     FIG 01, ASR for tonal languages
     Scrolling waveform -> tone contour -> tonal glyph tokens.
     ============================================================ */
  function asr(ctx, w, h) {
    const baseY = h * 0.6;
    const amp = h * 0.13;
    const glyphs = ["à", "á", "a", "ò", "ó", "ì", "í", "ẹ", "ọ"];
    const tones = []; // emitted tone marks travelling right
    let emitT = 0;

    function pitch(x, t) {
      // smooth tonal contour: a few overlapping slow waves
      return (
        Math.sin(x * 0.9 + t * 0.8) * 0.6 +
        Math.sin(x * 0.37 - t * 0.5) * 0.4
      );
    }

    return {
      frame(t) {
        ctx.clearRect(0, 0, w, h);
        const padX = w * 0.1;
        const fullW = w - padX * 2;

        // baseline
        ctx.strokeStyle = C.lineSoft; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padX, baseY); ctx.lineTo(w - padX, baseY); ctx.stroke();

        // ---- waveform (envelope-modulated sine bursts) ----
        ctx.strokeStyle = C.lineStrong; ctx.lineWidth = 1.2;
        ctx.beginPath();
        const N = 140;
        for (let i = 0; i <= N; i++) {
          const fx = i / N;
          const x = padX + fx * fullW;
          const env =
            (0.55 + 0.45 * Math.sin(fx * 22 - t * 2.2)) *
            (0.4 + 0.6 * Math.abs(Math.sin(fx * 4.0 + t * 0.7)));
          const carrier = Math.sin(fx * 120 - t * 9);
          const y = baseY + carrier * amp * env;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();

        // ---- tone contour above (the meaning) ----
        const cy = h * 0.27;
        const cAmp = h * 0.1;
        ctx.lineWidth = 2;
        const grad = ctx.createLinearGradient(padX, 0, w - padX, 0);
        grad.addColorStop(0, C.coral); grad.addColorStop(1, C.pink);
        ctx.strokeStyle = grad;
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const fx = i / 120;
          const x = padX + fx * fullW;
          const y = cy - pitch(fx * 6, t) * cAmp;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();

        // tone dots riding the contour (high/low markers)
        for (let k = 0; k < 5; k++) {
          const fx = ((t * 0.06 + k / 5) % 1);
          const x = padX + fx * fullW;
          const y = cy - pitch(fx * 6, t) * cAmp;
          ctx.fillStyle = C.coral;
          ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); ctx.fill();
          // tick connecting contour to baseline
          ctx.strokeStyle = "rgba(255,122,61,0.18)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, baseY - 4); ctx.stroke();
        }

        // ---- emitted glyph tokens (recognised output) drifting right ----
        emitT += 0.016;
        if (emitT > 0.9) {
          emitT = 0;
          tones.push({ ch: glyphs[(Math.random() * glyphs.length) | 0], x: padX, born: t });
        }
        ctx.font = "600 22px 'DM Serif Display', Georgia, serif";
        ctx.textBaseline = "middle";
        for (let i = tones.length - 1; i >= 0; i--) {
          const g = tones[i];
          g.x += 0.9;
          const fx = (g.x - padX) / fullW;
          if (fx > 1.02) { tones.splice(i, 1); continue; }
          const a = clamp(Math.min(fx * 6, (1.02 - fx) * 6), 0, 1);
          ctx.fillStyle = `rgba(26,25,22,${0.85 * a})`;
          ctx.fillStyle = i % 2 ? `rgba(155,58,168,${a})` : `rgba(26,25,22,${0.85 * a})`;
          ctx.fillText(g.ch, g.x, h * 0.88);
        }

        // axis labels
        ctx.font = "500 10px 'IBM Plex Mono','JetBrains Mono',ui-monospace,monospace";
        ctx.fillStyle = C.muted; ctx.textBaseline = "alphabetic";
        ctx.fillText("TONE", padX, cy - cAmp - 10);
        ctx.fillText("SIGNAL", padX, baseY - amp - 8);
        ctx.fillText("TOKENS", padX, h * 0.88 - 22);
      },
    };
  }

  /* ============================================================
     FIG 02, mini-PaaS deploy pipeline + streaming logs
     ============================================================ */
  function deploy(ctx, w, h) {
    const stages = ["push", "build", "deploy", "live"];
    const logs = ["› git push origin", "▸ detect: node 20", "▸ railpack build", "▸ layer 3/5 cached", "✓ image ready", "▸ caddy: tls ✓", "✓ https live"];
    let logShown = 0, logT = 0;
    let tok = 0; // token position 0..3 across stages

    return {
      frame(t, dt) {
        ctx.clearRect(0, 0, w, h);
        const padX = w * 0.1;
        const railY = h * 0.32;
        const fullW = w - padX * 2;
        const step = fullW / (stages.length - 1);

        // rail
        ctx.strokeStyle = C.line; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(padX, railY); ctx.lineTo(w - padX, railY); ctx.stroke();

        // progress portion (coral) up to token
        tok += dt * 0.5;
        if (tok > stages.length - 0.001) { tok = 0; logShown = 0; }
        const tx = padX + tok * step;
        ctx.strokeStyle = C.coral; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(padX, railY); ctx.lineTo(tx, railY); ctx.stroke();

        // stage nodes
        stages.forEach((s, i) => {
          const x = padX + i * step;
          const done = tok >= i - 0.001;
          const isLive = i === stages.length - 1;
          ctx.beginPath(); ctx.arc(x, railY, 7, 0, TAU);
          ctx.fillStyle = done ? (isLive && tok >= i ? C.coral : C.ink) : C.paper;
          ctx.fill();
          ctx.lineWidth = 1.5; ctx.strokeStyle = done ? C.coral : C.lineStrong; ctx.stroke();
          if (isLive && tok >= i) {
            const pr = 7 + ((t * 1.6) % 1) * 16;
            ctx.strokeStyle = `rgba(255,122,61,${0.5 * (1 - ((t * 1.6) % 1))})`;
            ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, railY, pr, 0, TAU); ctx.stroke();
          }
          ctx.font = "500 11px 'IBM Plex Mono','JetBrains Mono',ui-monospace,monospace";
          ctx.fillStyle = done ? C.ink : C.muted; ctx.textAlign = "center";
          ctx.fillText(s, x, railY - 16);
        });
        ctx.textAlign = "left";

        // moving token (commit)
        ctx.fillStyle = C.pink;
        ctx.beginPath(); ctx.arc(tx, railY, 3.5, 0, TAU); ctx.fill();

        // ---- streaming log panel ----
        const lx = padX, ly = h * 0.5, lw = fullW, lh = h * 0.4;
        ctx.fillStyle = "rgba(26,25,22,0.035)"; rr(ctx, lx, ly, lw, lh, 8); ctx.fill();
        ctx.strokeStyle = C.line; ctx.lineWidth = 1; rr(ctx, lx, ly, lw, lh, 8); ctx.stroke();

        logT += dt;
        const targetShown = Math.min(logs.length, Math.floor(tok / (stages.length / logs.length)) + 1);
        if (logShown < targetShown && logT > 0.18) { logShown++; logT = 0; }
        ctx.font = "500 11px 'IBM Plex Mono','JetBrains Mono',ui-monospace,monospace";
        const lineH = Math.min(18, (lh - 20) / logs.length);
        for (let i = 0; i < logShown; i++) {
          const line = logs[i];
          const ok = line[0] === "✓";
          ctx.fillStyle = ok ? C.coral : C.lineStrong;
          ctx.fillText(line, lx + 14, ly + 22 + i * lineH);
        }
        // blinking caret
        if (logShown < logs.length && (t * 2 | 0) % 2) {
          ctx.fillStyle = C.muted;
          ctx.fillText("▌", lx + 14, ly + 22 + logShown * lineH);
        }
      },
    };
  }

  /* ============================================================
     FIG 03, Spatial Engine: rotating wireframe (octahedron-ish)
     ============================================================ */
  function spatial(ctx, w, h) {
    // vertices of an icosahedron (cheap, looks rich)
    const t = (1 + Math.sqrt(5)) / 2;
    let V = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ];
    const E = [
      [0,1],[0,5],[0,7],[0,10],[0,11],[1,5],[1,7],[1,8],[1,9],[2,3],
      [2,4],[2,6],[2,10],[2,11],[3,4],[3,6],[3,8],[3,9],[4,5],[4,9],
      [4,11],[5,9],[5,11],[6,7],[6,8],[6,10],[7,8],[7,10],[8,9],[10,11],
    ];
    const mag = Math.hypot(1, t);
    V = V.map((p) => p.map((c) => c / mag));

    return {
      frame(time) {
        ctx.clearRect(0, 0, w, h);
        const cx = w / 2, cy = h / 2;
        const R = Math.min(w, h) * 0.32;
        const ax = time * 0.4, ay = time * 0.27;
        const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay);

        const pts = V.map(([x, y, z]) => {
          // rotate Y then X
          let X = x * cb + z * sb;
          let Z = -x * sb + z * cb;
          let Y = y * ca - Z * sa;
          Z = y * sa + Z * ca;
          const persp = 2.4 / (2.4 - Z);
          return { x: cx + X * R * persp, y: cy + Y * R * persp, z: Z, s: persp };
        });

        // faint filled hint on the near side
        ctx.lineWidth = 1;
        E.forEach(([a, b]) => {
          const p = pts[a], q = pts[b];
          const depth = (p.z + q.z) / 2; // -1..1
          const fwd = (depth + 1) / 2;
          ctx.strokeStyle = depth > 0
            ? `rgba(255,122,61,${0.25 + fwd * 0.5})`
            : `rgba(26,25,22,${0.08 + fwd * 0.14})`;
          ctx.lineWidth = depth > 0 ? 1.4 : 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        });
        // vertices
        pts.forEach((p) => {
          const fwd = (p.z + 1) / 2;
          ctx.fillStyle = p.z > 0.2 ? C.coral : C.lineStrong;
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.4 + fwd * 2.2, 0, TAU); ctx.fill();
        });

        // scene-graph mini tree (top-left), node lighting in sync
        const nx = w * 0.1, ny = h * 0.16;
        ctx.strokeStyle = C.line; ctx.lineWidth = 1;
        const nodes = [[0,0],[1,1],[1,-1],[2,1.6],[2,0.4]];
        const NS = 12;
        ctx.beginPath();
        ctx.moveTo(nx, ny); ctx.lineTo(nx + NS, ny + NS); 
        ctx.moveTo(nx, ny); ctx.lineTo(nx + NS, ny - NS);
        ctx.stroke();
        ctx.font = "500 9px 'IBM Plex Mono','JetBrains Mono',ui-monospace,monospace";
        ctx.fillStyle = C.muted;
        ctx.fillText("scene_graph", nx + 18, ny - 10);
        const lit = (time * 1.5 | 0) % 4;
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i === lit ? C.coral : C.lineStrong;
          ctx.beginPath(); ctx.arc(nx + (i % 2 ? 0 : NS), ny + (i < 2 ? -NS : NS) + (i*2), 2.4, 0, TAU); ctx.fill();
        }
      },
    };
  }

  /* ============================================================
     FIG 04, FFIGEN: AST traversal -> Dart codegen
     ============================================================ */
  function ffigen(ctx, w, h) {
    // small C AST on the left
    const ox = w * 0.12, oy = h * 0.2, dx = w * 0.13, dy = h * 0.2;
    const tree = [
      { x: 0, y: 1.5, label: "struct" },
      { x: 1, y: 0.5, label: "int" },
      { x: 1, y: 1.5, label: "char*" },
      { x: 1, y: 2.5, label: "fn()" },
    ];
    const edges = [[0,1],[0,2],[0,3]];
    const codeLines = ["final class Native {", "  external int field0;", "  external Pointer name;", "  void call();", "}"];
    let visit = 0, vt = 0, emitted = 0;
    const flying = [];

    return {
      frame(time, dt) {
        ctx.clearRect(0, 0, w, h);
        // divider
        const midX = w * 0.5;
        ctx.strokeStyle = C.lineSoft; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(midX, h * 0.12); ctx.lineTo(midX, h * 0.88); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "500 10px 'IBM Plex Mono','JetBrains Mono',ui-monospace,monospace"; ctx.fillStyle = C.muted;
        ctx.fillText("C · AST", ox, h * 0.12); ctx.fillText("DART · bindings", midX + 16, h * 0.12);

        const P = tree.map((n) => ({ x: ox + n.x * dx, y: oy + n.y * dy, label: n.label }));

        // edges
        ctx.strokeStyle = C.line; ctx.lineWidth = 1;
        edges.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); ctx.stroke(); });

        // traversal cursor
        vt += dt;
        if (vt > 0.85) {
          vt = 0;
          const leaf = visit % 3 + 1; // visit leaves 1,2,3
          flying.push({ from: { ...P[leaf] }, p: 0, idx: emitted % codeLines.length });
          visit++;
          if (visit % 3 === 0) emitted = Math.min(codeLines.length, emitted); 
          emitted = Math.min(codeLines.length, flying.length);
        }
        const activeLeaf = (visit % 3) + 1;

        // nodes
        P.forEach((n, i) => {
          const active = i === activeLeaf;
          ctx.beginPath(); ctx.arc(n.x, n.y, i === 0 ? 6 : 5, 0, TAU);
          ctx.fillStyle = active ? C.coral : (i === 0 ? C.ink : C.paper);
          ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = active ? C.coral : C.lineStrong; ctx.stroke();
          ctx.font = "500 9px 'IBM Plex Mono','JetBrains Mono',ui-monospace,monospace"; ctx.fillStyle = active ? C.coral : C.muted;
          ctx.fillText(n.label, n.x + 9, n.y + 3);
        });

        // flying binding tokens -> right side
        const codeX = midX + 18, codeY0 = h * 0.26, lineH = Math.min(20, (h * 0.5) / codeLines.length);
        for (let i = flying.length - 1; i >= 0; i--) {
          const f = flying[i];
          f.p += dt * 1.4;
          const tgtY = codeY0 + f.idx * lineH;
          const x = lerp(f.from.x, codeX, ease(clamp(f.p, 0, 1)));
          const y = lerp(f.from.y, tgtY, ease(clamp(f.p, 0, 1)));
          if (f.p >= 1) { flying.splice(i, 1); continue; }
          ctx.fillStyle = C.pink; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); ctx.fill();
        }

        // accumulated code lines
        ctx.font = "500 11px 'IBM Plex Mono','JetBrains Mono',ui-monospace,monospace";
        const shown = Math.min(codeLines.length, emitted);
        for (let i = 0; i < codeLines.length; i++) {
          const on = i < shown;
          ctx.fillStyle = on ? (i === 0 || i === codeLines.length - 1 ? C.lineStrong : C.ink) : "rgba(26,25,22,0.08)";
          ctx.fillText(codeLines[i], codeX, codeY0 + i * lineH);
        }
      },
    };
  }

  /* ============================================================
     FIG 05, Quickshare P2P: direct routing + reroute on failure
     ============================================================ */
  function p2p(ctx, w, h) {
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.34;
    const n = 7;
    const nodes = Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i / n) * TAU;
      return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    });
    let src = 0, dst = 3, pkts = [], emit = 0, failEdge = -1, failT = 0, path = [0, 3];

    function buildPath(a, b) {
      // simple ring path that avoids the failed edge if needed
      const cwSteps = (b - a + n) % n;
      const cw = []; for (let i = 0; i <= cwSteps; i++) cw.push((a + i) % n);
      const ccw = []; for (let i = 0; i <= n - cwSteps; i++) ccw.push((a - i + n) % n);
      const hasFail = (p) => { for (let i = 0; i < p.length - 1; i++) { if ((p[i] === failEdge || p[i+1] === failEdge)) return true; } return false; };
      if (failEdge >= 0 && hasFail(cw) && !hasFail(ccw)) return ccw;
      return cw.length <= ccw.length ? cw : ccw;
    }

    return {
      frame(time, dt) {
        ctx.clearRect(0, 0, w, h);

        // faded central server, crossed out
        ctx.strokeStyle = C.line; ctx.lineWidth = 1;
        rr(ctx, cx - 13, cy - 11, 26, 22, 4); ctx.stroke();
        ctx.strokeStyle = "rgba(242,106,106,0.5)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(cx - 16, cy - 14); ctx.lineTo(cx + 16, cy + 14); ctx.stroke();
        ctx.font = "500 8px 'IBM Plex Mono','JetBrains Mono',ui-monospace,monospace"; ctx.fillStyle = C.muted; ctx.textAlign = "center";
        ctx.fillText("no server", cx, cy + 26); ctx.textAlign = "left";

        // mesh edges (ring)
        for (let i = 0; i < n; i++) {
          const a = nodes[i], b = nodes[(i + 1) % n];
          const failed = i === failEdge || (i + 1) % n === failEdge;
          ctx.strokeStyle = failed ? "rgba(242,106,106,0.35)" : C.lineSoft;
          ctx.setLineDash(failed ? [3, 4] : []);
          ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.setLineDash([]);

        // active path highlight
        ctx.strokeStyle = C.coral; ctx.lineWidth = 2;
        ctx.beginPath();
        path.forEach((p, i) => { i ? ctx.lineTo(nodes[p].x, nodes[p].y) : ctx.moveTo(nodes[p].x, nodes[p].y); });
        ctx.stroke();

        // nodes
        nodes.forEach((nd, i) => {
          const isEnd = i === src || i === dst;
          ctx.beginPath(); ctx.arc(nd.x, nd.y, isEnd ? 7 : 5, 0, TAU);
          ctx.fillStyle = i === src ? C.ink : i === dst ? C.coral : C.paper;
          ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = isEnd ? (i === dst ? C.coral : C.ink) : C.lineStrong; ctx.stroke();
        });

        // emit packets along the path
        emit += dt;
        if (emit > 0.5) { emit = 0; pkts.push({ p: 0 }); }
        for (let i = pkts.length - 1; i >= 0; i--) {
          const pk = pkts[i];
          pk.p += dt * 0.45;
          if (pk.p >= 1) {
            pkts.splice(i, 1);
            // arrived: pick a new transfer + maybe a link failure
            if (Math.random() < 0.5) {
              src = dst; dst = (dst + 2 + ((Math.random() * 3) | 0)) % n;
              if (src === dst) dst = (dst + 1) % n;
              failEdge = Math.random() < 0.6 ? ((Math.random() * n) | 0) : -1;
              path = buildPath(src, dst);
            }
            continue;
          }
          // position along polyline path
          const seg = pk.p * (path.length - 1);
          const si = Math.min(path.length - 2, Math.floor(seg));
          const ft = seg - si;
          const a = nodes[path[si]], b = nodes[path[si + 1]];
          const x = lerp(a.x, b.x, ft), y = lerp(a.y, b.y, ft);
          ctx.fillStyle = C.pink; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill();
          ctx.fillStyle = "rgba(245,68,127,0.25)"; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
        }
      },
    };
  }

  /* ============================================================
     FIG 06, n8n workflow: pulses node->node, TTS emits waveform
     ============================================================ */
  function workflow(ctx, w, h) {
    const labels = ["trigger", "format", "neuphonic", "output"];
    const ny = h * 0.42;
    let pulse = 0;
    return {
      frame(time, dt) {
        ctx.clearRect(0, 0, w, h);
        const padX = w * 0.11, fullW = w - padX * 2, step = fullW / (labels.length - 1);
        const nodes = labels.map((l, i) => ({ x: padX + i * step, y: ny, l }));

        // wires (bezier-ish)
        ctx.strokeStyle = C.line; ctx.lineWidth = 1.5;
        for (let i = 0; i < nodes.length - 1; i++) {
          const a = nodes[i], b = nodes[i + 1];
          ctx.beginPath(); ctx.moveTo(a.x + 26, a.y);
          ctx.bezierCurveTo((a.x + b.x) / 2, a.y, (a.x + b.x) / 2, b.y, b.x - 26, b.y);
          ctx.stroke();
        }

        // travelling pulse
        pulse += dt * 0.32; if (pulse > 1) pulse = 0;
        const totalSeg = nodes.length - 1;
        const segF = pulse * totalSeg;
        const si = Math.min(totalSeg - 1, Math.floor(segF));
        const ft = segF - si;
        const a = nodes[si], b = nodes[si + 1];
        const px = lerp(a.x + 26, b.x - 26, ft), py = ny;
        const activeNode = Math.round(segF);

        // nodes (rounded cards)
        nodes.forEach((nd, i) => {
          const active = i === activeNode;
          const cw = 52, ch = 30;
          ctx.fillStyle = active ? "rgba(255,122,61,0.10)" : C.paper;
          rr(ctx, nd.x - cw / 2, nd.y - ch / 2, cw, ch, 7); ctx.fill();
          ctx.lineWidth = 1.4; ctx.strokeStyle = active ? C.coral : C.lineStrong;
          rr(ctx, nd.x - cw / 2, nd.y - ch / 2, cw, ch, 7); ctx.stroke();
          // little dot port
          ctx.fillStyle = active ? C.coral : C.muted;
          ctx.beginPath(); ctx.arc(nd.x - cw / 2, nd.y, 2.4, 0, TAU); ctx.fill();
          ctx.font = "500 9px 'IBM Plex Mono','JetBrains Mono',ui-monospace,monospace"; ctx.fillStyle = active ? C.ink : C.muted;
          ctx.textAlign = "center"; ctx.fillText(nd.l, nd.x, nd.y + ch / 2 + 14); ctx.textAlign = "left";

          // TTS node emits a small waveform burst when active
          if (i === 2 && active) {
            ctx.strokeStyle = C.pink; ctx.lineWidth = 1.4; ctx.beginPath();
            for (let s = 0; s <= 22; s++) {
              const fx = s / 22; const xx = nd.x - cw / 2 + 6 + fx * (cw - 12);
              const env = Math.sin(fx * Math.PI);
              const yy = nd.y - Math.sin(fx * 26 - time * 10) * 6 * env;
              s ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
            }
            ctx.stroke();
          }
        });

        // the pulse itself
        ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(px, py, 3.4, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(255,122,61,0.22)"; ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fill();
      },
    };
  }

  /* ============================================================
     HERO, calm flow field of thin ink curves (plotter feel)
     ============================================================ */
  function heroField(ctx, w, h) {
    const count = Math.min(240, Math.round((w * h) / 5200));
    let ps = [];
    function spawn() {
      return { x: Math.random() * w, y: Math.random() * h, life: 40 + Math.random() * 120, age: 0,
               coral: Math.random() < 0.16 };
    }
    ps = Array.from({ length: count }, spawn);
    const scale = 0.0019;

    // prime
    ctx.fillStyle = C.heroBg; ctx.globalAlpha = 1; ctx.fillRect(0, 0, w, h);

    return {
      frame(t) {
        // gentle paper fade (trails), cheap full-rect
        ctx.fillStyle = C.fade;
        ctx.fillRect(0, 0, w, h);

        ctx.lineWidth = 1;
        for (let i = 0; i < ps.length; i++) {
          const p = ps[i];
          const ang = noise2(p.x * scale, p.y * scale, t * 0.12) * Math.PI;
          const nx = p.x + Math.cos(ang) * 1.4;
          const ny = p.y + Math.sin(ang) * 1.4;
          ctx.strokeStyle = p.coral ? C.heroAccent : C.heroInk;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
          p.x = nx; p.y = ny; p.age++;
          if (p.age > p.life || p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) {
            ps[i] = spawn();
          }
        }
      },
    };
  }

  /* ============================================================
     FIG 07, Relay: out-of-band agent. A cursor glides + clicks on a
     target screen, HID keystrokes land as text, a capture pulse returns.
     ============================================================ */
  function relay(ctx, w, h) {
    const sx = w * 0.40, sy = h * 0.26, sw = w * 0.50, sh = h * 0.50;
    const ax = w * 0.12, ay = h * 0.52;
    let cur = { x: sx + sw * 0.30, y: sy + sh * 0.55 };
    let tgt = { x: sx + sw * 0.60, y: sy + sh * 0.40 };
    let p = 1, hold = 0, click = 0, typed = 0, act = -1, cap = -1;
    const typeMax = 16;
    function retarget() {
      cur = { x: tgt.x, y: tgt.y };
      tgt = { x: sx + sw * (0.18 + Math.random() * 0.62), y: sy + sh * (0.30 + Math.random() * 0.52) };
      p = 0;
    }
    return {
      frame(time, dt) {
        ctx.clearRect(0, 0, w, h);
        // agent node (the brain)
        ctx.strokeStyle = C.lineStrong; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(ax, ay, 9, 0, TAU); ctx.stroke();
        ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(ax, ay, 3, 0, TAU); ctx.fill();
        ctx.font = "500 8px 'IBM Plex Mono',ui-monospace,monospace";
        ctx.fillStyle = C.muted; ctx.textAlign = "center";
        ctx.fillText("agent", ax, ay + 22);
        // out-of-band channel
        ctx.textAlign = "left"; ctx.strokeStyle = C.lineSoft; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(ax + 10, ay); ctx.lineTo(sx, sy + sh * 0.5); ctx.stroke();
        ctx.setLineDash([]);
        // target screen
        ctx.strokeStyle = C.line; ctx.lineWidth = 1.2; rr(ctx, sx, sy, sw, sh, 6); ctx.stroke();
        ctx.strokeStyle = C.lineSoft; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sx, sy + 14); ctx.lineTo(sx + sw, sy + 14); ctx.stroke();
        ctx.fillStyle = C.muted; ctx.beginPath(); ctx.arc(sx + 8, sy + 7, 2, 0, TAU); ctx.fill();
        // typed lines (HID landing on the surface)
        ctx.strokeStyle = C.lineSoft; ctx.lineWidth = 4; ctx.lineCap = "round";
        for (let i = 0; i < 3; i++) {
          const full = Math.max(0, Math.min(1, (typed - i * 5) / 5));
          if (full <= 0) break;
          ctx.beginPath(); ctx.moveTo(sx + 12, sy + 30 + i * 12);
          ctx.lineTo(sx + 12 + (sw - 28) * full * 0.92, sy + 30 + i * 12); ctx.stroke();
        }
        ctx.lineCap = "butt";
        // cursor glide (eased)
        p = Math.min(1, p + dt * 1.0);
        const e = ease(p);
        const cx = lerp(cur.x, tgt.x, e), cy = lerp(cur.y, tgt.y, e);
        ctx.fillStyle = C.ink;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + 11);
        ctx.lineTo(cx + 3, cy + 8); ctx.lineTo(cx + 7, cy + 11); ctx.closePath(); ctx.fill();
        if (click > 0) {
          ctx.strokeStyle = C.coral; ctx.lineWidth = 1.6; ctx.globalAlpha = click;
          ctx.beginPath(); ctx.arc(cx, cy, (1 - click) * 12 + 3, 0, TAU); ctx.stroke();
          ctx.globalAlpha = 1; click = Math.max(0, click - dt * 1.6);
        }
        // arrived: click, type, fire pulses, retarget
        if (p >= 1 && hold <= 0) {
          click = 1; typed = Math.min(typeMax, typed + 1 + ((Math.random() * 3) | 0));
          if (typed >= typeMax) typed = 0;
          act = 0; if (Math.random() < 0.6) cap = 0; hold = 0.55;
        }
        if (hold > 0) hold = Math.max(0, hold - dt);
        else if (p >= 1) retarget();
        // act pulse: agent -> screen
        if (act >= 0) {
          act += dt * 1.3;
          if (act >= 1) act = -1;
          else {
            const x = lerp(ax + 10, sx, act), y = lerp(ay, sy + sh * 0.5, act);
            ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
            ctx.fillStyle = C.heroAccent; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
          }
        }
        // capture pulse: screen -> agent (the eyes)
        if (cap >= 0) {
          cap += dt * 1.0;
          if (cap >= 1) cap = -1;
          else {
            const x = lerp(sx, ax + 10, cap), y = lerp(sy + sh * 0.5, ay, cap);
            ctx.fillStyle = C.plum; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill();
          }
        }
        ctx.font = "500 8px 'IBM Plex Mono',ui-monospace,monospace";
        ctx.fillStyle = C.muted; ctx.textAlign = "center";
        ctx.fillText("HID → screen", sx + sw / 2, sy + sh + 16); ctx.textAlign = "left";
      },
    };
  }

  /* ============================================================
     FIG 08, TwinMic: two noisy mics lock into alignment, then a
     clean voice waveform is revealed by a left-to-right pass.
     ============================================================ */
  function twinmic(ctx, w, h) {
    const N = 32;
    const voice = (i) => {
      const x = i / (N - 1);
      const syl = Math.max(0, Math.sin(x * Math.PI * 3.1 - 0.4));
      return 0.16 + 0.84 * Math.pow(syl, 0.7) * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.27)));
    };
    return {
      frame(time) {
        ctx.clearRect(0, 0, w, h);
        const padX = w * 0.13, fullW = w - padX * 2, gap = fullW / N;
        const bw = Math.max(2, gap * 0.5);
        const rowAy = h * 0.24, rowBy = h * 0.46, cleanY = h * 0.78;
        const ampTop = h * 0.085, ampClean = h * 0.19;
        const cyc = (time * 0.17) % 1;            // B drifts, then locks
        const locked = cyc > 0.5;
        const driftPx = locked ? 0 : gap * 0.9 * (0.5 - cyc) * 2;
        const sweep = (time * 0.2) % 1;           // the "cleaning" pass

        ctx.font = "500 8px 'IBM Plex Mono',ui-monospace,monospace";
        ctx.textAlign = "left"; ctx.fillStyle = C.muted;
        ctx.fillText("mic A", padX, rowAy - ampTop - 6);
        ctx.fillText("mic B", padX, rowBy - ampTop - 6);
        ctx.textAlign = "right";
        ctx.fillStyle = locked ? C.coral : C.muted;
        ctx.fillText(locked ? "aligned" : "syncing", padX + fullW, rowAy - ampTop - 6);
        ctx.textAlign = "left";

        for (let i = 0; i < N; i++) {
          const x = padX + i * gap + gap * 0.25;
          const v = voice(i);
          const nA = 0.34 * (Math.sin(i * 5.1 + time * 6) * 0.5 + 0.5);
          const nB = 0.34 * (Math.sin(i * 4.3 - time * 5 + 1.7) * 0.5 + 0.5);
          const hA = (v * 0.55 + nA) * ampTop, hB = (v * 0.55 + nB) * ampTop;
          ctx.fillStyle = C.muted;
          rr(ctx, x, rowAy - hA, bw, hA * 2, bw * 0.5); ctx.fill();
          ctx.fillStyle = C.lineStrong;
          rr(ctx, x + driftPx, rowBy - hB, bw, hB * 2, bw * 0.5); ctx.fill();
        }

        ctx.fillStyle = C.muted; ctx.fillText("clean", padX, cleanY - ampClean - 6);
        for (let i = 0; i < N; i++) {
          const x = padX + i * gap + gap * 0.25;
          const hC = (0.12 + voice(i) * 0.88) * ampClean;
          ctx.globalAlpha = (i / (N - 1)) <= sweep ? 1 : 0.16;
          ctx.fillStyle = C.coral;
          rr(ctx, x, cleanY - hC, bw, hC * 2, bw * 0.5); ctx.fill();
        }
        ctx.globalAlpha = 1;
        const sx = padX + sweep * fullW;
        ctx.strokeStyle = C.coral; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(sx, cleanY - ampClean - 2); ctx.lineTo(sx, cleanY + ampClean + 2); ctx.stroke();
        ctx.globalAlpha = 1;
      },
    };
  }

  /* ============================================================
     Boot
     ============================================================ */
  const registry = { asr, deploy, spatial, ffigen, p2p, workflow, relay, twinmic };

  function boot() {
    refreshPalette();
    window.addEventListener("themechange", refreshPalette);
    const hero = document.getElementById("heroCanvas");
    if (hero) mount(hero, heroField);
    document.querySelectorAll("canvas[data-anim]").forEach((cv) => {
      const f = registry[cv.getAttribute("data-anim")];
      if (f) mount(cv, f);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
