/* ap-papers.js, papers index. Reads papers/papers.json (a list of
   markdown filenames), pulls each paper's front-matter, sorts newest-first,
   renders apparatus-styled rows linking into paper.html. No build step.
   To add a paper: drop the .md in papers/ and add its name to papers.json. */
(function () {
  "use strict";
  function meta(t) {
    const m = { title: "Untitled", date: "", summary: "" };
    if (t.slice(0, 3) === "---") {
      const e = t.indexOf("\n---", 3);
      if (e >= 0) {
        const fm = t.slice(3, e);
        const g = (k) => { const r = fm.match(new RegExp("^" + k + ":\\s*(.*)$", "m")); return r ? r[1].trim() : ""; };
        m.title = g("title") || m.title; m.date = g("date"); m.summary = g("summary");
      }
    }
    return m;
  }
  function esc(s) { return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function fmtDate(d) { if (!d) return ""; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }

  const box = document.getElementById("papers");
  fetch("papers/papers.json")
    .then((r) => r.json())
    .then((files) => Promise.all(files.map((f) =>
      fetch("papers/" + f).then((r) => r.text()).then((t) => Object.assign(meta(t), { file: f })).catch(() => null)
    )))
    .then((list) => {
      list = list.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
      if (!list.length) { box.innerHTML = '<div class="bl-empty">No papers yet.</div>'; return; }
      box.innerHTML = "";
      list.forEach((p, i) => {
        const a = document.createElement("a");
        a.className = "bl-row";
        a.href = "paper.html?paper=" + encodeURIComponent(p.file);
        a.setAttribute("data-cursor", "");
        a.innerHTML =
          '<span class="n">' + String(i + 1).padStart(2, "0") + "</span>" +
          '<span><span class="ti">' + esc(p.title) + "</span>" +
          (p.summary ? '<span class="su">' + esc(p.summary) + "</span>" : "") + "</span>" +
          '<span class="dt">' + esc(fmtDate(p.date)) + "</span>";
        box.appendChild(a);
      });
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    })
    .catch(() => { box.innerHTML = '<div class="bl-empty">Could not load papers.</div>'; });
})();
