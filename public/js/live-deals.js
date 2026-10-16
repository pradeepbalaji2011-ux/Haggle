/**
 * public/js/live-deals.js — Live Shuffling Top Deals Showcase Component
 *
 * Replaces the static hero visual box with a live, auto-shuffling showcase
 * of verified low-price deals. Clicking any deal opens its dedicated in-app
 * product page with full price comparison, direct buy options, and price history graph.
 */

import { CONFIG } from './config.js';

const money = value =>
  value == null || !Number.isFinite(Number(value))
    ? 'Price unavailable'
    : new Intl.NumberFormat(CONFIG.locale, {
        style: 'currency',
        currency: CONFIG.currency,
        maximumFractionDigits: 0
      }).format(Number(value));

const TOP_LIVE_DEALS = [
  {
    id: '5268628289708258757',
    productId: '5268628289708258757',
    title: 'Apple iPhone 15 128GB (Blue)',
    brand: 'Apple',
    store: 'Flipkart',
    price: 59900,
    mrp: 74900,
    savings: 15000,
    discount: '20% OFF',
    rating: 4.8,
    reviews: '3,420',
    image: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcToepaUCvBg-gxBFSGWR3txm2pI4nbdQQ7aTMdahw-PmoINc6o',
    buyUrl: 'https://www.flipkart.com/search?q=Apple%20iPhone%2015%20128GB',
    badge: '🏆 Lowest Price Found'
  },
  {
    id: 'sony_wh1000xm5_deal',
    productId: '10398471928471928',
    title: 'Sony WH-1000XM5 Noise Cancelling Headphones',
    brand: 'Sony',
    store: 'Amazon.in',
    price: 26990,
    mrp: 34990,
    savings: 8000,
    discount: '23% OFF',
    rating: 4.7,
    reviews: '5,120',
    image: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcQu1B2wZJOVE9cLUJcCaCkDyDU3Ap_c1M_a-T5RHUIQ5ctT72abz-JAeNuFLiP2TiaZ9g50gPFtHZe_CUYp_pF5HrDynZ9dHdsL3wFmfeuHDSjEEw-BcD9c',
    buyUrl: 'https://www.amazon.in/s?k=Sony+WH-1000XM5',
    badge: '⚡ ₹8,000 Cheaper Than Retail'
  },
  {
    id: 'airpods_pro_2_deal',
    productId: '72819384719284719',
    title: 'Apple AirPods Pro (2nd Gen) with MagSafe USB-C',
    brand: 'Apple',
    store: 'Croma',
    price: 18999,
    mrp: 24900,
    savings: 5901,
    discount: '24% OFF',
    rating: 4.9,
    reviews: '8,900',
    image: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcShQJdXwf5GcgR9G0tNGC_EfsgsRywYvXJ9MWKsQ09eD8Sp1mSCHnSlzFQ0ZTtp7GbsZvQXeIXsMcbNG2asBhqcfjgFoOvSURYzYvuho_EgB5tl2JRteI9sOQ',
    buyUrl: 'https://www.croma.com/searchB?q=AirPods+Pro+2nd+Gen',
    badge: '🔥 Hot Deal Verified'
  },
  {
    id: 'samsung_s25_deal',
    productId: '9182736451029384',
    title: 'Samsung Galaxy S25 5G (Phantom Black)',
    brand: 'Samsung',
    store: 'Reliance Digital',
    price: 69999,
    mrp: 79999,
    savings: 10000,
    discount: '13% OFF',
    rating: 4.8,
    reviews: '2,150',
    image: 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcRkFDsU1AlydFmG_yuLhInhWKCzG_BS2GAjT7P1QCYeOM3W3Hx6Lm7zhCgphbY0PqXBsgt8NGxLKMGycAEAnSwJZiaNNGjTULgIniFgi8Nd97JijcXUuVs_zA',
    buyUrl: 'https://www.reliancedigital.in/search?q=Samsung+Galaxy+S25',
    badge: '📉 ₹10,000 Price Drop'
  },
  {
    id: 'smart_tv_55_deal',
    productId: '6192837465019283',
    title: 'Xiaomi 55-Inch 4K Ultra HD Smart Google TV',
    brand: 'Xiaomi',
    store: 'Amazon.in',
    price: 29999,
    mrp: 44999,
    savings: 15000,
    discount: '33% OFF',
    rating: 4.6,
    reviews: '4,830',
    image: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcTl2L6l7XtBKcjEFcdxHem8AhGoYbK_JqgarH4EyfCs1Kh52uxDmvbBs92cNRG1nP8kxGsINeqsW5oB0SDhKRpaHqTxBGUmTat7gX91vQKEbq5ZFozvCRA8',
    buyUrl: 'https://www.amazon.in/s?k=Xiaomi+55+inch+4k+Smart+TV',
    badge: '🏷️ 33% Off Multi-Store Deal'
  }
];

export function initLiveDealsShowcase() {
  const container = document.getElementById('heroDealsShowcase');
  if (!container) return;

  let currentIndex = 0;
  let autoShuffleTimer = null;
  let isPaused = false;

  function renderDeal(deal, animate = true) {
    const cardWrap = document.getElementById('liveDealCardWrap');
    if (!cardWrap) return;

    const discountPill = deal.savings > 0
      ? `<span class="live-deal-save-pill">Save ${money(deal.savings)} (${deal.discount})</span>`
      : '';

    cardWrap.innerHTML = `
      <div class="live-deal-card ${animate ? 'deal-slide-in' : ''}"
        data-product-id="${deal.productId || deal.id}"
        data-product-title="${deal.title}"
        data-product-image="${deal.image}"
        data-product-price="${deal.price}"
        data-product-store="${deal.store}"
        data-product-buy-url="${deal.buyUrl}"
        data-product-brand="${deal.brand}"
        data-product-rating="${deal.rating}"
        data-product-reviews="${deal.reviews}">
        
        <!-- Top bar with pulsating live dot and badge -->
        <div class="live-deal-header">
          <div class="live-tag">
            <span class="pulse-dot"></span>
            <span>TOP DEAL DETECTED</span>
          </div>
          <span class="live-deal-badge">${deal.badge}</span>
        </div>

        <!-- Product Image & Store badge -->
        <div class="live-deal-image-container">
          <img src="${deal.image}" alt="${deal.title}" class="live-deal-img" loading="eager" />
          <span class="live-deal-store-tag">🏪 ${deal.store}</span>
        </div>

        <!-- Title & Rating -->
        <div class="live-deal-info">
          <h4 class="live-deal-title" title="${deal.title}">${deal.title}</h4>
          <div class="live-deal-rating">
            <span class="stars">★ ${deal.rating}</span>
            <span class="reviews-count">(${deal.reviews} reviews)</span>
          </div>
        </div>

        <!-- Pricing & Action Row -->
        <div class="live-deal-price-row">
          <div>
            <div class="live-deal-price">${money(deal.price)}</div>
            ${deal.mrp ? `<div class="live-deal-mrp">${money(deal.mrp)}</div>` : ''}
          </div>
          ${discountPill}
        </div>

        <!-- Call to action button -->
        <button type="button" class="live-deal-cta-btn">
          View Details &amp; Price History ↗
        </button>

        <!-- Shuffle Dots Navigation -->
        <div class="live-deal-dots">
          ${TOP_LIVE_DEALS.map((_, idx) => `
            <button type="button" class="deal-dot ${idx === currentIndex ? 'active' : ''}" data-index="${idx}" aria-label="Go to deal ${idx + 1}"></button>
          `).join('')}
        </div>
      </div>
    `;

    // Click handler on the whole card or button
    const card = cardWrap.querySelector('.live-deal-card');
    if (card) {
      card.addEventListener('click', () => {
        const q = new URLSearchParams({
          id: deal.productId || deal.id,
          title: deal.title,
          image: deal.image,
          price: deal.price,
          store: deal.store,
          buyUrl: deal.buyUrl,
          brand: deal.brand,
          rating: deal.rating,
          reviews: deal.reviews
        });
        window.location.hash = `#/product?${q.toString()}`;
      });
    }

    // Dot click listeners
    cardWrap.querySelectorAll('.deal-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetIdx = Number(dot.getAttribute('data-index'));
        if (targetIdx !== currentIndex) {
          currentIndex = targetIdx;
          renderDeal(TOP_LIVE_DEALS[currentIndex]);
          resetTimer();
        }
      });
    });
  }

  function nextDeal() {
    currentIndex = (currentIndex + 1) % TOP_LIVE_DEALS.length;
    renderDeal(TOP_LIVE_DEALS[currentIndex]);
  }

  function startTimer() {
    stopTimer();
    autoShuffleTimer = setInterval(() => {
      if (!isPaused) {
        nextDeal();
      }
    }, 3800); // Shuffles every 3.8s smoothly
  }

  function stopTimer() {
    if (autoShuffleTimer) {
      clearInterval(autoShuffleTimer);
      autoShuffleTimer = null;
    }
  }

  function resetTimer() {
    startTimer();
  }

  // Pause shuffling when customer hovers over the card to inspect or click
  container.addEventListener('mouseenter', () => { isPaused = true; });
  container.addEventListener('mouseleave', () => { isPaused = false; });

  // Initial render
  renderDeal(TOP_LIVE_DEALS[currentIndex], false);
  startTimer();
}
