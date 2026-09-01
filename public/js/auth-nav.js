// Shared across every page: fetches the current session and updates the
// header's right-hand nav to show either a "Get a library card" link or
// the signed-in member's name + avatar + logout.
(async function initAuthNav() {
  const nav = document.getElementById('site-nav');
  if (!nav) return;

  try {
    const res = await fetch('/auth/me');
    const data = await res.json();
    renderNav(data.user);
  } catch {
    // If the check fails, leave whatever the page already has in the nav.
  }

  function renderNav(user) {
    const existingAuthSlot = document.getElementById('auth-slot');
    if (existingAuthSlot) existingAuthSlot.remove();

    const slot = document.createElement('span');
    slot.id = 'auth-slot';
    slot.style.display = 'flex';
    slot.style.alignItems = 'center';
    slot.style.gap = '10px';

    if (user) {
      const initials = user.name ? user.name.trim().charAt(0).toUpperCase() : '?';
      slot.innerHTML = `
        <span class="nav-user" title="Click to view library card" style="cursor: pointer;" id="nav-user-profile-btn">
          ${
            user.avatarUrl
              ? `<img src="${escapeHtml(user.avatarUrl)}" alt="" class="nav-avatar" />`
              : `<span class="nav-avatar nav-avatar-fallback">${initials}</span>`
          }
          <span class="nav-user-name">${escapeHtml(user.name)}</span>
        </span>
        <button id="logout-btn" class="site-nav-logout">Log out</button>
      `;
      nav.appendChild(slot);

      document.getElementById('nav-user-profile-btn').addEventListener('click', () => {
        if (window.showProfileCard) window.showProfileCard(user.id);
      });

      document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/auth/logout', { method: 'POST' });
        window.location.reload();
      });
    } else {
      slot.innerHTML = `<a href="get-started.html" class="nav-get-card">Get a Library Card</a>`;
      nav.appendChild(slot);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
})();
