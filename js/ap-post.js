/* ap-post.js, renders a single markdown post (?post=file.md) into the
   apparatus prose column via showdown. Strips YAML front-matter first. */
(function () {
  "use strict";
  function split(t) {
    let m = { title: "Untitled", date: "" }, body = t;
    if (t.slice(0, 3) === "---") {
      const e = t.indexOf("\n---", 3);
      if (e >= 0) {
        const fm = t.slice(3, e);
        const g = (k) => { const r = fm.match(new RegExp("^" + k + ":\\s*(.*)$", "m")); return r ? r[1].trim() : ""; };
        m.title = g("title") || m.title; m.date = g("date");
        body = t.slice(e + 4).replace(/^\s+/, "");
      }
    }
    return { m, body };
  }
  function fmtDate(d) { if (!d) return ""; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }

  const file = new URLSearchParams(location.search).get("post");
  const tEl = document.getElementById("postTitle");
  const dEl = document.getElementById("postDate");
  const bEl = document.getElementById("postBody");
  if (!file || !/^[\w.-]+\.md$/.test(file)) { tEl.textContent = "Post not found"; return; }

  fetch("posts/" + file)
    .then((r) => { if (!r.ok) throw 0; return r.text(); })
    .then((t) => {
      const { m, body } = split(t);
      document.title = m.title + " · Abdulkabir Agboola";
      tEl.textContent = m.title;
      dEl.textContent = fmtDate(m.date);
      const conv = new showdown.Converter({ tables: true, strikethrough: true, ghCompatibleHeaderId: true, simpleLineBreaks: false });
      bEl.innerHTML = conv.makeHtml(body);
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    })
    .catch(() => { tEl.textContent = "Post not found"; bEl.innerHTML = "<p>Could not load this post.</p>"; });
})();
