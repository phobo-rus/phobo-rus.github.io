(() => {
  'use strict';

  const start = () => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    const root = document.documentElement;

    const announceEvent = (event, location, extra = {}) => {
      // Local integration hook only: no network, storage, or personal data.
      document.dispatchEvent(new CustomEvent('phobo:analytics', {
        bubbles: true,
        detail: { event, location, ...extra },
      }));
    };

    root.classList.add('js-enabled');
    root.dataset.reducedMotion = String(motionPreference.matches);

    const menuToggle = document.querySelector('[data-menu-toggle]');
    const navigation = document.getElementById('site-nav');
    if (menuToggle && navigation) {
      const setMenu = (open, restoreFocus = false) => {
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
        navigation.classList.toggle('is-open', open);
        navigation.dataset.open = String(open);
        if (open) navigation.querySelector('a[href]')?.focus({ preventScroll: true });
        if (restoreFocus) menuToggle.focus({ preventScroll: true });
      };

      setMenu(false);
      menuToggle.addEventListener('click', () => {
        setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
      });
      document.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('a[href]')) setMenu(false);
      });
      document.addEventListener('pointerdown', (event) => {
        if (!navigation.contains(event.target) && !menuToggle.contains(event.target)) setMenu(false);
      });
      document.addEventListener('focusin', (event) => {
        if (menuToggle.getAttribute('aria-expanded') === 'true'
          && !navigation.contains(event.target) && !menuToggle.contains(event.target)) setMenu(false);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
          event.preventDefault();
          setMenu(false, true);
        }
      });
      window.addEventListener('resize', () => {
        if (!menuToggle.getClientRects().length) setMenu(false);
      }, { passive: true });
    }

    const heroVideo = document.getElementById('hero-video');
    const heroSection = heroVideo?.closest('.phobo-hero, .hero, section') || heroVideo?.parentElement;
    let sdkPromise = null;
    let heroPlayerPromise = null;
    let player = null;
    let videoWork = Promise.resolve();
    let videoRequested = false;
    let videoPlaying = false;
    let videoLoaded = false;
    let videoHasPlayed = false;
    let videoError = false;
    let autoplayBlocked = false;
    let autoplayReady = false;
    let heroInViewport = false;
    let dialogVideoOpen = false;

    // Keep the same iframe, media buffer, and playback position for this page.
    // Scrolling and the silent announcement do not interrupt the muted loop.
    const canPlayHeroVideo = () => !dialogVideoOpen
      && document.visibilityState !== 'hidden'
      && navigator.onLine !== false
      && !motionPreference.matches
      && !connection?.saveData;

    // Official IFrame API: docs.kinescope.com/player-docs/embedding/iframe-api/.
    const loadVideoApi = () => {
      if (window.Kinescope?.IframePlayer) return Promise.resolve(window.Kinescope.IframePlayer);
      if (sdkPromise) return sdkPromise;
      sdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const previousReady = window.onKinescopeIframeAPIReady;
        let settled = false;
        let timer;
        const finish = (factory, error) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          script.onerror = null;
          if (window.onKinescopeIframeAPIReady === onReady) {
            if (previousReady) window.onKinescopeIframeAPIReady = previousReady;
            else delete window.onKinescopeIframeAPIReady;
          }
          if (error) {
            script.remove();
            reject(error);
          } else {
            resolve(factory);
          }
        };
        const onReady = (factory) => {
          if (typeof previousReady === 'function') {
            try { previousReady(factory); } catch { /* Keep this independent player usable. */ }
          }
          if (typeof factory?.create === 'function') finish(factory);
          else finish(null, new Error('Video API unavailable'));
        };
        window.onKinescopeIframeAPIReady = onReady;
        script.src = 'https://player.kinescope.io/latest/iframe.player.js';
        script.async = true;
        script.onerror = () => finish(null, new Error('Video API could not load'));
        timer = window.setTimeout(() => finish(null, new Error('Video API timed out')), 8000);
        document.head.appendChild(script);
      });
      return sdkPromise;
    };

    const updateHeroState = () => {
      if (!heroVideo) return;
      heroVideo.dataset.playing = String(videoPlaying);
      heroVideo.dataset.loaded = String(videoLoaded);
      heroVideo.dataset.loading = String(videoRequested && !videoLoaded);
      // Retain the last frame during buffering and deliberate pauses, avoiding
      // a poster flash at each loop boundary or when a dialog closes.
      heroVideo.dataset.ready = String(videoHasPlayed && !videoError
        && !motionPreference.matches && !connection?.saveData);
    };

    const ensureHeroPlayer = async () => {
      if (heroPlayerPromise) return heroPlayerPromise;
      const factory = await loadVideoApi();
      if (!canPlayHeroVideo()) return null;
      if (heroPlayerPromise) return heroPlayerPromise;
      heroVideo.loading = 'eager';
      heroPlayerPromise = factory.create('hero-video', {
        url: 'https://kinescope.io/2a191b39-71d2-40d5-bdea-b805994ffaf8',
        timeout: 7000,
        behavior: {
          autoPlay: false,
          autoPause: false,
          muted: true,
          loop: true,
          playsInline: true,
          preload: 'auto',
          localStorage: false,
          keyboard: false,
        },
        ui: { controls: false, mainPlayButton: false },
      }).then((createdPlayer) => {
        player = createdPlayer;
        createdPlayer.on(createdPlayer.Events.Loaded, () => {
          videoLoaded = true;
          updateHeroState();
        });
        createdPlayer.on(createdPlayer.Events.Playing, () => {
          videoRequested = true;
          videoLoaded = true;
          videoHasPlayed = true;
          videoPlaying = true;
          videoError = false;
          autoplayBlocked = false;
          updateHeroState();
          if (!canPlayHeroVideo()) syncHeroVisibility();
        });
        createdPlayer.on(createdPlayer.Events.Waiting, () => {
          videoPlaying = false;
          updateHeroState();
        });
        createdPlayer.on(createdPlayer.Events.Pause, () => {
          videoRequested = false;
          videoPlaying = false;
          updateHeroState();
        });
        createdPlayer.on(createdPlayer.Events.Error, () => {
          videoRequested = false;
          videoPlaying = false;
          videoError = true;
          updateHeroState();
        });
        return createdPlayer;
      });
      return heroPlayerPromise;
    };

    const syncHeroVisibility = () => {
      if (!heroVideo) return;
      // Serialize play/pause, and recheck current conditions after asynchronous
      // creation. No visibility, pause, buffer, or loop event destroys the player.
      videoWork = videoWork.catch(() => {}).then(async () => {
        if (!canPlayHeroVideo()) {
          if (player && videoRequested) {
            videoRequested = false;
            videoPlaying = false;
            try { await player.pause(); } catch { /* Keep the existing player. */ }
          }
          updateHeroState();
          return;
        }
        if (!autoplayReady || autoplayBlocked || videoError || videoRequested) return;
        if (!heroPlayerPromise && !heroInViewport) return;
        try {
          const currentPlayer = await ensureHeroPlayer();
          if (!currentPlayer) return;
          if (!canPlayHeroVideo()) {
            await currentPlayer.pause();
            return;
          }
          videoRequested = true;
          updateHeroState();
          try {
            await currentPlayer.play();
          } catch {
            // Respect the browser's autoplay decision. A later real gesture may
            // retry play on this same instance; it never reloads the iframe.
            videoRequested = false;
            videoPlaying = false;
            autoplayBlocked = true;
            updateHeroState();
          }
        } catch {
          videoRequested = false;
          videoPlaying = false;
          videoError = true;
          updateHeroState();
        }
      });
    };

    if (heroVideo) {
      updateHeroState();
      const readHeroVisibility = () => {
        const bounds = heroSection.getBoundingClientRect();
        heroInViewport = bounds.bottom > 0 && bounds.top < window.innerHeight;
      };
      readHeroVisibility();
      if ('IntersectionObserver' in window) {
        const visibilityObserver = new IntersectionObserver(([entry]) => {
          heroInViewport = entry.isIntersecting;
          syncHeroVisibility();
        }, { threshold: 0 });
        visibilityObserver.observe(heroSection);
      } else {
        let visibilityFrame = null;
        const scheduleVisibilityCheck = () => {
          if (visibilityFrame !== null) return;
          visibilityFrame = window.requestAnimationFrame(() => {
            visibilityFrame = null;
            readHeroVisibility();
            syncHeroVisibility();
          });
        };
        window.addEventListener('scroll', scheduleVisibilityCheck, { passive: true });
        window.addEventListener('resize', scheduleVisibilityCheck, { passive: true });
      }
      const readyForAutoplay = () => {
        autoplayReady = true;
        syncHeroVisibility();
      };
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(readyForAutoplay, { timeout: 2200 });
      } else {
        window.setTimeout(readyForAutoplay, 900);
      }
      const retryAfterGesture = () => {
        if (!autoplayBlocked || !canPlayHeroVideo()) return;
        autoplayBlocked = false;
        syncHeroVisibility();
      };
      document.addEventListener('pointerdown', retryAfterGesture, { passive: true });
      document.addEventListener('keydown', retryAfterGesture);
      document.addEventListener('visibilitychange', syncHeroVisibility);
      connection?.addEventListener?.('change', syncHeroVisibility);
      window.addEventListener('offline', syncHeroVisibility);
      window.addEventListener('online', syncHeroVisibility);
      window.addEventListener('pageshow', syncHeroVisibility);
    }

    const updateMotionPreference = () => {
      root.dataset.reducedMotion = String(motionPreference.matches);
      syncHeroVisibility();
    };
    if (motionPreference.addEventListener) {
      motionPreference.addEventListener('change', updateMotionPreference);
    } else if (motionPreference.addListener) {
      motionPreference.addListener(updateMotionPreference);
    }
    const setupTabs = ({ groupSelector, buttonSelector, panelId, onChange }) => {
      const group = document.querySelector(groupSelector);
      if (!group) return null;
      const tabs = [...group.querySelectorAll(buttonSelector)]
        .map((button) => ({ button, panel: document.getElementById(panelId(button)) }))
        .filter(({ panel }) => panel);
      if (!tabs.length) return null;

      let activeIndex = Math.max(0, tabs.findIndex(({ button }) => button.getAttribute('aria-selected') === 'true'));
      group.setAttribute('role', 'tablist');

      const select = (index, focus = false) => {
        activeIndex = ((index % tabs.length) + tabs.length) % tabs.length;
        tabs.forEach(({ button, panel }, itemIndex) => {
          const active = itemIndex === activeIndex;
          button.setAttribute('role', 'tab');
          button.setAttribute('aria-selected', String(active));
          button.setAttribute('aria-controls', panel.id);
          button.tabIndex = active ? 0 : -1;
          button.classList.toggle('is-active', active);
          panel.setAttribute('role', 'tabpanel');
          if (button.id) panel.setAttribute('aria-labelledby', button.id);
          panel.hidden = !active;
          panel.classList.toggle('is-active', active);
        });
        onChange?.(activeIndex, tabs.length);
        if (focus) tabs[activeIndex].button.focus({ preventScroll: true });
      };

      tabs.forEach(({ button }, index) => {
        button.addEventListener('click', () => select(index));
        button.addEventListener('keydown', (event) => {
          const nextIndex = {
            ArrowRight: index + 1,
            ArrowLeft: index - 1,
            Home: 0,
            End: tabs.length - 1,
          }[event.key];
          if (nextIndex === undefined) return;
          event.preventDefault();
          select(nextIndex, true);
        });
      });
      select(activeIndex);
      return { next: () => select(activeIndex + 1), previous: () => select(activeIndex - 1) };
    };

    setupTabs({
      groupSelector: '[data-format-tabs]',
      buttonSelector: '[data-format]',
      panelId: (button) => `format-${button.dataset.format}`,
    });

    const steps = setupTabs({
      groupSelector: '[data-step-tabs]',
      buttonSelector: '[data-step]',
      panelId: (button) => `step-${button.dataset.step}`,
      onChange: (index, total) => {
        const counter = document.getElementById('step-counter');
        if (counter) counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
      },
    });
    document.querySelector('[data-step-prev]')?.addEventListener('click', () => steps?.previous());
    document.querySelector('[data-step-next]')?.addEventListener('click', () => steps?.next());

    document.querySelectorAll('a[data-application]').forEach((link) => {
      link.addEventListener('click', () => {
        announceEvent('application_click', link.dataset.location || 'page');
      });
    });
    // CRM widgets own validation and delivery. Integration lives in crm-forms.js.
    const partnerDialog = document.getElementById('partner-dialog');
    if (typeof HTMLDialogElement !== 'undefined' && partnerDialog instanceof HTMLDialogElement) {
      let opener = null;
      const media = partnerDialog.querySelector('.dialog-media');
      const closeDialog = () => {
        if (partnerDialog.open) partnerDialog.close();
      };

      document.querySelectorAll('[data-open-partner-video], [data-video-src]').forEach((button) => {
        button.addEventListener('click', (event) => {
          if (!media || partnerDialog.open) return;
          let source;
          try {
            source = new URL(button.dataset.videoSrc || 'https://kinescope.io/embed/b30e38d6-19d8-4e69-9515-fe16361f7f94');
          } catch { return; }
          if (source.protocol !== 'https:' || source.hostname !== 'kinescope.io'
            || !/^\/embed\/[\w-]+\/?$/.test(source.pathname)) return;
          event.preventDefault();
          opener = button;
          const video = document.createElement('iframe');
          video.src = source.href;
          video.title = button.dataset.videoTitle || 'Видео партнёра PhoBo';
          video.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
          video.allowFullscreen = true;
          video.referrerPolicy = 'strict-origin-when-cross-origin';
          const heading = document.getElementById(partnerDialog.getAttribute('aria-labelledby'));
          if (heading) heading.textContent = video.title;
          media.replaceChildren(video);
          dialogVideoOpen = true;
          syncHeroVisibility();
          partnerDialog.showModal();
          partnerDialog.querySelector('[data-close-dialog]')?.focus({ preventScroll: true });
        });
      });
      partnerDialog.querySelectorAll('[data-close-dialog]').forEach((button) => {
        button.addEventListener('click', closeDialog);
      });
      partnerDialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        closeDialog();
      });
      partnerDialog.addEventListener('click', (event) => {
        if (event.target !== partnerDialog) return;
        const bounds = partnerDialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
      });
      partnerDialog.addEventListener('close', () => {
        media?.replaceChildren();
        dialogVideoOpen = false;
        syncHeroVisibility();
        if (opener?.isConnected) opener.focus({ preventScroll: true });
        opener = null;
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
