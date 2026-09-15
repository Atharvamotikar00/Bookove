const shelvesEl = document.getElementById('shelves');
const recommendedGrid = document.getElementById('recommended-grid');
const highlyRatedGrid = document.getElementById('highly-rated-grid');
const searchInput = document.getElementById('search-input');
const formatFilter = document.getElementById('format-filter');
const genreFilter = document.getElementById('genre-filter');
const sortFilter = document.getElementById('sort-filter');
const trendingTrack = document.getElementById('trending-track');

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
  if (genreFilter && genreFilter.value) params.set('genre', genreFilter.value);
  if (sortFilter && sortFilter.value) params.set('sort', sortFilter.value);

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

    const ratingHtml = book.avg_rating ? `<div class="book-card-rating"><span class="book-rating-badge">★ ${book.avg_rating}</span></div>` : '';

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
          ${renderGenreTags(book.genres)}
          ${uploaderHtml}
        </div>
        ${ratingHtml}
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

// --- Trending ribbon ---
async function loadTrendingRibbon() {
  try {
    const res = await fetch('/api/books/trending?limit=10');
    const books = await res.json();
    if (!books.length) {
      document.getElementById('trending-ribbon').style.display = 'none';
      return;
    }
    // Duplicate the items for seamless loop
    const items = books.map(b =>
      `<a href="reader.html?id=${b.id}" class="trending-item">${escapeHtml(b.title)} <span class="trending-reads">${b.read_count || 0} reads</span></a>`
    ).join('');
    trendingTrack.innerHTML = items + items;
  } catch {
    document.getElementById('trending-ribbon').style.display = 'none';
  }
}

// --- Tab switching ---
let activeTab = 'shelf';
document.querySelectorAll('.shelf-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab;
    document.querySelectorAll('.shelf-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    shelvesEl.style.display = 'none';
    recommendedGrid.style.display = 'none';
    highlyRatedGrid.style.display = 'none';

    if (activeTab === 'shelf') {
      shelvesEl.style.display = '';
      loadBooks();
    } else if (activeTab === 'recommended') {
      recommendedGrid.style.display = '';
      loadRecommended();
    } else if (activeTab === 'highly-rated') {
      highlyRatedGrid.style.display = '';
      loadHighlyRated();
    }
  });
});

// --- Recommendations ---
async function loadRecommended() {
  recommendedGrid.innerHTML = '<p class="empty-state">Loading recommendations…</p>';
  try {
    const clientId = localStorage.getItem('bookove-client-id') || crypto.randomUUID();
    localStorage.setItem('bookove-client-id', clientId);
    const res = await fetch(`/api/books/recommended?clientId=${encodeURIComponent(clientId)}&limit=12`);
    const data = await res.json();

    if (!data.books.length) {
      recommendedGrid.innerHTML = `
        <p class="empty-state">No recommendations yet — start reading some books and we'll suggest similar ones!</p>
      `;
      return;
    }

    const label = data.genres.length
      ? `<div class="rec-genre-label">Based on your interest in: ${data.genres.map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join(' ')}</div>`
      : '';

    recommendedGrid.innerHTML = '';
    if (label) {
      const labelDiv = document.createElement('div');
      labelDiv.className = 'rec-genre-banner';
      labelDiv.innerHTML = label;
      recommendedGrid.appendChild(labelDiv);
    }

    data.books.forEach((book, i) => {
      const colors = popArtFor(book.title + book.author);
      const card = document.createElement('div');
      card.className = 'book-card';
      card.tabIndex = 0;
      card.style.animationDelay = `${i * 0.06}s`;

      card.innerHTML = `
        <div class="book-card-inner" style="background: ${colors.bg};">
          <div class="book-card-rays" style="background: repeating-conic-gradient(${colors.ray} 0% 25%, transparent 0% 50%) 50%/20px 20px;"></div>
          <div class="book-card-halftone"></div>
          <div class="book-card-cover" data-book-id="${book.id}" data-format="${book.format}"></div>
          <div class="book-card-content">
            <span class="book-card-format">${book.format.toUpperCase()}</span>
            <h3 class="book-card-title">${escapeHtml(book.title)}</h3>
            <div class="book-card-rule"></div>
            <p class="book-card-author">${escapeHtml(book.author)}</p>
            ${renderGenreTags(book.genres)}
          </div>
          <div class="book-card-star" aria-hidden="true">★</div>
        </div>
      `;

      if (book.format === 'pdf') loadPdfCover(book.id, card.querySelector('.book-card-cover'));

      card.addEventListener('click', () => {
        card.classList.add('book-opening');
        setTimeout(() => { window.location.href = `reader.html?id=${book.id}`; }, 400);
      });

      recommendedGrid.appendChild(card);
    });
  } catch {
    recommendedGrid.innerHTML = '<p class="empty-state">Could not load recommendations.</p>';
  }
}

function renderGenreTags(genresJson) {
  if (!genresJson) return '';
  let genres;
  try {
    genres = JSON.parse(genresJson);
  } catch {
    return '';
  }
  if (!Array.isArray(genres) || !genres.length) return '';
  return `<div class="book-card-genres">${genres.map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('')}</div>`;
}

let searchDebounce;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadBooks, 300);
});
formatFilter.addEventListener('change', loadBooks);
if (genreFilter) genreFilter.addEventListener('change', loadBooks);
if (sortFilter) sortFilter.addEventListener('change', loadBooks);

// --- Highly Rated books ---
async function loadHighlyRated() {
  highlyRatedGrid.innerHTML = '<p class="empty-state">Loading highly rated books…</p>';
  try {
    const res = await fetch('/api/books/highly-rated?limit=20');
    const books = await res.json();

    if (!books.length) {
      highlyRatedGrid.innerHTML = `<p class="empty-state">No rated books yet — read and rate some books first!</p>`;
      return;
    }

    highlyRatedGrid.innerHTML = '';
    books.forEach((book, i) => {
      const colors = popArtFor(book.title + book.author);
      const card = document.createElement('div');
      card.className = 'book-card';
      card.tabIndex = 0;
      card.style.animationDelay = `${i * 0.06}s`;

      card.innerHTML = `
        <div class="book-card-inner" style="background: ${colors.bg};">
          <div class="book-card-rays" style="background: repeating-conic-gradient(${colors.ray} 0% 25%, transparent 0% 50%) 50%/20px 20px;"></div>
          <div class="book-card-halftone"></div>
          <div class="book-card-cover" data-book-id="${book.id}" data-format="${book.format}"></div>
          <div class="book-card-content">
            <span class="book-card-format">${book.format.toUpperCase()}</span>
            <h3 class="book-card-title">${escapeHtml(book.title)}</h3>
            <div class="book-card-rule"></div>
            <p class="book-card-author">${escapeHtml(book.author)}</p>
            ${renderGenreTags(book.genres)}
          </div>
          <div class="book-card-rating"><span class="book-rating-badge">★ ${book.avg_rating} <small>(${book.total_ratings})</small></span></div>
          <div class="book-card-star" aria-hidden="true">★</div>
        </div>
      `;

      if (book.format === 'pdf') loadPdfCover(book.id, card.querySelector('.book-card-cover'));

      card.addEventListener('click', () => {
        card.classList.add('book-opening');
        setTimeout(() => { window.location.href = `reader.html?id=${book.id}`; }, 400);
      });

      highlyRatedGrid.appendChild(card);
    });
  } catch {
    highlyRatedGrid.innerHTML = '<p class="empty-state">Could not load highly rated books.</p>';
  }
}

// Initialize: check user, then load books and trending ribbon
(async function init() {
  await checkUser();
  loadBooks();
  loadTrendingRibbon();
})();
