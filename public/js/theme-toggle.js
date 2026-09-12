// Theme toggle — injects a sun/moon button into the site nav and
// persists the user's preference in localStorage.
(function initThemeToggle() {
  const KEY = 'bookove-theme';

  // Apply saved theme immediately (before paint) to avoid flash
  if (localStorage.getItem(KEY) === 'dark') {
    document.documentElement.classList.add('dark');
  }

  // Build the toggle button
  const btn = document.createElement('button');
  btn.className = 'theme-toggle-btn';
  btn.setAttribute('aria-label', 'Toggle dark mode');
  btn.title = 'Toggle dark mode';
  btn.style.cssText =
    'background:var(--surface-alt); color:var(--ink); border:2px solid var(--ink); border-radius:8px; ' +
    'padding:8px 12px; cursor:pointer; font-size:16px; line-height:1; ' +
    'transition:all 0.15s ease; display:flex; align-items:center; justify-content:center; flex-shrink:0;';
  btn.innerHTML = isDark() ? sunIcon() : moonIcon();

  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'var(--ink)';
    btn.style.color = 'var(--accent-bright)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = isDark() ? 'var(--surface-alt)' : '';
    btn.style.color = isDark() ? 'var(--ink)' : '';
  });

  btn.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem(KEY, isDark() ? 'dark' : 'light');
    btn.innerHTML = isDark() ? sunIcon() : moonIcon();
    // Reset hover styles after toggle
    btn.style.background = isDark() ? 'var(--surface-alt)' : '';
    btn.style.color = isDark() ? 'var(--ink)' : '';
  });

  // Inject into every .site-nav on the page
  document.querySelectorAll('.site-nav').forEach((nav) => {
    nav.prepend(btn);
  });

  // Also inject into reader toolbar if present
  const readerActions = document.querySelector('.reader-actions');
  if (readerActions) {
    readerActions.prepend(btn.cloneNode(true));
    readerActions.querySelector('.theme-toggle-btn').addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem(KEY, isDark() ? 'dark' : 'light');
      document.querySelectorAll('.theme-toggle-btn').forEach((b) => {
        b.innerHTML = isDark() ? sunIcon() : moonIcon();
      });
    });
  }

  // Sync mobile bottom-nav theme toggle
  function syncAllThemeIcons() {
    const icon = isDark() ? sunIcon() : moonIcon();
    document.querySelectorAll('.theme-toggle-btn').forEach((b) => { b.innerHTML = icon; });
    const mobileIcon = document.getElementById('mobile-theme-icon');
    if (mobileIcon) mobileIcon.outerHTML = isDark() ? sunIconSm() : moonIconSm();
  }

  const mobileToggle = document.getElementById('mobile-theme-toggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem(KEY, isDark() ? 'dark' : 'light');
      syncAllThemeIcons();
    });
  }

  function isDark() {
    return document.documentElement.classList.contains('dark');
  }

  function sunIcon() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  }

  function moonIcon() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
  function sunIconSm() {
    return '<svg id="mobile-theme-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  }
  function moonIconSm() {
    return '<svg id="mobile-theme-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
})();
