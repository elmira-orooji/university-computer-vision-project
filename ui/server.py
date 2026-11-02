"""Local Pixel Studio. Run from any directory: python ui/server.py."""
from collections import OrderedDict
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import parse_qs, urlsplit
import json
import logging
import re
import time
import uuid

try:
    from . import codec
except ImportError:
    import codec

ROOT = Path(__file__).resolve().parents[1]
PORT = 8766
records = OrderedDict()
record_lock = Lock()
conversion_lock = Lock()
STATIC = {'/', '/index.html', '/favicon.svg',
          '/fonts/Vazirmatn-Regular.ttf', '/fonts/Vazirmatn-Bold.ttf', '/fonts/OFL.txt'}


def static_path(path):
    if path in {'/', '/index.html'}:
        return ROOT / 'ui/dist/index.html'
    if path in STATIC:
        return ROOT / 'ui' / path.lstrip('/')
    if path.startswith('/assets/'):
        name = path[len('/assets/'):]
        if re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', name):
            assets = (ROOT / 'ui/dist/assets').resolve()
            candidate = (assets / name).resolve()
            if candidate.parent == assets:
                return candidate
    return None


class ApiError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def remember(decoded, source, name, mode, elapsed):
    record = {'decoded': decoded, 'source': source, 'name': name, 'mode': mode, 'elapsed': elapsed}
    key = uuid.uuid4().hex
    with record_lock:
        while records and (len(records) >= 2 or sum(r['decoded']['width'] * r['decoded']['height'] for r in records.values()) + decoded['width'] * decoded['height'] > codec.MAX_PIXELS):
            records.popitem(last=False)
        records[key] = record
    return key, record


def get_record(key):
    with record_lock:
        if key not in records:
            raise ApiError('این نتیجه دیگر در حافظه نیست؛ فایل را دوباره باز کنید.', 410)
        return records[key]


def window_data(record, x, y, size=10):
    decoded = record['decoded']
    width, height = decoded['width'], decoded['height']
    if not 0 <= x < width or not 0 <= y < height or not 1 <= size <= 16:
        raise ApiError('مختصات پیکسل معتبر نیست.')
    start_x, start_y = max(0, min(x - size // 2, width - size)), max(0, min(y - size // 2, height - size))
    rows = []
    for py in range(start_y, min(start_y + size, height)):
        row = []
        for px in range(start_x, min(start_x + size, width)):
            pixel = decoded['matrix'][py][px]
            row.append({'x': px, 'y': py, 'rgba': codec.rgba(pixel, decoded['sample_depth']),
                        'values': [pixel] if isinstance(pixel, int) else list(pixel)})
        rows.append(row)
    return {'rows': rows, 'x': x, 'y': y, 'start_x': start_x, 'start_y': start_y}


def describe(key, record):
    decoded = record['decoded']
    return {'id': key, 'name': record['name'], 'width': decoded['width'], 'height': decoded['height'],
            'bit_depth': decoded['bit_depth'], 'sample_depth': decoded['sample_depth'], 'channels': decoded['channels'],
            'color_type': decoded['color_type'], 'interlace': decoded['interlace'],
            'bytes': len(record['source']), 'mode': record['mode'], 'elapsed': record['elapsed'],
            'window': window_data(record, decoded['width'] // 2, decoded['height'] // 3)}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'ui'), **kwargs)

    def setup(self):
        super().setup()
        self.connection.settimeout(30)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def check_origin(self):
        hosts = {f'localhost:{self.server.server_port}', f'127.0.0.1:{self.server.server_port}'}
        if self.headers.get('Host') not in hosts or self.headers.get('Origin', '') not in {'', *('http://' + h for h in hosts)}:
            raise ApiError('مبدأ درخواست مجاز نیست.', 403)

    def json_response(self, value, status=200):
        data = json.dumps(value, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_head(self):
        try:
            self.check_origin()
        except ApiError as exc:
            self.send_error(exc.status)
            return None
        path = static_path(urlsplit(self.path).path)
        if path is None or not path.is_file():
            self.send_error(404)
            return None
        try:
            file = path.open('rb')
        except OSError:
            self.send_error(404)
            return None
        self.send_response(200)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Content-Length', str(path.stat().st_size))
        self.end_headers()
        return file

    def do_GET(self):
        try:
            self.check_origin()
            parsed = urlsplit(self.path)
            query = parse_qs(parsed.query)
            if parsed.path == '/api/window':
                record = get_record(query.get('id', [''])[0])
                self.json_response(window_data(record, int(query.get('x', ['0'])[0]), int(query.get('y', ['0'])[0])))
                return
            if parsed.path == '/api/file':
                record = get_record(query.get('id', [''])[0])
                kind = query.get('kind', ['source'])[0]
                if kind not in {'source', 'png', 'matrix'}:
                    raise ApiError('نوع خروجی معتبر نیست.')
                if kind == 'matrix':
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/plain; charset=utf-8')
                    self.send_header('Content-Disposition', 'attachment; filename="pixel_matrix.txt"')
                    self.end_headers()
                    for line in codec.matrix_lines(record['decoded']):
                        self.wfile.write(line.encode())
                else:
                    if kind == 'png':
                        if not conversion_lock.acquire(blocking=False):
                            raise ApiError('یک تبدیل در حال اجراست؛ کمی بعد دوباره تلاش کنید.', 409)
                        try:
                            data = codec.encode_png(record['decoded'])
                        finally:
                            conversion_lock.release()
                    else:
                        data = record['source']
                    self.send_response(200)
                    self.send_header('Content-Type', 'image/png')
                    if kind == 'png':
                        self.send_header('Content-Disposition', 'attachment; filename="reconstructed.png"')
                    self.send_header('Content-Length', str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                return
            if static_path(parsed.path) is None:
                self.send_error(404)
                return
            super().do_GET()
        except (BrokenPipeError, ConnectionResetError):
            pass
        except ApiError as exc:
            self.json_response({'error': str(exc)}, exc.status)
        except ValueError:
            self.json_response({'error': 'پارامترهای درخواست معتبر نیستند.'}, 400)
        except Exception:
            logging.exception('GET failed')
            self.json_response({'error': 'دریافت نتیجه ناموفق بود.'}, 500)

    def do_POST(self):
        locked = False
        try:
            self.check_origin()
            parsed = urlsplit(self.path)
            query = parse_qs(parsed.query)
            if parsed.path not in {'/api/convert', '/api/sample'}:
                raise ApiError('مسیر درخواست موجود نیست.', 404)
            locked = conversion_lock.acquire(blocking=False)
            if not locked:
                raise ApiError('یک تبدیل در حال اجراست؛ کمی بعد دوباره تلاش کنید.', 409)
            start = time.perf_counter()
            if parsed.path == '/api/sample':
                name = query.get('name', ['flower'])[0]
                if name not in {'flower', 'shrimp', 'matrix'}:
                    raise ApiError('تصویر نمونه موجود نیست.')
                if name == 'matrix':
                    example = {'width': 16, 'height': 16, 'channels': 3, 'sample_depth': 8,
                               'matrix': [[(x * 17, y * 17, (x + y) * 8) for x in range(16)] for y in range(16)]}
                    source = ''.join(codec.matrix_lines(example)).encode()
                    name, mode = 'sample_matrix.txt', 'encode'
                else:
                    source = (ROOT / (name + '.png')).read_bytes()
                    name += '.png'
                    mode = 'decode'
            else:
                mode = query.get('mode', ['decode'])[0]
                if mode not in {'decode', 'encode'}:
                    raise ApiError('نوع تبدیل معتبر نیست.')
                lengths = self.headers.get_all('Content-Length', [])
                if len(lengths) != 1 or not lengths[0].isascii() or not lengths[0].isdigit() or self.headers.get('Transfer-Encoding'):
                    raise ApiError('حجم درخواست معتبر نیست.')
                if len(lengths[0]) > 10:
                    raise ApiError('حجم درخواست بیش از حد مجاز است.', 413)
                size = int(lengths[0])
                limit = codec.MAX_PNG_BYTES if mode == 'decode' else codec.MAX_MATRIX_BYTES
                if not 0 < size <= limit:
                    raise ApiError('فایل خالی است یا حجم آن بیش از حد مجاز است.', 413)
                source = self.rfile.read(size)
                if len(source) != size:
                    raise ApiError('دریافت فایل کامل نشد.')
                name = query.get('name', ['image.png' if mode == 'decode' else 'matrix.txt'])[0][:120]
            decoded = codec.decode_png(source) if mode == 'decode' else codec.parse_matrix(source)
            if mode == 'encode':
                source = codec.encode_png(decoded)
            elapsed = round((time.perf_counter() - start) * 1000)
            key, record = remember(decoded, source, name, mode, elapsed)
            payload, status = describe(key, record), 200
        except (ApiError, ValueError) as exc:
            payload, status = {'error': str(exc)}, getattr(exc, 'status', 400)
        except TimeoutError:
            payload, status = {'error': 'زمان دریافت فایل به پایان رسید.'}, 408
        except Exception:
            logging.exception('Conversion failed')
            payload, status = {'error': 'تبدیل فایل انجام نشد؛ گزارش سرور را بررسی کنید.'}, 500
        finally:
            if locked:
                conversion_lock.release()
        try:
            self.json_response(payload, status)
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass

    def do_HEAD(self):
        try:
            self.check_origin()
            if static_path(urlsplit(self.path).path) is None:
                self.send_error(404)
                return
            super().do_HEAD()
        except ApiError as exc:
            self.send_error(exc.status)


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    print(f'Pixel Studio: http://127.0.0.1:{PORT}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
