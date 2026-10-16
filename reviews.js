(function () {
  'use strict';
  const PAGE_SIZE = 4;
  const STORAGE_KEY = 'phobo.reviews.preferences.v1';
  const FILTER_PARAM = 'review_type';
  const TYPES = ['all', 'positive', 'neutral', 'negative'];

  function init() {
    const root = document.querySelector('.fr-reviews');
    if (!root || root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    const cards = Array.from(root.querySelectorAll('[data-review-card]'));
    const filters = Array.from(root.querySelectorAll('[data-review-filter]'));
    const more = root.querySelector('[data-reviews-more]');
    const count = root.querySelector('.fr-count');
    const empty = root.querySelector('.fr-empty');
    const grid = root.querySelector('.fr-grid');
    const shown = { all: PAGE_SIZE, positive: PAGE_SIZE, neutral: PAGE_SIZE, negative: PAGE_SIZE };
    let active = 'all';
    let saved;
    let measureFrame = 0;

    try {
      saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && TYPES.includes(saved.filter)) active = saved.filter;
      TYPES.forEach(type => {
        if (saved && saved.shown && Number.isInteger(saved.shown[type])) {
          shown[type] = Math.min(Math.max(PAGE_SIZE, saved.shown[type]), Math.max(PAGE_SIZE, cards.length));
        }
      });
    } catch (_) { /* Preferences are optional in restricted browser modes. */ }
    const requested = new URL(window.location.href).searchParams.get(FILTER_PARAM);
    if (TYPES.includes(requested)) active = requested;

    function persist(updateURL) {
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ filter: active, shown })); } catch (_) { /* Optional. */ }
      if (updateURL) {
        const url = new URL(window.location.href);
        if (active === 'all') url.searchParams.delete(FILTER_PARAM);
        else url.searchParams.set(FILTER_PARAM, active);
        try { window.history.replaceState(window.history.state, '', url); } catch (_) { /* File previews may restrict history. */ }
      }
    }

    function measureText() {
      cancelAnimationFrame(measureFrame);
      measureFrame = requestAnimationFrame(() => {
        cards.forEach(card => {
          if (card.hidden) return;
          const text = card.querySelector('[data-review-text]');
          const button = card.querySelector('[data-review-expand]');
          if (!text || !button) return;
          const expanded = card.dataset.expanded === 'true';
          button.hidden = !expanded && text.scrollHeight <= text.clientHeight + 2;
        });
      });
    }

    function render(options) {
      const settings = options || {};
      const matching = cards.filter(card => active === 'all' || card.dataset.reviewType === active);
      const visible = matching.slice(0, shown[active]);
      const visibleSet = new Set(visible);
      const firstAdded = visible.find(card => card.hidden);
      cards.forEach(card => { card.hidden = !visibleSet.has(card); });
      filters.forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.reviewFilter === active)); });
      more.hidden = visible.length >= matching.length;
      empty.hidden = matching.length !== 0;
      count.textContent = 'Показано ' + visible.length + ' из ' + matching.length;
      persist(Boolean(settings.updateURL));
      measureText();
      if (settings.focusAdded && firstAdded) firstAdded.focus({ preventScroll: false });
    }

    cards.forEach(card => {
      const button = card.querySelector('[data-review-expand]');
      if (!button) return;
      card.dataset.expanded = 'false';
      button.addEventListener('click', () => {
        const expanded = card.dataset.expanded !== 'true';
        card.dataset.expanded = String(expanded);
        button.setAttribute('aria-expanded', String(expanded));
        button.textContent = expanded ? 'Свернуть' : 'Читать полностью';
        measureText();
      });
    });

    filters.forEach(button => {
      button.addEventListener('click', () => {
        const next = button.dataset.reviewFilter;
        if (!TYPES.includes(next) || next === active) return;
        active = next;
        render({ updateURL: true });
      });
    });
    more.addEventListener('click', () => {
      shown[active] += PAGE_SIZE;
      render({ focusAdded: true });
    });
    window.addEventListener('popstate', () => {
      const next = new URL(window.location.href).searchParams.get(FILTER_PARAM);
      active = TYPES.includes(next) ? next : 'all';
      render();
    });
    root.classList.add('is-ready');
    root.querySelector('.fr-filters').hidden = false;
    render();
    if (window.ResizeObserver) new ResizeObserver(measureText).observe(grid);
    else window.addEventListener('resize', measureText);
    if (document.fonts) document.fonts.ready.then(measureText);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
