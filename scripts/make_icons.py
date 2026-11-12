"""Builds app icons + transparent wordmark from brand/logo-wordmark.png.
Run from the project root:  python3 scripts/make_icons.py"""
from PIL import Image, ImageDraw
import numpy as np

SRC = 'brand/logo-wordmark.png'
OUT = 'public/icons'
logo = Image.open(SRC).convert('RGB')
a = np.array(logo).astype(float)

# --- transparent wordmark (un-premultiply against the black background) ---
alpha = a.max(axis=2) / 255.0
alpha = np.clip((alpha - 0.04) / 0.96, 0, 1)
safe = np.where(alpha > 0, alpha, 1)[..., None]
rgb = np.clip(a / (255.0 * safe), 0, 1) * 255
rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
word = Image.fromarray(rgba, 'RGBA').crop((420, 168, 1795, 548))
word.save(f'{OUT}/wordmark.png')

# --- the "m" glyph (white) cut from the wordmark ---
m_alpha = Image.fromarray((alpha * 255).astype(np.uint8)).crop((428, 243, 757, 457))
def glyph_m(scale):
    w, h = m_alpha.size
    al = m_alpha.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    img = Image.new('RGBA', al.size, (250, 247, 244, 255))
    img.putalpha(al)
    return img

def gradient(size):
    # top-left light copper -> bottom-right dark copper, like the brand board icon
    x = np.linspace(0, 1, size)[None, :].repeat(size, 0)
    y = np.linspace(0, 1, size)[:, None].repeat(size, 1)
    t = np.clip((x * 0.5 + y * 0.5), 0, 1)[..., None]
    c0 = np.array([214, 134, 96.0]); c1 = np.array([86, 46, 32.0])
    return Image.fromarray((c0 * (1 - t) + c1 * t).astype(np.uint8), 'RGB').convert('RGBA')

def make_icon(size, rounded, content=0.68):
    S = size * 4  # supersample the dot / mask
    base = gradient(S)
    total_w = S * content
    # m : dot = 260 : 70 (ratio from the brand board icon), gap included
    m_w = total_w * 0.75
    g = glyph_m(m_w / m_alpha.size[0])
    dot_d = int(total_w * 0.2)
    gap = int(total_w * 0.05)
    comp_w = g.size[0] + gap + dot_d
    x0 = (S - comp_w) // 2
    y0 = (S - g.size[1]) // 2
    base.alpha_composite(g, (x0, y0))
    d = ImageDraw.Draw(base)
    dx = x0 + g.size[0] + gap
    dy = y0 + g.size[1] - dot_d
    d.ellipse([dx, dy, dx + dot_d, dy + dot_d], fill=(226, 152, 118, 255))
    if rounded:
        mask = Image.new('L', (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.225), fill=255)
        base.putalpha(mask)
    return base.resize((size, size), Image.LANCZOS)

make_icon(512, True).save(f'{OUT}/icon-512.png')
make_icon(192, True).save(f'{OUT}/icon-192.png')
make_icon(512, False, 0.56).save(f'{OUT}/icon-maskable-512.png')
make_icon(180, False, 0.62).convert('RGB').save(f'{OUT}/apple-touch-icon.png')
make_icon(64, True, 0.7).save(f'{OUT}/favicon-64.png')
print('ok')
