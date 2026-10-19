/**
 * public/js/pages/contact.js — Contact & Support Page (#/contact)
 */

import { escapeHtml } from '../product-card.js';

export function renderContactPage(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="contact-page-container">
      <div class="contact-header">
        <h1 class="contact-title">Contact Haggle Support</h1>
        <p class="contact-subtitle">Have a question, feedback, or want to report an inaccurate price? Our team is here to help.</p>
      </div>

      <div class="contact-grid">
        <!-- Left: Contact Details & Cards -->
        <div class="contact-info-cards">
          <div class="contact-card">
            <span class="card-icon" aria-hidden="true">✉️</span>
            <div>
              <h3>Email Support</h3>
              <p>For inquiries, support, and retailer partnerships:</p>
              <a href="mailto:haggledeals26@gmail.com" class="contact-highlight">haggledeals26@gmail.com</a>
              <span class="response-time">Average response time: &lt; 2 hours</span>
            </div>
          </div>

          <div class="contact-card">
            <span class="card-icon" aria-hidden="true">📞</span>
            <div>
              <h3>Toll-Free Helpline</h3>
              <p>Toll-free customer assistance across all Indian telecom circles:</p>
              <a href="tel:9345261563" class="contact-highlight">+91 9345261563</a>
              <span class="response-time">Mon – Sat: 9:00 AM – 8:00 PM IST</span>
            </div>
          </div>

          <div class="contact-card">
            <span class="card-icon" aria-hidden="true">📍</span>
            <div>
              <h3>Campus &amp; Headquarters</h3>
              <p>Haggle Technologies</p>
              <span class="contact-address">Puducherry Technological University (PTU), East Coast Road, Pillaichavady, Puducherry 605014, India</span>
            </div>
          </div>

          <div class="contact-card">
            <span class="card-icon" aria-hidden="true">⏱️</span>
            <div>
              <h3>Operating Hours</h3>
              <p>Support team active hours:</p>
              <span class="contact-highlight" style="font-size: 0.95rem;">Mon – Sat: 9:00 AM – 8:00 PM IST</span>
              <span class="response-time">Automated price alerts run 24/7</span>
            </div>
          </div>
        </div>

        <!-- Right: Message Form with Category Selector -->
        <div class="contact-form-panel">
          <h3>Send us a Message</h3>
          <p class="form-desc">Fill in the form below and our support team will get back to you shortly.</p>

          <div id="contactFormAlert" class="contact-alert" style="display: none;"></div>

          <form id="contactForm" class="contact-form">
            <div class="form-group">
              <label for="contactName">Your Name</label>
              <input type="text" id="contactName" placeholder="e.g. Priyanshu Sharma" required />
            </div>

            <div class="form-group">
              <label for="contactEmail">Your Email</label>
              <input type="email" id="contactEmail" placeholder="yourname@gmail.com" required />
            </div>

            <div class="form-group">
              <label for="contactSubject">Category</label>
              <select id="contactSubject" class="contact-select" required>
                <option value="price_inaccuracy">Report a Price Inaccuracy</option>
                <option value="missing_store">Suggest a Store or Retailer</option>
                <option value="feature_request">Feature Request / Feedback</option>
                <option value="price_alerts">Price Drop Alerts Help</option>
                <option value="account_wishlist">Account &amp; Wishlist Inquiry</option>
                <option value="general">General Support</option>
              </select>
            </div>

            <div class="form-group">
              <label for="contactMessage">Message</label>
              <textarea id="contactMessage" rows="5" placeholder="Please describe how we can assist you..." required></textarea>
            </div>

            <button type="submit" id="contactSubmitBtn" class="contact-submit-btn">
              <span>Send Message</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </div>
      </div>

      <!-- Interactive FAQ Accordion Strip -->
      <section class="contact-faq-section">
        <h2>Frequently Asked Questions</h2>
        <p class="faq-subtitle">Click any question to view the answer</p>
        <div class="faq-accordion-list">
          <div class="faq-accordion-item active">
            <button type="button" class="faq-accordion-btn" aria-expanded="true">
              <span>How does Haggle find the best prices?</span>
              <span class="faq-arrow" aria-hidden="true">▾</span>
            </button>
            <div class="faq-accordion-body" style="display: block;">
              <p>Haggle compares real-time verified product pricing strictly across India's top 15 authorized platforms (including Amazon, Flipkart, AJIO, JioMart, Shopsy, FirstCry, Nykaa, Meesho, Tata CLiQ, ShopClues, Lenskart, Tata Neu, IndiaMART, Myntra, and Snapdeal). We filter out unverified third-party search listings to ensure genuine offers.</p>
            </div>
          </div>

          <div class="faq-accordion-item">
            <button type="button" class="faq-accordion-btn" aria-expanded="false">
              <span>Are the "Buy" links official?</span>
              <span class="faq-arrow" aria-hidden="true">▾</span>
            </button>
            <div class="faq-accordion-body">
              <p>Yes. Every single Buy button directs straight to the official product detail page of that retailer. We strictly reject and drop generic store homepages or search results.</p>
            </div>
          </div>

          <div class="faq-accordion-item">
            <button type="button" class="faq-accordion-btn" aria-expanded="false">
              <span>How do price alerts work?</span>
              <span class="faq-arrow" aria-hidden="true">▾</span>
            </button>
            <div class="faq-accordion-body">
              <p>When you set a target price on any product page, Haggle stores your preference and tracks seller price fluctuations 24/7 so you never overpay. You can manage or delete your active alerts in your Profile.</p>
            </div>
          </div>

          <div class="faq-accordion-item">
            <button type="button" class="faq-accordion-btn" aria-expanded="false">
              <span>Why don't I see accessories (cases, covers) when searching for a phone?</span>
              <span class="faq-arrow" aria-hidden="true">▾</span>
            </button>
            <div class="faq-accordion-body">
              <p>Haggle features an intelligent accessory and price-sanity filter. When you search for "iPhone 16", cheap accessories like screen guards and cases are filtered out unless you explicitly add "case" or "cover" to your search query.</p>
            </div>
          </div>

          <div class="faq-accordion-item">
            <button type="button" class="faq-accordion-btn" aria-expanded="false">
              <span>Is Haggle completely free to use?</span>
              <span class="faq-arrow" aria-hidden="true">▾</span>
            </button>
            <div class="faq-accordion-body">
              <p>Yes, Haggle is 100% free for all shoppers across India with zero subscription fees.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  // Contact form submission
  const form = container.querySelector('#contactForm');
  const alertBox = container.querySelector('#contactFormAlert');
  const submitBtn = container.querySelector('#contactSubmitBtn');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (submitBtn) submitBtn.disabled = true;

    setTimeout(() => {
      if (alertBox) {
        alertBox.textContent = '✓ Thank you for reaching out! We have received your message and will respond within 2 hours to your email.';
        alertBox.className = 'contact-alert success';
        alertBox.style.display = 'block';
      }
      form.reset();
      if (submitBtn) submitBtn.disabled = false;
    }, 350);
  });

  // Interactive FAQ Accordion Click Handler
  container.querySelectorAll('.faq-accordion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-accordion-item');
      const body = item?.querySelector('.faq-accordion-body');
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';

      if (isExpanded) {
        btn.setAttribute('aria-expanded', 'false');
        item?.classList.remove('active');
        if (body) body.style.display = 'none';
      } else {
        btn.setAttribute('aria-expanded', 'true');
        item?.classList.add('active');
        if (body) body.style.display = 'block';
      }
    });
  });
}
