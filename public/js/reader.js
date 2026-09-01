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
}

// ---------------- PDF ----------------
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
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-page-canvas';
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    view.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    currentPage = num;
    slider.value = num;
    pageLabel.textContent = `Page ${num} of ${pdf.numPages}`;
    saveProgress(String(num));
  }

  document.getElementById('pdf-prev').addEventListener('click', () => {
    if (currentPage > 1) renderPage(currentPage - 1);
  });
  document.getElementById('pdf-next').addEventListener('click', () => {
    if (currentPage < pdf.numPages) renderPage(currentPage + 1);
  });
  slider.addEventListener('input', () => renderPage(parseInt(slider.value, 10)));

  // Arrow key navigation for PDF
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (currentPage > 1) renderPage(currentPage - 1);
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (currentPage < pdf.numPages) renderPage(currentPage + 1);
    }
  });

  renderPage(currentPage);
}

// ---------------- EPUB ----------------
async function renderEpub(fileUrl) {
  const view = document.getElementById('epub-view');
  view.style.display = 'block';

  const book = ePub(fileUrl);
  const rendition = book.renderTo(view, { width: '100%', height: '100%' });

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

init();
