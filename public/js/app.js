const shelvesEl = document.getElementById('shelves');
const searchInput = document.getElementById('search-input');
const formatFilter = document.getElementById('format-filter');

// Pop-art color combos for book panels (fallback when no cover)
const POP_ART = [
  { bg: '#FF4D4D', ray: '#FF1A1A', dot: '#CC0000' },
  { bg: '#FFD700', ray: '#FFC200', dot: '#CC9900' },
  { bg: '#00CC66', ray: '#00AA55', dot: '#008844' },
  { bg: '#3399FF', ray: '#2277DD', dot: '#1155AA' },
  { bg: '#FF66CC', ray: '#FF33AA', dot: '#CC0088' },
  { bg: '#FF9933', ray: '#FF7700', dot: '#CC5500' },
  { bg: '#9966FF', ray: '#7744DD', dot: '#5522AA' },
  { bg: '#00CCCC', ray: '#00AAAA', dot: '#008888' },
];

function popArtFor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return POP_ART[Math.abs(hash) % POP_ART.length];
}

let currentUser = null;

async function checkUser() {
  try {
    const res = await fetch('/auth/me');
    const data = await res.json();
    currentUser = data.user;
  } catch {
    currentUser = null;
  }
}

async function loadBooks() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
  if (formatFilter.value) params.set('format', formatFilter.value);

  shelvesEl.innerHTML = '<p class="empty-state">Loading the shelf…</p>';

  try {
    const res = await fetch(`/api/books?${params.toString()}`);
    const books = await res.json();
    renderBooks(books);
  } catch (err) {
    shelvesEl.innerHTML = '<p class="empty-state">Couldn\'t reach the library right now. Try refreshing.</p>';
  }
}

function renderBooks(books) {
  if (!books.length) {
    shelvesEl.innerHTML = `
      <div class="comic-burst comic-burst-inline" aria-hidden="true"></div>
      <p class="empty-state">The shelf is empty so far. <a href="upload.html">Add the first book.</a></p>
    `;
    return;
  }

  shelvesEl.innerHTML = '';

  books.forEach((book, i) => {
    const colors = popArtFor(book.title + book.author);
    const card = document.createElement('div');
    card.className = 'book-card';
    card.tabIndex = 0;
    card.style.animationDelay = `${i * 0.06}s`;
    card.title = `${book.title} — ${book.author}`;

    const uploaderHtml = book.uploader_name
      ? `<span class="book-card-uploader">shared by <span class="uploader-link" data-uploader-id="${book.uploader_id}">${escapeHtml(book.uploader_name)}</span></span>`
      : '';

    // Show delete button only for the book owner
    const isOwner = currentUser && book.uploader_id === currentUser.id;
    const deleteBtnHtml = isOwner
      ? `<button class="book-card-delete" data-book-id="${book.id}" title="Delete this book" aria-label="Delete ${escapeHtml(book.title)}">&times;</button>`
      : '';

    card.innerHTML = `
      <div class="book-card-inner" style="background: ${colors.bg};">
        ${deleteBtnHtml}
        <div class="book-card-rays" style="background: repeating-conic-gradient(${colors.ray} 0% 25%, transparent 0% 50%) 50%/20px 20px;"></div>
        <div class="book-card-halftone"></div>
        <div class="book-card-cover" data-book-id="${book.id}" data-format="${book.format}"></div>
        <div class="book-card-content">
          <span class="book-card-format">${book.format.toUpperCase()}</span>
          <h3 class="book-card-title">${escapeHtml(book.title)}</h3>
          <div class="book-card-rule"></div>
          <p class="book-card-author">${escapeHtml(book.author)}</p>
          ${uploaderHtml}
        </div>
        <div class="book-card-star" aria-hidden="true">★</div>
      </div>
    `;

    // Try to load PDF cover as thumbnail
    if (book.format === 'pdf') {
      loadPdfCover(book.id, card.querySelector('.book-card-cover'));
    }

    // Delete button handler
    const deleteBtn = card.querySelector('.book-card-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const bookId = deleteBtn.getAttribute('data-book-id');
        const bookTitle = escapeHtml(book.title);
        if (!confirm(`Delete "${bookTitle}"? This cannot be undone.`)) return;

        try {
          const res = await fetch(`/api/books/${bookId}`, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
            card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
            card.style.transform = 'scale(0.8) rotate(10deg)';
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 300);
          } else {
            alert(data.error || 'Failed to delete book.');
          }
        } catch {
          alert('Network error — could not delete book.');
        }
      });
    }

    card.addEventListener('click', (e) => {
      if (e.target.closest('.book-card-delete')) return;
      if (e.target.classList.contains('uploader-link')) {
        e.stopPropagation();
        const uid = e.target.getAttribute('data-uploader-id');
        if (window.showProfileCard) window.showProfileCard(uid);
        return;
      }
      // Book-open animation
      card.classList.add('book-opening');
      setTimeout(() => {
        window.location.href = `reader.html?id=${book.id}`;
      }, 400);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        card.classList.add('book-opening');
        setTimeout(() => {
          window.location.href = `reader.html?id=${book.id}`;
        }, 400);
      }
    });

    shelvesEl.appendChild(card);
  });
}

// Load first page of PDF as cover thumbnail
async function loadPdfCover(bookId, coverEl) {
  try {
    // Dynamically load pdf.js if not already loaded
    if (!window.pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      document.head.appendChild(script);
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument(`/api/books/${bookId}/file`).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    coverEl.style.backgroundImage = `url(${canvas.toDataURL('image/jpeg', 0.7)})`;
    coverEl.style.backgroundSize = 'cover';
    coverEl.style.backgroundPosition = 'center';
    coverEl.style.opacity = '1';
  } catch (err) {
    // PDF cover failed to load - keep the pop-art fallback
    console.log('PDF cover not available for', bookId);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

let searchDebounce;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadBooks, 300);
});
formatFilter.addEventListener('change', loadBooks);

// Initialize: check user, then load books
(async function init() {
  await checkUser();
  loadBooks();
})();
