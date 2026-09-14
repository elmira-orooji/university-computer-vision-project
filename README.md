# University Computer Vision Project

A Python coursework project that reads PNG files into a pixel matrix and reconstructs a PNG from that matrix without relying on image-processing libraries such as Pillow or OpenCV.

The implementation works directly with the PNG file format: it reads chunk data, decompresses image data, reverses PNG scanline filters, supports Adam7 interlacing, and writes a new PNG with valid PNG chunks and CRC values.

## Features

- Validates the PNG signature and reads `IHDR`, `IDAT`, `PLTE`, `tRNS`, and `IEND` chunks.
- Supports grayscale, truecolor, indexed-color, grayscale-with-alpha, and truecolor-with-alpha PNG data.
- Handles 8-bit and 16-bit channel values.
- Reconstructs PNG scanlines filtered with None, Sub, Up, Average, and Paeth filters.
- Supports non-interlaced PNGs and Adam7 interlaced PNGs when reading.
- Exports pixel data to a readable matrix text file.
- Creates a PNG from a compatible matrix text file using unfiltered scanlines.

## Repository layout

```text
.
├── pic-to-data-exercise1.py  # Interactive PNG ↔ matrix converter
├── flower.png                # Sample PNG
└── shrimp.png                # Sample PNG
```

## Requirements

- Python 3

The project uses only the Python standard library:

- `struct`
- `zlib`
- `math`
- `os`
- `ast`

No package installation is required.

## Run

From the repository root:

```bash
python pic-to-data-exercise1.py
```

The program presents this menu:

```text
1. Convert PNG to Matrix
2. Convert Matrix to PNG
3. Exit
```

## Convert PNG to a matrix

Choose option `1` and enter the path to a PNG file. The program creates a text file next to the input image using this naming pattern:

```text
<input-file>.png_matrix.txt
```

The file begins with image metadata, followed by one Python-style list per pixel row. For example:

```text
Width: 640, Height: 480
Bit Depth: 8, Color Type: 2
Interlaced: No
--------------------------------------------------
[(255, 0, 0), (0, 255, 0), ...]
```

## Convert a matrix to PNG

Choose option `2` and provide a matrix file produced by the first workflow. The program parses each row with `ast.literal_eval`, selects a PNG color type from the matrix values, compresses unfiltered scanlines, and writes:

```text
<matrix-file-without-.txt>_generated.png
```

## Implementation notes

- Reading supports indexed-color palettes and transparency chunks.
- The matrix-to-PNG path writes 8-bit or 16-bit grayscale, grayscale-alpha, RGB, or RGBA images according to the matrix data.
- Generated PNGs use filter type `0` (None) for each output scanline.
- Matrix files should be treated as trusted input. Although `ast.literal_eval` does not execute arbitrary code, malformed or extremely large files can still fail or consume significant memory.

## Limitations

- The writer does not create indexed-color PNGs or Adam7-interlaced output.
- PNG metadata outside the chunks needed for pixel decoding is not preserved when writing a new file.
- The program keeps the full decoded image matrix in memory, so very large images require more memory.

## License

No license file is currently included in this repository. All rights remain with the repository owner unless a license is added.
