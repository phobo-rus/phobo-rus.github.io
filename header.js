(() => {
  const init = () => {
    const header = document.querySelector('.site-header');
    const hero = document.querySelector('.phobo-hero');
    if (!header || !hero) return;
    let pending = false;
    const sync = () => {
      pending = false;
      const visible = hero.getBoundingClientRect().bottom <= 0;
      if (!visible) {
        const toggle = header.querySelector('[data-menu-toggle]');
        if (toggle?.getAttribute('aria-expanded') === 'true') toggle.click();
      }
      header.classList.toggle('is-visible', visible);
      header.inert = !visible;
      header.setAttribute('aria-hidden', String(!visible));
    };
    const schedule = () => {
      if (!pending) { pending = true; requestAnimationFrame(sync); }
    };
    window.addEventListener('scroll', schedule, { passive:true });
    window.addEventListener('resize', schedule);
    window.addEventListener('pageshow', schedule);
    sync();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
