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

  $$('figure[data-viz]').forEach((fig) => {
    const init = viz[fig.dataset.viz];
    if (init) init(fig);
  });
})();
