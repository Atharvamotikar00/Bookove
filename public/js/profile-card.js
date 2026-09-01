// public/js/profile-card.js
(function () {
  // Inject the modal HTML on load
  const modalHTML = `
    <div class="profile-modal-overlay" id="profile-modal" style="display:none;">
      <div class="profile-modal-content">
        
        <!-- OUTSIDE THE CARD (ABOVE) -->
        <div class="profile-meta-above">
          <div class="profile-insta-wrap" id="profile-insta-wrap" style="display:none;">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 2 .3 2.4.5.6.2 1 .5 1.5 1 .4.4.7.9 1 1.5.2.4.4 1.2.5 2.4.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 2-.5 2.4-.2.6-.5 1-1 1.5-.4.4-.9.7-1.5 1-.4.2-1.2.4-2.4.5-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-2-.3-2.4-.5-.6-.2-1-.5-1.5-1-.4-.4-.7-.9-1-1.5-.2-.4-.4-1.2-.5-2.4C2 15.6 2 15.2 2 12s0-3.6.1-4.9c.1-1.2.3-2 .5-2.4c.2-.6.5-1 1-1.5.4-.4.9-.7 1.5-1c.4-.2 1.2-.4 2.4-.5C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1 .1-1.6.2-1.9.4-.5.2-.8.4-1.2.7-.3.3-.5.7-.7 1.2-.1.3-.3.9-.4 1.9-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c.1 1 .2 1.6.4 1.9.2.5.4.8.7 1.2.3.3.7.5 1.2.7.3.1.9.3 1.9.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1-.1 1.6-.2 1.9-.4.5-.2.8-.4 1.2-.7.3-.3.5-.7.7-1.2.1-.3.3-.9.4-1.9.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c-.1-1-.2-1.6-.4-1.9-.2-.5-.4-.8-.7-1.2-.3-.3-.7-.5-1.2-.7-.3-.1-.9-.3-1.9-.4-1.2-.1-1.6-.1-4.7-.1z"/><path d="M12 7.4a4.6 4.6 0 100 9.2 4.6 4.6 0 000-9.2zm0 7.6a3 3 0 110-6 3 3 0 010 6z"/><circle cx="16.8" cy="7.2" r="1.1"/></svg>
            <span id="profile-insta-handle-placeholder"></span>
          </div>
          <div class="profile-follow-stats">
            <span id="profile-followers-count">0 Followers</span>
            <span class="bullet">•</span>
            <span id="profile-following-count">0 Following</span>
          </div>
          <button id="profile-follow-btn" class="btn btn-brass profile-action-btn" style="display:none; text-shadow:none;"></button>
        </div>

        <!-- THE LIBRARY CARD -->
        <div class="library-borrower-card">
          <div class="library-borrower-card::before"></div>
          <div class="library-card-header">
            <div class="library-card-logo">BOOKOVE LIBRARY ASSOCIATION</div>
            <div class="library-card-title">BORROWER'S CARD</div>
          </div>
          
          <div class="library-card-body" id="profile-card-details">
            <div class="library-card-photo-frame">
              <img id="profile-card-photo" src="" alt="Profile Photo" style="display:none;" />
              <div id="profile-card-photo-fallback">?</div>
            </div>
            
            <div class="library-card-fields">
              <div class="library-card-row">
                <span class="label">MEMBER NAME:</span>
                <span id="profile-card-username" class="value"></span>
              </div>
              <div class="library-card-row">
                <span class="label">AGE:</span>
                <span id="profile-card-age" class="value"></span>
              </div>
              <div class="library-card-row">
                <span class="label">GENDER:</span>
                <span id="profile-card-gender" class="value"></span>
              </div>
              <div class="library-card-row">
                <span class="label">PRONOUNS:</span>
                <span id="profile-card-pronouns" class="value"></span>
              </div>
            </div>
          </div>

          <!-- EDIT PROFILE FORM -->
          <form id="profile-edit-form" style="display: none;" enctype="multipart/form-data">
            <div class="edit-field">
              <label for="edit-age">Age</label>
              <input type="number" name="age" id="edit-age" min="1" max="120" />
            </div>
            <div class="edit-field">
              <label for="edit-gender">Gender</label>
              <input type="text" name="gender" id="edit-gender" placeholder="e.g. Female, Male, Non-binary" />
            </div>
            <div class="edit-field">
              <label for="edit-pronouns">Pronouns</label>
              <input type="text" name="pronouns" id="edit-pronouns" placeholder="e.g. she/her, they/them" />
            </div>
            <div class="edit-field">
              <label for="edit-instagram">Instagram Handle</label>
              <input type="text" name="instagram_handle" id="edit-instagram" placeholder="e.g. read_lover" />
            </div>
            <div class="edit-field">
              <label for="edit-avatar">Profile Photo</label>
              <input type="file" name="avatar" id="edit-avatar" accept="image/*" />
            </div>
            <div class="edit-actions">
              <button type="submit" class="btn btn-brass" style="text-shadow:none;">Save</button>
              <button type="button" id="profile-edit-cancel-btn" class="btn btn-ghost">Cancel</button>
            </div>
          </form>
          
          <div class="library-card-footer">
            <div class="simulated-barcode">
              <div class="barcode-line-pattern"></div>
              <div class="barcode-number" id="profile-card-no">NO. BG-849204912</div>
            </div>
          </div>
        </div>

        <!-- SHARED BOOKS SECTION -->
        <div class="profile-books-section" id="profile-books-section">
          <div class="profile-books-header">📚 Shared Books</div>
          <div class="profile-books-list" id="profile-books-list">
            <div class="profile-books-empty">Loading...</div>
          </div>
        </div>

        <!-- ACTIONS BELOW CARD -->
        <div class="profile-modal-actions">
          <button id="profile-edit-toggle-btn" class="btn btn-brass" style="display: none; text-shadow:none;">Edit Details</button>
          <button id="profile-close-btn" class="btn btn-ghost">Close</button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const modal = document.getElementById('profile-modal');
  const followBtn = document.getElementById('profile-follow-btn');
  const editToggleBtn = document.getElementById('profile-edit-toggle-btn');
  const closeBtn = document.getElementById('profile-close-btn');
  const editCancelBtn = document.getElementById('profile-edit-cancel-btn');
  const editForm = document.getElementById('profile-edit-form');
  const cardDetails = document.getElementById('profile-card-details');

  let currentProfileUser = null;
  let currentUserSession = null;

  async function checkSession() {
    try {
      const res = await fetch('/auth/me');
      const data = await res.json();
      currentUserSession = data.user;
    } catch {
      currentUserSession = null;
    }
  }

  window.showProfileCard = async function (userId) {
    window.AccessibilityAudio?.play('click');
    await checkSession();
    try {
      const res = await fetch(`/auth/profile/${userId}`);
      if (!res.ok) return;
      const user = await res.json();
      currentProfileUser = user;

      // Populate card view details
      document.getElementById('profile-card-username').textContent = user.username || 'Anonymous Reader';
      document.getElementById('profile-card-age').textContent = user.age || '—';
      document.getElementById('profile-card-gender').textContent = user.gender || '—';
      document.getElementById('profile-card-pronouns').textContent = user.pronouns || '—';
      document.getElementById('profile-card-no').textContent = `NO. BG-${user.id.slice(0, 8).toUpperCase()}`;

      // Photo
      const photoEl = document.getElementById('profile-card-photo');
      const fallbackEl = document.getElementById('profile-card-photo-fallback');
      if (user.avatarUrl) {
        photoEl.src = user.avatarUrl;
        photoEl.style.display = 'block';
        fallbackEl.style.display = 'none';
      } else {
        photoEl.style.display = 'none';
        fallbackEl.style.display = 'flex';
        fallbackEl.textContent = (user.username || '?').charAt(0).toUpperCase();
      }

      // Instagram (Above card)
      const instaWrap = document.getElementById('profile-insta-wrap');
      const instaHandlePlaceholder = document.getElementById('profile-insta-handle-placeholder');
      if (user.instagramHandle) {
        instaHandlePlaceholder.innerHTML = `<a href="https://instagram.com/${encodeURIComponent(user.instagramHandle)}" target="_blank" style="color:var(--brass-bright); font-weight:700;">@${user.instagramHandle}</a>`;
        instaWrap.style.display = 'flex';
      } else {
        instaHandlePlaceholder.textContent = '';
        if (currentUserSession && currentUserSession.id === user.id) {
          instaHandlePlaceholder.innerHTML = '<span style="font-style:italic; font-size:11px; opacity:0.75;">No Instagram linked (Edit to add)</span>';
          instaWrap.style.display = 'flex';
        } else {
          instaWrap.style.display = 'none';
        }
      }

      // Follow stats
      document.getElementById('profile-followers-count').textContent = `${user.followersCount} Followers`;
      document.getElementById('profile-following-count').textContent = `${user.followingCount} Following`;

      // Show follow button or edit details button
      if (currentUserSession) {
        if (currentUserSession.id === user.id) {
          followBtn.style.display = 'none';
          editToggleBtn.style.display = 'block';
        } else {
          editToggleBtn.style.display = 'none';
          followBtn.style.display = 'block';
          followBtn.textContent = user.isFollowing ? 'Unfollow' : 'Follow';
        }
      } else {
        editToggleBtn.style.display = 'none';
        followBtn.style.display = 'block';
        followBtn.textContent = 'Follow';
      }

      // Reset form view
      editForm.style.display = 'none';
      cardDetails.style.display = 'flex';

      // Load user's shared books
      loadUserBooks(user.id);

      modal.style.display = 'flex';

      // Accessibility prompt read aloud
      if (window.AccessibilityHelper?.isEnabled()) {
        const text = `Library Card for member ${user.username}. Age ${user.age || 'not specified'}. Pronouns ${user.pronouns || 'not specified'}. Instagram ${user.instagramHandle ? 'at ' + user.instagramHandle : 'not linked'}. ${user.followersCount} followers.`;
        window.AccessibilityHelper.speak(text);
      }

    } catch (err) {
      console.error(err);
    }
  };

  function hideModal() {
    window.AccessibilityAudio?.play('click');
    modal.style.display = 'none';
  }

  closeBtn.addEventListener('click', hideModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hideModal();
  });

  // Follow/Unfollow handler
  followBtn.addEventListener('click', async () => {
    window.AccessibilityAudio?.play('click');
    if (!currentUserSession) {
      alert('Please sign in to follow library members.');
      window.location.href = 'login.html';
      return;
    }

    const isFollowing = currentProfileUser.isFollowing;
    const url = isFollowing ? `/auth/unfollow/${currentProfileUser.id}` : `/auth/follow/${currentProfileUser.id}`;
    
    try {
      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        window.AccessibilityAudio?.play('success');
        // Refresh the profile card
        window.showProfileCard(currentProfileUser.id);
        // Refresh list
        if (window.loadBooks) window.loadBooks();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update follow status.');
        window.AccessibilityAudio?.play('error');
      }
    } catch {
      window.AccessibilityAudio?.play('error');
    }
  });

  // Edit details toggler
  editToggleBtn.addEventListener('click', () => {
    window.AccessibilityAudio?.play('click');
    // Pre-populate edit fields
    document.getElementById('edit-age').value = currentProfileUser.age || '';
    document.getElementById('edit-gender').value = currentProfileUser.gender || '';
    document.getElementById('edit-pronouns').value = currentProfileUser.pronouns || '';
    document.getElementById('edit-instagram').value = currentProfileUser.instagramHandle || '';

    cardDetails.style.display = 'none';
    editForm.style.display = 'block';
  });

  editCancelBtn.addEventListener('click', () => {
    window.AccessibilityAudio?.play('click');
    editForm.style.display = 'none';
    cardDetails.style.display = 'flex';
  });

  // Submit edit form
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    window.AccessibilityAudio?.play('click');
    const formData = new FormData(editForm);

    try {
      const res = await fetch('/auth/update-profile', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile.');

      window.AccessibilityAudio?.play('success');
      
      // Refresh the view and reload to update page layout
      await window.showProfileCard(currentProfileUser.id);
      window.location.reload();
    } catch (err) {
      alert(err.message);
      window.AccessibilityAudio?.play('error');
    }
  });

  // --- Load user's shared books ---
  async function loadUserBooks(userId) {
    const listEl = document.getElementById('profile-books-list');
    try {
      const res = await fetch(`/api/books/by-user/${userId}`);
      const books = await res.json();
      if (!books.length) {
        listEl.innerHTML = '<div class="profile-books-empty">No books shared yet.</div>';
        return;
      }
      listEl.innerHTML = books.map(book => `
        <a href="reader.html?id=${book.id}" class="profile-book-item">
          <span class="profile-book-format">${book.format.toUpperCase()}</span>
          <div class="profile-book-info">
            <span class="profile-book-title">${escapeHtml(book.title)}</span>
            <span class="profile-book-author">${escapeHtml(book.author)}</span>
          </div>
        </a>
      `).join('');
    } catch {
      listEl.innerHTML = '<div class="profile-books-empty">Could not load books.</div>';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
})();
