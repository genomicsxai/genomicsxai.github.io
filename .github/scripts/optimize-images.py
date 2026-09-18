#!/usr/bin/env python3
"""Build disposable, lossless WebP derivatives without changing uploads."""
from pathlib import Path
import argparse
import json
import warnings
from urllib.parse import unquote, urlsplit

from PIL import Image, ImageOps
import yaml

SUFFIX = '.optimized.webp'
EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff'}


def save_lossless(image, destination, metadata):
    image.save(destination, 'WEBP', lossless=True, quality=75, method=4,
               exact=True, **metadata)


def optimize(root):
    roots = [root / name for name in ('content', 'assets', 'static')]
    # Derivatives are disposable: remove stale files after edits/deletions.
    for directory in roots:
        for generated in directory.rglob('*.optimized*.webp'):
            generated.unlink()
    heroes = set()
    for post in (root / 'content').rglob('index.md'):
        text = post.read_text()
        if text.startswith('---\n'):
            metadata = yaml.safe_load(text.split('---', 2)[1]) or {}
            reference = str(metadata.get('image', ''))
            url = urlsplit(reference)
            if reference and not url.scheme and not url.netloc:
                path = unquote(url.path)
                candidates = [post.parent / path, root / 'assets' / path.lstrip('/'),
                              root / 'static' / path.lstrip('/')]
                heroes.update(p.resolve() for p in candidates if p.is_file())
    static_manifest = {}
    count = before = after = 0
    for directory in roots:
        for source in sorted(directory.rglob('*')):
            if not source.is_file() or source.suffix.lower() not in EXTENSIONS:
                continue
            try:
                opened = Image.open(source)
            except (Image.DecompressionBombWarning, Image.DecompressionBombError):
                print(f'Preserving image above safe decode limit: {source}')
                continue
            with opened as original:
                # WebP cannot represent high-bit-depth/CMYK images losslessly.
                # Preserve animation rather than silently flattening its frames.
                high_depth_png = (original.format == 'PNG' and source.read_bytes()[24] > 8)
                if (getattr(original, 'n_frames', 1) != 1 or high_depth_png
                        or original.mode not in {'1', 'L', 'LA', 'P', 'RGB', 'RGBA'}
                        or max(original.size) > 16383):
                    print(f'Preserving unsupported image: {source}')
                    continue
                image = ImageOps.exif_transpose(original).convert('RGBA')
                metadata = {key: original.info[key] for key in ('icc_profile', 'xmp')
                            if key in original.info}
                exif = ImageOps.exif_transpose(original).getexif()
                if exif:
                    metadata['exif'] = exif.tobytes()
                target = source.with_name(source.name + SUFFIX)
                save_lossless(image, target, metadata)
                count += 1
                before += source.stat().st_size
                after += target.stat().st_size
                variants = {'full': {'url': '', 'width': image.width, 'height': image.height}}
                if directory.name == 'static':
                    variants['full']['url'] = '/' + target.relative_to(directory).as_posix()
                if source.resolve() in heroes:
                    for width in (480, 960):
                        card = image.copy()
                        card.thumbnail((width, max(1, round(width * image.height / image.width))),
                                       Image.Resampling.LANCZOS)
                        card_path = source.with_name(source.name + f'.optimized-card-{width}.webp')
                        save_lossless(card, card_path, metadata)
                        variants[str(width)] = {'url': '/' + card_path.relative_to(directory).as_posix(),
                                                'width': card.width, 'height': card.height}
                if directory.name == 'static':
                    static_manifest['/' + source.relative_to(directory).as_posix()] = variants
    (root / 'data').mkdir(exist_ok=True)
    (root / 'data/image_derivatives.json').write_text(json.dumps(static_manifest, indent=2) + '\n')
    print(f'Converted {count} images: {before:,} -> {after:,} bytes (full resolution).')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('.'))
    args = parser.parse_args()
    warnings.simplefilter('error', Image.DecompressionBombWarning)
    optimize(args.root)
