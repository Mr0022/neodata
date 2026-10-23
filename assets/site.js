/* =========================================================
   نئودیتا — بخش‌های مشترک همه‌ی صفحه‌ها
   پس‌زمینه‌ی شبکه‌ی داده، پوسته‌ی روشن/تیره، نوار ناوبری بالا و منوی تمام‌صفحه.
   صفحه‌ی اصلی (app.js) از راه window.neodataSite به این‌ها دسترسی دارد.
   ========================================================= */
(function () {
  'use strict';

  const root = document.documentElement;
  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
      r: Math.random() * 1.8 + 1.8,             // شعاع ۱٫۸ تا ۳٫۶ پیکسل
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
     ناوبری بالا: پیوند جاری، نشانگر لغزان زیر آن، و زیرمنوی خدمات
     --------------------------------------------------------- */

  const topnav  = $('#topnav');
  const navEls  = $$('[data-sections]', topnav);
  const navInd  = $('.topnav__ind', topnav);
  const subItem = $('.topnav__has-sub', topnav);
  const subBtn  = $('button', subItem);
  const subLinks = $$('.topnav__sub a', subItem);
  let subOpenedAt = 0, subHoverTimer = 0;

  /** نشانگر به اندازه و جای پیوند جاری درمی‌آید؛ اگر پیوند پنهان است، نشانگر هم */
  function placeIndicator() {
    const el = navEls.find((n) => n.classList.contains('is-active'));
    if (!el || !el.offsetWidth) { navInd.style.opacity = '0'; return; }
    const box = topnav.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    navInd.style.setProperty('--x', (r.left - box.left - topnav.clientLeft) + 'px');
    navInd.style.setProperty('--y', (r.top - box.top - topnav.clientTop) + 'px');
    navInd.style.setProperty('--w', r.width + 'px');
    navInd.style.setProperty('--h', r.height + 'px');
    navInd.style.opacity = '';
    // نخستین بار بدون لغزش، از آن پس با لغزش
    if (!navInd.classList.contains('is-ready')) requestAnimationFrame(() => navInd.classList.add('is-ready'));
  }
  window.addEventListener('resize', placeIndicator);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeIndicator);

  const subOpen = () => subItem.classList.contains('is-open');
  function setSub(open) {
    subItem.classList.toggle('is-open', open);
    subBtn.setAttribute('aria-expanded', String(open));
    if (open) subOpenedAt = performance.now();
  }
  // کلیک باز و بسته می‌کند؛ اما کلیکی که بلافاصله پس از باز شدن با نشانگر برسد، آن را نمی‌بندد
  subBtn.addEventListener('click', () => setSub(!subOpen() || performance.now() - subOpenedAt < 400));
  subItem.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(subHoverTimer);
    if (!subOpen()) setSub(true);
  });
  subItem.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    subHoverTimer = setTimeout(() => setSub(false), 220);
  });
  document.addEventListener('pointerdown', (e) => { if (subOpen() && !subItem.contains(e.target)) setSub(false); });
  subItem.addEventListener('focusout', (e) => { if (!subItem.contains(e.relatedTarget)) setSub(false); });
  // کلیدهای جهت درون زیرمنو میان گزینه‌ها می‌چرخند، نه میان بخش‌ها
  subItem.addEventListener('keydown', (e) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    if (!subOpen()) setSub(true);
    const n = subLinks.length;
    const k = subLinks.indexOf(document.activeElement);
    subLinks[k < 0 ? (step > 0 ? 0 : n - 1) : (k + step + n) % n].focus();
  });

  /** پیوندهایی که data-sections آن‌ها id را دارد «جاری» می‌شوند و نشانگر به زیرشان می‌لغزد */
  function setActive(id, current = 'true') {
    navEls.forEach((n) => {
      const on = n.dataset.sections.split(' ').includes(id);
      n.classList.toggle('is-active', on);
      if (on && n.tagName === 'A') n.setAttribute('aria-current', current);
      else n.removeAttribute('aria-current');
    });
    setSub(false);
    placeIndicator();
  }

  /* ---------------------------------------------------------
     منوی تمام‌صفحه (روی صفحه‌هایی که کپسول ناوبری جا نمی‌شود)
     --------------------------------------------------------- */

  const menuBtn   = $('#menuBtn');
  const menuPanel = $('#menuPanel');
  const menuOpen = () => menuPanel.classList.contains('is-open');
  // هر چه پشت منوست، تا وقتی منو باز است در دسترس نیست
  const behindMenu = $$('main, #dots, #pager, #topnav');

  function openMenu() {
    menuPanel.classList.add('is-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    behindMenu.forEach((el) => { el.inert = true; });
    ($('[aria-current]', menuPanel) || $('button, a', menuPanel)).focus({ preventScroll: true });
  }
  function closeMenu() {
    if (!menuOpen()) return;
    menuPanel.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    behindMenu.forEach((el) => { el.inert = false; });
  }
  menuBtn.addEventListener('click', () => (menuOpen() ? closeMenu() : openMenu()));
  menuPanel.addEventListener('click', (e) => { if (e.target === menuPanel) closeMenu(); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (menuOpen()) { closeMenu(); menuBtn.focus(); }
    else if (subOpen()) { setSub(false); subBtn.focus(); }
  });

  /* ---------------------------------------------------------
     سوالات متداول (faq.html): هر بار فقط یک پاسخ باز است (مرورگرهایی که صفت name
     روی <details> را نمی‌شناسند)، و داده‌ی ساختاریافته‌ی FAQPage از همان
     متن‌های دیده‌شده ساخته می‌شود تا این دو هرگز از هم فاصله نگیرند
     --------------------------------------------------------- */

  const faqItems = $$('.faq__item');
  faqItems.forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) faqItems.forEach((o) => { if (o !== d) o.open = false; });
  }));
  if (faqItems.length) {
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((d) => ({
        '@type': 'Question',
        name: $('summary', d).textContent.trim(),
        acceptedAnswer: { '@type': 'Answer', text: $('.faq__a', d).textContent.replace(/\s+/g, ' ').trim() },
      })),
    });
    document.head.appendChild(ld);
  }

  /* ---------------------------------------------------------
     صفحه‌های اسکرول‌دار (مشاوره، سوالات متداول، درباره‌ی ما)

     هدر پس از کمی اسکرول زمینه‌ی شیشه‌ای می‌گیرد تا متن زیرش خوانا بماند،
     و عنصرهای [data-reveal] وقتی به صفحه می‌رسند آرام ظاهر می‌شوند.
     صفحه‌ی اصلی اسکرول نمی‌شود و این‌ها آنجا کاری نمی‌کنند.
     --------------------------------------------------------- */

  const head = $('.site-head');
  const onScroll = () => head.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const reveals = $$('[data-reveal]');
  if (reveals.length && !reduceMotion && 'IntersectionObserver' in window) {
    root.classList.add('reveal-ready');
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    }), { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  }

  // صفحه‌ای که خودش یکی از پیوندهای ناوبری است (<body data-page="about">)
  if (document.body.dataset.page) setActive(document.body.dataset.page, 'page');

  window.neodataSite = { net, setActive, closeSub: () => setSub(false), menuOpen, closeMenu };
})();
