(() => {
  'use strict';

  const galleries = [...document.querySelectorAll('[data-format-gallery]')];
  if (!galleries.length) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  galleries.forEach((gallery) => {
    const images = [...gallery.querySelectorAll('[data-gallery-slide]')];
    // One real photograph remains static until more photos are added to the list.
    if (images.length < 2) return;
    const panel = gallery.closest('[role="tabpanel"]');
    const delay = Number(gallery.dataset.galleryInterval) || 7000;
    let active = 0;
    let timer = null;

    const isPaused = () => document.hidden || reducedMotion.matches || Boolean(panel?.hidden);
    const stop = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const schedule = () => {
      stop();
      if (!isPaused()) timer = window.setTimeout(advance, delay);
    };
    const advance = () => {
      timer = null;
      if (isPaused()) return;
      // Retain the current photo if the following files have not loaded or failed.
      for (let offset = 1; offset < images.length; offset += 1) {
        const next = (active + offset) % images.length;
        if (!images[next].complete || images[next].naturalWidth === 0) continue;
        images[active].classList.remove('is-active');
        images[active].setAttribute('aria-hidden', 'true');
        images[next].classList.add('is-active');
        images[next].removeAttribute('aria-hidden');
        active = next;
        break;
      }
      schedule();
    };

    document.addEventListener('visibilitychange', schedule);
    reducedMotion.addEventListener('change', schedule);
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', schedule);
    if (panel) new MutationObserver(schedule).observe(panel, {
      attributes: true,
      attributeFilter: ['hidden'],
    });
    schedule();
  });
})();
