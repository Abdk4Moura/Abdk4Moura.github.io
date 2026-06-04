// Relay site — theme toggle + mobile menu. No framework, no dependencies.
(function(){
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('relay-theme'); } catch(e){}
  var initial = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.setAttribute('data-theme', initial);

  function iconFor(theme){
    // show the icon for the theme you'd switch TO
    return theme === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12h2.5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z"/></svg>';
  }
  function syncIcons(){
    var t = root.getAttribute('data-theme');
    document.querySelectorAll('[data-theme-btn]').forEach(function(b){ b.innerHTML = iconFor(t); });
  }
  function toggle(){
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('relay-theme', next); } catch(e){}
    syncIcons();
  }

  document.addEventListener('click', function(e){
    var tb = e.target.closest('[data-theme-btn]');
    if(tb){ toggle(); return; }
    var mb = e.target.closest('[data-menu-btn]');
    if(mb){ document.querySelector('[data-mobile-menu]').classList.toggle('open'); return; }
    var ml = e.target.closest('[data-mobile-menu] a');
    if(ml){ document.querySelector('[data-mobile-menu]').classList.remove('open'); }
  });

  document.addEventListener('DOMContentLoaded', syncIcons);
  syncIcons();
})();
