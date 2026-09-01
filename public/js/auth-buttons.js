// Handles local authentication forms for registration, login, recovery, and resets.
(async function initAuthButtons() {
  const errorEl = document.getElementById('auth-error');
  const successEl = document.getElementById('auth-success');

  function showError(msg) {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    }
    if (successEl) successEl.style.display = 'none';
    // Accessibility warning audio hook
    window.AccessibilityAudio?.play('error');
  }

  function showSuccess(msg) {
    if (successEl) {
      successEl.textContent = msg;
      successEl.style.display = 'block';
    }
    if (errorEl) errorEl.style.display = 'none';
    window.AccessibilityAudio?.play('success');
  }

  function clearMsgs() {
    if (errorEl) errorEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';
  }

  // Safe audio play hook
  function playClick() {
    window.AccessibilityAudio?.play('click');
  }

  // Check if already logged in and redirect to shelf
  try {
    const meRes = await fetch('/auth/me');
    const meData = await meRes.json();
    if (meData.user) {
      window.location.href = 'index.html';
      return;
    }
  } catch {}

  // Check if Google sign-in is configured and show the button
  try {
    const provRes = await fetch('/auth/providers');
    const provData = await provRes.json();
    const googleWrap = document.getElementById('google-signin-wrap');
    if (googleWrap && provData.google) {
      googleWrap.style.display = 'block';
    }
  } catch {}

  // --- REGISTRATION FORM HANDLER ---
  const regForm = document.getElementById('register-form');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsgs();
      playClick();

      const formData = new FormData(regForm);
      try {
        const res = await fetch('/auth/register', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed.');

        window.AccessibilityAudio?.play('success');
        showSuccess('Welcome! Library card created.');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1200);
      } catch (err) {
        showError(err.message);
      }
    });
  }

  // --- LOGIN & PASSWORD RECOVERY FLOWS ---
  const loginForm = document.getElementById('login-form');
  const forgotForm = document.getElementById('forgot-form');
  const resetForm = document.getElementById('reset-form');

  const loginSection = document.getElementById('login-section');
  const forgotSection = document.getElementById('forgot-section');
  const resetSection = document.getElementById('reset-section');

  const forgotBtn = document.getElementById('forgot-btn');
  const backToLoginBtn = document.getElementById('back-to-login-btn');
  const resetBackToLoginBtn = document.getElementById('reset-back-to-login-btn');

  let recoveryEmail = '';

  if (forgotBtn && loginSection && forgotSection) {
    forgotBtn.addEventListener('click', () => {
      playClick();
      clearMsgs();
      loginSection.style.display = 'none';
      forgotSection.style.display = 'block';
    });
  }

  if (backToLoginBtn && loginSection && forgotSection) {
    backToLoginBtn.addEventListener('click', () => {
      playClick();
      clearMsgs();
      forgotSection.style.display = 'none';
      loginSection.style.display = 'block';
    });
  }

  if (resetBackToLoginBtn && loginSection && resetSection) {
    resetBackToLoginBtn.addEventListener('click', () => {
      playClick();
      clearMsgs();
      resetSection.style.display = 'none';
      loginSection.style.display = 'block';
    });
  }

  // Submit Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsgs();
      playClick();

      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;

      try {
        const res = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invalid credentials.');

        window.AccessibilityAudio?.play('success');
        showSuccess('Logged in successfully!');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1000);
      } catch (err) {
        showError(err.message);
      }
    });
  }

  // Submit Forgot Password (Request OTP)
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsgs();
      playClick();

      const email = document.getElementById('forgot-email').value;
      recoveryEmail = email;

      try {
        const res = await fetch('/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Recovery lookup failed.');

        showSuccess('OTP generated!');
        
        // Show reset password section
        forgotSection.style.display = 'none';
        resetSection.style.display = 'block';

        // Display test OTP banner for development convenience
        if (data.debugOtp) {
          const debugOtpAlert = document.getElementById('debug-otp-alert');
          const debugOtpVal = document.getElementById('debug-otp-value');
          if (debugOtpAlert && debugOtpVal) {
            debugOtpVal.textContent = data.debugOtp;
            debugOtpAlert.style.display = 'flex';
          }
        }
      } catch (err) {
        showError(err.message);
      }
    });
  }

  // Submit Reset Password (Verify OTP)
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsgs();
      playClick();

      const otp = document.getElementById('reset-otp').value;
      const newPassword = document.getElementById('reset-new-password').value;

      try {
        const res = await fetch('/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: recoveryEmail, otp, newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to reset password.');

        showSuccess('Password reset successfully! Please log in.');
        
        // Return to login section
        resetSection.style.display = 'none';
        loginSection.style.display = 'block';
        
        // Clear forms
        resetForm.reset();
        loginForm.reset();
      } catch (err) {
        showError(err.message);
      }
    });
  }

  // Audio accessibility focus hooks
  document.querySelectorAll('input, button, a').forEach(el => {
    el.addEventListener('mouseenter', () => {
      window.AccessibilityAudio?.play('hover');
    });
    el.addEventListener('focus', () => {
      window.AccessibilityAudio?.play('hover');
    });
  });
})();

