"""Bounded web adapter around the coursework PNG reader. Standard library only."""
import ast
import importlib.util
import io
from pathlib import Path
import re
import struct
import tempfile
import zlib

ROOT = Path(__file__).resolve().parents[1]
MAX_PIXELS = 3_000_000
MAX_SIDE = 4096
MAX_PNG_BYTES = 12_000_000
MAX_MATRIX_BYTES = 96_000_000
SIGNATURE = b'\x89PNG\r\n\x1a\n'
DEPTHS = {0: {1, 2, 4, 8, 16}, 2: {8, 16}, 3: {1, 2, 4, 8}, 4: {8, 16}, 6: {8, 16}}
CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}
spec = importlib.util.spec_from_file_location('coursework_png', ROOT / 'pic-to-data-exercise1.py')
coursework = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coursework)


def check_dimensions(width, height):
    if not (0 < width <= MAX_SIDE and 0 < height <= MAX_SIDE and width * height <= MAX_PIXELS):
        raise ValueError('حد مجاز تصویر ۳ میلیون پیکسل و طول هر ضلع ۴۰۹۶ پیکسل است.')


def validate_png(data):
    if len(data) > MAX_PNG_BYTES:
        raise ValueError('حجم PNG باید حداکثر ۱۲ مگابایت باشد.')
    if not data.startswith(SIGNATURE):
        raise ValueError('فایل باید یک تصویر PNG معتبر باشد.')
    offset, chunks, compressed = 8, {}, bytearray()
    ended, idat_closed = False, False
    while offset < len(data):
        if offset + 12 > len(data):
            raise ValueError('ساختار PNG ناقص است.')
        length, kind = struct.unpack_from('>I4s', data, offset)
        end = offset + 12 + length
        if end > len(data):
            raise ValueError('بخشی از فایل PNG ناقص است.')
        content = data[offset + 8:end - 4]
        if kind in {b'acTL', b'fcTL', b'fdAT'}:
            raise ValueError('این آزمایشگاه تصویر PNG ثابت می‌پذیرد؛ PNG متحرک پشتیبانی نمی‌شود.')
        crc = struct.unpack_from('>I', data, end - 4)[0]
        if zlib.crc32(kind + content) & 0xffffffff != crc:
            raise ValueError('کنترل یکپارچگی PNG ناموفق بود؛ فایل آسیب دیده است.')
        if not chunks and kind != b'IHDR':
            raise ValueError('سرآیند PNG موجود نیست.')
        if kind == b'IDAT':
            if idat_closed:
                raise ValueError('ترتیب داده‌های PNG معتبر نیست.')
            compressed.extend(content)
        else:
            if compressed:
                idat_closed = True
            if kind in {b'IHDR', b'PLTE', b'tRNS', b'IEND'}:
                if kind in chunks:
                    raise ValueError('بخش تکراری در PNG وجود دارد.')
                if kind in {b'PLTE', b'tRNS'} and compressed:
                    raise ValueError('ترتیب بخش‌های PNG معتبر نیست.')
                chunks[kind] = content
            elif kind[0] & 32 == 0:
                raise ValueError('یک بخش ضروری PNG پشتیبانی نمی‌شود.')
        offset = end
        if kind == b'IEND':
            ended = True
            break
    if not ended or offset != len(data) or chunks.get(b'IEND') != b'' or not compressed:
        raise ValueError('پایان یا داده‌های تصویر PNG معتبر نیست.')
    if len(chunks.get(b'IHDR', b'')) != 13:
        raise ValueError('سرآیند PNG معتبر نیست.')
    width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', chunks[b'IHDR'])
    check_dimensions(width, height)
    if color not in DEPTHS or depth not in DEPTHS[color] or compression != 0 or filtering != 0 or interlace not in {0, 1}:
        raise ValueError('نوع رنگ، عمق بیت یا روش فشرده‌سازی پشتیبانی نمی‌شود.')
    palette, transparency = chunks.get(b'PLTE'), chunks.get(b'tRNS')
    if palette is not None and (not palette or len(palette) % 3 or len(palette) > 768):
        raise ValueError('پالت رنگ PNG معتبر نیست.')
    if color == 3 and (palette is None or len(palette) // 3 > 2 ** depth):
        raise ValueError('پالت رنگ PNG موجود یا معتبر نیست.')
    if transparency is not None:
        required = {0: 2, 2: 6}.get(color)
        if color in {4, 6} or (required is not None and len(transparency) != required):
            raise ValueError('داده‌های شفافیت PNG معتبر نیست.')
        if color == 3 and (not transparency or len(transparency) > len(palette) // 3):
            raise ValueError('شفافیت پالت معتبر نیست.')
    passes = coursework.get_adam7_passes(width, height) if interlace else [{'w': width, 'h': height}]
    bpp = depth * CHANNELS[color]
    expected = sum(p['h'] * (1 + (p['w'] * bpp + 7) // 8) for p in passes if p['w'] and p['h'])
    inflater = zlib.decompressobj()
    try:
        raw = inflater.decompress(compressed, expected + 1)
    except zlib.error as exc:
        raise ValueError('داده‌های فشردهٔ PNG معتبر نیست.') from exc
    if len(raw) != expected or not inflater.eof or inflater.unused_data or inflater.unconsumed_tail:
        raise ValueError('حجم داده‌های بازشده با ابعاد تصویر مطابقت ندارد.')
    return width, height, depth, color, interlace


def decode_png(data):
    validate_png(data)
    with tempfile.TemporaryDirectory(prefix='pixel-') as directory:
        path = Path(directory) / 'input.png'
        path.write_bytes(data)
        try:
            decoded = coursework.read_full_png(str(path), return_data=True)
        except (IndexError, KeyError, struct.error, ValueError) as exc:
            raise ValueError('پیکسل‌ها یا پالت PNG معتبر نیستند.') from exc
    matrix, depth, color = decoded['matrix'], decoded['bit_depth'], decoded['color_type']
    # Palette colors are already expanded by the coursework reader. Low-depth
    # grayscale samples are scaled to 8-bit so reconstruction preserves color.
    if color == 0 and depth < 8:
        maximum = (1 << depth) - 1
        for row in matrix:
            for x, pixel in enumerate(row):
                row[x] = (round(pixel[0] * 255 / maximum), pixel[1]) if isinstance(pixel, tuple) else round(pixel * 255 / maximum)
    decoded['sample_depth'] = 16 if depth == 16 else 8
    decoded['channels'] = len(matrix[0][0]) if isinstance(matrix[0][0], tuple) else 1
    return decoded


def parse_matrix(data):
    if len(data) > MAX_MATRIX_BYTES:
        raise ValueError('حجم فایل ماتریس باید حداکثر ۹۶ مگابایت باشد.')
    try:
        stream = io.StringIO(data.decode('utf-8-sig'))
    except UnicodeError as exc:
        raise ValueError('فایل ماتریس باید با کدگذاری UTF-8 ذخیره شده باشد.') from exc
    matrix, in_rows, depth, dimensions, channels, maximum = [], False, None, None, None, 0
    for line in stream:
        if len(line) > 200_000:
            raise ValueError('طول یک سطر ماتریس بیش از حد مجاز است.')
        line = line.strip()
        if not in_rows:
            match = re.fullmatch(r'Width: (\d+), Height: (\d+)', line)
            if match:
                dimensions = tuple(map(int, match.groups()))
                check_dimensions(*dimensions)
            match = re.match(r'Bit Depth: (\d+),', line)
            if match:
                depth = int(match[1])
                if depth not in {1, 2, 4, 8, 16}:
                    raise ValueError('عمق بیت فایل ماتریس معتبر نیست.')
            if line.startswith('---'):
                in_rows = True
            continue
        if not line:
            continue
        try:
            row = ast.literal_eval(line)
        except (ValueError, SyntaxError, RecursionError) as exc:
            raise ValueError('یک سطر ماتریس قابل خواندن نیست.') from exc
        if not isinstance(row, list) or not row or len(row) > MAX_SIDE:
            raise ValueError('هر سطر باید یک فهرست غیرخالی از پیکسل‌ها باشد.')
        if matrix and len(row) != len(matrix[0]):
            raise ValueError('تعداد پیکسل‌های سطرها یکسان نیست.')
        check_dimensions(len(row), len(matrix) + 1)
        for pixel in row:
            values = pixel if isinstance(pixel, tuple) else (pixel,)
            if channels is None:
                channels = len(values)
            if channels not in {1, 2, 3, 4} or len(values) != channels or (channels == 1 and isinstance(pixel, tuple)):
                raise ValueError('تعداد کانال‌های پیکسل‌ها یکسان یا معتبر نیست.')
            if any(type(value) is not int or not 0 <= value <= 65535 for value in values):
                raise ValueError('مقدار کانال‌ها باید عدد صحیح بین صفر و ۶۵۵۳۵ باشد.')
            maximum = max(maximum, *values)
        matrix.append(row)
    if not matrix or not in_rows:
        raise ValueError('ساختار یا داده‌های ماتریس موجود نیست.')
    height, width = len(matrix), len(matrix[0])
    if dimensions and dimensions != (width, height):
        raise ValueError('ابعاد سرآیند با داده‌های ماتریس مطابقت ندارد.')
    # Legacy palette exports advertise their packed source depth, but contain
    # expanded RGB(A). Preserve those values, while scaling packed grayscale.
    if depth in {1, 2, 4} and channels in {1, 2}:
        gray_maximum = (1 << depth) - 1
        if channels == 1:
            if maximum > gray_maximum:
                raise ValueError('مقدار پیکسل با عمق بیت اعلام‌شده سازگار نیست.')
            matrix = [[round(value * 255 / gray_maximum) for value in row] for row in matrix]
        else:
            for row in matrix:
                for x, (gray, alpha) in enumerate(row):
                    if gray > gray_maximum or alpha > 255:
                        raise ValueError('مقدار خاکستری یا شفافیت با عمق بیت سازگار نیست.')
                    row[x] = (round(gray * 255 / gray_maximum), alpha)
        maximum = 255
    elif depth == 8 and maximum > 255:
        raise ValueError('مقدار کانال برای عمق ۸ بیت بیش از حد مجاز است.')
    sample_depth = 16 if depth == 16 or maximum > 255 else 8
    return {'matrix': matrix, 'width': width, 'height': height, 'bit_depth': sample_depth,
            'sample_depth': sample_depth, 'color_type': {1: 0, 2: 4, 3: 2, 4: 6}[channels], 'channels': channels, 'interlace': 0}


def encode_png(decoded):
    matrix, depth = decoded['matrix'], decoded['sample_depth']
    channels = decoded['channels']
    color = {1: 0, 2: 4, 3: 2, 4: 6}[channels]
    compressor, compressed = zlib.compressobj(), bytearray()
    for row in matrix:
        raw = bytearray([0])
        for pixel in row:
            for value in ((pixel,) if channels == 1 else pixel):
                raw.extend(struct.pack('>H', value)) if depth == 16 else raw.append(value)
        compressed.extend(compressor.compress(raw))
    compressed.extend(compressor.flush())
    output = io.BytesIO()
    output.write(SIGNATURE)
    coursework.write_png_chunk(output, b'IHDR', struct.pack('>IIBBBBB', decoded['width'], decoded['height'], depth, color, 0, 0, 0))
    coursework.write_png_chunk(output, b'IDAT', compressed)
    coursework.write_png_chunk(output, b'IEND', b'')
    return output.getvalue()


def matrix_lines(decoded):
    yield f"Width: {decoded['width']}, Height: {decoded['height']}\n"
    color = {1: 0, 2: 4, 3: 2, 4: 6}[decoded['channels']]
    yield f"Bit Depth: {decoded['sample_depth']}, Color Type: {color}\n"
    yield 'Interlaced: No\n--------------------------------------------------\n'
    for row in decoded['matrix']:
        yield str(row) + '\n'


def rgba(pixel, depth):
    values = [pixel] if isinstance(pixel, int) else list(pixel)
    if len(values) == 1:
        values = values * 3 + [65535 if depth == 16 else 255]
    elif len(values) == 2:
        values = values[:1] * 3 + values[1:]
    elif len(values) == 3:
        values.append(65535 if depth == 16 else 255)
    return [round(value * 255 / 65535) if depth == 16 else value for value in values]
