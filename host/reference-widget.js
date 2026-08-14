/* ============================================================================
 * reference-widget.js — ОБРАЗЦОВАЯ ЗАГЛУШКА, НЕ РЕШЕНИЕ ЗАДАНИЯ.
 *
 * Зачем этот файл:
 *   1. Показывает контракт интеграции, которому должен следовать ваш виджет:
 *      авто-монтирование в асинхронно появляющийся слот, идемпотентный mount,
 *      честный unmount без утечек (счётчики в панели диагностики остаются
 *      зелёными после «стресс-теста ×5» — ваш виджет тоже должен так уметь).
 *   2. НАМЕРЕННО не решает проблемы окружения. Откройте
 *      host-page.html, поводите курсором по серому полю, переключите масштаб
 *      полотна на 80% и 125%, посверните боковую панель — и посмотрите,
 *      что происходит с перекрестием, подсказкой и размером холста.
 *
 * Этот файл — часть окружения. Не копируйте его в решение и не правьте:
 * ========================================================================== */
(function () {
  'use strict';

  var SLOT_SELECTOR = '[data-widget="pokemap"]';
  var MOUNTED_FLAG = '__referenceWidgetMounted';

  /* ---------------------------------------------------------------------- */
  /* Экземпляр виджета                                                       */
  /* ---------------------------------------------------------------------- */
  function createInstance(host, config) {
    var disposers = [];
    var world = { x: 0, y: 0 };
    var pointer = { x: -100, y: -100, inside: false };
    var drag = null;
    var rafId = 0;

    var root = document.createElement('div');
    root.style.position = 'relative';
    root.style.height = '420px';
    root.style.overflow = 'hidden';
    root.style.borderRadius = '4px';
    root.style.background = '#0f1522';
    root.style.cursor = 'grab';

    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '420px';
    root.appendChild(canvas);

    var label = document.createElement('div');
    label.style.cssText =
      'position:absolute;left:10px;top:10px;color:#9fb4d6;font:12px/1.5 ui-monospace,monospace;' +
      'background:rgba(8,12,20,.72);padding:6px 8px;border-radius:4px;pointer-events:none;';
    root.appendChild(label);

    /* Подсказка через position:fixed — как её обычно и делают.
       Под transform у предка ведёт себя не так, как ожидается. */
    var tip = document.createElement('div');
    tip.style.cssText =
      'position:fixed;z-index:50;background:#2b6cf6;color:#fff;padding:4px 8px;border-radius:4px;' +
      'font:12px/1.4 -apple-system,sans-serif;pointer-events:none;display:none;';
    document.body.appendChild(tip);

    host.appendChild(root);

    var ctx = canvas.getContext('2d');

    /* Наивная синхронизация размера холста: один раз, без DPR и без
       наблюдения за контейнером. */
    function syncCanvasSize() {
      canvas.width = root.clientWidth;
      canvas.height = 420;
    }
    syncCanvasSize();

    /* Наивный перевод координат указателя: разница clientX и rect.left.
       rect отдаёт размеры в экранных пикселях, холст рисует в своих. */
    function toLocal(ev) {
      var rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    }

    function onMove(ev) {
      var p = toLocal(ev);
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.inside = true;
      if (drag) {
        world.x = drag.wx + (ev.clientX - drag.sx);
        world.y = drag.wy + (ev.clientY - drag.sy);
      }
      tip.style.display = 'block';
      tip.style.left = ev.clientX + 14 + 'px';
      tip.style.top = ev.clientY + 14 + 'px';
      tip.textContent = 'x:' + Math.round(p.x) + ' y:' + Math.round(p.y);
    }

    function onLeave() {
      pointer.inside = false;
      tip.style.display = 'none';
    }

    function onDown(ev) {
      drag = { sx: ev.clientX, sy: ev.clientY, wx: world.x, wy: world.y };
      root.style.cursor = 'grabbing';
    }

    function onUp() {
      drag = null;
      root.style.cursor = 'grab';
    }

    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);

    disposers.push(function () {
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    });

    function draw() {
      var w = canvas.width;
      var h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0f1522';
      ctx.fillRect(0, 0, w, h);

      var step = 40;
      ctx.strokeStyle = 'rgba(120,150,200,.18)';
      ctx.lineWidth = 1;
      var ox = ((world.x % step) + step) % step;
      var oy = ((world.y % step) + step) % step;
      for (var x = ox; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (var y = oy; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      if (pointer.inside) {
        ctx.strokeStyle = '#ff5f5f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 12, 0, Math.PI * 2);
        ctx.moveTo(pointer.x - 20, pointer.y);
        ctx.lineTo(pointer.x + 20, pointer.y);
        ctx.moveTo(pointer.x, pointer.y - 20);
        ctx.lineTo(pointer.x, pointer.y + 20);
        ctx.stroke();
      }

      label.textContent =
        'reference-widget (заглушка)\n' +
        'холст: ' + w + '×' + h + '\n' +
        'смещение мира: ' + Math.round(world.x) + ', ' + Math.round(world.y) + '\n' +
        'красное перекрестие должно стоять точно под курсором';

      rafId = window.requestAnimationFrame(draw);
    }
    rafId = window.requestAnimationFrame(draw);

    if (config && typeof config.onEvent === 'function') {
      config.onEvent({ type: 'ready', widget: 'reference' });
    }

    return {
      host: host,
      destroy: function () {
        window.cancelAnimationFrame(rafId);
        disposers.forEach(function (fn) {
          fn();
        });
        disposers.length = 0;
        tip.remove();
        root.remove();
      }
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Публичный контракт                                                      */
  /* ---------------------------------------------------------------------- */
  var instances = new Map();

  var api = {
    version: '0.0.0-reference',

    mount: function (target, config) {
      var host = typeof target === 'string' ? document.querySelector(target) : target;
      if (!host) throw new Error('[reference-widget] mount: контейнер не найден');

      // Идемпотентность: повторный mount в тот же узел возвращает старый хэндл.
      if (host[MOUNTED_FLAG]) return host[MOUNTED_FLAG];

      var handle = { id: 'ref-' + Math.random().toString(36).slice(2, 8), host: host };
      var instance = createInstance(host, config || {});
      instances.set(handle, instance);
      host[MOUNTED_FLAG] = handle;
      return handle;
    },

    unmount: function (handle) {
      var instance = instances.get(handle);
      if (!instance) return;
      instance.destroy();
      instances.delete(handle);
      delete instance.host[MOUNTED_FLAG];
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Авто-монтирование: слот появляется асинхронно и может пересоздаваться    */
  /* ---------------------------------------------------------------------- */
  function scan() {
    var slots = document.querySelectorAll(SLOT_SELECTOR);
    Array.prototype.forEach.call(slots, function (slot) {
      if (!slot[MOUNTED_FLAG]) api.mount(slot);
    });

    // Слот, который вынесли из DOM, надо честно размонтировать.
    instances.forEach(function (instance, handle) {
      if (!document.contains(handle.host)) api.unmount(handle);
    });
  }

  var observer = new MutationObserver(scan);
  function startObserving() {
    observer.observe(document.body, { childList: true, subtree: true });
    scan();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserving, { once: true });
  } else {
    startObserving();
  }

  window.ReferenceWidget = api;
})();
