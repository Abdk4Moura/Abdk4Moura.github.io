/* ap-paper.js, renders an interactive research paper (?paper=file.md).
   Pipeline: protect LaTeX math from the markdown pass -> showdown ->
   restore math -> KaTeX render -> mount interactive figures (ap-figures.js).
   A paper is markdown with $...$ / $$...$$ math and figure embeds:
     <div class="ap-fig" data-fig="loop" data-cap="..."></div>  */
(function () {
  "use strict";

  function frontMatter(t) {
    let m = { title: "Untitled", date: "", summary: "" }, body = t;
    if (t.slice(0, 3) === "---") {
      const e = t.indexOf("\n---", 3);
      if (e >= 0) {
        const fm = t.slice(3, e);
        const g = (k) => { const r = fm.match(new RegExp("^" + k + ":\\s*(.*)$", "m")); return r ? r[1].trim() : ""; };
        m.title = g("title") || m.title; m.date = g("date"); m.summary = g("summary");
        body = t.slice(e + 4).replace(/^\s+/, "");
      }
    }
    return { m, body };
  }
  function fmtDate(d) { if (!d) return ""; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }

  // Pull math spans out of the markdown so showdown never mangles them
  // (underscores, backslashes, asterisks). Skip fenced/inline code regions.
  function protectMath(src) {
    const store = [];
    const tok = (raw) => { store.push(raw); return "MATH" + (store.length - 1) + ""; };
    const lines = src.split("\n");
    let fenced = false, out = [];
    for (let line of lines) {
      if (/^\s*```/.test(line)) { fenced = !fenced; out.push(line); continue; }
      if (fenced) { out.push(line); continue; }
      // protect inline code first, then math, then restore inline code
      const code = []; line = line.replace(/`[^`]*`/g, (m) => { code.push(m); return "C" + (code.length - 1) + ""; });
      line = line.replace(/\$\$([^$]|\$(?!\$))+?\$\$/g, (m) => tok(m)); // display $$...$$
      line = line.replace(/\$(?!\s)([^$\n]+?)(?<!\s)\$/g, (m) => tok(m)); // inline $...$
      line = line.replace(/C(\d+)/g, (_, i) => code[+i]);
      out.push(line);
    }
    return { text: out.join("\n"), store };
  }
  function restoreMath(html, store) {
    return html.replace(/MATH(\d+)/g, (_, i) => store[+i]);
  }

  const file = new URLSearchParams(location.search).get("paper");
  const tEl = document.getElementById("paperTitle");
  const dEl = document.getElementById("paperDate");
  const sEl = document.getElementById("paperSummary");
  const bEl = document.getElementById("paperBody");
  if (!file || !/^[\w.-]+\.md$/.test(file)) { if (tEl) tEl.textContent = "Paper not found"; return; }

  fetch("papers/" + file)
    .then((r) => { if (!r.ok) throw 0; return r.text(); })
    .then((t) => {
      const { m, body } = frontMatter(t);
      document.title = m.title + " · Abdulkabir Agboola";
      if (tEl) tEl.textContent = m.title;
      if (dEl) dEl.textContent = fmtDate(m.date);
      if (sEl) sEl.textContent = m.summary || "";

      const { text, store } = protectMath(body);
      const conv = new showdown.Converter({ tables: true, strikethrough: true, ghCompatibleHeaderId: true, simpleLineBreaks: false });
      let html = conv.makeHtml(text);
      html = restoreMath(html, store);
      // unwrap display math that landed inside its own paragraph
      html = html.replace(/<p>\s*(\$\$[\s\S]+?\$\$)\s*<\/p>/g, '<div class="mathblock">$1</div>');
      bEl.innerHTML = html;

      // KaTeX
      if (window.renderMathInElement) {
        window.renderMathInElement(bEl, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
          ],
          throwOnError: false,
          errorColor: "var(--red)",
        });
      }
      // interactive figures
      if (window.APFigures && window.APFigures.init) window.APFigures.init();
      // build a section table of contents from h2s
      buildToc(bEl);
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    })
    .catch(() => { if (tEl) tEl.textContent = "Paper not found"; bEl.innerHTML = "<p>Could not load this paper.</p>"; });

  function buildToc(scope) {
    const nav = document.getElementById("paperToc");
    if (!nav) return;
    const hs = scope.querySelectorAll("h2");
    if (!hs.length) { nav.style.display = "none"; return; }
    const ul = document.createElement("ul");
    hs.forEach((h) => {
      if (!h.id) h.id = h.textContent.toLowerCase().replace(/[^\w]+/g, "-");
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#" + h.id; a.textContent = h.textContent.replace(/^\d+\.?\s*/, "");
      a.setAttribute("data-cursor", "");
      li.appendChild(a); ul.appendChild(li);
    });
    nav.appendChild(ul);
    // active-section highlight
    const links = [...nav.querySelectorAll("a")];
    const spy = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) {
          const id = e.target.id;
          links.forEach((l) => l.classList.toggle("on", l.getAttribute("href") === "#" + id));
        }
      });
    }, { rootMargin: "-10% 0px -75% 0px" });
    hs.forEach((h) => spy.observe(h));
  }
})();
