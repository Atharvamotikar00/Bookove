const { Resend } = require('resend');

let resendClient = null;

function getClient() {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      '⚠️  RESEND_API_KEY not set. OTP emails will be logged to console instead of sent.\n' +
      '     Get a free key at https://resend.com/api-keys'
    );
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

/**
 * Send a password-reset OTP email.
 * Falls back to console logging when RESEND_API_KEY is not configured.
 */
async function sendOtpEmail(to, otp) {
  const siteName = process.env.SITE_NAME || 'Bookove';
  const fromEmail = process.env.RESEND_FROM || 'Bookove <onboarding@resend.dev>';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="margin: 0 0 8px; font-size: 22px; color: #1a1a2e;">${siteName}</h2>
      <p style="margin: 0 0 24px; color: #666; font-size: 14px;">Password Reset Request</p>
      <div style="background: #f5f5f5; border: 2px solid #1a1a2e; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; color: #444; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em;">Your reset code</p>
        <p style="margin: 0; font-size: 36px; font-weight: 800; letter-spacing: 0.15em; color: #1a1a2e;">${otp}</p>
      </div>
      <p style="margin: 0 0 8px; color: #666; font-size: 13px;">This code expires in <strong>10 minutes</strong>.</p>
      <p style="margin: 0; color: #999; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
  `;

  const text = `Your ${siteName} password reset code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.`;

  const client = getClient();
  if (client) {
    try {
      await client.emails.send({
        from: fromEmail,
        to: [to],
        subject: `${siteName} — Password Reset Code`,
        text,
        html,
      });
      console.log(`✉️  OTP email sent to ${to}`);
    } catch (err) {
      console.error('Resend error:', err);
      throw new Error('Failed to send email. Please try again later.');
    }
  } else {
    console.log(`✉️  [DEV — No API key] OTP for ${to}: ${otp}`);
  }
}

module.exports = { sendOtpEmail };
