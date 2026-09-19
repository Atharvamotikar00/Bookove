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

  // Show Google sign-in button (always visible, but only works if configured)
  const googleWrap = document.getElementById('google-signin-wrap');
  if (googleWrap) {
    googleWrap.style.display = 'block';
  }

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

  // Step elements
  const otpStep = document.getElementById('otp-step');
  const otpVerifiedStep = document.getElementById('otp-verified-step');
  const resetPasswordStep = document.getElementById('reset-password-step');
  const verifyOtpBtn = document.getElementById('verify-otp-btn');
  const otpLoginBtn = document.getElementById('otp-login-btn');
  const showResetPasswordBtn = document.getElementById('show-reset-password-btn');

  function resetOtpSteps() {
    if (otpStep) otpStep.style.display = 'block';
    if (otpVerifiedStep) otpVerifiedStep.style.display = 'none';
    if (resetPasswordStep) resetPasswordStep.style.display = 'none';
  }

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
      resetOtpSteps();
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

        showSuccess('OTP sent! Check your email inbox.');
        
        // Show OTP verification section (Step 1)
        forgotSection.style.display = 'none';
        resetSection.style.display = 'block';
        resetOtpSteps();
      } catch (err) {
        showError(err.message);
      }
    });
  }

  // Step 1: Verify OTP code
  let verifiedOtp = '';
  if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener('click', async () => {
      clearMsgs();
      playClick();

      const otp = document.getElementById('reset-otp').value;
      if (!otp || otp.length !== 6) {
        showError('Please enter the 6-digit code.');
        return;
      }

      try {
        const res = await fetch('/auth/forgot-password/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: recoveryEmail, otp })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed.');

        verifiedOtp = otp;
        window.AccessibilityAudio?.play('success');

        // Show the two options: Login Now or Reset Password
        otpStep.style.display = 'none';
        otpVerifiedStep.style.display = 'block';
      } catch (err) {
        showError(err.message);
      }
    });
  }

  // Step 2a: Login directly with verified OTP
  if (otpLoginBtn) {
    otpLoginBtn.addEventListener('click', async () => {
      clearMsgs();
      playClick();

      try {
        const res = await fetch('/auth/verify-otp-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: recoveryEmail, otp: verifiedOtp })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed.');

        window.AccessibilityAudio?.play('success');
        showSuccess('Logged in successfully!');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 800);
      } catch (err) {
        showError(err.message);
      }
    });
  }

  // Step 2b: Show reset password form
  if (showResetPasswordBtn) {
    showResetPasswordBtn.addEventListener('click', () => {
      playClick();
      clearMsgs();
      otpVerifiedStep.style.display = 'none';
      resetPasswordStep.style.display = 'block';
    });
  }

  // Step 3: Submit new password
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsgs();
      playClick();

      const newPassword = document.getElementById('reset-new-password').value;

      try {
        const res = await fetch('/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: recoveryEmail, otp: verifiedOtp, newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to reset password.');

        showSuccess('Password reset successfully! Please log in.');
        
        // Return to login section
        resetSection.style.display = 'none';
        loginSection.style.display = 'block';
        resetOtpSteps();
        
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

