/* =========================================================
   نئودیتا — شکل‌ها و نمودارهای تعاملی صفحه‌های خدمت و مقاله‌ها
   هر شکل یک <figure data-viz="…"> است که نسخه‌ی کامل و بی‌حرکتش در خود HTML آمده؛
   این فایل فقط تعامل و حرکت را اضافه می‌کند. همه‌ی داده‌ها نمونه‌ی نمایشی‌اند.
   ========================================================= */
(function () {
  'use strict';

  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SVG = 'http://www.w3.org/2000/svg';
  /** عدد با رقم فارسی: ۱۸٫۴ و ۲٬۳۸۴ */
  const faNum = (n, decimals = 0) =>
    n.toLocaleString('fa-IR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  /* ---------------------------------------------------------
     سیم‌ها: خط یا منحنی میان گره‌ها (data-node) از روی data-wires،
     با الگوی «از:به:کلاس…». با هر تغییر اندازه دوباره کشیده می‌شوند.
     جهت منحنی‌ها را متغیر CSS --wire-dir (x یا y) تعیین می‌کند تا روی گوشی،
     که گره‌ها زیر هم می‌آیند، سیم‌ها هم عمودی شوند.
     --------------------------------------------------------- */

  function wires(box) {
    const svg = $('.wires', box);
    const node = (id) => $(`[data-node="${id}"]`, box);
    const paths = box.dataset.wires.trim().split(/\s+/).map((spec) => {
      const [from, to, ...cls] = spec.split(':');
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('class', ['wire', ...cls].join(' '));
      p.dataset.from = from;
      p.dataset.to = to;
      svg.appendChild(p);
      return p;
    });

    function draw() {
      const b = box.getBoundingClientRect();
      if (!b.width) return;
      svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
      const dir = getComputedStyle(box).getPropertyValue('--wire-dir').trim() || 'x';
      paths.forEach((p) => {
        const r1 = node(p.dataset.from).getBoundingClientRect();
        const r2 = node(p.dataset.to).getBoundingClientRect();
        const ax = r1.left + r1.width / 2 - b.left, ay = r1.top + r1.height / 2 - b.top;
        const bx = r2.left + r2.width / 2 - b.left, by = r2.top + r2.height / 2 - b.top;
        let d;
        if (p.classList.contains('wire--straight')) {
          d = `M${ax} ${ay}L${bx} ${by}`;
        } else if (dir === 'x') {
          // از لبه‌ی کناری گره به لبه‌ی کناری گره‌ی مقصد
          const s = Math.sign(bx - ax) || 1;
          const x1 = ax + s * r1.width / 2, x2 = bx - s * r2.width / 2, m = (x1 + x2) / 2;
          d = `M${x1} ${ay}C${m} ${ay} ${m} ${by} ${x2} ${by}`;
        } else {
          const s = Math.sign(by - ay) || 1;
          const y1 = ay + s * r1.height / 2, y2 = by - s * r2.height / 2, m = (y1 + y2) / 2;
          d = `M${ax} ${y1}C${ax} ${m} ${bx} ${m} ${bx} ${y2}`;
        }
        p.setAttribute('d', d);
      });
    }

    draw();
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(box);
    else window.addEventListener('resize', draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    return paths;
  }

  /* ---------------------------------------------------------
     چرخه‌ی خودکار میان حالت‌های یک شکل: فقط وقتی شکل در صفحه پیداست،
     و با اولین انتخاب بازدیدکننده می‌ایستد. با «کاهش حرکت» اصلاً نمی‌چرخد.
     --------------------------------------------------------- */

  function autoplay(fig, count, ms, set, start = 0) {
    let k = start, timer = 0, seen = false, stopped = reduceMotion;
    const sync = () => {
      clearInterval(timer);
      if (seen && !stopped) timer = setInterval(() => { k = (k + 1) % count; set(k); }, ms);
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { seen = e.isIntersecting; sync(); }, { threshold: 0.3 }).observe(fig);
    }
    set(k);
    return {
      pick(i) { stopped = true; sync(); k = i; set(i); },
      replay() { stopped = reduceMotion; k = 0; set(0); sync(); },
      stop() { stopped = true; sync(); },
    };
  }

  /** دکمه‌های .seg (یا هر گروه دکمه‌ی دیگر)، حالت‌های شکل‌اند؛ متن data-note هر دکمه در .viz__note می‌نشیند */
  function modes(fig, ms, apply, start = 0, sel = '.seg button') {
    const btns = $$(sel, fig);
    const note = $('.viz__note', fig);
    const set = (k) => {
      btns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === k)));
      if (note && btns[k].dataset.note) note.textContent = btns[k].dataset.note;
      apply(k, btns[k]);
    };
    const play = autoplay(fig, btns.length, ms, set, start);
    btns.forEach((b, i) => b.addEventListener('click', () => play.pick(i)));
  }

  const viz = {};

  /* ---------- داشبورد: چند منبع، یک داشبورد؛ شاخص عوض می‌شود ---------- */

  viz.dash = (fig) => {
    const { months, metrics } = JSON.parse(fig.dataset.series);
    const cols = $$('.viz-dash__col', fig);
    const value = $('.viz-dash__value', fig), unit = $('.viz-dash__unit', fig);
    const label = $('.viz-dash__label', fig), delta = $('.viz-dash__delta', fig);
    const chart = $('.viz-dash__chart', fig), tip = $('.viz-dash__tip', fig);
    wires($('.wired', fig)).forEach((p) => p.classList.add('is-live'));

    modes(fig, 3800, (k) => {
      const m = metrics[k], last = m.values.length - 1;
      cols.forEach((c, i) => {
        c.style.setProperty('--v', (m.values[i] / m.max).toFixed(3));
        c.dataset.tip = `${months[i]} · ${faNum(m.values[i], m.dec)} ${m.unit}`;
      });
      const pct = Math.round((m.values[last] / m.values[last - 1] - 1) * 100);
      label.textContent = `${m.name} ${months[last]}`;
      value.textContent = faNum(m.values[last], m.dec);
      unit.textContent = m.unit;
      delta.textContent = `${pct >= 0 ? '▲' : '▼'} ${faNum(Math.abs(pct))}٪ نسبت به ماه قبل`;
      chart.setAttribute('aria-label', `${m.name} ماهانه (نمونه‌ی نمایشی): از ${faNum(m.values[0], m.dec)} در ${months[0]} تا ${faNum(m.values[last], m.dec)} ${m.unit} در ${months[last]}`);
    });

    // راهنمای ستون، مثل نمودار صفحه‌ی اصلی
    const cols$ = $('.viz-dash__cols', fig);
    cols$.addEventListener('pointerover', (e) => {
      const col = e.target.closest('.viz-dash__col');
      if (!col) return;
      tip.textContent = col.dataset.tip;
      const half = tip.offsetWidth / 2;
      const x = col.offsetLeft + col.offsetWidth / 2;
      tip.style.left = Math.max(half, Math.min(chart.clientWidth - half, x)) + 'px';
      tip.style.bottom = `calc(${parseFloat(col.style.getPropertyValue('--v')) * 100}% + 8px)`;
      tip.classList.add('is-on');
    });
    // روی صفحه‌ی لمسی راهنما پس از برداشتن انگشت هم می‌ماند
    cols$.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') tip.classList.remove('is-on'); });
  };

  /* ---------- گام‌به‌گام (چت‌بات): هر گام صحنه‌ی خودش را دارد ---------- */

  viz.flow = (fig) => {
    const steps = $$('.viz-flow__step', fig);
    const scenes = $$('.viz-flow__scene', fig);
    const paths = wires($('.wired', fig));      // سیم i گام i را به گام i+1 وصل می‌کند
    const set = (k) => {
      steps.forEach((s, i) => {
        s.classList.toggle('is-on', i === k);
        s.classList.toggle('is-done', i < k);
        s.setAttribute('aria-pressed', String(i === k));
      });
      scenes.forEach((s, i) => s.classList.toggle('is-on', i === k));
      paths.forEach((p, i) => p.classList.toggle('is-live', i < k));
    };
    const play = autoplay(fig, steps.length, 2800, set);
    steps.forEach((s, i) => s.addEventListener('click', () => play.pick(i)));
    $('.viz__replay', fig).addEventListener('click', () => play.replay());
  };

  /* ---------- مسیر کار ایجنت: کار روزمره یا تصمیم حساس ---------- */

  viz.route = (fig) => {
    const box = $('.viz-route', fig);
    const paths = wires(box);
    modes(fig, 4200, (k, btn) => {
      const r = btn.dataset.route;
      box.dataset.route = r;
      paths.forEach((p) => p.classList.toggle('is-live', p.classList.contains('r-all') || p.classList.contains('r-' + r)));
    });
  };

  /* ---------- دوربین: شمارش، کنترل کیفیت، ایمنی ---------- */

  viz.cam = (fig) => {
    const box = $('.viz-cam', fig);
    modes(fig, 4200, (k, btn) => { box.dataset.mode = btn.dataset.mode; });
  };

  /* ---------- یکپارچه‌سازی داده: پیش و پس ---------- */

  viz.integrate = (fig) => {
    const box = $('.viz-int', fig);
    const after = wires(box).filter((p) => p.classList.contains('w-after'));
    modes(fig, 3800, (k, btn) => {
      box.dataset.state = btn.dataset.state;
      after.forEach((p) => p.classList.toggle('is-live', btn.dataset.state === 'after'));
    });
  };

  /* ---------- پیش‌بینی: افق پیش‌بینی و راهنمای نقطه‌به‌نقطه ---------- */

  viz.forecast = (fig) => {
    const d = JSON.parse(fig.dataset.chart);   // labels، values، lo، hi، actual، min، max، unit
    const plot = $('.viz-fc', fig);
    const clip = $('.viz-fc__clip', fig);
    const range = $('.viz-range input', fig);
    const out = $('.viz-range b', fig);
    const tip = $('.viz-fc__tip', fig), dot = $('.viz-fc__dot', fig), guide = $('.viz-fc__guide', fig);
    const labels = $$('.viz-fc__labels span', fig);
    const n = d.values.length, A = d.actual;
    // زمان از راست به چپ پیش می‌رود: قدیمی‌ترین ماه سمت راست، آینده سمت چپ
    const X = (i) => 1000 - (i / (n - 1)) * 1000;
    const Y = (v) => 300 - ((v - d.min) / (d.max - d.min)) * 300;
    let horizon = Number(range.value);

    function setHorizon(h) {
      horizon = h;
      out.textContent = `${faNum(h)} ماه`;
      const x = X(A - 1 + h);
      clip.setAttribute('x', x);
      clip.setAttribute('width', 1000 - x);
      labels.forEach((l) => l.classList.toggle('is-off', Number(l.dataset.i) > A - 1 + h));
      plot.classList.remove('is-hover');
    }
    range.addEventListener('input', () => setHorizon(Number(range.value)));
    setHorizon(horizon);

    function show(i) {
      const x = X(i) / 10, y = Y(d.values[i]) / 3;   // درصد پهنا و بلندی
      dot.style.left = guide.style.left = x + '%';
      dot.style.top = y + '%';
      tip.textContent = i < A
        ? `${d.labels[i]} · ${faNum(d.values[i], 1)} ${d.unit}`
        : `${d.labels[i]} · پیش‌بینی ${faNum(d.values[i], 1)} (${faNum(d.lo[i], 1)} تا ${faNum(d.hi[i], 1)})`;
      const w = plot.clientWidth, half = tip.offsetWidth / 2;
      tip.style.left = Math.max(half, Math.min(w - half, (x / 100) * w)) + 'px';
      tip.style.top = y + '%';
      plot.classList.add('is-hover');
    }
    const point = (e) => {
      const r = plot.getBoundingClientRect();
      const i = Math.round(((r.right - e.clientX) / r.width) * (n - 1));
      show(Math.max(0, Math.min(A - 1 + horizon, i)));
    };
    plot.addEventListener('pointermove', point);
    plot.addEventListener('pointerdown', point);
    // روی صفحه‌ی لمسی راهنما پس از برداشتن انگشت هم می‌ماند
    plot.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') plot.classList.remove('is-hover'); });
  };

  /** کارت توضیح هر حالت (.viz-panel)؛ تابعی که فقط کارت k را نشان می‌دهد */
  const panels = (fig) => {
    const ps = $$('.viz-panel', fig);
    return (k) => ps.forEach((p, i) => p.classList.toggle('is-on', i === k));
  };

  /** راهنمای کوچکی که روی عنصر نشانگر می‌ایستد؛ روی صفحه‌ی لمسی پس از برداشتن انگشت هم می‌ماند */
  function hoverTip(area, tip, pick) {
    area.addEventListener('pointerover', (e) => {
      const hit = pick(e.target);
      if (!hit) return;
      const a = area.getBoundingClientRect(), r = hit.el.getBoundingClientRect();
      tip.textContent = hit.text;
      const half = tip.offsetWidth / 2;
      tip.style.left = Math.max(half, Math.min(a.width - half, r.left + r.width / 2 - a.left)) + 'px';
      tip.style.top = (r.top - a.top) + 'px';
      tip.classList.add('is-on');
    });
    area.addEventListener('pointerout', (e) => {
      if (e.pointerType !== 'touch' && pick(e.target) && !(e.relatedTarget && pick(e.relatedTarget))) tip.classList.remove('is-on');
    });
  }

  /* ========== مقاله‌ها ========== */

  /* ---------- RAG: نمایه‌سازی یا پاسخ‌گویی ---------- */

  viz.rag = (fig) => {
    const box = $('.viz-rag', fig);
    const paths = wires(box);
    modes(fig, 5200, (k, btn) => {
      box.dataset.lane = btn.dataset.lane;
      paths.forEach((p) => p.classList.toggle('is-live', p.classList.contains('l-' + btn.dataset.lane)));
    });
  };

  /* ---------- فضای برداری: k تکه‌ی نزدیک به پرسش ---------- */

  viz.vectors = (fig) => {
    const { points, queries } = JSON.parse(fig.dataset.space);
    const dots = $$('.viz-vec__pt', fig);
    const links = $('.viz-vec__links', fig);
    const star = $('.viz-vec__q', fig);
    const hits = $('.viz-vec__hits', fig);
    const range = $('.viz-range input', fig), out = $('.viz-range b', fig);
    let q = 0;

    function render() {
      const k = Number(range.value), Q = queries[q];
      out.textContent = faNum(k);
      star.style.transform = `translate(${Q.x}px, ${Q.y}px)`;
      const near = points.map((p, i) => ({ i, d: Math.hypot(p.x - Q.x, p.y - Q.y) }))
        .sort((a, b) => a.d - b.d).slice(0, k);
      const hit = new Set(near.map((n) => n.i));
      dots.forEach((c, i) => c.classList.toggle('is-hit', hit.has(i)));
      links.replaceChildren(...near.map(({ i }) => {
        const l = document.createElementNS(SVG, 'line');
        [['x1', Q.x], ['y1', Q.y], ['x2', points[i].x], ['y2', points[i].y]].forEach(([a, v]) => l.setAttribute(a, v));
        return l;
      }));
      // نزدیکی در این صفحه‌ی دوبُعدی، به‌جای شباهت کسینوسی بردارهای واقعی (همان فرمول HTML اولیه)
      hits.replaceChildren(...near.map(({ i, d }) => {
        const li = document.createElement('li');
        const t = document.createElement('span'), b = document.createElement('b');
        t.textContent = points[i].t;
        b.textContent = faNum(Math.max(0, 1 - d / 400), 2);
        li.append(t, b);
        return li;
      }));
    }
    range.addEventListener('input', render);
    modes(fig, 4600, (k) => { q = k; render(); });

    hoverTip($('.viz-vec__plot', fig), $('.viz-vec__tip', fig), (el) => {
      const c = el.closest && el.closest('.viz-vec__pt');
      return c && { el: c, text: points[Number(c.dataset.i)].t };
    });
  };

  /* ---------- هوش تجاری: چهار سطح تحلیل ---------- */

  viz.ladder = (fig) => modes(fig, 4200, panels(fig), 0, '.viz-ladder__step');

  /* ---------- زنجیره‌ی داده و اجزای ایجنت: فقط سیم‌های روان ---------- */

  viz.chain = viz.hub = (fig) => wires($('.wired', fig)).forEach((p) => p.classList.add('is-live'));

  /* ---------- مدل ستاره‌ای: کدام بُعد و کدام ستون‌ها در هر پرسش ---------- */

  viz.star = (fig) => {
    const box = $('.viz-star', fig);
    const paths = wires(box);
    const sql = $('.viz-sql code', fig);
    const cols = $$('[data-col]', box);
    modes(fig, 5200, (k, btn) => {
      const tables = btn.dataset.tables.split(' '), used = btn.dataset.cols.split(' ');
      $$('[data-node]', box).forEach((n) => n.classList.toggle('is-on', n.dataset.node === 'fact' || tables.includes(n.dataset.node)));
      paths.forEach((p) => p.classList.toggle('is-live', tables.includes(p.dataset.from)));
      cols.forEach((c) => c.classList.toggle('is-used', used.includes(c.dataset.col)));
      sql.textContent = btn.dataset.sql;
    });
  };

  /* ---------- کاوش: از منطقه به شهر و برگشت ---------- */

  viz.drill = (fig) => {
    const tree = JSON.parse(fig.dataset.tree);
    const list = $('.viz-drill__bars', fig);
    const up = $('.viz-drill__up', fig), here = $('.viz-drill__here', fig);
    const title = $('.viz-drill__title', fig);
    const top = title.innerHTML;

    function show(region) {
      const items = region ? region.children : tree;
      const max = Math.max(...items.map((x) => x.value));
      const total = items.reduce((s, x) => s + x.value, 0);
      list.replaceChildren(...items.map((x, k) => {
        const li = document.createElement('li');
        const row = document.createElement(region ? 'div' : 'button');
        row.className = 'viz-drill__row';
        if (!region) { row.type = 'button'; row.addEventListener('click', () => drill(k)); }
        row.innerHTML = '<span class="viz-drill__name"></span><span class="viz-drill__track"><i></i></span><span class="viz-drill__val"></span>';
        row.querySelector('.viz-drill__name').textContent = x.name;
        row.querySelector('.viz-drill__val').innerHTML = `${faNum(x.value)} <small>${faNum(Math.round((x.value / total) * 100))}٪</small>`;
        const bar = row.querySelector('i');
        bar.style.setProperty('--v', '0');
        requestAnimationFrame(() => requestAnimationFrame(() => bar.style.setProperty('--v', (x.value / max).toFixed(3))));
        li.appendChild(row);
        return li;
      }));
      up.disabled = !region;
      here.textContent = region ? region.name : '';
      if (region) title.textContent = `فروش ۱۴۰۴ منطقه‌ی ${region.name} به تفکیک شهر، میلیارد تومان`;
      else title.innerHTML = top;
    }
    // دکمه‌ی زده‌شده با فهرست عوض می‌شود؛ تمرکز به دکمه‌ی بازگشت (و در بازگشت، به نخستین منطقه) می‌رود
    function drill(k) { show(tree[k]); up.focus(); }
    up.addEventListener('click', () => { show(null); list.querySelector('button').focus(); });
    $$('.viz-drill__row', list).forEach((row, k) => row.addEventListener('click', () => drill(k)));
  };

  /* ---------- طیف خودکارسازی: هر سطح و توضیحش ---------- */

  viz.spectrum = (fig) => {
    const marks = $$('.viz-spec__mark', fig);
    const panel = panels(fig);
    modes(fig, 4600, (k) => {
      marks.forEach((m, i) => m.classList.toggle('is-on', i === k));
      panel(k);
    }, 2, '.viz-spec__levels button');
  };

  /* ---------- حلقه‌ی ایجنت: گام‌به‌گام ---------- */

  viz.loop = (fig) => {
    const box = $('.viz-loop', fig);
    const rows = $$('.viz-loop__trace li', fig);
    const nodes = $$('.viz-loop__node', fig);
    const arcs = $$('.viz-loop__arc', fig);
    const count = $('.viz-loop__count', fig);
    let cur = 0;
    const set = (k) => {
      cur = k;
      const phase = rows[k].dataset.phase, prev = k ? rows[k - 1].dataset.phase : '';
      rows.forEach((r, i) => {
        r.classList.toggle('is-on', i === k);
        r.classList.toggle('is-done', i < k);
        r.classList.toggle('is-prev', i === k - 1);   // روی گوشی فقط گام قبل و گام جاری دیده می‌شوند
      });
      nodes.forEach((n) => n.classList.toggle('is-on', n.dataset.phase === phase));
      arcs.forEach((a) => a.classList.toggle('is-live', a.dataset.from === prev && a.dataset.to === phase));
      count.textContent = `گام ${faNum(k + 1)} از ${faNum(rows.length)}`;
    };
    box.classList.add('is-ready');
    const play = autoplay(fig, rows.length, 2400, set);
    $('.viz-loop__next', fig).addEventListener('click', () => play.pick((cur + 1) % rows.length));
    $('.viz-loop__reset', fig).addEventListener('click', () => play.replay());
  };

  /* ========== مقاله‌های مالی، زنجیره‌ی تأمین و شاخص‌ها ========== */

  /** نمودار خطی با زمان از راست به چپ (viewBox 0 0 1000 300)؛ همان نگاشت HTML اولیه */
  function scale(n, lo, hi) {
    const X = (i) => 1000 - (i / (n - 1)) * 1000;
    const Y = (v) => 300 - ((v - lo) / (hi - lo)) * 300;
    const line = (vs) => vs.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
    return { X, Y, line };
  }

  /** جابه‌جایی نرم میان دو فهرست عدد؛ تابع برگشتی فهرست تازه را می‌گیرد. با «کاهش حرکت» یک‌باره */
  function morph(draw, ms = 650) {
    let shown = null, raf = 0;
    return (to) => {
      cancelAnimationFrame(raf);
      const from = shown;
      if (reduceMotion || !from) { shown = to.slice(); draw(shown); return; }
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - t, 3);
        shown = to.map((v, i) => from[i] + (v - from[i]) * e);
        draw(shown);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
  }

  /** راهنمای نقطه‌به‌نقطه‌ی نمودار خطی: نزدیک‌ترین نقطه به نشانگر */
  function crosshair(area, n, text, top) {
    const tip = $('.viz-plot__tip', area), dot = $('.viz-plot__dot', area), guide = $('.viz-plot__guide', area);
    const show = (e) => {
      const r = area.getBoundingClientRect();
      const i = Math.max(0, Math.min(n - 1, Math.round(((r.right - e.clientX) / r.width) * (n - 1))));
      const x = 100 - (i / (n - 1)) * 100, y = top(i);
      dot.style.left = guide.style.left = x + '%';
      dot.style.top = y + '%';
      tip.textContent = text(i);
      const half = tip.offsetWidth / 2;
      tip.style.left = Math.max(half, Math.min(r.width - half, (x / 100) * r.width)) + 'px';
      tip.style.top = y + '%';
      area.classList.add('is-hover');
    };
    area.addEventListener('pointermove', show);
    area.addEventListener('pointerdown', show);
    // روی صفحه‌ی لمسی راهنما پس از برداشتن انگشت هم می‌ماند
    area.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') area.classList.remove('is-hover'); });
  }

  /* ---------- بستن دفاتر: دستی یا خودکار ---------- */

  viz.close = (fig) => {
    const box = $('.viz-gantt', fig);
    const rows = $$('.viz-gantt__rows > li', fig);
    const end = $('.viz-gantt__end', fig), label = $('.viz-gantt__end b', fig);
    modes(fig, 4200, (k) => {
      const key = k ? 'auto' : 'manual';
      box.dataset.mode = key;
      let last = 0;
      rows.forEach((r) => {
        const [s, l] = r.dataset[key].split(' ').map(Number);
        const bar = $('i', r);
        bar.style.setProperty('--s', s);
        bar.style.setProperty('--l', l);
        last = Math.max(last, s + l);
      });
      end.style.setProperty('--s', last);
      label.textContent = `بستن دفاتر: روز ${faNum(Math.ceil(last))}`;
    });
  };

  /* ---------- تحلیل هزینه‌ها: دسته‌بندی و هشدار، تراکنش به تراکنش ---------- */

  viz.expense = (fig) => {
    const box = $('.viz-exp', fig);
    const rows = $$('.viz-exp__row', fig);
    const bars = $$('.viz-exp__bars li', fig);
    const note = $('.viz__note', fig), count = $('.viz-exp__count', fig);
    const done = note.textContent, n = rows.length;
    const total = {};
    rows.forEach((r) => { total[r.dataset.cat] = (total[r.dataset.cat] || 0) + Number(r.dataset.amt); });
    const top = Math.max(...Object.values(total));
    const fmt = (v) => faNum(v, v % 1 ? 1 : 0);
    let cur = 0;
    // گام k: تراکنش k بررسی می‌شود؛ گام‌های پس از آخرین تراکنش، نتیجه را نگه می‌دارند
    const set = (k) => {
      cur = k;
      const last = Math.min(k, n - 1), sums = {};
      rows.forEach((r, i) => {
        const on = i <= last;
        r.classList.toggle('is-done', on);
        r.classList.toggle('is-on', i === k);
        r.classList.toggle('is-flagged', on && 'flag' in r.dataset && Number(r.dataset.flagAt || i) <= last);
        if (on) sums[r.dataset.cat] = (sums[r.dataset.cat] || 0) + Number(r.dataset.amt);
      });
      bars.forEach((b) => {
        const v = sums[b.dataset.cat] || 0;
        $('i', b).style.setProperty('--v', (v / top).toFixed(3));
        $('b', b).textContent = fmt(v);
      });
      const flags = rows.filter((r) => r.classList.contains('is-flagged')).length;
      count.textContent = `${faNum(last + 1)} از ${faNum(n)} تراکنش · ${faNum(flags)} هشدار`;
      note.textContent = k < n ? rows[k].dataset.note : done;
    };
    box.classList.add('is-ready');
    // با «کاهش حرکت» از نتیجه شروع می‌شود و با «گام بعد» می‌شود از اول دنبالش کرد
    const play = autoplay(fig, n + 2, 2100, set, reduceMotion ? n : 0);
    $('.viz-exp__next', fig).addEventListener('click', () => play.pick((cur + 1) % (n + 1)));
    $('.viz-exp__reset', fig).addEventListener('click', () => play.replay());
  };

  /* ---------- پایش بودجه: ماه به ماه ---------- */

  viz.budget = (fig) => {
    const { months, units } = JSON.parse(fig.dataset.budget);
    const rows = $$('.viz-budget__row', fig);
    const range = $('.viz-range input', fig), out = $('.viz-range b', fig);
    const month = $('.viz-budget__month', fig), note = $('.viz__note', fig);
    const sum = (a, from, to) => a.slice(from, to).reduce((s, x) => s + x, 0);
    // همان قاعده‌ی HTML اولیه: تا ۳٪ طبق برنامه، تا ۸٪ نزدیک سقف، بیشتر فراتر از برنامه، و کمتر از ۵٪- کم‌خرج
    const status = (v) => (v > 0.08 ? 'bad' : v > 0.03 ? 'warn' : v < -0.05 ? 'mute' : 'good');
    const set = (k) => {
      const m = k + 1;
      let A = 0, P = 0, F = 0, B = 0;
      const over = [];
      units.forEach((u, i) => {
        const a = sum(u.actual, 0, m), p = sum(u.plan, 0, m), v = a / p - 1, st = status(v);
        A += a; P += p; F += a + sum(u.plan, m, 12); B += u.budget;
        if (st === 'bad') over.push(u.name);
        const row = rows[i], badge = $('.viz-badge', row);
        row.dataset.st = st;
        $('.viz-budget__fill', row).style.setProperty('--v', (a / u.budget).toFixed(3));
        $('.viz-budget__plan', row).style.setProperty('--p', (p / u.budget).toFixed(3));
        $('.viz-budget__val', row).textContent = `${faNum(Math.round((a / u.budget) * 100))}٪`;
        badge.dataset.st = st;
        const pct = faNum(Math.round(Math.abs(v) * 100));
        badge.textContent = st === 'good' ? 'طبق برنامه' : `${pct}٪ ${st === 'mute' ? 'کمتر' : 'بیش'} از برنامه`;
      });
      range.value = m;
      out.textContent = month.textContent = months[k];
      const d = Math.round((A / P - 1) * 100), diff = Math.round(F - B);
      let s = `تا پایان ${months[k]}: ${faNum(Math.round(A))} میلیارد تومان هزینه شده، `;
      s += d === 0 ? 'طبق برنامه. ' : `${faNum(Math.abs(d))}٪ ${d > 0 ? 'بیش' : 'کمتر'} از برنامه. `;
      if (over.length) s += `${over.join('، ')} فراتر از برنامه است. `;
      s += m === 12 ? 'هزینه‌ی کل سال ' : 'اگر بقیه‌ی سال طبق برنامه پیش برود، هزینه‌ی کل سال ';
      s += `${faNum(Math.round(F))} میلیارد تومان ${m === 12 ? 'شد' : 'می‌شود'}؛ `;
      s += diff === 0 ? 'برابر بودجه.' : `${faNum(Math.abs(diff))} میلیارد ${diff > 0 ? 'بیش' : 'کمتر'} از بودجه‌ی ${faNum(B)} میلیاردی.`;
      note.textContent = s;
    };
    // با «کاهش حرکت» همان ماه HTML اولیه می‌ماند؛ وگرنه سال از فروردین ورق می‌خورد
    const play = autoplay(fig, 12, 1500, set, reduceMotion ? Number(range.value) - 1 : 0);
    range.addEventListener('input', () => play.pick(Number(range.value) - 1));
  };

  /* ---------- جریان نقدی: سه سناریو ---------- */

  viz.cash = (fig) => {
    const d = JSON.parse(fig.dataset.cash);   // min (حداقل لازم)، max، unit، scen
    const n = d.scen[0].length;
    const { X, Y, line } = scale(n, 0, d.max);
    const lineEl = $('.viz-cash__line', fig), area = $('.viz-cash__area', fig), risk = $('.viz-cash__risk', fig);
    const plot = $('.viz-cash', fig), yt = Y(d.min).toFixed(1);
    let vals = d.scen[0];
    const draw = morph((vs) => {
      vals = vs;
      const l = line(vs), x0 = X(0).toFixed(1), x1 = X(n - 1).toFixed(1);
      lineEl.setAttribute('d', l);
      area.setAttribute('d', `${l}L${x1} 300L${x0} 300Z`);
      risk.setAttribute('d', `${l}L${x1} ${yt}L${x0} ${yt}Z`);
    });
    modes(fig, 5200, (k) => {
      const s = d.scen[k], low = Math.min(...s), w = s.indexOf(low) + 1;
      draw(s);
      plot.setAttribute('aria-label', `پیش‌بینی موجودی نقد سیزده هفته‌ی آینده (نمونه‌ی نمایشی): کمترین موجودی ${faNum(low, 1)} ${d.unit} در هفته‌ی ${faNum(w)}؛ حداقل نقد لازم ${faNum(d.min)} ${d.unit}`);
    });
    crosshair($('.viz-plot__area', fig), n,
      (i) => `هفته‌ی ${faNum(i + 1)} · ${faNum(vals[i], 1)} ${d.unit}${vals[i] < d.min ? ' (کمتر از حداقل)' : ''}`,
      (i) => (Y(vals[i]) / 300) * 100);
  };

  /* ---------- تحلیل انحراف: هر ستون و توضیحش ---------- */

  viz.waterfall = (fig) => modes(fig, 3800, panels(fig), 0, '.viz-wf__col');

  /* ---------- زنجیره‌ی تأمین: شاخص‌های هر حلقه ---------- */

  viz.supply = (fig) => {
    wires($('.wired', fig)).forEach((p) => p.classList.add('is-live'));
    modes(fig, 3800, panels(fig), 0, '.viz-sc__stage');
  };

  /* ---------- موجودی: سه سطح موجودی اطمینان ---------- */

  viz.stock = (fig) => {
    const d = JSON.parse(fig.dataset.stock);   // max، cost، scen: [{ss, rop, v, out}]
    const n = d.scen[0].v.length;
    const { X, Y, line } = scale(n, 0, d.max);
    const lineEl = $('.viz-stock__line', fig), outEl = $('.viz-stock__out', fig);
    const ss = $('.viz-stock__ss', fig), rop = $('.viz-stock__rop', fig), ropl = $('.viz-stock__ropl', fig);
    const short = $('.viz-stock__short', fig), avg = $('.viz-stock__avg', fig), cap = $('.viz-stock__cap', fig);
    let vals = d.scen[1].v, outs = d.scen[1].out;
    // مقدارهای روزانه، به‌اضافه‌ی نقطه‌ی سفارش و موجودی اطمینان در دو خانه‌ی آخر
    const draw = morph((vs) => {
      vals = vs.slice(0, n);
      const yr = Y(vs[n]).toFixed(1), ys = Y(vs[n + 1]);
      lineEl.setAttribute('d', line(vals));
      rop.setAttribute('y1', yr);
      rop.setAttribute('y2', yr);
      ss.setAttribute('y', ys.toFixed(1));
      ss.setAttribute('height', (300 - ys).toFixed(1));
      ropl.style.top = (yr / 3) + '%';
    });
    const w = 1000 / (n - 1) / 2;
    modes(fig, 4600, (k) => {
      const s = d.scen[k], mean = s.v.reduce((a, b) => a + b, 0) / n;
      outs = s.out;
      draw([...s.v, s.rop, s.ss]);
      outEl.setAttribute('d', s.out.map((o, i) => (o ? `M${Math.min(1000, X(i) + w).toFixed(1)} 299L${Math.max(0, X(i) - w).toFixed(1)} 299` : '')).join(''));
      short.textContent = `${faNum(s.out.reduce((a, b) => a + b, 0))} روز`;
      avg.textContent = `${faNum(Math.round(mean))} عدد`;
      cap.textContent = `${faNum(Math.round(mean * d.cost))} میلیون تومان`;
    }, 1);
    crosshair($('.viz-plot__area', fig), n,
      (i) => `روز ${faNum(i + 1)} · ${outs[i] ? 'کمبود' : `${faNum(Math.round(vals[i]))} عدد`}`,
      (i) => (Y(vals[i]) / 300) * 100);
  };

  /* ---------- OTIF: صد سفارش ---------- */

  viz.otif = (fig) => {
    const cells = $$('.viz-otif__grid i', fig);
    const rank = cells.map((c) => Number(c.style.getPropertyValue('--r')));
    const grid = $('.viz-otif__grid', fig), big = $('.viz-otif__big b', fig);
    const [okN, lateN, partN] = $$('.viz-otif__legend b', fig);
    modes(fig, 4200, (k, btn) => {
      const late = Number(btn.dataset.late), part = Number(btn.dataset.part), ok = 100 - late - part;
      // دیرها از ابتدای ترتیب و ناقص‌ها از انتهای آن، تا هر حالت جای ثابتی داشته باشد
      cells.forEach((c, i) => {
        c.className = rank[i] < late ? 'is-late' : rank[i] >= 100 - part ? 'is-part' : 'is-ok';
      });
      big.textContent = `${faNum(ok)}٪`;
      okN.textContent = faNum(ok); lateN.textContent = faNum(late); partN.textContent = faNum(part);
      grid.setAttribute('aria-label', `۱۰۰ سفارش: ${faNum(ok)} کامل و به‌موقع، ${faNum(late)} دیر، ${faNum(part)} ناقص`);
    });
  };

  /* ---------- زمان تحویل: راهنمای هر محموله ---------- */

  viz.leadtime = (fig) => {
    hoverTip($('.viz-lt', fig), $('.viz-lt__tip', fig), (el) => {
      const dot = el.closest && el.closest('.viz-lt__dot');
      if (!dot) return null;
      const v = Number(dot.dataset.v), p = Number(dot.closest('.viz-lt__row').dataset.promise);
      const diff = v - p;
      return { el: dot, text: `محموله‌ی ${faNum(Number(dot.dataset.k))} · ${faNum(v)} روز${diff > 0 ? ` (${faNum(diff)} روز دیرتر از تعهد)` : ''}` };
    });
  };

  /* ---------- ماتریس ریسک: کارت هر تأمین‌کننده ---------- */

  viz.risk = (fig) => modes(fig, 4200, panels(fig), 0, '.viz-risk__pt');

  /* ---------- گلوگاه: خروجی خط برابر کندترین ایستگاه ---------- */

  viz.line = (fig) => {
    const box = $('.viz-line', fig);
    const sts = $$('.viz-line__st', fig);
    const out = $('.viz-line__out b', fig);
    modes(fig, 4600, (k, btn) => {
      const caps = btn.dataset.caps.split(' ').map(Number);
      const rate = Math.min(...caps), neck = caps.indexOf(rate);
      let inflow = caps[0];
      sts.forEach((st, i) => {
        // هر چهار واحد در ساعت که بیشتر از ظرفیت می‌رسد، یک نشانه در صف (حداکثر هشت)
        const grow = i ? Math.max(0, inflow - caps[i]) : 0;
        inflow = Math.min(inflow, caps[i]);
        const q = $('.viz-line__queue', st), want = Math.min(8, Math.ceil(grow / 4));
        while (q.children.length < want) q.appendChild(document.createElement('i'));
        while (q.children.length > want) q.lastChild.remove();
        st.classList.toggle('is-neck', i === neck);
        $('.viz-line__cap b', st).textContent = faNum(caps[i]);
        $('.viz-line__util i', st).style.setProperty('--v', (rate / caps[i]).toFixed(3));
        $('.viz-line__pct', st).textContent = `بهره‌برداری ${faNum(Math.round((rate / caps[i]) * 100))}٪`;
      });
      out.textContent = faNum(rate);
      box.style.setProperty('--speed', (30 / rate).toFixed(2));
    });
  };

  /* ---------- دوازده شاخص: کاشی‌ها، گروه‌ها و توضیح هر شاخص ---------- */

  viz.kpis = (fig) => {
    const tiles = $$('.viz-kpi', fig);
    const filters = $$('.viz-kpis__filter button', fig);
    const panel = panels(fig);
    let group = 'all';
    const filter = (g) => {
      group = g;
      filters.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.group === g)));
      tiles.forEach((t) => t.classList.toggle('is-dim', g !== 'all' && t.dataset.group !== g));
    };
    const play = autoplay(fig, tiles.length, 3400, (k) => {
      tiles.forEach((t, i) => t.setAttribute('aria-pressed', String(i === k)));
      panel(k);
    });
    tiles.forEach((t, i) => t.addEventListener('click', () => {
      if (group !== 'all' && t.dataset.group !== group) filter('all');
      play.pick(i);
    }));
    filters.forEach((b) => b.addEventListener('click', () => {
      filter(b.dataset.group);
      const first = tiles.findIndex((t) => b.dataset.group === 'all' || t.dataset.group === b.dataset.group);
      play.pick(first);
    }));
  };

  /** برچسب درون نوار فقط وقتی دیده می‌شود که در پهنای نوار جا شود */
  const fitLabels = (els) => els.forEach((em) => {
    em.classList.remove('is-hidden');
    em.classList.toggle('is-hidden', em.offsetWidth > em.parentElement.offsetWidth + 8);
  });

  /* ---------- چرخه‌ی تبدیل نقد: سناریوها و اهرم‌ها ---------- */

  viz.ccc = (fig) => {
    const box = $('.viz-ccc', fig);
    const btns = $$('.seg button', fig), note = $('.viz__note', fig);
    const inputs = $$('.viz-ccc__controls input', fig);
    const ems = $$('.viz-ccc__track em', fig);
    const days = $('.viz-ccc__days', fig), cash = $('.viz-ccc__cash', fig), gapEm = $('.viz-ccc__gap em', fig);
    const val = {};
    const render = () => {
      const { dio, dso, dpo } = val, c = dio + dso - dpo;
      const [inv, ar, ap] = ems;
      inv.textContent = `موجودی ${faNum(dio)} روز`;
      ar.textContent = `مطالبات ${faNum(dso)} روز`;
      ap.textContent = `${faNum(dpo)} روز`;
      inputs.forEach((inp) => {
        inp.value = val[inp.dataset.k];
        inp.previousElementSibling.querySelector('b').textContent = `${faNum(val[inp.dataset.k])} روز`;
      });
      box.style.setProperty('--dio', dio);
      box.style.setProperty('--dso', dso);
      box.style.setProperty('--dpo', dpo);
      box.style.setProperty('--gs', Math.min(dpo, dio + dso));
      box.style.setProperty('--gl', Math.abs(c));
      box.classList.toggle('is-neg', c < 0);
      gapEm.textContent = c < 0 ? `${faNum(-c)} روز منفی` : `${faNum(c)} روز`;
      days.textContent = c < 0 ? `منفی ${faNum(-c)} روز` : `${faNum(c)} روز`;
      cash.textContent = c < 0 ? 'هیچ؛ تأمین‌کنندگان کار را تأمین مالی می‌کنند' : `${faNum(c * 0.5, (c * 0.5) % 1 ? 1 : 0)} میلیارد تومان`;
      box.setAttribute('aria-label', `چرخه‌ی تبدیل نقد: ${faNum(dio)} روز موجودی به‌اضافه‌ی ${faNum(dso)} روز وصول مطالبات، منهای ${faNum(dpo)} روز اعتبار تأمین‌کننده؛ برابر ${faNum(c)} روز`);
      // پس از پایان جابه‌جایی نوارها، برچسب‌هایی که جا نمی‌شوند پنهان می‌شوند
      setTimeout(() => fitLabels(ems), reduceMotion ? 0 : 520);
    };
    const set = (k) => {
      btns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === k)));
      ['dio', 'dso', 'dpo'].forEach((key) => { val[key] = Number(btns[k].dataset[key]); });
      note.textContent = btns[k].dataset.note;
      render();
    };
    const play = autoplay(fig, btns.length, 4400, set);
    btns.forEach((b, i) => b.addEventListener('click', () => play.pick(i)));
    inputs.forEach((inp) => inp.addEventListener('input', () => {
      play.stop();
      val[inp.dataset.k] = Number(inp.value);
      btns.forEach((b) => b.setAttribute('aria-pressed', 'false'));
      note.textContent = 'مقدارها را خودتان تنظیم کرده‌اید؛ هر روز کوتاه‌تر شدن چرخه، حدود نیم میلیارد تومان نقد آزاد می‌کند.';
      render();
    }));
  };

  /* ---------- ارزش طول عمر مشتری به هزینه‌ی جذب ---------- */

  viz.unit = (fig) => {
    const inputs = $$('.viz-unit__controls input', fig);
    const note = $('.viz__note', fig);
    const units = { arpa: ' میلیون', margin: '٪', churn: '٪', cac: ' میلیون' };
    const money = (v) => (v >= 1000 ? `${faNum(v / 1000, 1)} میلیارد` : `${faNum(v, v < 10 && v % 1 ? 1 : 0)} میلیون`);
    const render = () => {
      const v = {};
      inputs.forEach((inp) => {
        v[inp.dataset.k] = Number(inp.value);
        inp.previousElementSibling.querySelector('b').textContent = `${faNum(Number(inp.value))}${units[inp.dataset.k]}`;
      });
      const life = 100 / v.churn, ltv = (v.arpa * v.margin) / 100 * life, ratio = ltv / v.cac;
      const payback = v.cac / ((v.arpa * v.margin) / 100 / 12), top = Math.max(ltv, v.cac);
      $('.viz-unit__ltv', fig).style.setProperty('--v', (ltv / top).toFixed(3));
      $('.viz-unit__cac', fig).style.setProperty('--v', (v.cac / top).toFixed(3));
      $('.viz-unit__ltvv', fig).textContent = money(ltv);
      $('.viz-unit__cacv', fig).textContent = money(v.cac);
      $('.viz-unit__big b', fig).textContent = faNum(ratio, ratio < 10 ? 1 : 0);
      $('.viz-unit__scale', fig).style.setProperty('--r', (Math.min(ratio, 8) / 8).toFixed(3));
      $('.viz-unit__life', fig).textContent = `${faNum(life, life % 1 ? 1 : 0)} سال`;
      $('.viz-unit__payback', fig).textContent = `${faNum(Math.round(payback))} ماه`;
      const r = faNum(ratio, 1);
      note.textContent = ratio < 1
        ? `زیان‌ده: جذب هر مشتری بیشتر از کل سودی که در طول همکاری می‌سازد هزینه دارد (${r} برابر)؛ رشد سریع‌تر یعنی زیان بیشتر.`
        : ratio < 3
          ? `شکننده: هر تومان هزینه‌ی جذب ${r} تومان سود ناخالص برمی‌گرداند؛ پس از هزینه‌های دیگر، سود کمی می‌ماند. ریزش را کم کنید یا جذب را ارزان‌تر.`
          : ratio <= 6
            ? `سالم: هر تومان هزینه‌ی جذب، در طول همکاری ${r} تومان سود ناخالص برمی‌گرداند.`
            : `بسیار سالم (${r} برابر): شاید بتوان برای رشد سریع‌تر، بیشتر برای جذب مشتری هزینه کرد.`;
    };
    inputs.forEach((inp) => inp.addEventListener('input', render));
  };

  /* ---------- درخت شاخص‌ها: سه وضعیت ---------- */

  viz.tree = (fig) => {
    const nodes = $$('.viz-tree__node', fig);
    const paths = wires($('.wired', fig));
    const words = { 'up-good': '▲ بهتر شد', 'up-bad': '▲ بدتر شد', 'down-good': '▼ بهتر شد', 'down-bad': '▼ بدتر شد', flat: '– بی‌تغییر' };
    modes(fig, 5200, (k) => {
      const state = {};
      nodes.forEach((n) => {
        const st = n.dataset.states.split(' ')[k], tone = st.split('-')[1];
        state[n.dataset.node] = st;
        n.dataset.state = st;
        const line = $('.viz-tree__st', n);
        line.textContent = words[st];
        if (tone) {
          const mark = document.createElement('i');
          mark.className = 'viz-st';
          mark.dataset.st = tone;
          line.prepend(mark);
        }
      });
      // سیمی جاری است که شاخص مبدأش تغییر کرده؛ رنگش خوب یا بد بودن همان تغییر است
      paths.forEach((p) => {
        const st = state[p.dataset.from];
        p.classList.toggle('is-live', st !== 'flat');
        p.classList.toggle('is-good', st.endsWith('good'));
        p.classList.toggle('is-bad', st.endsWith('bad'));
      });
    });
  };

  $$('figure[data-viz]').forEach((fig) => {
    const init = viz[fig.dataset.viz];
    if (init) init(fig);
  });
})();
