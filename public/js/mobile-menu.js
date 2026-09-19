// Mobile menu — three-dot dropdown (theme switch), + upload button,
// and profile pfp / guest circle on the navbar. Mobile only.
(async function initMobileMenu() {
  const btn = document.getElementById('mobile-menu-btn');
  const dropdown = document.getElementById('mobile-dropdown');
  const profileSlot = document.getElementById('mobile-profile-slot');

  if (!btn || !dropdown) return;

  // Toggle dropdown
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  // Theme mode-switch inside dropdown
  const themeBtn = document.getElementById('mobile-theme-btn');
  const themeLabel = document.getElementById('mobile-theme-label');
  if (themeBtn) {
    updateThemeLabel();
    themeBtn.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('bookove-theme', isDark() ? 'dark' : 'light');
      updateThemeLabel();
      // Sync all theme toggle buttons on the page
      document.querySelectorAll('.theme-toggle-btn').forEach((b) => {
        b.innerHTML = isDark() ? sunIcon() : moonIcon();
      });
      // Sync bottom-nav theme icon if present
      const bottomIcon = document.getElementById('mobile-theme-icon');
      if (bottomIcon) bottomIcon.outerHTML = isDark() ? sunIcon('mobile-theme-icon') : moonIcon('mobile-theme-icon');
    });
  }

  function updateThemeLabel() {
    if (themeLabel) themeLabel.textContent = isDark() ? 'Light Mode' : 'Dark Mode';
  }
  function isDark() {
    return document.documentElement.classList.contains('dark');
  }
  function sunIcon(id) {
    return `<svg ${id ? `id="${id}" ` : ''}width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  }
  function moonIcon(id) {
    return `<svg ${id ? `id="mobile-theme-icon" ` : ''}width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }

  // Fetch auth state → render profile pfp or guest circle
  try {
    const res = await fetch('/auth/me');
    const data = await res.json();
    renderAuth(data.user);
  } catch {
    renderAuth(null);
  }

  function renderAuth(user) {
    if (!profileSlot) return;

    if (user) {
      // Logged in — show pfp, click opens profile card
      const initials = user.name ? user.name.trim().charAt(0).toUpperCase() : '?';
      profileSlot.innerHTML = user.avatarUrl
        ? `<img src="${escapeHtml(user.avatarUrl)}" alt="Profile" class="mobile-profile-img" />`
        : `<span class="mobile-profile-fallback">${initials}</span>`;
      profileSlot.classList.add('signed-in');
      profileSlot.onclick = () => {
        if (window.showProfileCard) window.showProfileCard(user.id);
      };
    } else {
      // Guest — plain circle, click goes to create account
      profileSlot.innerHTML = `<span class="mobile-profile-guest" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </span>`;
      profileSlot.classList.remove('signed-in');
      profileSlot.onclick = () => {
        window.location.href = 'get-started.html';
      };
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
})();
