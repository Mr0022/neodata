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
- صفحه‌های درون پوشه (مثل articles/rag.html): نشانی‌های نسبی نوار ناوبری و پانویس، که از ریشه‌ی
  سایت نوشته شده‌اند، برای جای همان صفحه بازنویسی می‌شوند (consult ← ../consult). در 404.html، که
  Cloudflare Pages آن را در هر نشانی ناموجودی نشان می‌دهد، همه‌ی نشانی‌ها از ریشه‌ی دامنه‌اند (/consult).

نشانی صفحه‌ها بی‌پسوند است (consult، articles/rag، و ./ برای صفحه‌ی اصلی)، همان نشانی‌ای که Cloudflare
Pages سرو می‌کند؛ پیوند با .html هر بار یک ریدایرکت دارد و خطا شمرده می‌شود.

در پایان بررسی می‌کند همه‌ی آیکون‌های به‌کاررفته تعریف شده‌اند و همه‌ی نشانی‌ها (صفحه، شیوه‌نامه،
اسکریپت، تصویر) به فایلی موجود می‌روند؛ اگر نه، با خطا تمام می‌شود.
"""
import pathlib
import posixpath
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPRITE = re.compile(r'(<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">\n)(.*?)(</svg>)', re.S)
NAV = re.compile(r'  <!-- ناوبری بالا:.*?</nav>', re.S)
FOOTER = re.compile(r'^([ \t]*)(<footer class="site-foot[^"]*">)\n(.*?)^[ \t]*</footer>', re.S | re.M)
# نشانی نسبی: نه طرح‌دار (https:، mailto:، tel:)، نه #…، نه از ریشه‌ی دامنه (/…)
LOCAL = re.compile(r'((?:href|src)=")(?![a-z][a-z0-9+.-]*:|#|/)([^"]+)(")')
# همه‌ی نشانی‌های این سایت، نسبی یا از ریشه‌ی دامنه
SITE = re.compile(r'((?:href|src)=")(?![a-z][a-z0-9+.-]*:|#|//)([^"]+)(")')


def pages():
    """صفحه‌های سایت: پوشه‌ی ریشه و پوشه‌ی مقاله‌ها (کارت ویزیت در print/ صفحه‌ی سایت نیست)"""
    return sorted(ROOT.glob('*.html')) + sorted(ROOT.glob('articles/**/*.html'))


def rebase(html, page_dir):
    """نشانی‌های نسبیِ نوشته‌شده از ریشه‌ی سایت را برای صفحه‌ای در page_dir (مثلاً articles) نسبی می‌کند؛
    با page_dir='/' همه از ریشه‌ی دامنه می‌شوند (برای 404.html)"""
    if page_dir == '.':
        return html

    def fix(m):
        path, rest = re.match(r'([^?#]*)(.*)', m.group(2)).groups()
        if page_dir == '/':
            p = posixpath.normpath(path)
            rel = '/' + ('' if p == '.' else p)
        else:
            rel = posixpath.relpath(path, page_dir)
        if path.endswith('/'):
            rel = rel.rstrip('/') + '/'
        return m.group(1) + rel + rest + m.group(3)

    return LOCAL.sub(fix, html)


def pretty(html):
    """پیوند به صفحه‌ها بی‌پسوند: consult.html ← consult، index.html#process ← ./#process"""
    def fix(m):
        path, rest = re.match(r'([^?#]*)(.*)', m.group(2)).groups()
        if not path.endswith('.html'):
            return m.group(0)
        path = path[:-len('.html')]
        if path == 'index' or path.endswith('/index'):
            path = path[:-len('index')] or './'
        return m.group(1) + path + rest + m.group(3)

    return re.sub(r'(href=")(?![a-z][a-z0-9+.-]*:|#|/)([^"]+)(")', fix, html)


def page_nav(nav):
    """پیوندهای صحنه‌ی صفحه‌ی اصلی، در صفحه‌های دیگر به خود صفحه‌ی اصلی می‌روند"""
    nav = nav.replace('href="#hero" data-goto="hero"', 'href="./"')
    nav = re.sub(r'href="#([a-z-]+)" data-goto="\1"', r'href="./#\1"', nav)
    if 'data-goto' in nav or re.search(r'<a [^>]*href="#', nav):
        sys.exit('sync-layout: پیوندی در نوار ناوبری به صفحه‌ی اصلی تبدیل نشد')
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
    for attr, url in sorted({(m.group(1), m.group(2)) for m in SITE.finditer(html)}):
        file = re.split(r'[?#]', url, maxsplit=1)[0]
        target = (ROOT if file.startswith('/') else path.parent) / file.lstrip('/')
        if target.is_dir():
            if not file.endswith('/'):
                problems.append(f'پیوند به پوشه بی / پایانی (ریدایرکت می‌شود): {url}')
            target = target / 'index.html'
        elif not target.exists() and not target.suffix:
            target = target.with_name(target.name + '.html')   # consult ← consult.html
        if attr == 'href="' and file.endswith('.html'):
            problems.append(f'پیوند با .html (ریدایرکت می‌شود؛ بی‌پسوند بنویسید): {url}')
        elif not target.exists():
            problems.append(f'پیوند به فایل ناموجود: {url}')
    return [f'{path.relative_to(ROOT)}: {p}' for p in problems]


def main():
    index = (ROOT / 'index.html').read_text(encoding='utf-8')
    sprite = SPRITE.search(index).group(2)
    nav = page_nav(NAV.search(index).group(0))
    foot = FOOTER.search(index)
    foot_indent, foot_body = foot.group(1), foot.group(3)

    problems = check(ROOT / 'index.html', index)
    for path in pages():
        if path.name == 'index.html' and path.parent == ROOT:
            continue
        name = path.relative_to(ROOT).as_posix()
        here = '/' if path == ROOT / '404.html' else path.parent.relative_to(ROOT).as_posix()
        html = path.read_text(encoding='utf-8')
        html, n_sprite = SPRITE.subn(lambda m: m.group(1) + sprite + m.group(3), html, count=1)
        html, n_nav = NAV.subn(lambda m: rebase(nav, here), html, count=1)
        html, n_foot = FOOTER.subn(
            lambda m: m.group(1) + m.group(2) + '\n' + rebase(reindent(foot_body, foot_indent, m.group(1)), here) + m.group(1) + '</footer>',
            html, count=1)
        missing = [label for label, n in (('آیکون‌ها', n_sprite), ('نوار ناوبری', n_nav), ('پانویس', n_foot)) if not n]
        if missing:
            problems.append(f'{name}: پیدا نشد: {"، ".join(missing)}')
            continue
        path.write_text(html, encoding='utf-8')
        problems += check(path, html)
        print(f'{name}: به‌روز شد')

    if problems:
        print('\n'.join(problems), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
