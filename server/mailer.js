/**
 * server/mailer.js — Nodemailer Transporter & Email Templates
 *
 * Exports:
 *  - sendMail(to, subject, html)  – fire-and-forget, never throws
 *  - getWelcomeEmailHtml(name, siteUrl)
 *  - getOtpEmailHtml(otp)
 *  - getPasswordChangedEmailHtml()
 */

import nodemailer from 'nodemailer';

const CONTACT_EMAIL = process.env.EMAIL_USER || 'haggledeals26@gmail.com';
const SITE_URL = process.env.SITE_URL || 'https://haggle-2mki.onrender.com';

// Lazy-create transporter so missing env vars don't crash startup
let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: CONTACT_EMAIL,
        pass: process.env.EMAIL_PASS || ''
      }
    });
  }
  return _transporter;
}

/**
 * Sends an email. Never throws — failures are logged only.
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 * @returns {Promise<boolean>} true on success, false on failure
 */
export async function sendMail(to, subject, html) {
  if (!process.env.EMAIL_PASS) {
    console.warn('[mailer] EMAIL_PASS not set — skipping email send to', to);
    return false;
  }
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Haggle Deals" <${CONTACT_EMAIL}>`,
      to,
      subject,
      html
    });
    console.info(`[mailer] ✓ Email sent to ${to} — "${subject}"`);
    return true;
  } catch (err) {
    console.error(`[mailer] ✗ Failed to send email to ${to}:`, err.message);
    return false;
  }
}

// ─── Email HTML Templates ─────────────────────────────────────────────────────

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  background: #f0fdf4;
  padding: 0;
  margin: 0;
`;

function emailWrapper(content) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Haggle</title>
</head>
<body style="${BASE_STYLE}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4; padding: 32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); max-width:600px; width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#047857 100%); padding:28px 32px; text-align:center;">
            <h1 style="margin:0; color:#ffffff; font-size:2rem; font-weight:900; letter-spacing:-0.5px;">🛒 Haggle</h1>
            <p style="margin:4px 0 0; color:rgba(255,255,255,0.85); font-size:0.9rem;">India's Smart Price Comparison Engine</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb; padding:20px 32px; text-align:center; border-top:1px solid #e5e7eb;">
            <p style="margin:0; font-size:0.8rem; color:#9ca3af;">
              This email was sent from <a href="mailto:${CONTACT_EMAIL}" style="color:#059669;">${CONTACT_EMAIL}</a><br/>
              © 2026 Haggle. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Welcome email HTML for new/existing users
 * @param {string} name
 * @param {string} siteUrl
 */
export function getWelcomeEmailHtml(name, siteUrl = SITE_URL) {
  const firstName = (name || 'Shopper').split(' ')[0];
  const content = `
    <h2 style="margin:0 0 8px; font-size:1.5rem; font-weight:800; color:#111827;">
      Welcome to Haggle, ${firstName}! 🎉
    </h2>
    <p style="margin:0 0 24px; font-size:1rem; color:#374151; line-height:1.6;">
      You've just joined thousands of smart shoppers who never overpay again. Here's what you can do:
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%; margin-bottom:24px;">
      <tr>
        <td style="padding:14px 18px; background:#f0fdf4; border-left:4px solid #059669; border-radius:0 8px 8px 0; margin-bottom:10px; display:block;">
          <strong style="color:#047857;">🔍 Compare prices</strong>
          <span style="color:#374151;"> across 15 top Indian stores including Amazon, Flipkart, Meesho, Myntra, Nykaa and more.</span>
        </td>
      </tr>
      <tr><td style="height:10px;"></td></tr>
      <tr>
        <td style="padding:14px 18px; background:#f0fdf4; border-left:4px solid #059669; border-radius:0 8px 8px 0;">
          <strong style="color:#047857;">📈 Track price history</strong>
          <span style="color:#374151;"> and see when prices drop so you always buy at the right time.</span>
        </td>
      </tr>
      <tr><td style="height:10px;"></td></tr>
      <tr>
        <td style="padding:14px 18px; background:#f0fdf4; border-left:4px solid #059669; border-radius:0 8px 8px 0;">
          <strong style="color:#047857;">❤️ Save your wishlist</strong>
          <span style="color:#374151;"> and get instant price alerts the moment your dream product goes on sale.</span>
        </td>
      </tr>
    </table>

    <div style="text-align:center; margin:28px 0;">
      <a href="${siteUrl}" style="display:inline-block; background:linear-gradient(135deg,#059669,#047857); color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:50px; font-size:1rem; font-weight:700; letter-spacing:0.3px; box-shadow:0 4px 12px rgba(5,150,105,0.35);">
        Start Shopping →
      </a>
    </div>

    <p style="margin:24px 0 0; font-size:0.9rem; color:#6b7280; text-align:center; line-height:1.5;">
      Questions? Reply to this email or reach us at<br/>
      <a href="mailto:${CONTACT_EMAIL}" style="color:#059669;">${CONTACT_EMAIL}</a>
    </p>
  `;
  return emailWrapper(content);
}

/**
 * OTP email HTML for forgot-password flow
 * @param {string|number} otp
 */
export function getOtpEmailHtml(otp) {
  const content = `
    <h2 style="margin:0 0 8px; font-size:1.4rem; font-weight:800; color:#111827;">
      🔐 Password Reset Code
    </h2>
    <p style="margin:0 0 24px; font-size:1rem; color:#374151; line-height:1.6;">
      We received a request to reset your Haggle password. Use the code below:
    </p>

    <div style="text-align:center; margin:28px 0;">
      <div style="display:inline-block; background:#f0fdf4; border:2px dashed #059669; border-radius:14px; padding:24px 48px;">
        <p style="margin:0 0 4px; font-size:0.8rem; font-weight:700; text-transform:uppercase; color:#059669; letter-spacing:1px;">Your OTP Code</p>
        <p style="margin:0; font-size:3rem; font-weight:900; color:#047857; letter-spacing:10px; font-family:'Courier New', monospace;">${otp}</p>
      </div>
    </div>

    <div style="background:#fef9c3; border:1px solid #fde047; border-radius:10px; padding:14px 18px; margin-bottom:20px;">
      <p style="margin:0; font-size:0.9rem; color:#713f12;">
        ⏱️ <strong>Valid for 10 minutes only.</strong> Do not share this code with anyone.
      </p>
    </div>

    <p style="margin:0; font-size:0.85rem; color:#9ca3af; text-align:center;">
      Didn't request a password reset? Ignore this email — your account is safe.
    </p>
  `;
  return emailWrapper(content);
}

/**
 * Password changed confirmation email HTML
 */
export function getPasswordChangedEmailHtml() {
  const content = `
    <h2 style="margin:0 0 8px; font-size:1.4rem; font-weight:800; color:#111827;">
      ✅ Password Changed Successfully
    </h2>
    <p style="margin:0 0 24px; font-size:1rem; color:#374151; line-height:1.6;">
      Your Haggle account password was just changed. You can now log in with your new password.
    </p>

    <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:14px 18px; margin-bottom:24px;">
      <p style="margin:0; font-size:0.9rem; color:#991b1b;">
        🚨 <strong>Did not request this change?</strong> Your account may be compromised.
        Please contact us immediately at <a href="mailto:${CONTACT_EMAIL}" style="color:#dc2626;">${CONTACT_EMAIL}</a>
      </p>
    </div>

    <div style="text-align:center; margin:20px 0;">
      <a href="${SITE_URL}" style="display:inline-block; background:linear-gradient(135deg,#059669,#047857); color:#ffffff; text-decoration:none; padding:12px 32px; border-radius:50px; font-size:0.95rem; font-weight:700;">
        Login to Haggle →
      </a>
    </div>
  `;
  return emailWrapper(content);
}
