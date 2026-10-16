/* Register before the vendor loaders. Bitrix24 remains the only submitter. */
(() => {
  'use strict';
  const allowedIds = new Set(['67', '69']);
  const instances = new WeakMap();
  const records = new Map();
  const pendingSuccess = [];
  let dialog = null;
  let returnFocus = null;
  let ready = false;

  const hostFor = (id) => document.querySelector(`[data-bitrix-id="${id}"]`);
  const setLoadState = (host, state) => {
    if (!host) return;
    host.dataset.formState = state;
    const status = host.querySelector('.crm-load-status');
    const fallback = host.querySelector('.crm-load-fallback');
    if (status && status.hidden !== (state !== 'loading')) status.hidden = state !== 'loading';
    if (fallback && fallback.hidden !== (state !== 'unavailable')) fallback.hidden = state !== 'unavailable';
  };

  window.addEventListener('b24:form:init', (event) => {
    const form = event.detail?.object;
    const id = String(form?.identification?.id ?? '');
    if (!form || typeof form !== 'object' || !allowedIds.has(id)) return;
    const record = { id, trigger: null, awaitingResult: false, delivered: false, confirmed: false };
    instances.set(form, record);
    records.set(id, record);
    const host = hostFor(id);
    if (host) host.dataset.crmInitialized = 'true';
  });

  window.addEventListener('b24:form:send', (event) => {
    const record = instances.get(event.detail?.object);
    if (!record) return;
    record.trigger = document.activeElement;
    if (!record.awaitingResult) record.confirmed = false;
    record.awaitingResult = true;
  });

  const showSuccess = (record) => {
    if (!ready) { pendingSuccess.push(record); return; }
    const host = hostFor(record.id);
    if (!host || !dialog || typeof dialog.showModal !== 'function') return;
    // Only a provider success event or its actual success DOM state reaches here.
    // No local validation, click, timeout, or failed request implies delivery.
    const announcement = document.getElementById('fee-announcement');
    if (announcement?.open) announcement.close();
    if (dialog.open || document.querySelector('dialog[open]')) return;
    returnFocus = record.trigger instanceof HTMLElement && record.trigger.isConnected
      ? record.trigger : host;
    try {
      dialog.showModal();
      document.documentElement.classList.add('lead-result-open');
      dialog.querySelector('[data-lead-result-close]')?.focus({ preventScroll: true });
    } catch {
      returnFocus = null;
      // Leave the provider's configured redirect untouched if dialog opening fails.
    }
  };

  const confirmDelivery = (record) => {
    if (record.confirmed) return;
    record.confirmed = true;
    record.awaitingResult = false;
    const host = hostFor(record.id);
    const success = host?.querySelector('.b24-form-success');
    record.delivered = Boolean(success && success.style.display !== 'none' && !success.hidden);
    if (host && record.delivered) host.dataset.crmDelivered = 'true';
    showSuccess(record);
  };

  window.addEventListener('b24:form:send:success', (event) => {
    const record = instances.get(event.detail?.object);
    if (record) confirmDelivery(record);
  });

  const start = () => {
    ready = true;
    dialog = document.getElementById('lead-result-dialog');
    if (dialog) {
      const close = () => { if (dialog.open) dialog.close(); };
      dialog.querySelectorAll('[data-lead-result-close]').forEach((button) => {
        button.addEventListener('click', close);
      });
      dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
      let backdropPressed = false;
      const outside = (event) => {
        if (event.target !== dialog) return false;
        const bounds = dialog.getBoundingClientRect();
        return event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom;
      };
      dialog.addEventListener('pointerdown', (event) => { backdropPressed = outside(event); });
      dialog.addEventListener('click', (event) => {
        if (backdropPressed && outside(event)) close();
        backdropPressed = false;
      });
      dialog.addEventListener('close', () => {
        document.documentElement.classList.remove('lead-result-open');
        if (returnFocus instanceof HTMLElement && returnFocus.isConnected) {
          returnFocus.focus({ preventScroll: true });
        }
        returnFocus = null;
      });
    }
    document.querySelectorAll('[data-bitrix-id]').forEach((host) => {
      host.tabIndex = -1;
      // Keep the same form behind our confirmation. The provider owns its
      // post-submit action (including redirect); never invent a reset or resend.
      host.addEventListener('submit', (event) => {
        const record = records.get(host.dataset.bitrixId);
        if (!record) return;
        if (record.delivered) {
          event.preventDefault();
          event.stopImmediatePropagation();
          showSuccess(record);
          return;
        }
        record.trigger = document.activeElement;
        if (!record.awaitingResult) record.confirmed = false;
        record.awaitingResult = true;
      }, true);
      // The two vendor forms currently reuse several input IDs. Keep the
      // vendor IDs intact, but make labels/focus local to their own form.
      host.addEventListener('click', (event) => {
        const label = event.target.closest?.('label[for]');
        if (!label || !host.contains(label)) return;
        const field = [...host.querySelectorAll('input, textarea, select')]
          .find((item) => item.id === label.htmlFor);
        if (field && field !== label.control) {
          event.preventDefault();
          field.focus();
        }
      });
      // Observe rendered vendor content; init alone does not mean usable inputs.
      const check = () => {
        if (!host.querySelector('.b24-form-wrapper form, .b24-form form, iframe')) return false;
        const fields = [...host.querySelectorAll('input, textarea, select')];
        host.querySelectorAll('label[for]').forEach((label) => {
          const field = fields.find((item) => item.id === label.htmlFor);
          if (field) field.setAttribute('aria-label', label.textContent.replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim());
        });
        setLoadState(host, 'ready');
        return true;
      };
      const checkResult = (mutations = []) => {
        const record = records.get(host.dataset.bitrixId);
        if (!record) return;
        const success = host.querySelector('.b24-form-success');
        if (!success) return;
        // Read the vendor's inline v-show state, not computed visibility:
        // our CSS intentionally prevents its green result from being painted.
        const active = success.style.display !== 'none' && !success.hidden;
        const wasActive = mutations.some((mutation) => mutation.target === success
          && mutation.attributeName === 'style' && mutation.oldValue !== null
          && !/display\s*:\s*none/i.test(mutation.oldValue));
        if (record.awaitingResult && (active || wasActive)) confirmDelivery(record);
        record.delivered = record.confirmed && active;
        if (record.delivered) host.dataset.crmDelivered = 'true';
        else delete host.dataset.crmDelivered;
      };
      const observer = new MutationObserver((mutations) => {
        if (check()) window.clearTimeout(timer);
        checkResult(mutations);
      });
      const timer = window.setTimeout(() => {
        if (!check()) setLoadState(host, 'unavailable');
        // Keep observing so a late network response can recover automatically.
      }, 15000);
      observer.observe(host, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['style', 'hidden'], attributeOldValue: true });
      if (check()) window.clearTimeout(timer);
    });
    pendingSuccess.splice(0).forEach(showSuccess);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
