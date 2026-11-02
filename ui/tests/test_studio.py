import http.client
import io
import json
import re
from pathlib import Path
import struct
import threading
import unittest
import zlib

from ui import codec, server


def fixture_png(width=2, height=1, depth=8, color=6, raw=None, extra=(), interlace=0):
    output = io.BytesIO()
    output.write(codec.SIGNATURE)
    codec.coursework.write_png_chunk(output, b'IHDR', struct.pack('>IIBBBBB', width, height, depth, color, 0, 0, interlace))
    for kind, content in extra:
        codec.coursework.write_png_chunk(output, kind, content)
    codec.coursework.write_png_chunk(output, b'IDAT', zlib.compress(raw if raw is not None else bytes([0, 255, 0, 0, 255, 0, 128, 255, 64])))
    codec.coursework.write_png_chunk(output, b'IEND', b'')
    return output.getvalue()


class CodecTests(unittest.TestCase):
    def test_rgba_roundtrip_includes_alpha(self):
        decoded = codec.decode_png(fixture_png())
        self.assertEqual(decoded['matrix'], [[(255, 0, 0, 255), (0, 128, 255, 64)]])
        self.assertEqual(codec.decode_png(codec.encode_png(decoded))['matrix'], decoded['matrix'])

    def test_text_roundtrip(self):
        original = codec.decode_png(fixture_png())
        parsed = codec.parse_matrix(''.join(codec.matrix_lines(original)).encode())
        self.assertEqual(parsed['matrix'], original['matrix'])
        self.assertEqual(codec.decode_png(codec.encode_png(parsed))['matrix'], original['matrix'])

    def test_16bit_values_not_inferred_from_small_values(self):
        decoded = codec.decode_png(fixture_png(depth=16, color=0, raw=b'\x00\x00\x01\x00\xff'))
        self.assertEqual(decoded['matrix'], [[1, 255]])
        parsed = codec.parse_matrix(''.join(codec.matrix_lines(decoded)).encode())
        rebuilt = codec.decode_png(codec.encode_png(parsed))
        self.assertEqual(rebuilt['bit_depth'], 16)
        self.assertEqual(rebuilt['matrix'], [[1, 255]])

    def test_16bit_rgba_channels_and_alpha(self):
        values = [65535, 257, 3, 32768, 42, 500, 60000, 0]
        raw = b'\x00' + b''.join(struct.pack('>H', value) for value in values)
        decoded = codec.decode_png(fixture_png(depth=16, raw=raw))
        rebuilt = codec.decode_png(codec.encode_png(codec.parse_matrix(''.join(codec.matrix_lines(decoded)).encode())))
        self.assertEqual(rebuilt['matrix'], [[tuple(values[:4]), tuple(values[4:])]])

    def test_animation_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'متحرک'):
            codec.decode_png(fixture_png(extra=[(b'acTL', struct.pack('>II', 1, 0))]))

    def test_palette_is_expanded_before_export(self):
        decoded = codec.decode_png(fixture_png(depth=1, color=3, raw=b'\x00\x40',
            extra=[(b'PLTE', b'\xff\x00\x00\x00\xff\x00'), (b'tRNS', b'\xff\x00')]))
        self.assertEqual(decoded['matrix'], [[(255, 0, 0, 255), (0, 255, 0, 0)]])
        parsed = codec.parse_matrix(''.join(codec.matrix_lines(decoded)).encode())
        self.assertEqual(codec.decode_png(codec.encode_png(parsed))['matrix'], decoded['matrix'])

    def test_packed_grayscale_scales_for_8bit_writer(self):
        decoded = codec.decode_png(fixture_png(depth=1, color=0, raw=b'\x00\x40'))
        self.assertEqual(decoded['matrix'], [[0, 255]])
        self.assertEqual(codec.decode_png(codec.encode_png(decoded))['matrix'], [[0, 255]])

    def test_legacy_low_depth_grayscale_alpha(self):
        data = b'Width: 2, Height: 1\nBit Depth: 1, Color Type: 0\n---\n[(0,0),(1,255)]\n'
        parsed = codec.parse_matrix(data)
        self.assertEqual(parsed['matrix'], [[(0, 0), (255, 255)]])
        self.assertEqual(codec.decode_png(codec.encode_png(parsed))['matrix'], parsed['matrix'])

    def test_all_png_scanline_filters(self):
        previous, current = [10, 30, 50, 70, 90, 110], [20, 40, 70, 90, 130, 200]
        for kind in range(5):
            filtered = []
            for x, value in enumerate(current):
                a, b = (current[x - 3] if x >= 3 else 0), previous[x]
                c = previous[x - 3] if x >= 3 else 0
                predictor = [0, a, b, (a + b) // 2, codec.coursework.paeth_predictor(a, b, c)][kind]
                filtered.append((value - predictor) % 256)
            raw = bytes([0, *previous, kind, *filtered])
            decoded = codec.decode_png(fixture_png(height=2, color=2, raw=raw))
            self.assertEqual(decoded['matrix'][1], [(20, 40, 70), (90, 130, 200)])

    def test_adam7_passes_reassemble(self):
        width, height = 9, 9
        matrix = [[(x * 20, y * 20, 100) for x in range(width)] for y in range(height)]
        raw = bytearray()
        for p in codec.coursework.get_adam7_passes(width, height):
            if not p['w'] or not p['h']:
                continue
            for py in range(p['h']):
                raw.append(0)
                for px in range(p['w']):
                    raw.extend(matrix[p['y0'] + py * p['dy']][p['x0'] + px * p['dx']])
        decoded = codec.decode_png(fixture_png(width, height, color=2, interlace=1, raw=raw))
        self.assertEqual(decoded['matrix'], matrix)

    def test_crc_and_truncation_are_rejected(self):
        data = fixture_png()
        for invalid in [data[:-4], data[:40] + bytes([data[40] ^ 1]) + data[41:], b'not a PNG']:
            with self.assertRaises(ValueError):
                codec.decode_png(invalid)

    def test_dimensions_and_decompressed_size_are_bounded(self):
        for data in [fixture_png(width=1000000), fixture_png(raw=bytes(10000))]:
            with self.assertRaises(ValueError):
                codec.decode_png(data)

    def test_bad_matrix_inputs(self):
        for row in ['[]', '[True]', '[(-1,0,0)]', '[(256,0,0)]', '[(0,0),(1,2,3)]', "[__import__('os')]", '[1]\n[1,2]']:
            with self.subTest(row=row), self.assertRaises(ValueError):
                codec.parse_matrix(('Bit Depth: 8, Color Type: 2\n---\n' + row).encode())

    def test_header_shape_is_checked(self):
        with self.assertRaises(ValueError):
            codec.parse_matrix(b'Width: 2, Height: 3\nBit Depth: 8, Color Type: 0\n---\n[1,2]')


class QuietHandler(server.Handler):
    def log_message(self, *_args):
        pass


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        cls.port = cls.httpd.server_port
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=5)

    def request(self, method, path, data=b'', headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=15)
        try:
            connection.request(method, path, body=data, headers=headers or {})
            response = connection.getresponse()
            return response.status, response.read()
        finally:
            connection.close()

    def test_both_conversion_directions_and_downloads(self):
        status, raw = self.request('POST', '/api/convert?mode=decode&name=test.png', fixture_png())
        self.assertEqual(status, 200)
        decoded = json.loads(raw)
        self.assertEqual((decoded['width'], decoded['height']), (2, 1))
        status, matrix = self.request('GET', '/api/file?id=' + decoded['id'] + '&kind=matrix')
        self.assertEqual(status, 200)
        status, raw = self.request('POST', '/api/convert?mode=encode&name=matrix.txt', matrix)
        self.assertEqual(status, 200)
        encoded = json.loads(raw)
        status, png = self.request('GET', '/api/file?id=' + encoded['id'] + '&kind=png')
        self.assertEqual(status, 200)
        self.assertEqual(codec.decode_png(png)['matrix'], [[(255, 0, 0, 255), (0, 128, 255, 64)]])

    def test_pixel_window_and_invalid_coordinate(self):
        _, raw = self.request('POST', '/api/convert?mode=decode', fixture_png())
        key = json.loads(raw)['id']
        status, raw = self.request('GET', '/api/window?id=' + key + '&x=1&y=0')
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)['rows'][0][1]['rgba'], [0, 128, 255, 64])
        self.assertEqual(self.request('GET', '/api/window?id=' + key + '&x=2&y=0')[0], 400)

    def test_sample_matrix(self):
        status, raw = self.request('POST', '/api/sample?name=matrix')
        self.assertEqual(status, 200)
        data = json.loads(raw)
        self.assertEqual((data['width'], data['height'], data['mode']), (16, 16, 'encode'))

    def test_invalid_requests_and_expired_results(self):
        self.assertEqual(self.request('POST', '/api/convert?mode=nope', b'x')[0], 400)
        self.assertEqual(self.request('POST', '/api/convert?mode=decode', b'bad')[0], 400)
        self.assertEqual(self.request('POST', '/api/sample?name=../flower')[0], 400)
        self.assertEqual(self.request('GET', '/api/window?id=missing')[0], 410)

    def test_private_files_and_cross_origin_are_blocked(self):
        for method in ['GET', 'HEAD']:
            self.assertEqual(self.request(method, '/codec.py')[0], 404)
        self.assertEqual(self.request('POST', '/api/sample?name=matrix', headers={'Origin': 'https://example.com'})[0], 403)
        self.assertEqual(self.request('GET', '/', headers={'Host': 'example.com'})[0], 403)

    def test_built_react_app_and_assets_are_served(self):
        status, html = self.request('GET', '/')
        self.assertEqual(status, 200)
        self.assertIn(b'lang="fa"', html)
        assets = re.findall(rb'(?:src|href)="(/assets/[^"]+)"', html)
        self.assertTrue(assets)
        for asset in assets:
            status, content = self.request('GET', asset.decode())
            self.assertEqual(status, 200)
            self.assertTrue(content)
        for invalid in ['/assets/../server.py', '/assets/../../frontend/package.json', '/app.js', '/style.css']:
            self.assertEqual(self.request('GET', invalid)[0], 404)


if __name__ == '__main__':
    unittest.main()
