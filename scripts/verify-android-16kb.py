#!/usr/bin/env python3
"""Check the actual APK/AAB ELF files, including RELRO, for 16 KB page support.

APK packaging is checked for uncompressed 64-bit native libraries. An AAB must
also be converted to APKs with bundletool and checked before uploading.
Reference: https://developer.android.com/guide/practices/page-sizes
"""
import argparse
import struct
import sys
import zipfile

PAGE_SIZE = 16384


def inspect_elf(data):
    if data[:4] != b"\x7fELF":
        raise ValueError("native library is not ELF")
    if data[4] != 2:
        return None  # The 16 KB requirement applies to 64-bit ABIs.
    endian = "<" if data[5] == 1 else ">"
    offset = struct.unpack_from(endian + "Q", data, 32)[0]
    size, count = struct.unpack_from(endian + "HH", data, 54)
    loads, relro_ends = [], []
    for index in range(count):
        header = struct.unpack_from(endian + "IIQQQQQQ", data, offset + index * size)
        kind, _, file_offset, address, _, _, memory_size, alignment = header
        if kind == 1:  # PT_LOAD
            loads.append((alignment, file_offset % PAGE_SIZE == address % PAGE_SIZE))
        elif kind == 0x6474E552:  # PT_GNU_RELRO
            relro_ends.append((address + memory_size) % PAGE_SIZE)
    if not loads:
        raise ValueError("ELF has no load segments")
    return loads, relro_ends


def inspect_archive(path):
    failures, count = [], 0
    with zipfile.ZipFile(path) as archive, open(path, "rb") as raw:
        for info in archive.infolist():
            if not info.filename.endswith(".so"):
                continue
            result = inspect_elf(archive.read(info))
            if result is None:
                continue
            count += 1
            loads, relro_ends = result
            if any(alignment < PAGE_SIZE or not congruent for alignment, congruent in loads):
                failures.append(f"{info.filename}: load segments are not 16 KB compatible")
            if any(relro_ends):
                failures.append(f"{info.filename}: RELRO ends outside a 16 KB boundary ({relro_ends})")
            if path.endswith(".apk") and info.compress_type == zipfile.ZIP_STORED:
                raw.seek(info.header_offset + 26)
                name_length, extra_length = struct.unpack("<HH", raw.read(4))
                data_offset = info.header_offset + 30 + name_length + extra_length
                if data_offset % PAGE_SIZE:
                    failures.append(f"{info.filename}: uncompressed APK entry is not aligned to 16 KB")
            print(f"{info.filename}: LOAD={[x[0] for x in loads]}, RELRO remainder={relro_ends}")
    for failure in failures:
        print(f"FAIL: {failure}", file=sys.stderr)
    print(f"{path}: {count} 64-bit libraries checked; {len(failures)} failures")
    return not failures


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", nargs="+", help="Built APK or AAB")
    args = parser.parse_args()
    success = True
    for archive_path in args.archive:
        success = inspect_archive(archive_path) and success
    sys.exit(0 if success else 1)
