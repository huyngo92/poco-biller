#!/usr/bin/env python3
"""
Cắt các sprite-sheet thiết kế thành asset lẻ dùng cho app.

Cả 3 sheet đều đã có NỀN TRONG SUỐT (alpha thấp ở nền, cao ở nội dung) nên chỉ
cần cắt theo lưới rồi ôm sát bbox theo alpha — không cần flood-fill.

- avatars.png (4x3): 12 avatar người -> PNG tròn, nền trong suốt.
- categories.png (4x4): lấy 8 icon cần -> PNG vuông, icon căn giữa, nền trong suốt.
- mascots.png (2x2): 4 minh hoạ -> PNG chữ nhật, nền trong suốt.

Chạy một lần lúc chuẩn bị asset; không phải dependency runtime.
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, ".claude", "planning", "new-ui")
PUB = os.path.join(ROOT, "public")

ALPHA_THR = 96  # coi là "nội dung" khi alpha vượt ngưỡng này


def ensure(d):
    os.makedirs(d, exist_ok=True)


def cut_grid(path, cols, rows):
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    cw, ch = w / cols, h / rows
    cells = []
    for r in range(rows):
        row = []
        for c in range(cols):
            box = (round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch))
            row.append(img.crop(box))
        cells.append(row)
    return cells


def alpha_bbox(cell):
    """bbox của vùng có alpha > ngưỡng."""
    a = cell.split()[3]
    mask = a.point(lambda v: 255 if v > ALPHA_THR else 0)
    return mask.getbbox()


def circular(cell, out=256):
    """Ôm sát đĩa avatar theo alpha, mask tròn cho mép sạch, nền trong suốt."""
    bb = alpha_bbox(cell) or (0, 0, *cell.size)
    disc = cell.crop(bb)
    s = max(disc.size)
    sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sq.paste(disc, ((s - disc.size[0]) // 2, (s - disc.size[1]) // 2))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, s - 1, s - 1), fill=255)
    # giao alpha sẵn có với mask tròn
    base = sq.split()[3]
    base = Image.composite(base, Image.new("L", (s, s), 0), mask)
    sq.putalpha(base)
    return sq.resize((out, out), Image.LANCZOS)


def squared(cell, out=256, pad=0.12):
    """Ôm sát icon theo alpha, căn giữa trong canvas vuông có lề, nền trong suốt."""
    bb = alpha_bbox(cell) or (0, 0, *cell.size)
    ic = cell.crop(bb)
    s = round(max(ic.size) * (1 + pad * 2))
    sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sq.paste(ic, ((s - ic.size[0]) // 2, (s - ic.size[1]) // 2), ic)
    return sq.resize((out, out), Image.LANCZOS)


def rect(cell, long=640):
    """Ôm sát minh hoạ theo alpha. Nền minh hoạ là lớp xanh BÁN trong suốt
    (alpha ~40-70) -> remap alpha để khử hẳn lớp haze, giữ nhân vật + viền mượt."""
    bb = alpha_bbox(cell) or (0, 0, *cell.size)
    ic = cell.crop(bb)
    r, g, b, a = ic.split()
    # 0 khi alpha<=100 (haze nền), ramp 100->170 -> 0..255, đặc khi >=170
    a = a.point(lambda v: 0 if v <= 100 else (255 if v >= 170 else round((v - 100) / 70 * 255)))
    ic = Image.merge("RGBA", (r, g, b, a))
    bb2 = alpha_bbox(ic) or (0, 0, *ic.size)
    ic = ic.crop(bb2)
    scale = long / max(ic.size)
    return ic.resize((round(ic.size[0] * scale), round(ic.size[1] * scale)), Image.LANCZOS)


def main():
    ensure(os.path.join(PUB, "avatars"))
    ensure(os.path.join(PUB, "categories"))
    ensure(os.path.join(PUB, "mascots"))

    # ---- avatars 4x3 -> av-1..12 ----
    cells = cut_grid(os.path.join(SRC, "poco_biller_avatar_pack.png"), 4, 3)
    n = 1
    for r in range(3):
        for c in range(4):
            circular(cells[r][c]).save(os.path.join(PUB, "avatars", f"av-{n}.png"))
            n += 1
    print(f"avatars: {n - 1} file")

    # ---- categories 4x4 -> map id ----
    #  (0,0)coffee (0,1)food (0,2)basket (0,3)taxi
    #  (1,0)house-utilities (1,1)bag (1,2)cake (1,3)luggage
    #  (2,0)ticket (2,1)pills (2,2)book (2,3)paw
    #  (3,0)gift (3,1)refresh (3,2)gaspump (3,3)more
    cat = cut_grid(os.path.join(SRC, "poco_biller_category_icon_sprite.png"), 4, 4)
    catmap = {
        "an-uong": (0, 1),
        "ca-phe": (0, 0),
        "di-lai": (0, 3),
        "luu-tru": (1, 3),
        "giai-tri": (2, 0),
        "mua-sam": (1, 1),
        "hoa-don": (1, 0),
        "khac": (3, 3),
    }
    for cid, (r, c) in catmap.items():
        squared(cat[r][c]).save(os.path.join(PUB, "categories", f"{cid}.png"))
    print(f"categories: {len(catmap)} file")

    # ---- mascots 2x2 ----
    m = cut_grid(os.path.join(SRC, "poco_biller_character_illustrations.png"), 2, 2)
    mascmap = {
        "celebrate": (0, 0),  # high-five, phone tick
        "scan": (0, 1),       # quét hoá đơn
        "send": (1, 0),       # gửi (máy bay giấy)
        "done": (1, 1),       # nhóm hoàn tất + checklist
    }
    for name, (r, c) in mascmap.items():
        rect(m[r][c]).save(os.path.join(PUB, "mascots", f"{name}.png"))
    print(f"mascots: {len(mascmap)} file")


if __name__ == "__main__":
    main()
