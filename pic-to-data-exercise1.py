import struct
import zlib
import math
import os
import ast

#-------------------Reading PNG Pic--------------------------------------------------------

def paeth_predictor(a, b, c):
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc: return a
    elif pb <= pc: return b
    else: return c

def unfilter_scanline(scanline, prev_scanline, filter_bpp, filter_type):
    recon = bytearray(len(scanline))
    for x in range(len(scanline)):
        a = recon[x - filter_bpp] if x >= filter_bpp else 0
        b = prev_scanline[x]
        c = prev_scanline[x - filter_bpp] if x >= filter_bpp else 0
        
        if filter_type == 0: val = scanline[x]
        elif filter_type == 1: val = scanline[x] + a
        elif filter_type == 2: val = scanline[x] + b
        elif filter_type == 3: val = scanline[x] + (a + b) // 2
        elif filter_type == 4: val = scanline[x] + paeth_predictor(a, b, c)
        else: raise ValueError(f"نوع فیلتر نامعتبر است: {filter_type}")
        
        recon[x] = val & 0xff
    return recon

def get_adam7_passes(width, height):
    x_start = [0, 4, 0, 2, 0, 1, 0]
    y_start = [0, 0, 4, 0, 2, 0, 1]
    x_step  = [8, 8, 4, 4, 2, 2, 1]
    y_step  = [8, 8, 8, 4, 4, 2, 2]
    
    passes = []
    for i in range(7):
        pass_w = max(0, math.ceil((width - x_start[i]) / x_step[i]))
        pass_h = max(0, math.ceil((height - y_start[i]) / y_step[i]))
        passes.append({
            'w': pass_w, 'h': pass_h,
            'x0': x_start[i], 'y0': y_start[i],
            'dx': x_step[i], 'dy': y_step[i]
        })
    return passes

def unpack_bits(byte_data, bit_depth, pixels_count):
    pixels = []
    mask = (1 << bit_depth) - 1
    for byte in byte_data:
        for i in range(8 // bit_depth - 1, -1, -1):
            if len(pixels) < pixels_count:
                val = (byte >> (i * bit_depth)) & mask
                pixels.append(val)
    return pixels


#--------------------Convert PNG to Matrix---------------------------------------------

def read_full_png(filepath):
    with open(filepath, 'rb') as f:
        if f.read(8) != b'\x89PNG\r\n\x1a\n':
            raise ValueError("Error! this PNG file is not valid")
        
        chunks = {}
        idat_data = bytearray()
        
        while True:
            l_bytes = f.read(4)
            if not l_bytes: break
            length = struct.unpack('>I', l_bytes)[0]
            ctype = f.read(4).decode('ascii')
            cdata = f.read(length)
            f.read(4) 
            
            if ctype == 'IDAT': idat_data.extend(cdata)
            else: chunks[ctype] = cdata
            if ctype == 'IEND': break

    ihdr = chunks['IHDR']
    width, height, bit_depth, color_type, comp, flt, interlace = struct.unpack('>IIBBBBB', ihdr)
    
    channels_map = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}
    channels = channels_map[color_type]
    bits_per_pixel = channels * bit_depth
    filter_bpp = max(1, math.ceil(bits_per_pixel / 8))
    
    palette = []
    if 'PLTE' in chunks:
        plte_data = chunks['PLTE']
        for i in range(0, len(plte_data), 3):
            palette.append((plte_data[i], plte_data[i+1], plte_data[i+2]))
            
    trns = None
    if 'tRNS' in chunks:
        trns_data = chunks['tRNS']
        if color_type == 3: trns = list(trns_data)
        elif color_type == 0: trns = struct.unpack('>H', trns_data)[0]
        elif color_type == 2: trns = struct.unpack('>HHH', trns_data)

    decompressed = zlib.decompress(idat_data)
    final_matrix = [[None for _ in range(width)] for _ in range(height)]
    passes = get_adam7_passes(width, height) if interlace == 1 else [{'w': width, 'h': height, 'x0': 0, 'y0': 0, 'dx': 1, 'dy': 1}]
    
    idx = 0
    for p in passes:
        pw, ph = p['w'], p['h']
        if pw == 0 or ph == 0: continue
        row_bytes = math.ceil(pw * bits_per_pixel / 8)
        prev_scanline = bytearray(row_bytes)
        
        for y_pass in range(ph):
            filter_type = decompressed[idx]
            idx += 1
            scanline = decompressed[idx : idx + row_bytes]
            idx += row_bytes
            recon = unfilter_scanline(scanline, prev_scanline, filter_bpp, filter_type)
            prev_scanline = recon
            
            raw_pixels = []
            if bit_depth < 8:
                raw_pixels = unpack_bits(recon, bit_depth, pw * channels)
            else:
                bytes_per_sample = bit_depth // 8
                for j in range(0, len(recon), bytes_per_sample):
                    if bit_depth == 16: raw_pixels.append((recon[j] << 8) | recon[j+1])
                    else: raw_pixels.append(recon[j])
            
            pixels = []
            for j in range(0, len(raw_pixels), channels):
                px = raw_pixels[j : j+channels]
                if len(px) == 1: px = px[0]
                else: px = tuple(px)
                pixels.append(px)
                
            processed_pixels = []
            for px in pixels:
                out_px = px
                if color_type == 3:
                    r, g, b = palette[px]
                    a = trns[px] if (trns and px < len(trns)) else 255
                    out_px = (r, g, b, a) if trns else (r, g, b)
                elif color_type == 0 and trns is not None:
                    a = 0 if px == trns else (65535 if bit_depth == 16 else 255)
                    out_px = (px, a)
                elif color_type == 2 and trns is not None:
                    a = 0 if px == trns else (65535 if bit_depth == 16 else 255)
                    out_px = px + (a,)
                processed_pixels.append(out_px)
            
            actual_y = p['y0'] + y_pass * p['dy']
            for x_pass in range(pw):
                actual_x = p['x0'] + x_pass * p['dx']
                final_matrix[actual_y][actual_x] = processed_pixels[x_pass]

    out_filename = filepath + '_matrix.txt'
    with open(out_filename, 'w') as f:
        f.write(f"Width: {width}, Height: {height}\n")
        f.write(f"Bit Depth: {bit_depth}, Color Type: {color_type}\n")
        f.write(f"Interlaced: {'Yes' if interlace == 1 else 'No'}\n")
        f.write("--------------------------------------------------\n")
        for row in final_matrix:
            f.write(str(row) + "\n")
            
    return out_filename


#--------------------Convert Matrix to PNG------------------------------------------------

def write_png_chunk(f, chunk_type, data):
    f.write(struct.pack('>I', len(data)))
    f.write(chunk_type)
    f.write(data)
    crc = zlib.crc32(chunk_type + data) & 0xffffffff
    f.write(struct.pack('>I', crc))

def matrix_to_png(txt_filepath):
    with open(txt_filepath, 'r') as f:
        lines = f.readlines()
    
   
    start_idx = 0
    for i, line in enumerate(lines):
        if line.startswith('---'):
            start_idx = i + 1
            break
            
    matrix = [ast.literal_eval(line.strip()) for line in lines[start_idx:] if line.strip()]
    
    height = len(matrix)
    width = len(matrix[0])
    
    
    sample = matrix[0][0]
    is_16bit = False
    
    if isinstance(sample, int):
        color_type = 0 
        channels = 1
        if any(px > 255 for row in matrix for px in row): is_16bit = True
    elif isinstance(sample, tuple):
        channels = len(sample)
        if channels == 2: color_type = 4
        elif channels == 3: color_type = 2
        elif channels == 4: color_type = 6
        else: raise ValueError("Error! Can not support this format")
        if any(v > 255 for row in matrix for px in row for v in px): is_16bit = True
    
    bit_depth = 16 if is_16bit else 8
    
    
    idat_uncompressed = bytearray()
    for row in matrix:
        idat_uncompressed.append(0) 
        for px in row:
            vals = [px] if channels == 1 else list(px)
            for v in vals:
                if is_16bit:
                    idat_uncompressed.extend(struct.pack('>H', v))
                else:
                    idat_uncompressed.append(v)
                    
    idat_compressed = zlib.compress(idat_uncompressed)
    
    out_filepath = txt_filepath.replace('.txt', '') + '_generated.png'
    with open(out_filepath, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        
        ihdr_data = struct.pack('>IIBBBBB', width, height, bit_depth, color_type, 0, 0, 0)
        write_png_chunk(f, b'IHDR', ihdr_data)
        write_png_chunk(f, b'IDAT', idat_compressed)
        write_png_chunk(f, b'IEND', b'')
        
    return out_filepath

#--------------------------------------Menu---------------------------------------------------------

def main_menu():
    while True:
        print("\n" + "="*40)
        print("  Menu ")
        print("="*40)
        print("1. Convert PNG to Matrix")
        print("2. Convert Matrix to PNG")
        print("3. Exit")
        
        choice = input("Please choose a number between 1-3 : ")
        
        if choice == '1':
            filepath = input("Please enter PNG path :").strip(' "\'')
            if not os.path.exists(filepath):
                print("Error! Couldn't find the file")
                continue
            try:
                print("Processing...")
                out_file = read_full_png(filepath)
                print(f"Done successfully in : {out_file}")
            except Exception as e:
                print(f"Error in processing picture {e}")
                
        elif choice == '2':
            filepath = input("Enter Matrix path : ").strip(' "\'')
            if not os.path.exists(filepath):
                print("Error! Couldn't find the file")
                continue
            try:
                print("Generatinng picture")
                out_file = matrix_to_png(filepath)
                print(f"Done successfully in : {out_file}")
            except Exception as e:
                print(f"Error in reading Matrix & generate picture {e}")
                
        elif choice == '3':
            break
            
        else:
            print("Invalid choice , try again ")



if __name__ == "__main__":
    main_menu()
