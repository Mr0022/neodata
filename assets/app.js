/* =========================================================
   نئودیتا — منطق صفحه‌ی اصلی
   صحنه‌ی بخش‌به‌بخش، پس‌زمینه‌ی شبکه‌ی داده و نمایش‌های تعاملی هر خدمت
   ========================================================= */
(function () {
  'use strict';

  const root = document.documentElement;
  // اگر اسکریپت دیر رسید و صفحه به حالت ساده برگشته بود، حالت صحنه دوباره فعال می‌شود
  root.classList.remove('no-js');
  root.classList.add('js');
  window.neodataReady = true;

  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** رقم لاتین به فارسی */
  const fa = (s) => String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const pad2 = (n) => fa(String(n).padStart(2, '0'));
  /** عدد با جداکننده و رقم فارسی: ۲٬۳۸۴ و ۱۸٫۴ */
  const faNum = (n, decimals = 0) =>
    n.toLocaleString('fa-IR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  /** مجموعه‌ای از setTimeoutها که با یک فراخوانی پاک می‌شوند */
  function timeline() {
    const ids = new Set();
    return {
      after(ms, fn) {
        const id = setTimeout(() => { ids.delete(id); fn(); }, ms);
        ids.add(id);
      },
      clear() { ids.forEach(clearTimeout); ids.clear(); },
    };
  }

  const stage  = $('#stage');
  const slides = $$('.slide', stage);
  const last   = slides.length - 1;

  // زمان‌بندی‌ها فقط یک جا تعریف شده‌اند: متغیرهای CSS روی :root
  const cssMs = (name) => parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;
  const OUT_MS      = cssMs('--out-ms');
  const OUT_STAGGER = cssMs('--out-stagger');
  const IN_DELAY    = cssMs('--in-delay');
  const STEP_LOCK   = reduceMotion ? 300 : IN_DELAY + 420;   // کمینه‌ی فاصله‌ی دو جابه‌جایی با چرخ ماوس

  slides.forEach((s) => {
    const anims = $$('.anim', s);
    // ترتیب ظهور و محو، همان ترتیب عنصرها در HTML است
    anims.forEach((el, i) => el.style.setProperty('--i', String(Math.min(i, 12))));
    s.dataset.outMs = String(OUT_MS + OUT_STAGGER * Math.min(Math.max(anims.length - 1, 0), 12) + 80);
    s.tabIndex = -1;
    s.inert = true;
    s.setAttribute('aria-hidden', 'true');
  });

  /* ---------------------------------------------------------
     ناوبری: نقطه‌ها، منو، شماره‌ی بخش، نوار پیشرفت
     --------------------------------------------------------- */

  const dotsNav   = $('#dots');
  const menuList  = $('#menuList');
  const menuBtn   = $('#menuBtn');
  const menuPanel = $('#menuPanel');
  const pager     = $('#pager');
  const prevBtn   = $('#prevBtn');
  const nextBtn   = $('#nextBtn');
  const bar       = $('#progressBar');
  const announcer = $('#announcer');
  const dotEls = [], menuEls = [];

  $('#pagerTotal').textContent = pad2(slides.length);

  slides.forEach((s, i) => {
    const label = s.dataset.title || s.id;

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.dataset.label = label;
    dot.setAttribute('aria-label', label);
    dot.addEventListener('click', () => show(i));
    dotsNav.appendChild(dot);
    dotEls.push(dot);

    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.dataset.num = pad2(i + 1);
    btn.addEventListener('click', () => { closeMenu(); show(i, { focus: true }); });
    li.appendChild(btn);
    menuList.appendChild(li);
    menuEls.push(btn);
  });

  const menuOpen = () => menuPanel.classList.contains('is-open');
  const behindMenu = [stage, dotsNav, pager];

  function openMenu() {
    menuPanel.classList.add('is-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    behindMenu.forEach((el) => { el.inert = true; });
    (menuEls[index] || menuEls[0]).focus({ preventScroll: true });
  }
  function closeMenu() {
    if (!menuOpen()) return;
    menuPanel.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    behindMenu.forEach((el) => { el.inert = false; });
  }
  menuBtn.addEventListener('click', () => (menuOpen() ? closeMenu() : openMenu()));
  menuPanel.addEventListener('click', (e) => { if (e.target === menuPanel) closeMenu(); });

  prevBtn.addEventListener('click', () => show(index - 1));
  nextBtn.addEventListener('click', () => show(index + 1));

  function updateChrome(announce) {
    const s = slides[index];
    dotEls.forEach((d, k) => d.classList.toggle('is-active', k === index));
    [dotEls, menuEls].forEach((list) => list.forEach((el, k) => {
      if (k === index) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    }));
    bar.style.width = ((index + 1) / slides.length) * 100 + '%';
    $('#pagerNum').textContent = pad2(index + 1);
    $('#pagerTitle').textContent = s.dataset.title || '';
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === last;
    if (announce) announcer.textContent = s.dataset.title || '';

    // نشانه‌ی آدرس با بخش جاری هم‌گام می‌شود (بدون شلوغ کردن تاریخچه)
    const id = index === 0 ? '' : s.id;
    if (location.hash.slice(1) !== id) {
      try {
        history.replaceState(null, '', location.pathname + location.search + (id ? '#' + id : ''));
      } catch (_) { /* روی file:// برخی مرورگرها اجازه نمی‌دهند */ }
    }
  }

  /* ---------------------------------------------------------
     صحنه: محو شدن بخش جاری و ظهور بخش بعدی

     پس‌زمینه ثابت می‌ماند و فقط محتوا عوض می‌شود. بخش قبلی کلاس
     is-leaving می‌گیرد تا انیمیشن محو شدنش تمام شود، بخش بعدی is-active.
     اگر وسط یک جابه‌جایی جابه‌جایی تازه‌ای برسد، همان لحظه اعمال می‌شود؛
     چون نام انیمیشن عوض می‌شود، مرورگر آن را از نو شروع می‌کند.
     --------------------------------------------------------- */

  let index = -1;
  let lastStepAt = -Infinity;
  const leaveTimers = new Map();
  const demos = {};
  const demo = (s, phase) => { const d = demos[s.id]; if (d && d[phase]) d[phase](); };

  /**
   * رفتن به بخش شماره‌ی next
   * opts.fromEdge: جابه‌جایی با اسکرول؛ بخش بلندی که از پایین وارد می‌شود از انتهایش شروع شود
   * opts.focus: فوکوس صفحه‌کلید به بخش تازه برود
   */
  function show(next, opts = {}) {
    next = Math.max(0, Math.min(last, next));
    if (next === index) return false;
    const first = index < 0;
    const dir = next > index ? 'next' : 'prev';
    const cur = slides[index];
    const nxt = slides[next];
    const focusWasIn = !!cur && cur.contains(document.activeElement);

    if (cur) {
      cur.classList.remove('is-active');
      cur.dataset.dir = dir;
      cur.classList.add('is-leaving');
      cur.inert = true;
      cur.setAttribute('aria-hidden', 'true');
      clearTimeout(leaveTimers.get(cur));
      leaveTimers.set(cur, setTimeout(() => cur.classList.remove('is-leaving'), Number(cur.dataset.outMs)));
      demo(cur, 'leave');
    }

    clearTimeout(leaveTimers.get(nxt));
    nxt.classList.remove('is-leaving');
    nxt.dataset.dir = dir;
    nxt.inert = false;
    nxt.removeAttribute('aria-hidden');
    nxt.scrollTop = opts.fromEdge && dir === 'prev' ? nxt.scrollHeight : 0;
    nxt.classList.add('is-active');

    index = next;
    lastStepAt = performance.now();
    updateChrome(!first);
    demo(nxt, 'enter');
    if (!first && net) net.kick(dir === 'next' ? 1 : -1);
    if (focusWasIn || opts.focus) nxt.focus({ preventScroll: true });
    return true;
  }

  const indexOf = (id) => slides.findIndex((s) => s.id === id);

  // دکمه‌ها و پیوندهای درون‌صفحه‌ای
  $$('[data-goto]').forEach((el) => el.addEventListener('click', (e) => {
    const i = indexOf(el.dataset.goto);
    if (i < 0) return;
    e.preventDefault();
    closeMenu();
    show(i);
  }));

  /** شماره‌ی بخشی که آدرس به آن اشاره می‌کند، وگرنه ۱- */
  const hashIndex = () => {
    let id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { id = location.hash.slice(1); }
    return id ? indexOf(id) : -1;
  };
  window.addEventListener('hashchange', () => { const i = hashIndex(); if (i >= 0) show(i); });

  /** آیا بخش (اگر محتوایش بلندتر از صفحه است) در این جهت جای اسکرول دارد؟ */
  const canScroll = (el, dir) =>
    dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 2 : el.scrollTop > 1;

  /* ---------------------------------------------------------
     چرخ ماوس و تاچ‌پد: هر حرکت = یک بخش

     دنباله‌ی اینرسی تاچ‌پد بلعیده می‌شود تا یک حرکت چند بخش را رد نکند.
     اگر محتوای بخش بلندتر از صفحه باشد، اول خودِ بخش اسکرول می‌شود و
     جابه‌جایی فقط با حرکت تازه‌ای پس از رسیدن به لبه انجام می‌شود.
     --------------------------------------------------------- */

  const WHEEL_MIN  = 40;    // کمینه‌ی چرخش برای یک بخش
  const WHEEL_GAP  = 160;   // سکوتی که حرکت تازه شمرده می‌شود
  const WHEEL_TAIL = 900;   // بیشینه‌ی مهار دنباله‌ی اینرسی پس از پایان قفل
  const WHEEL_DUST = 12;    // پس از مهلت مهار، حرکت‌های کوچک‌تر از این خرده‌ی اینرسی‌اند

  let wheelSum = 0, wheelAt = 0, wheelPrev = 0, tailing = false, innerGesture = false;

  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey || menuOpen()) return;                       // بزرگ‌نمایی یا منوی باز
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
    if (Math.abs(e.deltaX) > Math.abs(dy) || Math.abs(dy) < 1) return;
    const dir = dy > 0 ? 1 : -1;
    const now = performance.now();
    const gap = now - wheelAt;
    const abs = Math.abs(dy);
    wheelAt = now;
    if (gap > WHEEL_GAP) { wheelSum = 0; tailing = false; innerGesture = false; }

    const s = slides[index];
    if (canScroll(s, dir)) {
      innerGesture = true;
      wheelPrev = abs;
      // نشانگر روی هدر یا دکمه‌های ثابت است: اسکرول را خودمان به بخش می‌رسانیم
      if (!s.contains(e.target)) { e.preventDefault(); s.scrollTop += dy; }
      return;
    }
    e.preventDefault();
    if (innerGesture || now - lastStepAt < STEP_LOCK) { wheelPrev = abs; return; }

    if (tailing) {
      // دنباله‌ی اینرسی رو به کاهش است و نادیده گرفته می‌شود، مگر اینکه دوباره اوج بگیرد
      // (حرکت تازه)، ضربه‌ی مستقل چرخ ماوس برسد، یا مهلت مهار تمام شده و حرکت هنوز
      // جان دارد (چرخاندن پیوسته). خرده‌های پایانی اینرسی پس از مهلت هم شمرده نمی‌شوند.
      const accelerating = abs > wheelPrev * 1.2 + 1;
      const notch = gap > 90 && abs >= 50;
      const expired = now - lastStepAt > STEP_LOCK + WHEEL_TAIL && abs >= WHEEL_DUST;
      if (accelerating || notch || expired) tailing = false;
      else { wheelPrev = abs; return; }
    }
    wheelPrev = abs;

    wheelSum += dy;
    if (Math.abs(wheelSum) < WHEEL_MIN) return;
    wheelSum = 0;
    if (show(index + dir, { fromEdge: true })) tailing = true;
  }, { passive: false });

  /* ---------------------------------------------------------
     لمس: کشیدن انگشت به بالا یا پایین = یک بخش

     اگر بخش جای اسکرول دارد، مرورگر خودش آن را اسکرول می‌کند؛ جابه‌جایی
     فقط وقتی انجام می‌شود که کشش از لبه‌ی بالا یا پایین بخش شروع شده باشد.
     --------------------------------------------------------- */

  let touch = null;

  window.addEventListener('touchstart', (e) => {
    if (menuOpen() || e.touches.length > 1) { touch = null; return; }
    const t = e.touches[0];
    const s = slides[index];
    touch = {
      x: t.clientX, y: t.clientY, at: performance.now(),
      atTop: !canScroll(s, -1), atBottom: !canScroll(s, 1),
    };
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (!touch) return;
    const start = touch;
    touch = null;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dy) < Math.abs(dx) * 1.3) return;            // حرکت افقی
    const dt = Math.max(1, performance.now() - start.at);
    const far   = Math.abs(dy) > Math.min(110, window.innerHeight * 0.14);
    const flick = Math.abs(dy) > 30 && Math.abs(dy) / dt > 0.4;
    if (!far && !flick) return;
    if (performance.now() - lastStepAt < 350) return;
    if (dy < 0 && start.atBottom) show(index + 1, { fromEdge: true });
    else if (dy > 0 && start.atTop) show(index - 1, { fromEdge: true });
  }, { passive: true });

  window.addEventListener('touchcancel', () => { touch = null; }, { passive: true });

  /* ---------------------------------------------------------
     صفحه‌کلید
     --------------------------------------------------------- */

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen()) { closeMenu(); menuBtn.focus(); return; }
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || menuOpen()) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;

    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      show(e.key === 'Home' ? 0 : last);
      return;
    }
    let dir = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (e.key === ' ') {
      if (e.target.closest && e.target.closest('button, a, summary')) return;   // فاصله = فعال‌کردن دکمه
      dir = e.shiftKey ? -1 : 1;
    }
    if (!dir) return;
    e.preventDefault();

    const s = slides[index];
    if (canScroll(s, dir)) {
      const step = e.key.startsWith('Arrow') ? 80 : s.clientHeight * 0.85;
      s.scrollBy({ top: dir * step, behavior: reduceMotion ? 'auto' : 'smooth' });
      return;
    }
    if (e.repeat || performance.now() - lastStepAt < 400) return;   // نگه‌داشتن کلید بخش‌ها را رد نکند
    show(index + dir, { fromEdge: true });
  });

  /* ---------------------------------------------------------
     پس‌زمینه: شبکه‌ی نقطه‌های داده

     رنگ پس‌زمینه ثابت است؛ با هر جابه‌جایی فقط نقطه‌ها کمی در جهت
     اسکرول جریان می‌گیرند تا حس حرکت در دل داده‌ها ساخته شود.
     --------------------------------------------------------- */

  const net = (function () {
    const canvas = $('#net');
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx) return null;

    const LINK = 150;                          // بیشینه‌ی فاصله‌ی دو نقطه‌ی متصل
    const MOUSE_LINK = 190;
    let w = 0, h = 0, pts = [], raf = 0, flow = 0;
    // رنگ‌ها از متغیرهای CSS پوسته‌ی جاری خوانده می‌شوند (--net-a و …)
    let colA = '', colB = '', colLine = '', nodeAlpha = 0, lineAlpha = 0;
    function readColors() {
      const cs = getComputedStyle(root);
      const v = (name) => cs.getPropertyValue(name).trim();
      colA = v('--net-a'); colB = v('--net-b'); colLine = v('--net-line');
      nodeAlpha = parseFloat(v('--net-alpha')) || 0.6;
      lineAlpha = parseFloat(v('--net-line-alpha')) || 0.15;
    }
    const mouse = { x: -1e4, y: -1e4 };

    const make = () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 1.3 + 0.7,
      z: Math.random() * 0.7 + 0.3,            // عمق: نقطه‌های نزدیک‌تر تندتر جریان می‌گیرند
      violet: Math.random() < 0.3,
    });

    function resize() {
      const nw = window.innerWidth, nh = window.innerHeight;
      // نقطه‌های موجود با نسبت ابعاد تازه جابه‌جا می‌شوند تا پراکنده بمانند
      if (w && h) pts.forEach((p) => { p.x *= nw / w; p.y *= nh / h; });
      w = nw; h = nh;
      const dpr = Math.min(window.devicePixelRatio || 1, w * h > 2e6 ? 1.25 : 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(Math.min(90, Math.max(26, (w * h) / 15000)));
      while (pts.length < target) pts.push(make());
      pts.length = target;
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy - flow * p.z;
        if (p.x < -20) p.x += w + 40; else if (p.x > w + 20) p.x -= w + 40;
        if (p.y < -20) p.y += h + 40; else if (p.y > h + 20) p.y -= h + 40;
      }
      flow *= 0.93;
      if (Math.abs(flow) < 0.01) flow = 0;

      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          ctx.strokeStyle = `rgba(${colLine}, ${((1 - Math.sqrt(d2) / LINK) * lineAlpha).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        const mx = a.x - mouse.x, my = a.y - mouse.y;
        const md2 = mx * mx + my * my;
        if (md2 < MOUSE_LINK * MOUSE_LINK) {
          ctx.strokeStyle = `rgba(${colA}, ${((1 - Math.sqrt(md2) / MOUSE_LINK) * lineAlpha * 1.8).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      for (const p of pts) {
        ctx.fillStyle = `rgba(${p.violet ? colB : colA}, ${nodeAlpha})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }

    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    const start = () => { if (!raf && !reduceMotion) raf = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    readColors();
    resize();
    draw();
    start();

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { resize(); draw(); }, 120);
    });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mouse.x = e.clientX; mouse.y = e.clientY;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });

    return {
      kick(dir) { if (!reduceMotion) flow += dir * 9; },
      recolor() { readColors(); draw(); },
    };
  })();

  /* ---------------------------------------------------------
     پوسته‌ی روشن / تیره

     روشن پیش‌فرض است. اسکریپت درون <head> انتخاب قبلی را پیش از نخستین
     رنگ‌آمیزی اعمال می‌کند؛ اینجا فقط دکمه، رنگ نوار مرورگر و رنگ‌های بوم
     با پوسته هم‌گام می‌شوند.
     --------------------------------------------------------- */

  const themeBtn = $('#themeBtn');
  const themeMeta = $('meta[name="theme-color"]');

  function applyTheme(theme, remember) {
    root.setAttribute('data-theme', theme);
    themeBtn.setAttribute('aria-label', theme === 'dark' ? 'تغییر به پوسته‌ی روشن' : 'تغییر به پوسته‌ی تیره');
    if (themeMeta) themeMeta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
    if (remember) {
      try { localStorage.setItem('neodata-theme', theme); } catch (_) { /* حالت خصوصی */ }
    }
    if (net) net.recolor();
  }
  applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', false);
  themeBtn.addEventListener('click', () =>
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true));

  /* ---------------------------------------------------------
     خانه: واژه‌ی چرخان عنوان
     --------------------------------------------------------- */

  demos.hero = (function () {
    const rotator = $('#rotator');
    const words = $$('span', rotator);
    const ROT_OUT = cssMs('--rot-out');
    const ROT_RESIZE = cssMs('--rot-resize');
    const T = timeline();
    let i = 0, timer = 0;

    // روی گوشی واژه سطر خودش را دارد (display: grid) و پهنای قاب اهمیتی ندارد
    const inline = () => getComputedStyle(rotator).display !== 'grid';
    const widthOf = (k) => words[k].offsetWidth;
    // پهنای قاب همان پهنای واژه‌ی جاری است تا میان واژه و بقیه‌ی عنوان فاصله نیفتد
    const fit = () => { rotator.style.width = inline() ? widthOf(i) + 'px' : ''; };
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    window.addEventListener('resize', fit);

    /* سه مرحله‌ی پشت‌سرهم، تا هیچ‌گاه دو واژه با هم دیده نشوند و واژه‌ی پیدا از قابش
       پهن‌تر نباشد (وگرنه روی «را به» یا «تبدیل کنید» می‌افتاد) */
    const tick = () => {
      const prev = words[i];
      const next = (i + 1) % words.length;
      const grows = inline() && widthOf(next) > widthOf(i);
      i = next;
      prev.classList.remove('is-on');
      prev.classList.add('is-out');                              // ۱) محو کامل واژه‌ی قبلی
      T.after(ROT_OUT, () => {
        prev.classList.remove('is-out');
        fit();                                                   // ۲) قاب به پهنای واژه‌ی تازه
        // قاب بزرگ می‌شود: واژه پس از باز شدن کامل قاب می‌آید؛ کوچک می‌شود: همان لحظه،
        // چون واژه‌ی تازه از قابِ در حال جمع‌شدن باریک‌تر است
        T.after(grows ? ROT_RESIZE : 0, () => words[i].classList.add('is-on'));   // ۳) ظهور
      });
    };

    /** حالت پایدار: فقط واژه‌ی جاری پیداست (پس از قطع شدن یک چرخش در میانه) */
    const settle = () => {
      words.forEach((w, k) => { w.classList.remove('is-out'); w.classList.toggle('is-on', k === i); });
      fit();
    };

    return {
      enter() {
        clearInterval(timer); T.clear(); settle();
        if (!reduceMotion) timer = setInterval(tick, 2800);
      },
      leave() { clearInterval(timer); T.clear(); },
    };
  })();

  /* ---------------------------------------------------------
     ۱ | داشبورد: شمارش شاخص‌ها و نمودار ستونی
     --------------------------------------------------------- */

  function buildChart(chart) {
    const values = chart.dataset.values.split(',').map(Number);
    const labels = chart.dataset.labels.split(',');
    const max = Number(chart.dataset.max);
    const unit = chart.dataset.unit || '';
    const plot = $('.chart__plot', chart);

    const grid = document.createElement('div');
    grid.className = 'chart__grid';
    for (let k = 0; k <= 4; k++) {
      const line = document.createElement('span');
      line.style.bottom = k * 25 + '%';
      line.dataset.tick = faNum((max * k) / 4);
      grid.appendChild(line);
    }

    const bars = document.createElement('div');
    bars.className = 'chart__bars';
    values.forEach((v, k) => {
      const col = document.createElement('div');
      col.className = 'chart__col';
      col.style.setProperty('--v', (v / max).toFixed(4));
      col.style.setProperty('--k', String(k));
      col.dataset.tip = `${labels[k]} · ${faNum(v, 1)} ${unit}`;
      col.appendChild(document.createElement('i'));
      const isLast = k === values.length - 1;
      // نام ماه فقط هر سه ماه یک بار، به‌اضافه‌ی ماه جاری
      if (k % 3 === 0 || isLast) {
        const b = document.createElement('b');
        b.textContent = labels[k];
        col.appendChild(b);
      }
      if (isLast) {
        col.classList.add('is-current');
        const em = document.createElement('em');
        em.textContent = faNum(v, 1);
        col.appendChild(em);
      }
      bars.appendChild(col);
    });

    const tip = document.createElement('div');
    tip.className = 'chart__tip';
    plot.append(grid, bars, tip);

    // راهنمای ستون: ناحیه‌ی حساس کل ارتفاع ستون است، نه فقط خود میله
    bars.addEventListener('pointerover', (e) => {
      const col = e.target.closest('.chart__col');
      if (!col) return;
      tip.textContent = col.dataset.tip;
      const half = tip.offsetWidth / 2;
      const x = col.offsetLeft + col.offsetWidth / 2;
      tip.style.left = Math.max(half, Math.min(plot.clientWidth - half, x)) + 'px';
      tip.style.bottom = `calc(${parseFloat(col.style.getPropertyValue('--v')) * 100}% + 8px)`;
      tip.classList.add('is-on');
    });
    bars.addEventListener('pointerleave', () => tip.classList.remove('is-on'));
  }

  demos.dashboard = (function () {
    const slide = $('#dashboard');
    buildChart($('#salesChart'));
    const counters = $$('[data-count]', slide);
    const T = timeline();
    let raf = 0;
    const render = (el, v) => {
      el.textContent = faNum(v, Number(el.dataset.decimals) || 0) + (el.dataset.suffix || '');
    };
    return {
      enter() {
        T.clear(); cancelAnimationFrame(raf);
        if (reduceMotion) { counters.forEach((el) => render(el, Number(el.dataset.count))); return; }
        counters.forEach((el) => render(el, 0));
        T.after(IN_DELAY + 300, () => {
          const t0 = performance.now(), dur = 1400;
          const frame = (now) => {
            const p = Math.min(1, (now - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            counters.forEach((el) => render(el, Number(el.dataset.count) * eased));
            if (p < 1) raf = requestAnimationFrame(frame);
          };
          raf = requestAnimationFrame(frame);
        });
      },
      leave() { T.clear(); cancelAnimationFrame(raf); },
    };
  })();

  /* ---------------------------------------------------------
     ۲ | چت‌بات: پرسش، جست‌وجو در اسناد، پاسخ مستند
     --------------------------------------------------------- */

  demos.chatbot = (function () {
    const body = $('#chatBody');
    const card = body.closest('.chat');
    const user = $('[data-step="user"]', body);
    const search = $('[data-step="search"]', body);
    const bot = $('[data-step="bot"]', body);
    const status = $('.msg__status span', search);
    const searching = status.textContent;
    const found = status.dataset.done;
    const stream = $('.stream', bot);
    const cites = $('.cites', bot);
    const T = timeline();

    // متن پاسخ واژه‌به‌واژه نوشته می‌شود؛ نیم‌فاصله جزو واژه می‌ماند
    const words = stream.textContent.trim().split(/\s+/);
    stream.textContent = '';
    const spans = words.map((w, k) => {
      const sp = document.createElement('span');
      sp.className = 'w';
      sp.textContent = w;
      stream.appendChild(sp);
      if (k < words.length - 1) stream.appendChild(document.createTextNode(' '));
      return sp;
    });

    function reset() {
      card.classList.add('is-playing');
      [user, search, bot].forEach((m) => m.classList.remove('is-shown'));
      search.classList.remove('is-searching');
      status.textContent = searching;
      bot.classList.remove('is-typing');
      spans.forEach((sp) => sp.classList.remove('on'));
      cites.classList.remove('is-shown');
    }

    window.addEventListener('resize', () => { body.style.minHeight = ''; });

    return {
      enter() {
        T.clear();
        // بلندی گفتگوی کامل یک بار اندازه گرفته می‌شود تا کارت هنگام نوشته‌شدن پاسخ قد نکشد
        card.classList.remove('is-playing');
        bot.classList.remove('is-typing');
        status.textContent = found;
        body.style.minHeight = '';
        body.style.minHeight = body.offsetHeight + 'px';
        if (reduceMotion) return;
        reset();
        let t = IN_DELAY + 700;
        T.after(t, () => user.classList.add('is-shown'));
        t += 800;
        T.after(t, () => search.classList.add('is-shown', 'is-searching'));
        t += 1400;
        T.after(t, () => { search.classList.remove('is-searching'); status.textContent = found; });
        t += 600;
        T.after(t, () => bot.classList.add('is-shown', 'is-typing'));
        t += 1000;
        T.after(t, () => {
          bot.classList.remove('is-typing');
          spans.forEach((sp, k) => T.after(k * 65, () => sp.classList.add('on')));
          T.after(spans.length * 65 + 250, () => cites.classList.add('is-shown'));
        });
      },
      leave() { T.clear(); },
    };
  })();

  /* ---------------------------------------------------------
     ۳ | ایجنت: گام‌های فرایند یکی‌یکی اجرا می‌شوند
     --------------------------------------------------------- */

  demos.agents = (function () {
    const steps = $$('#flowSteps .fstep');
    const foot = $('#flowFoot');
    const status = $('#flowStatus');
    const T = timeline();

    const setRunning = (running) => {
      status.textContent = running ? status.dataset.run : status.dataset.done;
      status.classList.toggle('is-run', running);
    };

    function run(delay) {
      steps.forEach((s) => s.classList.remove('is-run', 'is-done'));
      foot.classList.remove('is-shown');
      setRunning(true);
      let t = delay;
      steps.forEach((s) => {
        T.after(t, () => s.classList.add('is-run'));
        t += 1000;
        T.after(t, () => { s.classList.remove('is-run'); s.classList.add('is-done'); });
        t += 160;
      });
      T.after(t + 100, () => { foot.classList.add('is-shown'); setRunning(false); });
      T.after(t + 3800, () => run(0));               // اجرای دوباره، تا وقتی بخش باز است
    }

    return {
      enter() { T.clear(); if (!reduceMotion) run(IN_DELAY + 700); },
      leave() { T.clear(); },
    };
  })();

  /* ---------------------------------------------------------
     ۴ | بینایی ماشین: نوار نقاله، تشخیص و شمارش کارتن‌ها
     --------------------------------------------------------- */

  demos.vision = (function () {
    const view = $('#camView');
    const layer = $('#camItems');
    const line = $('#camLine');
    const countEl = $('#camCount'), okEl = $('#camOk'), badEl = $('#camBad');
    let count = 1248, ok = 1239, bad = 9;
    let items = [], raf = 0, lastT = 0, W = 0, itemW = 0, speed = 0, spawnIn = 0, serial = 0;

    function measure() {
      W = view.clientWidth;
      itemW = W * 0.17;                              // همان width: 17% در CSS
      speed = W / 6.5;                               // هر کارتن در حدود ۶٫۵ ثانیه از قاب می‌گذرد
      view.style.setProperty('--belt-dur', (28 / speed).toFixed(3) + 's');
    }

    const place = (it) => { it.el.style.transform = `translate3d(${it.x.toFixed(1)}px, 0, 0)`; };
    const nextGap = () => (itemW * (1.7 + Math.random() * 0.9)) / speed;

    function spawn(x) {
      serial++;
      const isBad = serial % 7 === 4;                // هر چند کارتن، یکی معیوب
      const conf = isBad ? 0.86 + Math.random() * 0.1 : 0.93 + Math.random() * 0.06;
      const el = document.createElement('div');
      el.className = 'item' + (isBad ? ' item--bad' : '');
      el.innerHTML = `<span class="item__box"></span><span class="item__bb"><b>${isBad ? 'معیوب' : 'کارتن'} ${faNum(conf, 2)}</b></span>`;
      layer.appendChild(el);
      // کارتنی که از ابتدا از خط شمارش گذشته، دوباره شمرده نمی‌شود
      const it = { el, x, bad: isBad, counted: x + itemW / 2 <= W / 2 };
      if (it.counted) el.classList.add('is-counted');
      items.push(it);
      place(it);
    }

    function seed() {
      items.forEach((it) => it.el.remove());
      items = [];
      for (let x = W * 0.86; x > -itemW; x -= itemW * (1.8 + Math.random() * 0.7)) spawn(x);
      spawnIn = nextGap() * 0.6;
    }

    function tally(it) {
      count++;
      if (it.bad) bad++; else ok++;
      countEl.textContent = faNum(count);
      okEl.textContent = faNum(ok);
      badEl.textContent = faNum(bad);
      it.el.classList.add('is-counted');
      line.classList.remove('flash');
      line.classList.toggle('flash--bad', it.bad);
      void line.offsetWidth;                         // شروع دوباره‌ی انیمیشن
      line.classList.add('flash');
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      for (const it of items) {
        it.x -= speed * dt;
        if (!it.counted && it.x + itemW / 2 <= W / 2) { it.counted = true; tally(it); }
        place(it);
      }
      items = items.filter((it) => (it.x < -itemW - 10 ? (it.el.remove(), false) : true));
      spawnIn -= dt;
      if (spawnIn <= 0) { spawn(W + 4); spawnIn = nextGap(); }
      raf = requestAnimationFrame(frame);
    }

    let active = false;
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!active) { items.forEach((it) => it.el.remove()); items = []; return; }
        measure(); seed();
      }, 150);
    });

    return {
      enter() {
        active = true;
        cancelAnimationFrame(raf);
        measure();
        if (!items.length) seed();
        if (reduceMotion) return;
        lastT = performance.now();
        raf = requestAnimationFrame(frame);
      },
      leave() { active = false; cancelAnimationFrame(raf); },
    };
  })();

  /* ---------------------------------------------------------
     شروع: بخشی که آدرس به آن اشاره می‌کند، وگرنه خانه
     --------------------------------------------------------- */

  const start = hashIndex();
  show(start >= 0 ? start : 0);
})();
