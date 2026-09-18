#!/usr/bin/env python3
"""Regression checks for pixel preservation and thumbnail generation."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from PIL import Image

spec = importlib.util.spec_from_file_location('optimizer', Path(__file__).with_name('optimize-images.py'))
optimizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(optimizer)


class ImageTests(unittest.TestCase):
    def test_lossless_cards_and_rebuild(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            bundle = root / 'content/blogs/example'
            bundle.mkdir(parents=True)
            (bundle / 'index.md').write_text('---\nimage: hero.png\n---\n')
            original = Image.new('RGBA', (1200, 675), (123, 45, 67, 0))
            original.putpixel((1, 1), (15, 33, 71, 128))
            source = bundle / 'hero.png'
            original.save(source)
            original_bytes = source.read_bytes()
            optimizer.optimize(root)
            with Image.open(bundle / 'hero.png.optimized.webp') as result:
                self.assertEqual(original.tobytes(), result.convert('RGBA').tobytes())
            for width in (480, 960):
                with Image.open(bundle / f'hero.png.optimized-card-{width}.webp') as card:
                    self.assertEqual(card.size, (width, width * 9 // 16))
            self.assertEqual(source.read_bytes(), original_bytes)
            first = (bundle / 'hero.png.optimized.webp').read_bytes()
            optimizer.optimize(root)
            self.assertEqual(first, (bundle / 'hero.png.optimized.webp').read_bytes())
            source.unlink()
            optimizer.optimize(root)
            self.assertFalse(list(bundle.glob('*.webp')))

    def test_static_hero_and_filename_collisions(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            bundle = root / 'content/blogs/example'
            bundle.mkdir(parents=True)
            (bundle / 'index.md').write_text('---\nimage: /images/hero.jpg\n---\n')
            images = root / 'static/images'
            images.mkdir(parents=True)
            Image.new('RGB', (40, 20), 'red').save(images / 'hero.jpg')
            Image.new('RGB', (40, 20), 'blue').save(images / 'hero.png')
            optimizer.optimize(root)
            manifest = json.loads((root / 'data/image_derivatives.json').read_text())
            self.assertEqual(manifest['/images/hero.jpg']['480']['width'], 40)
            self.assertEqual(manifest['/images/hero.jpg']['full']['url'],
                             '/images/hero.jpg.optimized.webp')
            self.assertTrue((images / 'hero.png.optimized.webp').exists())

    def test_small_palette_jpeg_orientation_and_animation(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            bundle = root / 'content/blogs/example'
            bundle.mkdir(parents=True)
            (bundle / 'index.md').write_text('---\nimage: small.png\n---\n')
            Image.new('P', (16, 8)).save(bundle / 'small.png')
            image = Image.new('RGB', (20, 10), 'red')
            exif = Image.Exif()
            exif[274] = 6
            image.save(bundle / 'rotated.jpg', exif=exif)
            image.save(bundle / 'animated.gif', save_all=True,
                       append_images=[Image.new('RGB', (20, 10), 'blue')], duration=100, loop=0)
            Image.new('I;16', (16, 8)).save(bundle / 'depth.png')
            optimizer.optimize(root)
            with Image.open(bundle / 'small.png.optimized-card-480.webp') as card:
                self.assertEqual(card.size, (16, 8))
            with Image.open(bundle / 'rotated.jpg.optimized.webp') as rotated:
                self.assertEqual(rotated.size, (10, 20))
                self.assertNotEqual(rotated.getexif().get(274), 6)
            self.assertFalse((bundle / 'animated.gif.optimized.webp').exists())
            self.assertFalse((bundle / 'depth.png.optimized.webp').exists())


if __name__ == '__main__':
    unittest.main()
