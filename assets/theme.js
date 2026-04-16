/* ============================================================
   FactoryCA Theme — Main JavaScript
   ============================================================ */

'use strict';

// ── Utility ───────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const on = (el, ev, fn, opts) => el?.addEventListener(ev, fn, opts);
const formatMoney = cents => `$${(cents / 100).toFixed(2)}`;

// ── Scroll-fade Intersection Observer ─────────────────────────
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      fadeObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
$$('.fade-in').forEach(el => fadeObserver.observe(el));

// ── Sticky Header ──────────────────────────────────────────────
(function initStickyHeader() {
  const header = $('.site-header');
  if (!header) return;
  let lastY = 0;
  const handleScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 40);
    lastY = y;
  };
  on(window, 'scroll', handleScroll, { passive: true });
  handleScroll();
})();

// ── Announcement Bar Dismiss ──────────────────────────────────
(function initAnnouncementBar() {
  const bar = $('.announcement-bar');
  const btn = $('.announcement-bar__close');
  if (!bar || !btn) return;
  if (sessionStorage.getItem('announcementDismissed')) {
    bar.remove();
    return;
  }
  on(btn, 'click', () => {
    bar.style.height = bar.offsetHeight + 'px';
    requestAnimationFrame(() => {
      bar.style.transition = 'height 0.3s ease, opacity 0.3s ease';
      bar.style.height = '0';
      bar.style.opacity = '0';
      setTimeout(() => bar.remove(), 300);
    });
    sessionStorage.setItem('announcementDismissed', '1');
  });
})();

// ── Cart Drawer ────────────────────────────────────────────────
class CartDrawer {
  constructor() {
    this.drawer  = $('.cart-drawer');
    this.overlay = $('.cart-overlay');
    this.body    = $('.cart-drawer__body');
    this.countEl = $$('.cart-count');
    if (!this.drawer) return;
    this.bindEvents();
  }

  open() {
    this.drawer.classList.add('open');
    this.overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    this.refresh();
  }

  close() {
    this.drawer.classList.remove('open');
    this.overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  bindEvents() {
    $$('[data-open-cart]').forEach(btn => on(btn, 'click', () => this.open()));
    on(this.overlay, 'click', () => this.close());
    on($('.cart-drawer__close'), 'click', () => this.close());
    on(document, 'keydown', e => { if (e.key === 'Escape') this.close(); });
  }

  async refresh() {
    try {
      const res  = await fetch('/cart.js');
      const cart = await res.json();
      this.updateCount(cart.item_count);
      this.renderItems(cart);
    } catch (e) {
      console.error('Cart refresh failed:', e);
    }
  }

  updateCount(count) {
    this.countEl.forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  }

  renderItems(cart) {
    if (!this.body) return;
    if (cart.item_count === 0) {
      this.body.innerHTML = `
        <div class="cart-drawer__empty">
          <div class="cart-drawer__empty-icon">🛍️</div>
          <h3 style="font-family:var(--font-heading);margin-bottom:8px">Your cart is empty</h3>
          <p style="font-size:14px;margin-bottom:24px">Discover our beautiful digital downloads.</p>
          <a href="/collections/all" class="btn btn-primary" onclick="window.cartDrawer.close()">Shop Now</a>
        </div>`;
      const footer = $('.cart-drawer__footer');
      if (footer) footer.style.display = 'none';
      return;
    }

    const footer = $('.cart-drawer__footer');
    if (footer) footer.style.display = '';

    const totalEl = $('.cart-total-price');
    if (totalEl) totalEl.textContent = formatMoney(cart.total_price);

    this.body.innerHTML = cart.items.map(item => `
      <div class="cart-item">
        <img class="cart-item__img" src="${item.image || ''}" alt="${item.title}" loading="lazy">
        <div>
          <div class="cart-item__title">${item.product_title}</div>
          ${item.variant_title && item.variant_title !== 'Default Title'
            ? `<div class="cart-item__price" style="margin-bottom:4px">${item.variant_title}</div>`
            : ''}
          <div class="cart-item__price">${formatMoney(item.final_line_price)}</div>
        </div>
        <button class="cart-item__remove" data-remove-key="${item.key}" aria-label="Remove item">×</button>
      </div>
    `).join('');

    this.body.querySelectorAll('[data-remove-key]').forEach(btn => {
      on(btn, 'click', () => this.removeItem(btn.dataset.removeKey));
    });
  }

  async removeItem(key) {
    try {
      await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, quantity: 0 }),
      });
      await this.refresh();
    } catch (e) { console.error('Remove failed:', e); }
  }

  async addItem(variantId, quantity = 1) {
    const res = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity }),
    });
    if (!res.ok) throw new Error('Add to cart failed');
    await this.refresh();
    this.open();
  }
}
window.cartDrawer = new CartDrawer();
// Init cart count on load
window.cartDrawer?.refresh?.();

// ── Quick Add to Cart ──────────────────────────────────────────
on(document, 'click', async (e) => {
  const btn = e.target.closest('[data-quick-add]');
  if (!btn) return;
  e.preventDefault();
  const variantId = btn.dataset.variantId;
  if (!variantId) return;
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span class="loading-spinner"></span>';
  btn.disabled = true;
  try {
    await window.cartDrawer.addItem(variantId);
    btn.innerHTML = '✓ Added';
    btn.style.background = '#2e7d32';
    setTimeout(() => {
      btn.innerHTML = originalHtml;
      btn.style.background = '';
      btn.disabled = false;
    }, 2000);
  } catch (err) {
    btn.innerHTML = 'Error — try again';
    btn.disabled = false;
    setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
  }
});

// ── Search Overlay ─────────────────────────────────────────────
(function initSearch() {
  const overlay  = $('.search-overlay');
  const input    = $('.search-box__input');
  const results  = $('.search-results');
  if (!overlay) return;

  const openSearch  = () => { overlay.classList.add('open'); input?.focus(); document.body.style.overflow = 'hidden'; };
  const closeSearch = () => { overlay.classList.remove('open'); document.body.style.overflow = ''; };

  $$('[data-open-search]').forEach(btn => on(btn, 'click', openSearch));
  on(overlay, 'click', e => { if (e.target === overlay) closeSearch(); });
  on(document, 'keydown', e => { if (e.key === 'Escape') closeSearch(); });
  on(document, 'keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); } });

  if (!input || !results) return;

  let timer;
  on(input, 'input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { results.innerHTML = ''; return; }
    timer = setTimeout(() => fetchSuggestions(q), 300);
  });

  async function fetchSuggestions(q) {
    try {
      const res  = await fetch(`/search/suggest.json?q=${encodeURIComponent(q)}&resources[type]=product&resources[limit]=6`);
      const data = await res.json();
      const products = data.resources?.results?.products ?? [];
      if (!products.length) {
        results.innerHTML = `<div style="padding:20px;text-align:center;font-size:14px;color:var(--color-muted)">No results for "${q}"</div>`;
        return;
      }
      results.innerHTML = products.map(p => `
        <a href="${p.url}" class="search-result-item">
          <img src="${p.featured_image?.url || ''}" alt="${p.title}" loading="lazy">
          <div>
            <div style="font-size:14px;font-weight:500;margin-bottom:4px">${p.title}</div>
            <div style="font-size:12px;color:var(--color-muted)">${p.price ? formatMoney(parseInt(p.price.replace(/\D/g,''))) : ''}</div>
          </div>
        </a>
      `).join('');
    } catch (e) { console.error('Search failed:', e); }
  }
})();

// ── Testimonials Carousel ──────────────────────────────────────
(function initTestimonials() {
  const section = $('.testimonials');
  if (!section) return;
  const track  = $('.testimonials__track', section);
  const dots   = $$('.testimonials__dot', section);
  const prevBtn = $('[data-prev]', section);
  const nextBtn = $('[data-next]', section);
  if (!track) return;

  const cards  = $$('.testimonial-card', track);
  let current  = 0;
  let autoplay;
  const perView = window.innerWidth < 640 ? 1 : window.innerWidth < 900 ? 2 : 3;
  const max    = Math.max(0, cards.length - perView);

  function go(idx) {
    current = Math.max(0, Math.min(idx, max));
    const cardW = cards[0]?.offsetWidth + 24 || 0;
    track.style.transform = `translateX(-${current * cardW}px)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
  }

  dots.forEach((dot, i) => on(dot, 'click', () => { go(i); resetAutoplay(); }));
  on(prevBtn, 'click', () => { go(current - 1); resetAutoplay(); });
  on(nextBtn, 'click', () => { go(current + 1); resetAutoplay(); });

  function resetAutoplay() { clearInterval(autoplay); startAutoplay(); }
  function startAutoplay() {
    autoplay = setInterval(() => go(current >= max ? 0 : current + 1), 5000);
  }
  startAutoplay();
  on(section, 'mouseenter', () => clearInterval(autoplay));
  on(section, 'mouseleave', startAutoplay);
  go(0);
})();

// ── Product Gallery Zoom + Thumb Swap ─────────────────────────
(function initProductGallery() {
  const gallery = $('.product-gallery');
  if (!gallery) return;

  // Thumbnail swap
  const mainImg = $('.product-gallery__main img');
  const thumbs  = $$('.product-gallery__thumb');
  thumbs.forEach(thumb => {
    on(thumb, 'click', () => {
      const src = thumb.querySelector('img')?.src;
      if (mainImg && src) mainImg.src = src;
      thumbs.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });

  // Zoom on hover
  const mainWrap = $('.product-gallery__main');
  if (!mainWrap || !mainImg) return;
  on(mainWrap, 'mousemove', e => {
    const rect = mainWrap.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
    const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
    mainWrap.style.setProperty('--zoom-x', `${x}%`);
    mainWrap.style.setProperty('--zoom-y', `${y}%`);
  });
})();

// ── Sticky ATC Bar ─────────────────────────────────────────────
(function initStickyAtc() {
  const bar     = $('.sticky-atc');
  const atcForm = $('.product-atc-form');
  if (!bar || !atcForm) return;
  const observer = new IntersectionObserver(([e]) => {
    bar.classList.toggle('visible', !e.isIntersecting);
  }, { threshold: 0 });
  observer.observe(atcForm);
})();

// ── Product Accordion ──────────────────────────────────────────
$$('.accordion__item').forEach(item => {
  const trigger = $('.accordion__trigger', item);
  const content = $('.accordion__content', item);
  if (!trigger || !content) return;
  on(trigger, 'click', () => {
    const open = item.classList.toggle('open');
    content.style.maxHeight = open ? content.scrollHeight + 'px' : '0';
    trigger.setAttribute('aria-expanded', String(open));
  });
});

// ── Collection Filters ─────────────────────────────────────────
(function initFilters() {
  const filterForm = $('.filter-form');
  if (!filterForm) return;
  on(filterForm, 'change', () => filterForm.submit());
})();

// ── Add to Cart Form ───────────────────────────────────────────
(function initProductForm() {
  const form   = $('.product-atc-form');
  const btn    = $('.atc-btn', form);
  if (!form || !btn) return;

  on(form, 'submit', async e => {
    e.preventDefault();
    const variantId = new FormData(form).get('id');
    if (!variantId) return;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="loading-spinner"></span> Adding…';
    btn.disabled = true;
    try {
      await window.cartDrawer.addItem(variantId);
      btn.innerHTML = '✓ Added to Cart';
      btn.style.background = '#2e7d32';
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.style.background = '';
        btn.disabled = false;
      }, 2000);
    } catch (err) {
      btn.innerHTML = 'Error — try again';
      btn.disabled = false;
      setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
    }
  });
})();

// ── Newsletter Form ────────────────────────────────────────────
$$('.newsletter-form').forEach(form => {
  on(form, 'submit', async e => {
    e.preventDefault();
    const email = form.querySelector('[type=email]')?.value;
    const btn   = form.querySelector('button[type=submit]');
    const msg   = form.querySelector('.newsletter-msg');
    if (!email || !btn) return;
    btn.textContent = '…';
    btn.disabled = true;
    // Shopify handles newsletter via contact form POST
    try {
      const fd = new FormData();
      fd.append('contact[email]', email);
      fd.append('contact[tags]', 'newsletter');
      await fetch('/contact#contact_form', { method: 'POST', body: fd });
      if (msg) { msg.textContent = 'Thanks! Check your inbox.'; msg.style.color = '#4ade80'; }
      form.reset();
    } catch (e) {
      if (msg) msg.textContent = 'Something went wrong. Please try again.';
    }
    btn.disabled = false;
    btn.textContent = 'Subscribe';
  });
});

// ── Mobile menu toggle ─────────────────────────────────────────
(function initMobileMenu() {
  const toggle = $('.mobile-menu-toggle');
  const menu   = $('.mobile-menu');
  if (!toggle || !menu) return;
  on(toggle, 'click', () => {
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });
})();
