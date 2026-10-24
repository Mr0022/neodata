#!/usr/bin/env python3
"""
سرور پیش‌نمایش محلی که نشانی‌ها را مثل Cloudflare Pages سرو می‌کند:

    python3 tools/serve.py          # سپس http://localhost:8080
    python3 tools/serve.py 3000     # درگاه دیگر

- /consult فایل consult.html را نشان می‌دهد، و /consult.html با ریدایرکت ۳۰۸ به /consult می‌رود.
- /articles/ فایل articles/index.html است و /articles به /articles/ ریدایرکت می‌شود.
- نشانی ناموجود، 404.html را با وضعیت ۴۰۴ برمی‌گرداند.

پس پیوندها همان‌طور که در سایت منتشرشده کار می‌کنند، این‌جا هم کار می‌کنند.
"""
import functools
import http.server
import pathlib
import sys
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.route():
            super().do_GET()

    def do_HEAD(self):
        if self.route():
            super().do_HEAD()

    def route(self):
        """نشانی بی‌پسوند را به فایل .html آن می‌رساند؛ نشانی .html را ریدایرکت می‌کند"""
        url = urllib.parse.urlsplit(self.path)
        path = urllib.parse.unquote(url.path)
        query = '?' + url.query if url.query else ''
        if path.endswith('.html'):
            target = path[:-len('index.html')] if path.endswith('/index.html') or path == '/index.html' else path[:-len('.html')]
            self.send_response(308)
            self.send_header('Location', urllib.parse.quote(target) + query)
            self.end_headers()
            return False
        file = ROOT / path.lstrip('/')
        if not path.endswith('/') and not file.exists() and file.with_name(file.name + '.html').is_file():
            self.path = url.path + '.html' + query
        return True

    def send_error(self, code, message=None, explain=None):
        page = ROOT / '404.html'
        if code != 404 or not page.is_file():
            return super().send_error(code, message, explain)
        body = page.read_bytes()
        self.send_response(404)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(('127.0.0.1', port), handler) as server:
        print(f'http://localhost:{port}  (Ctrl+C برای توقف)')
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
