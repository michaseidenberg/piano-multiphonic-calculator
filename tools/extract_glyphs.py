"""Erzeugt js/glyphs.js aus der SMuFL-Schrift Bravura (SIL Open Font License 1.1).

    python3 -m pip install fonttools
    curl -LO https://raw.githubusercontent.com/steinbergmedia/bravura/master/redist/otf/Bravura.otf
    python3 tools/extract_glyphs.py Bravura.otf

Die Schrift selbst kommt nicht ins Repo, nur die Pfade der benötigten Zeichen.
"""
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

WANT = {"gClef": 0xE050, "fClef": 0xE062, "noteheadBlack": 0xE0A4,
        "flat": 0xE260, "natural": 0xE261, "sharp": 0xE262}
# Extended Helmholtz-Ellis: U+E2C0 + 5·Block + Index; Index 1 = ♭, 2 = ♮, 3 = ♯
for block, (n, d) in enumerate([(1, "down"), (1, "up"), (2, "down"), (2, "up"), (3, "down"), (3, "up")]):
    for idx, name in {1: "flat", 2: "natural", 3: "sharp"}.items():
        WANT[f"{name}_{d}{n}"] = 0xE2C0 + 5 * block + idx

HEADER = """/*
 * Notenzeichen als SVG-Pfade, extrahiert aus der Schrift Bravura (SMuFL),
 * © Steinberg Media Technologies GmbH, SIL Open Font License 1.1
 * (https://github.com/steinbergmedia/bravura, https://openfontlicense.org).
 * Vorzeichen mit Pfeilen: Extended Helmholtz-Ellis (U+E2C0–E2DD), je Pfeil 1/12 Ton.
 *
 * Einheiten der Schrift: 1000 pro Geviert = 4 Notenlinien-Abstände, y nach oben.
 * Generiert, nicht von Hand bearbeiten.
 */"""


# Ganze Schrift-Einheiten genügen: 1 Einheit = 0.032 px bei 8 px Linienabstand
def ntos(v):
    return "%d" % round(v)


def main(font_path):
    font = TTFont(font_path)
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    lines = [HEADER, "(function (root) {", "  var GLYPHS = {"]
    for key, cp in WANT.items():
        name = cmap[cp]
        pen = SVGPathPen(glyphs, ntos=ntos)
        glyphs[name].draw(pen)
        lines.append(f'    {key}: {{ w: {glyphs[name].width}, d: "{pen.getCommands()}" }}, // {name}')
    lines += ["  };",
              '  if (typeof module !== "undefined" && module.exports) module.exports = GLYPHS;',
              "  else root.PM_GLYPHS = GLYPHS;",
              "})(this);", ""]
    out = Path(__file__).resolve().parent.parent / "js" / "glyphs.js"
    out.write_text("\n".join(lines))
    print(out, len(WANT), "Zeichen")


if __name__ == "__main__":
    main(sys.argv[1])
