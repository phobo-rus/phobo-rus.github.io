(function () {
  'use strict';

  // Generated into the page from the single source in content/restaurants.json.
  const restaurants = JSON.parse(document.getElementById('phobo-restaurant-data')?.textContent || '[]');

  /*
  Уличная карта появляется при увеличении.
  Ключи Google Maps и Яндекс Карт не нужны.
  */
  const streetTiles =
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  const countries = [
    ['ru', 'Россия'],
    ['ae', 'ОАЭ'],
    ['am', 'Армения'],
    ['ge', 'Грузия'],
    ['az', 'Азербайджан'],
    ['kg', 'Кыргызстан'],
    ['ab', 'Абхазия'],
    ['vn', 'Вьетнам']
  ];

  function init() {
    const root = document.getElementById('network');

    if (!root || root.dataset.ready) return;
    root.dataset.ready = 'true';

    const $ = selector => root.querySelector(selector);

    const filters = $('.pn-filters');
    const note = $('.pn-note');
    const status = $('.pn-map-status');
    const loading = $('.pn-loading');
    const retry = $('.pn-retry');
    const reset = $('.pn-reset');

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    let map;
    let clusters;
    let observer;
    let selected = 'all';
    let busy = false;

    const css = () => getComputedStyle(root);

    const valid = restaurants.filter(restaurant =>
      countries.some(country =>
        country[0] === restaurant.country
      ) &&
      restaurant.address &&
      Number.isFinite(restaurant.lat) &&
      Number.isFinite(restaurant.lng) &&
      Math.abs(restaurant.lat) < 85.05 &&
      Math.abs(restaurant.lng) <= 180
    );

    const buttons = [
      ['all', 'Вся сеть'],
      ...countries
    ].map(([id, label]) => {
      const button = document.createElement('button');

      button.type = 'button';
      button.className = 'pn-button';
      button.textContent = label;
      const count = document.createElement('span');
      count.className = 'pn-button-count';
      const countValue = id === 'all' ? valid.length : valid.filter(item => item.country === id).length;
      count.textContent = countValue;
      button.setAttribute('aria-label', label + ', точек: ' + countValue);
      button.appendChild(count);
      button.dataset.country = id;
      button.disabled = true;

      button.setAttribute(
        'aria-pressed',
        String(id === 'all')
      );

      button.onclick = () => {
        selected = id;
        render(id === 'all');
      };

      filters.appendChild(button);
      return button;
    });

    function popup(restaurant) {
      const box = document.createElement('div');
      box.className = 'pn-popup';

      const title = document.createElement('strong');
      title.textContent = restaurant.name || 'PhoBo · ' + restaurant.city;
      box.appendChild(title);

      [restaurant.address].forEach(text => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        box.appendChild(paragraph);
      });

      if (restaurant.status_label) {
        const statusLabel = document.createElement('p');
        statusLabel.className = 'pn-location-status';
        statusLabel.textContent = restaurant.status_label;
        box.appendChild(statusLabel);
      }
      const streetOnly = restaurant.location_precision === 'street';
      if (streetOnly) {
        const precision = document.createElement('p');
        precision.className = 'pn-location-note';
        precision.textContent = 'Метка показывает улицу, номер дома не указан.';
        box.appendChild(precision);
      }

      const link = document.createElement('a');
      link.textContent = 'Найти на Яндекс.Картах';
      link.href = 'https://yandex.ru/maps/?' + new URLSearchParams({text:streetOnly ? restaurant.address : (restaurant.name || 'PhoBo') + ' ' + restaurant.address,ll:restaurant.lng + ',' + restaurant.lat,z:streetOnly ? '14' : '16'});
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      box.appendChild(link);
      return box;
    }

    function render(showWorld) {
      clusters.clearLayers();
      map.closePopup();

      buttons.forEach(button => {
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.country === selected)
        );
      });

      const items = valid.filter(restaurant =>
        selected === 'all' ||
        restaurant.country === selected
      );

      const region = countries.find(country => country[0] === selected);
      if (status) {
        status.textContent = items.length + ' ' + (items.length === 1 ? 'адрес' : items.length > 1 && items.length < 5 ? 'адреса' : 'адресов') + ' · ' + (region ? region[1] : 'вся сеть');
      }
      if (note) {
        note.textContent = 'При увеличении открывается уличная карта. Нажмите на отметку, чтобы увидеть адрес.';
      }
      const markers = items.map(restaurant => {
        return L.marker(
          [restaurant.lat, restaurant.lng],
          {
            title: (restaurant.name || 'PhoBo') + ': ' + restaurant.address,
            alt: (restaurant.name || 'PhoBo') + ': ' + restaurant.address,

            icon: L.divIcon({
              className: 'pn-pin' + (restaurant.status_label ? ' pn-pin-preparing' : '') + (restaurant.location_precision === 'street' ? ' pn-pin-street' : ''),
              html: '<span></span>',
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            })
          }
        ).bindPopup(popup(restaurant));
      });

      clusters.addLayers(markers);

      if (showWorld || !items.length) {
        map.fitBounds(
          [[-52, -170], [78, 178]],
          {
            padding: [16, 16],
            animate: !reduced
          }
        );
      } else {
        map.fitBounds(
          items.map(restaurant => [
            restaurant.lat,
            restaurant.lng
          ]),
          {
            padding: [50, 50],
            maxZoom: 12,
            animate: !reduced
          }
        );
      }

      
    }

    const assets = new Map();

    function asset(url, isCSS) {
      if (assets.has(url)) return assets.get(url);

      const promise = new Promise((resolve, reject) => {
        const element = document.createElement(
          isCSS ? 'link' : 'script'
        );

        const timer = setTimeout(() => {
          element.remove();
          assets.delete(url);
          reject(new Error('Тайм-аут загрузки'));
        }, 20000);

        element.onload = () => {
          clearTimeout(timer);
          resolve();
        };

        element.onerror = () => {
          clearTimeout(timer);
          element.remove();
          assets.delete(url);
          reject(new Error('Не удалось загрузить ресурс'));
        };

        if (isCSS) {
          element.rel = 'stylesheet';
          element.href = url;
        } else {
          element.src = url;
          element.async = true;
        }

        document.head.appendChild(element);
      });

      assets.set(url, promise);
      return promise;
    }

    async function start() {
      if (busy) return;

      busy = true;
      loading.hidden = false;
      retry.hidden = true;

      $('.pn-loading-text').textContent =
        'Загружаем карту…';

      try {
        await Promise.all([
          asset(
            'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
            true
          ),

          asset(
            'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
            true
          ),

          window.L
            ? Promise.resolve()
            : asset(
                'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'
              ),

          window.d3 && d3.geoMercator
            ? Promise.resolve()
            : asset(
                'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js'
              ),

          window.topojson
            ? Promise.resolve()
            : asset(
                'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js'
              )
        ]);

        if (!L.markerClusterGroup) {
          await asset(
            'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'
          );
        }

        const controller = new AbortController();

        const timer = setTimeout(
          () => controller.abort(),
          20000
        );

        let world;

        try {
          const response = await fetch(
            'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json',
            { signal: controller.signal }
          );

          if (!response.ok) {
            throw new Error('География недоступна');
          }

          world = await response.json();
        } finally {
          clearTimeout(timer);
        }

        map = L.map($('.pn-map'), {
          minZoom: 0,
          maxZoom: 19,
          scrollWheelZoom: false,
          zoomSnap: 0.25,
          zoomDelta: 1,
          zoomAnimation: !reduced,

          maxBounds: [
            [-85.05112878, -180],
            [85.05112878, 180]
          ],

          maxBoundsViscosity: 1
        }).setView([30, 45], 2);

        map.attributionControl.setPrefix(false);
        const zoomIn = $('.leaflet-control-zoom-in');
        const zoomOut = $('.leaflet-control-zoom-out');
        if (zoomIn) { zoomIn.title = 'Приблизить'; zoomIn.setAttribute('aria-label','Приблизить карту'); }
        if (zoomOut) { zoomOut.title = 'Отдалить'; zoomOut.setAttribute('aria-label','Отдалить карту'); }
        map.createPane('pn-world');
        map.getPane('pn-world').style.zIndex = '150';

        /*
        ИСПРАВЛЕНИЕ ГЕОМЕТРИИ КАРТЫ

        D3 корректно разрезает контуры на линии смены дат.
        Это устраняет горизонтальные линии через материки.
        */
        const size = 1024;

        const projection = d3.geoMercator()
          .scale(size / (2 * Math.PI))
          .translate([size / 2, size / 2])
          .clipExtent([[0, 0], [size, size]]);

        const land = topojson.feature(
          world,
          world.objects.land || world.objects.countries
        );

        const path = d3.geoPath(projection)(land);

        const namespace = 'http://www.w3.org/2000/svg';

        const svg = document.createElementNS(
          namespace,
          'svg'
        );

        svg.setAttribute('xmlns', namespace);
        svg.setAttribute('viewBox', '0 0 1024 1024');
        svg.setAttribute('preserveAspectRatio', 'none');

        const shape = document.createElementNS(
          namespace,
          'path'
        );

        shape.setAttribute('d', path);

        shape.setAttribute(
          'fill',
          css().getPropertyValue('--pn-land').trim()
        );

        shape.setAttribute('stroke', '#C6B89F');
        shape.setAttribute('stroke-width', '0.6');
        shape.setAttribute(
          'vector-effect',
          'non-scaling-stroke'
        );

        svg.appendChild(shape);

        const worldLayer = L.svgOverlay(
          svg,
          [
            [-85.05112878, -180],
            [85.05112878, 180]
          ],
          {
            interactive: false,
            className: 'pn-world-svg',
            pane: 'pn-world',

            attribution:
              '<a href="https://www.naturalearthdata.com/" ' +
              'target="_blank" rel="noopener">' +
              'Natural Earth</a>'
          }
        ).addTo(map);

        const streets = L.tileLayer(streetTiles, {
          minZoom: 7,
          maxZoom: 19,
          noWrap: true,

          referrerPolicy:
            'strict-origin-when-cross-origin',

          attribution:
            '&copy; <a ' +
            'href="https://www.openstreetmap.org/copyright" ' +
            'target="_blank" rel="noopener">' +
            'OpenStreetMap contributors</a>'
        });

        function basemap() {
          if (map.getZoom() >= 7) {
            if (!map.hasLayer(streets)) {
              streets.addTo(map);
            }

            // The world geometry remains behind street tiles as a fallback.
          } else {
            if (map.hasLayer(streets)) {
              map.removeLayer(streets);
            }

            if (!map.hasLayer(worldLayer)) {
              worldLayer.addTo(map);
            }
          }
        }

        map.on('zoomend', basemap);

        streets.on('tileerror', () => {
          if (!map.hasLayer(worldLayer)) worldLayer.addTo(map);
          worldLayer.bringToBack();
          if (note) {
            note.textContent =
              'Уличная карта временно недоступна. ' +
              'Отметки ресторанов сохранены; ' +
              'можно вернуться к общему виду ' +
              'фильтром «Вся сеть».';
          }
        });

        clusters = L.markerClusterGroup({
          maxClusterRadius: 40,
          showCoverageOnHover: false,
          animate: !reduced,
          spiderfyOnMaxZoom: true,
          zoomToBoundsOnClick: true,

          iconCreateFunction: group => {
            return L.divIcon({
              className: 'pn-cluster',
              html: String(group.getChildCount()),
              iconSize: [40, 40]
            });
          }
        }).addTo(map);

        render(true);
        basemap();

        buttons.forEach(button => {
          button.disabled = false;
        });

        if (reset) {
          reset.disabled = false;
          reset.onclick = () => {
            selected = 'all';
            render(true);
          };
        }

        loading.hidden = true;

        if (window.ResizeObserver) {
          observer = new ResizeObserver(() => {
            if (map) {
              map.invalidateSize({ pan: false });
            }
          });

          observer.observe($('.pn-map'));
        }

      } catch (error) {
        console.warn('PhoBo map failed to initialise:', error);
        if (observer) {
          observer.disconnect();
        }

        if (map) {
          map.remove();
          map = null;
        }

        buttons.forEach(button => {
          button.disabled = true;
        });

        if (reset) reset.disabled = true;

        $('.pn-loading-text').textContent =
          'Карта не загрузилась. ' +
          'Проверьте соединение и повторите попытку.';

        retry.hidden = false;

      } finally {
        busy = false;
      }
    }

    retry.onclick = start;
    start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      { once: true }
    );
  } else {
    init();
  }
})();

(function () {
  'use strict';
  function initDirectory() {
    const root = document.querySelector('.restaurant-directory');
    if (!root || root.dataset.ready) return;
    root.dataset.ready = 'true';
    const input = root.querySelector('[data-restaurant-search]');
    const select = root.querySelector('[data-restaurant-country]');
    if (!input || !select) return;
    const items = Array.from(root.querySelectorAll('[data-restaurant-item]'));
    const normalize = value => value.toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
    function filter() {
      const query = normalize(input.value);
      let count = 0;
      items.forEach(item => {item.hidden = !(select.value === 'all' || item.dataset.country === select.value) || !normalize(item.dataset.search).includes(query); if (!item.hidden) count++;});
      root.querySelectorAll('.rd-city').forEach(group => {group.hidden = !group.querySelector('[data-restaurant-item]:not([hidden])');});
      root.querySelectorAll('.rd-country').forEach(group => {group.hidden = !group.querySelector('[data-restaurant-item]:not([hidden])');});
      root.querySelector('[data-restaurant-count]').textContent = 'Найдено точек: ' + count;
      root.querySelector('.rd-empty').hidden = count > 0;
    }
    input.addEventListener('input', filter);
    select.addEventListener('change', filter);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',initDirectory,{once:true}); else initDirectory();
})();
