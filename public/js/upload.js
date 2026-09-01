const form = document.getElementById('upload-form');
const msgEl = document.getElementById('form-msg');
const signedOutNotice = document.getElementById('signed-out-notice');

(async function gateOnAuth() {
  try {
    const res = await fetch('/auth/me');
    const data = await res.json();
    if (data.user) {
      form.style.display = 'block';
      document.getElementById('posting-as-name').textContent = data.user.name;
      const avatarWrap = document.getElementById('posting-as-avatar-wrap');
      if (data.user.avatarUrl) {
        avatarWrap.innerHTML = `<img src="${data.user.avatarUrl}" alt="" class="nav-avatar" style="width:28px;height:28px;">`;
      }
    } else {
      signedOutNotice.style.display = 'block';
    }
  } catch {
    signedOutNotice.style.display = 'block';
  }
})();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msgEl.textContent = '';
  msgEl.className = 'form-msg';

  const isPublicDomain = document.getElementById('isPublicDomain').checked;
  const rightsAttested = document.getElementById('rightsAttested').checked;

  if (!isPublicDomain && !rightsAttested) {
    msgEl.textContent = 'Please confirm the public-domain or rights checkbox before uploading.';
    msgEl.className = 'form-msg error';
    return;
  }

  const fileInput = document.getElementById('file');
  if (!fileInput.files.length) {
    msgEl.textContent = 'Please choose a file.';
    msgEl.className = 'form-msg error';
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('title', document.getElementById('title').value);
  formData.append('author', document.getElementById('author').value);
  formData.append('description', document.getElementById('description').value);
  formData.append('isPublicDomain', isPublicDomain);
  formData.append('rightsAttested', rightsAttested);

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading…';

  try {
    const res = await fetch('/api/books/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Upload failed.');
    }

    msgEl.textContent = 'Added! Taking you to the shelf…';
    msgEl.className = 'form-msg success';
    setTimeout(() => { window.location.href = `reader.html?id=${data.id}`; }, 900);
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = 'form-msg error';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add to shelf';
  }
});
