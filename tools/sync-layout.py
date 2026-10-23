#!/usr/bin/env python3
"""
نوار ناوبری، پانویس و آیکون‌های صفحه‌ی اصلی را به همه‌ی صفحه‌های دیگر می‌برد.

سایت ابزار ساخت ندارد و این سه بخش در هر فایل HTML تکرار شده‌اند. فقط در index.html ویرایششان
کنید و سپس از ریشه‌ی مخزن اجرا کنید:

    python3 tools/sync-layout.py

- آیکون‌ها: کل فهرست <symbol>های index.html.
- نوار ناوبری: از توضیح «ناوبری بالا» تا </nav>؛ پیوندهای درون‌صفحه‌ای صفحه‌ی اصلی
  (href="#process" data-goto="process") به index.html#process تبدیل می‌شوند.
- پانویس: محتوای <footer class="site-foot">؛ خود تگ footer هر صفحه دست نمی‌خورد.

در پایان بررسی می‌کند همه‌ی آیکون‌های به‌کاررفته تعریف شده‌اند و همه‌ی پیوندهای محلی به فایلی
موجود می‌روند؛ اگر نه، با خطا تمام می‌شود.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPRITE = re.compile(r'(<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">\n)(.*?)(</svg>)', re.S)
NAV = re.compile(r'  <!-- ناوبری بالا:.*?</nav>', re.S)
FOOTER = re.compile(r'^([ \t]*)(<footer class="site-foot[^"]*">)\n(.*?)^[ \t]*</footer>', re.S | re.M)


def page_nav(nav):
    """پیوندهای صحنه‌ی صفحه‌ی اصلی، در صفحه‌های دیگر به خود صفحه‌ی اصلی می‌روند"""
    nav = nav.replace('href="#hero" data-goto="hero"', 'href="index.html"')
    nav = re.sub(r'href="#([a-z-]+)" data-goto="\1"', r'href="index.html#\1"', nav)
    if 'data-goto' in nav or re.search(r'<a [^>]*href="#', nav):
        sys.exit('sync-layout: پیوندی در نوار ناوبری به index.html تبدیل نشد')
    return nav


def reindent(block, src, dst):
    """تورفتگی سطرهای پانویس را با جای تازه‌اش هماهنگ می‌کند"""
    out = []
    for line in block.split('\n'):
        if line.startswith(src):
            line = dst + line[len(src):]
        out.append(line)
    return '\n'.join(out)


def check(path, html):
    problems = []
    used = set(re.findall(r'<use href="#([a-z0-9-]+)"', html))
    defined = set(re.findall(r'<symbol id="([a-z0-9-]+)"', html))
    problems += [f'آیکون تعریف‌نشده: #{i}' for i in sorted(used - defined)]
    for href in sorted(set(re.findall(r'href="([a-z0-9-]+\.html)(?:#[a-z-]*)?"', html))):
        if not (ROOT / href).exists():
            problems.append(f'پیوند به فایل ناموجود: {href}')
    return [f'{path.name}: {p}' for p in problems]


def main():
    index = (ROOT / 'index.html').read_text(encoding='utf-8')
    sprite = SPRITE.search(index).group(2)
    nav = page_nav(NAV.search(index).group(0))
    foot = FOOTER.search(index)
    foot_indent, foot_body = foot.group(1), foot.group(3)

    problems = check(ROOT / 'index.html', index)
    for path in sorted(ROOT.glob('*.html')):
        if path.name == 'index.html':
            continue
        html = path.read_text(encoding='utf-8')
        html, n_sprite = SPRITE.subn(lambda m: m.group(1) + sprite + m.group(3), html, count=1)
        html, n_nav = NAV.subn(lambda m: nav, html, count=1)
        html, n_foot = FOOTER.subn(
            lambda m: m.group(1) + m.group(2) + '\n' + reindent(foot_body, foot_indent, m.group(1)) + m.group(1) + '</footer>',
            html, count=1)
        missing = [name for name, n in (('آیکون‌ها', n_sprite), ('نوار ناوبری', n_nav), ('پانویس', n_foot)) if not n]
        if missing:
            problems.append(f'{path.name}: پیدا نشد: {"، ".join(missing)}')
            continue
        path.write_text(html, encoding='utf-8')
        problems += check(path, html)
        print(f'{path.name}: به‌روز شد')

    if problems:
        print('\n'.join(problems), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
