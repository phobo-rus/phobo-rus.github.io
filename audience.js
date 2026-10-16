(() => {
  const hoverPointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  document.querySelectorAll('[data-audience-card]').forEach((card) => {
    const front = card.querySelector('.pa-face-front');
    const back = card.querySelector('.pa-face-back');
    const button = card.querySelector('.pa-card-toggle');
    const stage = card.querySelector('.pa-card-stage');
    if (!front || !back || !button || !stage) return;

    let expanded = false;
    const update = (nextExpanded) => {
      expanded = nextExpanded;
      card.dataset.expanded = String(expanded);
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-label', `${button.dataset.audienceCategory}: ${expanded ? 'Вернуться к описанию' : button.dataset.audienceLabel}`);
      front.setAttribute('aria-hidden', String(expanded));
      back.setAttribute('aria-hidden', String(!expanded));
      front.inert = expanded;
      back.inert = !expanded;
    };

    update(false);
    card.dataset.enhanced = 'true';

    card.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse' && hoverPointer.matches) update(true);
    });
    card.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse' && hoverPointer.matches) update(false);
    });
    // Native button clicks cover touch, Enter and Space without custom key emulation.
    button.addEventListener('click', () => update(!expanded));
    stage.addEventListener('click', () => update(!expanded));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && expanded) {
        update(false);
        event.preventDefault();
      }
    });
  });
})();
