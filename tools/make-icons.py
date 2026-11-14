"""Draws the app icons in public/icons: the site's awning over a die. Run: python3 tools/make-icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
BG = (23, 18, 13)
RED = (200, 55, 45)
CREAM = (255, 244, 222)
DIE = (255, 251, 242)
PIPS = [(44, 75, 168), (184, 50, 31), (47, 122, 53), (242, 182, 50), (107, 63, 159)]


def draw(size: int, safe: float) -> Image.Image:
    """`safe` is the share of the canvas the art may use (maskable icons keep to the middle 80%)."""
    s = size * 4  # draw large, then shrink for smooth edges
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)
    pad = s * (1 - safe) / 2
    inner = s - 2 * pad

    # Awning: alternating stripes with scalloped edge.
    top, depth = pad + inner * 0.06, inner * 0.2
    stripes = 6
    w = inner / stripes
    for i in range(stripes):
        x0 = pad + i * w
        color = RED if i % 2 == 0 else CREAM
        d.rectangle([x0, top, x0 + w, top + depth], fill=color)
        d.ellipse([x0, top + depth - w / 2, x0 + w, top + depth + w / 2], fill=color)

    # Die, tilted a little.
    die = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    dd = ImageDraw.Draw(die)
    side = inner * 0.5
    cx, cy = s / 2, pad + inner * 0.64
    box = [cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2]
    dd.rounded_rectangle(box, radius=side * 0.2, fill=DIE)
    r = side * 0.09
    spots = [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)]
    for (px, py), color in zip(spots, PIPS):
        x, y = cx + px * side * 0.27, cy + py * side * 0.27
        dd.ellipse([x - r, y - r, x + r, y + r], fill=color)
    die = die.rotate(-12, center=(cx, cy), resample=Image.BICUBIC)
    img.paste(die, (0, 0), die)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw(192, 0.92).save(OUT / "icon-192.png")
    draw(512, 0.92).save(OUT / "icon-512.png")
    draw(512, 0.78).save(OUT / "icon-maskable-512.png")
    draw(180, 0.92).save(OUT / "apple-touch-icon.png")
    draw(32, 0.98).save(OUT / "favicon-32.png")
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
