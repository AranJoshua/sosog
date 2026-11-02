#!/usr/bin/env python3
"""
SOSOG photo prep
----------------
Turns a folder of big camera originals (HEIC, DNG, JPG, PNG) into small,
web-ready JPEGs and writes a tiny manifest.csv you can send instead of the
photos themselves.

What it does for every photo:
  1. Fixes rotation from the phone's orientation flag.
  2. Writes <name>-large.jpg (long edge 1600 px, about 300 KB) for detail pages.
  3. Writes <name>-thumb.jpg (long edge 480 px, about 30 KB) for cards and feeds.
  4. Strips ALL metadata from the web copies (GPS location, device, date).
  5. Records the ORIGINAL's capture date and EXIF GPS in manifest.csv, so the
     GPS cam photos can be checked against the checklist coordinates without
     uploading a single photo.

Setup (once):
    pip install pillow pillow-heif rawpy

Usage:
    python sosog_prep_photos.py "C:/path/to/GLIMPSE OF SORSOGON" out_glimpse --sequential glimpse
    python sosog_prep_photos.py "C:/path/to/FINAL WEBSITE PICS" out_final
    python sosog_prep_photos.py "C:/path/to/GPS" out_gps --recursive

Options:
    --sequential NAME   Rename outputs NAME-001, NAME-002 ... ordered by capture
                        date (good for the Glimpse feed). Without it, outputs
                        keep the original file name (good for structure photos,
                        so they can still be matched to the sheet).
    --recursive         Also read subfolders.
    --workers N         Parallel workers (default: CPU count minus 1).
    --skip-existing     Do not redo photos that already have output files, so a
                        long run can be stopped and resumed.
    --large 1600 --thumb 480 --quality 80   Tweak sizes if needed.

The originals are never modified or deleted.
"""
import argparse
import csv
import os
import re
import sys
import multiprocessing
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime

from PIL import Image, ImageOps

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:
    pillow_heif = None

try:
    import rawpy
except ImportError:
    rawpy = None

EXTS = {".heic", ".heif", ".jpg", ".jpeg", ".png", ".dng"}


def safe_stem(name: str) -> str:
    stem = os.path.splitext(name)[0]
    stem = re.sub(r"[^A-Za-z0-9]+", "-", stem).strip("-")
    return stem.lower() or "photo"


def to_deg(values, ref):
    try:
        d, m, s = (float(v) for v in values)
        deg = d + m / 60.0 + s / 3600.0
        return -deg if ref in ("S", "W") else deg
    except Exception:
        return None


def read_meta(img):
    taken, lat, lng = "", None, None
    try:
        ex = img.getexif()
        sub = ex.get_ifd(0x8769)
        taken = sub.get(0x9003) or ex.get(0x0132) or ""
        gps = ex.get_ifd(0x8825)
        if gps and 2 in gps and 4 in gps:
            lat = to_deg(gps[2], gps.get(1, "N"))
            lng = to_deg(gps[4], gps.get(3, "E"))
    except Exception:
        pass
    return str(taken), lat, lng


def process(job):
    src, out_dir, stem, large_px, thumb_px, quality = job
    ext = os.path.splitext(src)[1].lower()
    try:
        if ext == ".dng":
            if rawpy is None:
                return {"src": src, "error": "rawpy not installed (pip install rawpy)"}
            with rawpy.imread(src) as raw:
                rgb = raw.postprocess(use_camera_wb=True, half_size=True)
            img = Image.fromarray(rgb)
            taken, lat, lng = "", None, None
        else:
            img = Image.open(src)
            taken, lat, lng = read_meta(img)
            img = ImageOps.exif_transpose(img)
        orig_w, orig_h = img.size
        img = img.convert("RGB")

        large = img.copy()
        large.thumbnail((large_px, large_px), Image.LANCZOS)
        thumb = img.copy()
        thumb.thumbnail((thumb_px, thumb_px), Image.LANCZOS)

        lp = os.path.join(out_dir, f"{stem}-large.jpg")
        tp = os.path.join(out_dir, f"{stem}-thumb.jpg")
        # No exif= argument, so every web copy is saved with metadata stripped.
        large.save(lp, "JPEG", quality=quality, optimize=True, progressive=True)
        thumb.save(tp, "JPEG", quality=max(60, quality - 5), optimize=True, progressive=True)
        return {
            "src": src,
            "stem": stem,
            "orig_mb": round(os.path.getsize(src) / 1e6, 2),
            "orig_w": orig_w,
            "orig_h": orig_h,
            "large_w": large.size[0],
            "large_h": large.size[1],
            "large_kb": round(os.path.getsize(lp) / 1e3),
            "thumb_kb": round(os.path.getsize(tp) / 1e3),
            "taken": taken,
            "lat": "" if lat is None else round(lat, 6),
            "lng": "" if lng is None else round(lng, 6),
        }
    except Exception as e:  # keep going if one file is broken
        return {"src": src, "error": f"{type(e).__name__}: {e}"}


def parse_taken(s):
    try:
        return datetime.strptime(s, "%Y:%m:%d %H:%M:%S")
    except Exception:
        return datetime.max


def main():
    ap = argparse.ArgumentParser(description="Prepare web-ready photos and a manifest.")
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--sequential", metavar="NAME")
    ap.add_argument("--recursive", action="store_true")
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    ap.add_argument("--skip-existing", action="store_true")
    ap.add_argument("--large", type=int, default=1600)
    ap.add_argument("--thumb", type=int, default=480)
    ap.add_argument("--quality", type=int, default=80)
    a = ap.parse_args()

    if pillow_heif is None:
        print("Note: pillow-heif is not installed, so .HEIC files will fail. Run: pip install pillow-heif")

    files = []
    for root, _dirs, names in os.walk(a.input):
        for n in names:
            if os.path.splitext(n)[1].lower() in EXTS:
                files.append(os.path.join(root, n))
        if not a.recursive:
            break
    files.sort()
    if not files:
        sys.exit("No photos found in that folder.")
    os.makedirs(a.output, exist_ok=True)

    # Stems: original names, de-duplicated. Sequential naming is applied after the
    # first pass (it needs capture dates), so use temporary stems first.
    stems, used = {}, set()
    for f in files:
        s = safe_stem(os.path.basename(f))
        base, i = s, 2
        while s in used:
            s, i = f"{base}-{i}", i + 1
        used.add(s)
        stems[f] = s

    jobs = []
    for f in files:
        s = stems[f]
        if a.skip_existing and os.path.exists(os.path.join(a.output, f"{s}-large.jpg")) and not a.sequential:
            continue
        jobs.append((f, a.output, s, a.large, a.thumb, a.quality))

    print(f"{len(files)} photos found, processing {len(jobs)} with {a.workers} workers...")
    results, done = [], 0
    with ProcessPoolExecutor(max_workers=a.workers, mp_context=multiprocessing.get_context("spawn")) as ex:
        futs = [ex.submit(process, j) for j in jobs]
        for fut in as_completed(futs):
            results.append(fut.result())
            done += 1
            if done % 10 == 0 or done == len(jobs):
                print(f"  {done}/{len(jobs)}")

    ok = [r for r in results if "error" not in r]
    bad = [r for r in results if "error" in r]

    if a.sequential:
        ok.sort(key=lambda r: (parse_taken(r["taken"]), r["src"]))
        for i, r in enumerate(ok, 1):
            new = f"{a.sequential}-{i:03d}"
            for kind in ("large", "thumb"):
                os.replace(
                    os.path.join(a.output, f"{r['stem']}-{kind}.jpg"),
                    os.path.join(a.output, f"{new}-{kind}.jpg"),
                )
            r["stem"] = new
    else:
        ok.sort(key=lambda r: r["stem"])

    cols = ["stem", "original_file", "orig_mb", "orig_w", "orig_h", "large_w", "large_h",
            "large_kb", "thumb_kb", "taken", "exif_lat", "exif_lng"]
    with open(os.path.join(a.output, "manifest.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        for r in ok:
            w.writerow([r["stem"], os.path.basename(r["src"]), r["orig_mb"], r["orig_w"], r["orig_h"],
                        r["large_w"], r["large_h"], r["large_kb"], r["thumb_kb"], r["taken"],
                        r["lat"], r["lng"]])

    orig = sum(r["orig_mb"] for r in ok)
    web = sum(r["large_kb"] + r["thumb_kb"] for r in ok) / 1000
    print(f"\nDone. {len(ok)} photos converted, {len(bad)} failed.")
    print(f"Originals: {orig:.1f} MB  ->  web copies: {web:.1f} MB")
    print(f"Manifest: {os.path.join(a.output, 'manifest.csv')}  (this small file is the one to send)")
    for r in bad:
        print("FAILED:", r["src"], "-", r["error"])


if __name__ == "__main__":
    main()
