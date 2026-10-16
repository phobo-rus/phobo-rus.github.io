(() => {
  'use strict';

  const dialog = document.getElementById('fee-announcement');
  if (!dialog || typeof dialog.showModal !== 'function' || dialog.dataset.initialized) return;
  dialog.dataset.initialized = 'true';

  const delay = Number(dialog.dataset.delayMs) || 50000;
  const storageKey = 'phobo:fee-announcement:2027';
  const readSession = () => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(storageKey));
      if (saved && typeof saved.shown === 'boolean' && Number.isFinite(saved.elapsedMs)
        && saved.elapsedMs >= 0) {
        return { shown: saved.shown, elapsedMs: Math.min(delay, saved.elapsedMs) };
      }
    } catch { /* Private browsing can disable storage. Keep this page usable. */ }
    return null;
  };
  let state = readSession() || { shown: false, elapsedMs: 0 };
  let visibleSince = null;
  let pageActive = true;
  let timer = null;
  const saveSession = () => {
    try { window.sessionStorage.setItem(storageKey, JSON.stringify(state)); }
    catch { /* The in-memory state still prevents repeats on this page. */ }
  };

  const clearTimer = () => {
    window.clearTimeout(timer);
    timer = null;
  };
  const checkpoint = () => {
    if (visibleSince !== null) {
      state.elapsedMs = Math.min(delay, state.elapsedMs + Math.max(0, performance.now() - visibleSince));
      visibleSince = null;
    }
    saveSession();
  };
  const visible = () => pageActive && document.visibilityState === 'visible';
  const editingForm = () => {
    const focused = document.activeElement;
    return focused instanceof HTMLElement
      && (focused.matches('input, textarea, select') || focused.isContentEditable);
  };
  const notifyVisibility = () => document.dispatchEvent(new CustomEvent('phobo:fee-visibility'));

  const tryShow = () => {
    clearTimer();
    checkpoint();
    if (state.shown || !visible()) return;
    if (state.elapsedMs < delay) {
      resume();
      return;
    }
    // Keep video dialogs and form editing uninterrupted; the earned time is retained.
    if (document.querySelector('dialog[open]') || editingForm()) {
      timer = window.setTimeout(tryShow, 1000);
      return;
    }
    try {
      dialog.showModal();
    } catch {
      timer = window.setTimeout(tryShow, 1000);
      return;
    }
    state.shown = true;
    saveSession();
    document.documentElement.classList.add('fee-dialog-open');
    dialog.querySelector('[data-fee-close]')?.focus({ preventScroll: true });
    notifyVisibility();
  };

  const resume = () => {
    clearTimer();
    if (state.shown || !visible()) return;
    if (visibleSince === null) visibleSince = performance.now();
    const remaining = delay - state.elapsedMs - (performance.now() - visibleSince);
    timer = window.setTimeout(tryShow, Math.max(0, remaining));
  };

  const closeDialog = () => {
    if (dialog.open) dialog.close();
  };
  dialog.querySelector('[data-fee-close]')?.addEventListener('click', closeDialog);
  dialog.querySelector('[data-fee-apply]')?.addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog();
  });
  let backdropPress = false;
  const outsideDialog = (event) => {
    if (event.target !== dialog) return false;
    const bounds = dialog.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
  };
  dialog.addEventListener('pointerdown', (event) => { backdropPress = outsideDialog(event); });
  dialog.addEventListener('click', (event) => {
    if (backdropPress && outsideDialog(event)) closeDialog();
    backdropPress = false;
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('fee-dialog-open');
    notifyVisibility();
  });

  document.addEventListener('visibilitychange', () => {
    if (!pageActive) return;
    clearTimer();
    checkpoint();
    resume();
  });
  window.addEventListener('pagehide', () => {
    checkpoint();
    pageActive = false;
    clearTimer();
  });
  window.addEventListener('pageshow', (event) => {
    // A restored BFCache page may hold a state from before another page showed it.
    if (event.persisted) {
      visibleSince = null;
      state = readSession() || state;
    }
    pageActive = true;
    resume();
  });
  resume();
})();
