/* ==========================================================================
   VINTEX GUEST HOUSE — main.js
   The Orchestrator.
   - Owns global currency state (USD / KSH) and broadcasts changes.
   - Injects the persistent nav into every page's <header id="site-nav">.
   - Handles soft page-to-page transitions (fade-out before navigation).
   No page-specific logic (rooms, modal, FAQ) lives here — that belongs
   to room.js or the inline script on contact.html.
   ========================================================================== */

const Vintex = (() => {
  const FX_RATE = 128; // 1 USD ≈ 128 KSH
  const STORAGE_KEY = 'vintex_currency';
  const VALID = ['USD', 'KSH'];

  let currency = (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return VALID.includes(saved) ? saved : 'USD';
    } catch (e) {
      return 'USD';
    }
  })();

  const listeners = new Set();

  function getCurrency() {
    return currency;
  }

  function setCurrency(next) {
    if (!VALID.includes(next) || next === currency) return;
    currency = next;
    try { localStorage.setItem(STORAGE_KEY, currency); } catch (e) { /* ignore */ }
    listeners.forEach((fn) => fn(currency));
    document.dispatchEvent(new CustomEvent('currencychange', { detail: { currency } }));
  }

  function onCurrencyChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /**
   * Formats a USD base price into the active currency's display string.
   * Kept here (not in room.js) because the conversion rate is global state.
   */
  function formatPrice(usd) {
    if (currency === 'USD') {
      return `$${usd.toFixed(0)}`;
    }
    const ksh = Math.round(usd * FX_RATE);
    return `KSH ${ksh.toLocaleString('en-KE')}`;
  }

  function formatPriceUnit() {
    return currency === 'USD' ? 'USD / night' : 'KSH / night';
  }

  /* ---------------------------------------------------------------- */
  /* NAV INJECTION                                                    */
  /* ---------------------------------------------------------------- */
  const NAV_LINKS = [
    { href: 'index.html', label: 'The Kimana Experience' },
    { href: 'room.html', label: 'Rooms & Rates' },
    { href: 'contact.html', label: 'Contact' },
  ];

  function injectNav(activePage) {
    const mount = document.getElementById('site-nav');
    if (!mount) return;

    mount.innerHTML = `
      <nav class="nav" id="nav">
        <a href="index.html" class="nav__mark" data-transition-link>VINTEX<span>&nbsp;Guest&nbsp;House</span></a>
        <button class="nav__burger" id="navBurger" aria-label="Toggle menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        <div class="nav__links">
          ${NAV_LINKS.map((l) => `<a href="${l.href}" class="nav__link${l.href === activePage ? ' is-active' : ''}" data-transition-link>${l.label}</a>`).join('')}
          <div class="currency-toggle" id="currencyToggle" role="group" aria-label="Currency">
            <span class="currency-toggle__opt" data-currency="USD">USD</span>
            <span class="currency-toggle__opt" data-currency="KSH">KSH</span>
          </div>
        </div>
      </nav>
    `;

    const toggle = document.getElementById('currencyToggle');
    const opts = toggle.querySelectorAll('[data-currency]');

    function paintToggle() {
      opts.forEach((el) => {
        el.classList.toggle('is-active', el.dataset.currency === getCurrency());
      });
    }
    paintToggle();

    toggle.addEventListener('click', (e) => {
      const target = e.target.closest('[data-currency]');
      if (!target) return;
      setCurrency(target.dataset.currency);
      paintToggle();
    });

    onCurrencyChange(paintToggle);

    const burger = document.getElementById('navBurger');
    const navEl = document.getElementById('nav');
    burger.addEventListener('click', () => {
      const open = navEl.classList.toggle('is-mobile-open');
      burger.setAttribute('aria-expanded', String(open));
    });

    bindTransitionLinks();
  }

  /* ---------------------------------------------------------------- */
  /* PAGE TRANSITIONS                                                 */
  /* ---------------------------------------------------------------- */
  function bindTransitionLinks() {
    document.querySelectorAll('[data-transition-link]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (!href || a.target === '_blank') return;
        e.preventDefault();
        document.body.classList.add('page-leaving');
        window.setTimeout(() => { window.location.href = href; }, 220);
      });
    });
  }

  function init(activePage) {
    injectNav(activePage);
    document.body.classList.remove('page-leaving');
  }

  return {
    init,
    getCurrency,
    setCurrency,
    onCurrencyChange,
    formatPrice,
    formatPriceUnit,
    bindTransitionLinks,
  };
})();