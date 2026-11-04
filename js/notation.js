/*
 * Notation als SVG (Strings); Notenzeichen als Pfade aus Bravura (js/glyphs.js).
 *
 * Tonhöhen werden wie im Original auf Zwölfteltöne (72er-Raster, 16.7 ¢) gerundet und als
 * nächster Halbton + Pfeil-Vorzeichen notiert (Extended Helmholtz-Ellis): 1 Pfeil = 1/12 Ton,
 * 2 = 1/6 Ton, 3 = 1/4 Ton, nach oben bzw. unten. Ohne Vorzeichen, aber mit Pfeil, steht ein
 * Auflösungszeichen mit Pfeil.
 * Sehr hohe/tiefe Noten bekommen 8va/15ma bzw. 8vb/15mb.
 */
(function (root) {
  "use strict";

  var PM = root.PM || (typeof require !== "undefined" ? require("./multiphonic.js") : null);
  var G = root.PM_GLYPHS || (typeof require !== "undefined" ? require("./glyphs.js") : null);

  var SP = 8; // Abstand der Notenlinien in px
  var UNIT = SP / 250; // Glyphen-Einheiten → px (1 Linienabstand = 250 Einheiten)

  // Halbton → [Stammton-Index C=0 … B=6, Vorzeichen]
  var SPELLING = [
    [0, ""], [0, "sharp"], [1, ""], [2, "flat"], [2, ""], [3, ""],
    [3, "sharp"], [4, ""], [5, "flat"], [5, ""], [6, "flat"], [6, ""],
  ];

  // Diatonische Stufen (Oktave·7 + Stammton) der Bezugslinien
  var TREBLE_BOTTOM = 30; // E4
  var BASS_BOTTOM = 18; // G2
  var MIDDLE_C = 28;
  var TREBLE_MAX = 45; // höchste Note ohne Oktavierung (3 Hilfslinien)
  var BASS_MIN = 11; // tiefste Note ohne Oktavierung

  function centsText(dev) {
    return PM.centsText(dev);
  }

  function fmt(x) {
    return Math.round(x * 100) / 100;
  }

  /*
   * Tonhöhe (Cent über C0) → Schreibweise:
   * { diatonic, accidental, arrows (−3…3), clef, ottava (Oktaven), cents-Abweichung }
   */
  function spell(cents) {
    var info = PM.noteInfo(cents);
    var off = PM.step72(cents) - 6 * info.semitone;
    off = ((off % 72) + 72) % 72;
    if (off > 36) off -= 72;
    var sp = SPELLING[info.semitone];
    var d = info.octave * 7 + sp[0];
    var clef = d >= MIDDLE_C ? "treble" : "bass";
    var ottava = 0;
    if (clef === "treble") {
      while (d - 7 * ottava > TREBLE_MAX && ottava < 3) ottava++;
    } else {
      while (d - 7 * ottava < BASS_MIN && ottava > -2) ottava--;
    }
    return {
      name: info.name,
      octave: info.octave,
      deviation: info.deviation,
      diatonic: d,
      accidental: sp[1],
      arrows: off,
      clef: clef,
      ottava: ottava,
    };
  }

  function glyph(name, x, y, color) {
    var g = G[name];
    return (
      '<path d="' + g.d + '" transform="translate(' + fmt(x) + "," + fmt(y) + ") scale(" + UNIT + "," + -UNIT + ')"' +
      ' style="fill:' + (color || "currentColor") + '"' + "/>"
    );
  }

  function glyphWidth(name) {
    return G[name].w * UNIT;
  }

  /*
   * Vorzeichen-Glyphe: ♭/♮/♯ mit 0–3 Pfeilen (Extended Helmholtz-Ellis aus Bravura).
   * Ohne Vorzeichen, aber mit Pfeilen, steht ein Auflösungszeichen mit Pfeilen.
   */
  function accidentalGlyph(sp) {
    var acc = sp.accidental || (sp.arrows ? "natural" : "");
    if (!acc) return "";
    if (!sp.arrows) return acc;
    return acc + "_" + (sp.arrows > 0 ? "up" : "down") + Math.abs(sp.arrows);
  }

  // Breite links vom Notenkopf für das Vorzeichen
  function prefixWidth(sp) {
    var acc = accidentalGlyph(sp);
    return acc ? glyphWidth(acc) + 3 : 0;
  }

  /*
   * Eine Note zeichnen. staffY(d) liefert die y-Position einer diatonischen Stufe im
   * jeweiligen System; ledger(d) die Liste der Hilfslinien.
   */
  function drawNote(sp, x, staff, color) {
    var d = sp.diatonic - 7 * sp.ottava;
    var y = staff.y(d);
    var out = "";
    var acc = accidentalGlyph(sp);
    if (acc) out += glyph(acc, x - prefixWidth(sp), y, color);
    var headW = glyphWidth("noteheadBlack");
    staff.ledgers(d).forEach(function (ly) {
      out += '<line x1="' + fmt(x - 3.5) + '" x2="' + fmt(x + headW + 3.5) + '" y1="' + fmt(ly) + '" y2="' + fmt(ly) + '" stroke="currentColor" stroke-width="1"/>';
    });
    out += glyph("noteheadBlack", x, y, color);
    if (sp.ottava) {
      var label = { 1: "8va", 2: "15ma", 3: "22ma", "-1": "8vb", "-2": "15mb" }[sp.ottava];
      var above = sp.ottava > 0;
      var ly2 = above ? Math.min(staff.top, y) - SP * 1.6 : Math.max(staff.bottom, y) + SP * 2.4;
      out += '<text x="' + fmt(x - 4) + '" y="' + fmt(ly2) + '" font-family="Georgia, serif" font-style="italic" font-size="10" style="fill:' + color + '">' + label + "</text>";
    }
    return out;
  }

  // shift = Oktaven, um die das System versetzt klingt (2 = G-Schlüssel 15ma, −2 = F 15mb)
  function makeStaff(clef, top, shift) {
    shift = shift || 0;
    var bottomLine = top + 4 * SP;
    var ref = (clef === "treble" ? TREBLE_BOTTOM : BASS_BOTTOM) + 7 * shift;
    function y(d) {
      return bottomLine - ((d - ref) * SP) / 2;
    }
    function ledgers(d) {
      var ls = [];
      var L;
      for (L = ref - 2; L >= d; L -= 2) ls.push(y(L));
      for (L = ref + 10; L <= d; L += 2) ls.push(y(L));
      return ls;
    }
    return { clef: clef, top: top, bottom: bottomLine, y: y, ledgers: ledgers, shift: shift };
  }

  function staffLines(staff, x0, x1) {
    var s = "";
    for (var i = 0; i < 5; i++) {
      var y = staff.top + i * SP;
      s += '<line x1="' + fmt(x0) + '" x2="' + fmt(x1) + '" y1="' + y + '" y2="' + y + '" stroke="currentColor" stroke-width="0.8"/>';
    }
    // Schlüssel auf der Linie G4 bzw. F3 des Systems (bei versetzten Systemen entsprechend höher/tiefer)
    var sh = 7 * (staff.shift || 0);
    if (staff.clef === "treble") s += glyph("gClef", x0 + 4, staff.y(32 + sh));
    else s += glyph("fClef", x0 + 4, staff.y(24 + sh));
    if (staff.shift > 0) s += '<text x="' + fmt(x0 + 10.5) + '" y="' + fmt(staff.top - SP * 2.1) + '" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor">15</text>';
    if (staff.shift < 0) s += '<text x="' + fmt(x0 + 10.5) + '" y="' + fmt(staff.bottom + SP * 1.6) + '" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor">15</text>';
    return s;
  }

  function svgWrap(w, h, body, cls) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" class="' + (cls || "notation") + '" viewBox="0 0 ' + fmt(w) + " " + fmt(h) +
      '" width="' + fmt(w) + '" height="' + fmt(h) + '" role="img">' + body + "</svg>"
    );
  }

  /* Ein kleines Einzelsystem mit einer Note (Ergebnistabelle). */
  function noteSVG(cents, color) {
    var sp = spell(cents);
    var top = SP * 5;
    var staff = makeStaff(sp.clef, top);
    var w = SP * 10;
    var h = top + 4 * SP + SP * 5;
    var body = staffLines(staff, 0, w);
    body += drawNote(sp, SP * 6.2, staff, color || "currentColor");
    var title = "<title>" + sp.name + sp.octave + " " + centsText(sp.deviation) + "</title>";
    return svgWrap(w, h, title + body);
  }

  // Senkrechte Ausdehnung einer Glyphe in Schrift-Einheiten (absolute Pfade: M, L, C, V, H, Z)
  var boxCache = {};
  function glyphBox(name) {
    if (boxCache[name]) return boxCache[name];
    var toks = G[name].d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g);
    var lo = Infinity;
    var hi = -Infinity;
    var cmd = "";
    var nums = [];
    function flush() {
      var ys = [];
      if (cmd === "V") ys = nums;
      else if (cmd !== "H") for (var k = 1; k < nums.length; k += 2) ys.push(nums[k]);
      ys.forEach(function (y) {
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      });
      nums = [];
    }
    toks.forEach(function (t) {
      if (/[A-Za-z]/.test(t)) {
        flush();
        cmd = t;
      } else nums.push(parseFloat(t));
    });
    flush();
    return (boxCache[name] = { lo: lo, hi: hi });
  }

  /*
   * Dynamische Systeme wie in bach (Erweiterung): immer Violin- und Bassschlüssel; liegen Töne ab
   * C6, kommt darüber ein Violinsystem „15“ (klingt zwei Oktaven höher), liegen Töne unter C2,
   * darunter ein Basssystem „15“ (zwei Oktaven tiefer). Diese Töne stehen dort ohne 8va/8vb;
   * nur was auch dort nicht passt, bekommt noch eine Oktavierung.
   * → { staves, place(sp) → { staff, sp }, lines(x0, x1), top, bottom, height }
   */
  var HI15 = 42; // C6
  var LO15 = 14; // C2

  function staffLayout(spells) {
    var hi = spells.some(function (sp) {
      return sp.diatonic >= HI15;
    });
    var lo = spells.some(function (sp) {
      return sp.diatonic < LO15;
    });
    var defs = [];
    if (hi) defs.push(["treble", 2]);
    defs.push(["treble", 0], ["bass", 0]);
    if (lo) defs.push(["bass", -2]);
    var top = SP * 6;
    var staves = defs.map(function (d, i) {
      return makeStaff(d[0], top + i * (4 * SP + SP * 6), d[1]);
    });
    var gHi = hi ? staves[0] : null;
    var g = staves[hi ? 1 : 0];
    var f = staves[hi ? 2 : 1];
    var fLo = lo ? staves[staves.length - 1] : null;
    function place(sp) {
      var d = sp.diatonic;
      var staff, o = 0;
      if (gHi && d >= HI15) {
        staff = gHi;
        while (d - 14 - 7 * o > TREBLE_MAX && o < 3) o++;
      } else if (fLo && d < LO15) {
        staff = fLo;
        while (d + 14 - 7 * o < BASS_MIN && o > -2) o--;
      } else {
        staff = sp.clef === "treble" ? g : f;
        o = sp.ottava;
        if (gHi && staff === g) o = 0;
        if (fLo && staff === f) o = 0;
      }
      return { staff: staff, sp: Object.assign({}, sp, { ottava: o }) };
    }
    var first = staves[0];
    var last = staves[staves.length - 1];
    function lines(x0, x1) {
      var out = "";
      staves.forEach(function (st) {
        out += staffLines(st, x0, x1);
      });
      return out + '<line x1="' + fmt(x0 + 0.5) + '" x2="' + fmt(x0 + 0.5) + '" y1="' + first.top + '" y2="' + last.bottom + '" stroke="currentColor" stroke-width="1"/>';
    }
    return { staves: staves, place: place, lines: lines, top: first.top, bottom: last.bottom, height: last.bottom + SP * 7 };
  }

  /*
   * Akkord (Erweiterung): alle Töne übereinander in einer Spalte rechts der Partialtöne.
   * Sekunden: der obere Kopf rechts neben dem Hals; Vorzeichen in Spalten nach links, so dass
   * sich keine zwei überdecken (von oben nach unten, jedes in die erste freie Spalte).
   * Gleich geschriebene Töne (Stufe, Vorzeichen, Pfeile) erscheinen einmal. Liefert { body, width }.
   */
  function drawChord(notes, x0, layout) {
    var seen = {};
    var items = [];
    notes
      .slice()
      .sort(function (a, b) {
        return a.cents - b.cents;
      })
      .forEach(function (n) {
        var sp0 = spell(n.cents);
        var key = sp0.diatonic + sp0.accidental + sp0.arrows;
        if (seen[key]) return;
        seen[key] = true;
        var pl = layout.place(sp0);
        var sp = pl.sp;
        var staff = pl.staff;
        var d = sp.diatonic - 7 * sp.ottava;
        items.push({ sp: sp, staff: staff, d: d, y: staff.y(d), color: n.color || "currentColor", shift: 0 });
      });
    // Sekunden und gleiche Stufe: Kopf nach rechts versetzen
    layout.staves.forEach(function (staff) {
      var prev = null;
      items.forEach(function (it) {
        if (it.staff !== staff) return;
        if (prev && it.d - prev.d <= 1 && !prev.shift) it.shift = 1;
        prev = it;
      });
    });
    // Vorzeichen-Spalten, von oben nach unten
    var colW = glyphWidth("sharp") + 2;
    var cols = [];
    items
      .slice()
      .sort(function (a, b) {
        return a.y - b.y;
      })
      .forEach(function (it) {
        var acc = accidentalGlyph(it.sp);
        if (!acc) return;
        var b = glyphBox(acc);
        var top = it.y - b.hi * UNIT - 1;
        var bottom = it.y - b.lo * UNIT + 1;
        var c = 0;
        while (
          cols[c] &&
          cols[c].some(function (o) {
            return top < o.bottom && bottom > o.top;
          })
        )
          c++;
        (cols[c] = cols[c] || []).push({ top: top, bottom: bottom });
        it.acc = acc;
        it.col = c;
      });
    var headW = glyphWidth("noteheadBlack");
    var heads = x0 + cols.length * colW + 3;
    var out = "";
    items.forEach(function (it) {
      var hx = heads + it.shift * (headW - 0.8);
      var lx0 = Math.min(heads, hx) - 3.5;
      var lx1 = hx + headW + 3.5;
      it.staff.ledgers(it.d).forEach(function (ly) {
        out += '<line x1="' + fmt(lx0) + '" x2="' + fmt(lx1) + '" y1="' + fmt(ly) + '" y2="' + fmt(ly) + '" stroke="currentColor" stroke-width="1"/>';
      });
      if (it.acc) out += glyph(it.acc, heads - 3 - it.col * colW - glyphWidth(it.acc), it.y, it.color);
      out += "<g class=\"cnote\"><title>" + it.sp.name + it.sp.octave + " " + centsText(it.sp.deviation) + "</title>" + glyph("noteheadBlack", hx, it.y, it.color) + "</g>";
    });
    // Oktavierung: je System und Wert einmal, über dem höchsten bzw. unter dem tiefsten Ton
    var labels = {};
    items.forEach(function (it) {
      if (!it.sp.ottava) return;
      var k = layout.staves.indexOf(it.staff) + ":" + it.sp.ottava;
      var l = labels[k];
      if (!l || (it.sp.ottava > 0 ? it.y < l.it.y : it.y > l.it.y)) labels[k] = { it: it };
    });
    Object.keys(labels).forEach(function (k) {
      var it = labels[k].it;
      var label = { 1: "8va", 2: "15ma", 3: "22ma", "-1": "8vb", "-2": "15mb" }[it.sp.ottava];
      var hx = heads + it.shift * (headW - 0.8);
      var ly = it.sp.ottava > 0 ? Math.min(it.staff.top, it.y) - SP * 1.6 : Math.max(it.staff.bottom, it.y) + SP * 2.4;
      out += '<text x="' + fmt(hx - 4) + '" y="' + fmt(ly) + '" font-family="Georgia, serif" font-style="italic" font-size="10" style="fill:' + it.color + '">' + label + "</text>";
    });
    var right = heads + 2 * headW + 6;
    return { body: out, width: right - x0, heads: heads };
  }

  /*
   * Doppelsystem mit allen Partialtönen nebeneinander (aufsteigend).
   * notes = [{ cents, color, label }]
   */
  function spectrumSVG(notes) {
    var col = SP * 5.2;
    var left = SP * 4.5;
    var spells = notes.map(function (n) {
      return spell(n.cents);
    });
    var layout = staffLayout(spells);
    var w = left + Math.max(notes.length, 1) * col + SP * 2;
    var h = layout.height;
    var body = layout.lines(0, w);
    notes.forEach(function (n, i) {
      var pl = layout.place(spells[i]);
      var sp = pl.sp;
      var x = left + i * col + SP * 2.2;
      body += "<g><title>" + (n.label ? n.label + ": " : "") + sp.name + sp.octave + " " + centsText(sp.deviation) + "</title>";
      body += drawNote(sp, x, pl.staff, n.color || "currentColor");
      if (n.label) {
        body += '<text x="' + fmt(x + 4.7) + '" y="' + fmt(SP * 1.6) + '" text-anchor="middle" font-size="10" style="fill:' + (n.color || "currentColor") + '">' + n.label + "</text>";
      }
      body += '<text x="' + fmt(x + 4.7) + '" y="' + fmt(h - SP * 1.2) + '" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">' + centsText(sp.deviation) + "</text>";
      body += "</g>";
    });
    return svgWrap(w, h, body, "notation spectrum");
  }

  /*
   * Akkord als eigenes kleines Doppelsystem (Erweiterung). Steht in der Oberfläche rechts
   * neben dem Doppelsystem der Partialtöne oder, wenn der Platz fehlt, darunter.
   * notes = [{ cents, color }], label = Beschriftung oben. Ohne Töne: "".
   */
  function chordSVG(notes, label) {
    if (!notes || !notes.length) return "";
    var layout = staffLayout(
      notes.map(function (n) {
        return spell(n.cents);
      })
    );
    var left = SP * 4.5;
    var ch = drawChord(notes, left + SP, layout);
    var w = left + SP + ch.width + SP * 1.5;
    // längere Beschriftung („Likely sounding“): System so breit wie nötig, Text im System halten
    var textW = label ? label.length * 5.6 : 0;
    w = Math.max(w, textW + 2);
    var h = layout.height;
    var body = layout.lines(0, w);
    body += '<line x1="' + fmt(w - 0.5) + '" x2="' + fmt(w - 0.5) + '" y1="' + layout.top + '" y2="' + layout.bottom + '" stroke="currentColor" stroke-width="1"/>';
    body += ch.body;
    if (label) {
      var cx = Math.max(textW / 2 + 1, Math.min(ch.heads + 4.7, w - textW / 2 - 1));
      body += '<text x="' + fmt(cx) + '" y="' + fmt(SP * 1.6) + '" text-anchor="middle" font-size="10" fill="currentColor">' + label + "</text>";
    }
    return svgWrap(w, h, body, "notation chord");
  }

  var API = { staffLayout: staffLayout, spell: spell, accidentalGlyph: accidentalGlyph, noteSVG: noteSVG, spectrumSVG: spectrumSVG, chordSVG: chordSVG };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.PMNotation = API;
})(this);
