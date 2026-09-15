const params = new URLSearchParams(window.location.search);
const bookId = params.get('id');

const titleEl = document.getElementById('reader-title');
const downloadLink = document.getElementById('download-link');
const reportBtn = document.getElementById('report-btn');
const reportModal = document.getElementById('report-modal');
const reportCancel = document.getElementById('report-cancel');
const reportSubmit = document.getElementById('report-submit');
const reportReason = document.getElementById('report-reason');

function getClientId() {
  let id = localStorage.getItem('bookgrove_client_id');
  if (!id) {
    id = 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('bookgrove_client_id', id);
  }
  return id;
}
const clientId = getClientId();

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

reportBtn.addEventListener('click', () => (reportModal.style.display = 'flex'));
reportCancel.addEventListener('click', () => (reportModal.style.display = 'none'));
reportSubmit.addEventListener('click', async () => {
  await fetch(`/api/books/${bookId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reportReason.value || 'No reason given' }),
  });
  reportModal.style.display = 'none';
  reportReason.value = '';
  alert('Thanks — this has been reported for review.');
});

async function saveProgress(location) {
  fetch(`/api/books/${bookId}/progress/${clientId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location }),
  }).catch(() => {});
}

async function getSavedProgress() {
  try {
    const res = await fetch(`/api/books/${bookId}/progress/${clientId}`);
    const data = await res.json();
    return data.location;
  } catch {
    return null;
  }
}

async function init() {
  if (!bookId) {
    titleEl.textContent = 'No book specified.';
    return;
  }

  let book;
  try {
    const res = await fetch(`/api/books/${bookId}`);
    if (!res.ok) throw new Error();
    book = await res.json();
  } catch {
    titleEl.textContent = 'Book not found.';
    return;
  }

  titleEl.textContent = `${book.title} — ${book.author}`;
  document.title = `${book.title} — Bookove`;

  const bylineEl = document.getElementById('reader-byline');
  if (bylineEl && book.uploader_name) {
    bylineEl.innerHTML = `Shared by <span class="uploader-link" style="text-decoration:underline; cursor:pointer; font-weight:700;" data-uploader-id="${book.uploader_id}">${escapeHtml(book.uploader_name)}</span>`;
    bylineEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('uploader-link')) {
        const uid = e.target.getAttribute('data-uploader-id');
        if (window.showProfileCard) window.showProfileCard(uid);
      }
    });
  }

  const fileUrl = `/api/books/${bookId}/file`;
  downloadLink.href = fileUrl;
  downloadLink.setAttribute('download', book.original_filename);

  if (book.format === 'pdf') renderPdf(fileUrl);
  else if (book.format === 'epub') renderEpub(fileUrl);
  else if (book.format === 'txt') renderTxt(fileUrl);
  else renderMobiFallback();

  // Load rating
  loadRating();
}

// ---------------- PDF ----------------
function getPdfScale() {
  const isMobile = window.innerWidth <= 640;
  const maxWidth = isMobile ? window.innerWidth - 48 : 800;
  const baseViewport = 612; // standard PDF width at scale 1
  return Math.min(maxWidth / baseViewport, 1.6);
}

async function renderPdf(fileUrl) {
  const view = document.getElementById('pdf-view');
  const footer = document.getElementById('pdf-footer');
  view.style.display = 'block';
  footer.style.display = 'flex';

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const loadingTask = pdfjsLib.getDocument(fileUrl);
  const pdf = await loadingTask.promise;

  const slider = document.getElementById('pdf-slider');
  const pageLabel = document.getElementById('pdf-page-label');
  slider.max = pdf.numPages;

  const savedLocation = await getSavedProgress();
  let currentPage = savedLocation ? Math.min(parseInt(savedLocation, 10) || 1, pdf.numPages) : 1;

  async function renderPage(num) {
    view.innerHTML = '';
    const page = await pdf.getPage(num);
    const scale = getPdfScale();
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-page-canvas';
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.maxWidth = '100%';
    canvas.style.height = 'auto';
    view.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    currentPage = num;
    slider.value = num;
    pageLabel.textContent = `Page ${num} of ${pdf.numPages}`;
    saveProgress(String(num));
  }

  function goPrev() { if (currentPage > 1) renderPage(currentPage - 1); }
  function goNext() { if (currentPage < pdf.numPages) renderPage(currentPage + 1); }

  document.getElementById('pdf-prev').addEventListener('click', goPrev);
  document.getElementById('pdf-next').addEventListener('click', goNext);
  slider.addEventListener('input', () => renderPage(parseInt(slider.value, 10)));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
  });

  // Touch swipe for PDF
  let touchStartX = 0;
  let touchStartY = 0;
  view.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });
  view.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    const dy = e.changedTouches[0].screenY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goNext(); else goPrev();
    }
  }, { passive: true });

  renderPage(currentPage);
}

// ---------------- EPUB ----------------
async function renderEpub(fileUrl) {
  const view = document.getElementById('epub-view');
  view.style.display = 'block';

  const isMobile = window.innerWidth <= 640;
  const book = ePub(fileUrl);
  const rendition = book.renderTo(view, {
    width: '100%',
    height: '100%',
    spread: isMobile ? 'none' : 'auto'
  });

  const savedLocation = await getSavedProgress();
  await rendition.display(savedLocation || undefined);

  rendition.on('relocated', (location) => {
    saveProgress(location.start.cfi);
  });

  const footer = document.getElementById('pdf-footer');
  footer.style.display = 'flex';
  footer.innerHTML = `
    <button id="epub-prev">‹ Prev</button>
    <span style="flex:1;"></span>
    <button id="epub-next">Next ›</button>
  `;
  document.getElementById('epub-prev').addEventListener('click', () => rendition.prev());
  document.getElementById('epub-next').addEventListener('click', () => rendition.next());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') rendition.prev();
    if (e.key === 'ArrowRight') rendition.next();
  });

  // Touch swipe for EPUB
  let touchStartX = 0;
  let touchStartY = 0;
  view.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });
  view.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    const dy = e.changedTouches[0].screenY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) rendition.next(); else rendition.prev();
    }
  }, { passive: true });
}

// ---------------- TXT ----------------
async function renderTxt(fileUrl) {
  const view = document.getElementById('txt-view');
  view.style.display = 'block';
  const res = await fetch(fileUrl);
  const text = await res.text();
  view.textContent = text;

  const savedLocation = await getSavedProgress();
  if (savedLocation) {
    window.scrollTo(0, parseInt(savedLocation, 10) || 0);
  }

  let scrollDebounce;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollDebounce);
    scrollDebounce = setTimeout(() => saveProgress(String(window.scrollY)), 400);
  });

  // Arrow key support for TXT (scroll up/down)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
    }
    if (e.key === 'ArrowUp') {
      window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
    }
  });
}

// ---------------- MOBI fallback ----------------
function renderMobiFallback() {
  document.getElementById('mobi-fallback').style.display = 'block';
}

// ---------------- Rating ----------------
async function loadRating() {
  try {
    const res = await fetch(`/api/books/${bookId}/rating?clientId=${encodeURIComponent(clientId)}`);
    const data = await res.json();
    updateRatingUI(data.avgRating, data.totalRatings, data.userRating);
  } catch {}
}

function updateRatingUI(avg, total, userRating) {
  const label = document.getElementById('rating-label');
  if (total > 0) {
    label.textContent = `${avg} (${total} rating${total > 1 ? 's' : ''})`;
  } else {
    label.textContent = 'No ratings yet';
  }

  // Highlight stars
  document.querySelectorAll('.star-btn').forEach(btn => {
    const star = parseInt(btn.dataset.star, 10);
    if (userRating && star <= userRating) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

document.querySelectorAll('.star-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const rating = parseInt(btn.dataset.star, 10);
    try {
      const res = await fetch(`/api/books/${bookId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, clientId })
      });
      const data = await res.json();
      if (data.ok) {
        updateRatingUI(data.avgRating, data.totalRatings, rating);
      }
    } catch {}
  });
});

init();
