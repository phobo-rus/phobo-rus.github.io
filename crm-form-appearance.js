/* Present the native Bitrix fields in the approved PhoBo layout.
   Values, validation, consent state and submission remain owned by Bitrix24. */
(() => {
  'use strict';
  const definitions = [
    { key: 'name', selector: '.b24-form-field-name', label: 'Ваше имя', placeholder: 'Как к вам обращаться?' },
    { key: 'phone', selector: '.b24-form-field-phone', label: 'Телефон', placeholder: '+7 999 000-00-00' },
    { key: 'city', selector: '.b24-form-field-string', label: 'Город открытия', placeholder: 'Где хотите открыть PhoBo?' },
    { key: 'email', selector: '.b24-form-field-email', label: 'Почта', placeholder: 'Ваш адрес электронной почты' },
    { key: 'comment', selector: '.b24-form-field-text', label: 'Оставить комментарий', placeholder: 'Что хотите уточнить?' },
  ];

  const styleHost = (host) => {
    const fields = new Map();
    definitions.forEach(({ key, selector, label: text, placeholder }) => {
      const field = host.querySelector(selector);
      const control = field?.querySelector('input:not([type="hidden"]), textarea');
      if (!field || !control) return;
      fields.set(key, field);
      field.classList.add('crm-appearance-field', `crm-appearance-${key}`);
      if (control.getAttribute('placeholder') !== placeholder) control.setAttribute('placeholder', placeholder);
      if (control.getAttribute('aria-label') !== text) control.setAttribute('aria-label', text);
      if (control.tagName === 'TEXTAREA' && control.rows !== 1) control.rows = 1;
      const label = field.querySelector('label[for]');
      if (label && label.textContent.replace(/\s*\*\s*$/, '').trim() !== text) {
        const required = label.querySelector('.b24-form-control-required');
        label.replaceChildren(document.createTextNode(text), ...(required ? [required] : []));
      }
    });
    const group = fields.get('name')?.parentElement;
    if (group && fields.get('phone')?.parentElement === group) group.classList.add('crm-appearance-fields');
    const city = fields.get('city');
    const email = fields.get('email');
    if (host.dataset.bitrixId === '69' && city && email && city.parentElement === email.parentElement && city.nextElementSibling !== email) {
      city.parentElement.insertBefore(email, city.nextSibling);
    }

    host.querySelectorAll('.b24-form-field-agreement .b24-form-control-desc').forEach((description) => {
      if (description.querySelector('[data-phobo-consent-link]')) return;
      const link = document.createElement('a');
      link.href = '/consent/';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.dataset.phoboConsentLink = '';
      link.textContent = 'согласие на обработку персональных данных';
      // This is a document link within the native checkbox label. Its click
      // must not trigger a vendor popup or change the checkbox's state.
      link.addEventListener('click', (event) => event.stopPropagation());
      description.replaceChildren(document.createTextNode('Я даю '), link, document.createTextNode('.'));
    });
  };

  const start = () => {
    document.querySelectorAll('.crm-form-host[data-bitrix-id="67"], .crm-form-host[data-bitrix-id="69"]').forEach((host) => {
      let scheduled = false;
      const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(() => { scheduled = false; styleHost(host); });
      });
      observer.observe(host, { childList: true, subtree: true });
      styleHost(host);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
