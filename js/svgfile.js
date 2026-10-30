/*
 * Grafiken als SVG-Dateien (Erweiterung): Notation und Katalog in Druckfarben auf Weiß,
 * Dateinamen <Saite>_<klingende Teiltöne>_at_<k-n>, mehrere Dateien als ZIP (ohne Kompression,
 * ohne Abhängigkeiten).
 */
(function (root) {
  "use strict";

  var S = root.PMString || (typeof require !== "undefined" ? require("./stringview.js") : null);
  var P = S.PRINT;
  var MUTED = "#5d666c"; // --muted im hellen Schema
  var FONT = "Helvetica, Arial, sans-serif";

  function fmt(x) {
    return Math.round(x * 100) / 100;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Farben der Oberfläche (CSS-Variablen) durch Druckfarben ersetzen
  function printColors(svg) {
    return svg
      .replace(/var\(--sc(\d)\)/g, function (_, i) {
        return P.sc[+i];
      })
      .replace(/var\(--muted\)/g, MUTED)
      .replace(/currentColor/g, P.ink);
  }

  function size(svg) {
    var m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    return { w: +m[1], h: +m[2] };
  }

  /* Notation (spectrumSVG, chordSVG aus notation.js) als eigenständige Datei. */
  function notationFile(svg) {
    var s = size(svg);
    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      printColors(svg).replace(
        /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" class="[^"]*" viewBox="([^"]+)" width="[^"]+" height="[^"]+" role="img">/,
        '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="' + s.w + '" height="' + s.h + '" viewBox="$1" font-family="' + FONT + '">' +
          '<rect width="' + s.w + '" height="' + s.h + '" fill="' + P.paper + '"/>'
      ) +
      "\n"
    );
  }

  // Breite eines Textes in px, grob geschätzt (Helvetica)
  function textWidth(t, px) {
    return String(t).length * px * 0.58;
  }

  /*
   * Katalog als Tabelle: title (Kopfzeile), rows = [{ node: "1/19", percent: "5.3 %",
   * partials: "…17_18_19", notes: "…", chord: chordSVG }]. Spalten wie im Katalog.
   */
  var CHORD_SCALE = 0.55; // Akkorde kleiner, wie in der Katalogspalte der Oberfläche

  function catalogueFile(title, rows) {
    var px = 12;
    var pad = 10;
    var heads = ["Node", "%", "Partials", "", "Notes"];
    var keys = ["node", "percent", "partials", "chord", "notes"];
    var chordW = 0;
    rows.forEach(function (r) {
      if (r.chord) chordW = Math.max(chordW, size(r.chord).w * CHORD_SCALE);
    });
    var widths = keys.map(function (k, c) {
      if (k === "chord") return chordW;
      return rows.reduce(function (m, r) {
        return Math.max(m, textWidth(r[k], px));
      }, textWidth(heads[c], px));
    });
    var xs = [];
    var x = pad;
    widths.forEach(function (w) {
      xs.push(x);
      x += w + 2 * pad;
    });
    var W = Math.ceil(x);
    var y = 40;
    var body = '<text x="' + pad + '" y="22" font-size="15" font-weight="700" fill="' + P.ink + '">' + esc(title) + "</text>";
    heads.forEach(function (h, c) {
      if (h) body += '<text x="' + fmt(xs[c]) + '" y="' + (y + 12) + '" font-size="11" font-weight="700" fill="' + MUTED + '">' + h + "</text>";
    });
    y += 20;
    body += '<line x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="' + MUTED + '" stroke-width="0.6"/>';
    rows.forEach(function (r) {
      var cs = r.chord ? size(r.chord) : null;
      var h = cs ? cs.h * CHORD_SCALE : 30;
      var mid = y + h / 2 + px * 0.35;
      keys.forEach(function (k, c) {
        if (k === "chord") {
          if (r.chord) {
            body += printColors(r.chord).replace(
              /^<svg (.*?) width="[^"]+" height="[^"]+"/,
              '<svg x="' + fmt(xs[c]) + '" y="' + fmt(y) + '" $1 width="' + fmt(cs.w * CHORD_SCALE) + '" height="' + fmt(h) + '"'
            );
          }
        } else {
          body += '<text x="' + fmt(xs[c]) + '" y="' + fmt(mid) + '" font-size="' + px + '" fill="' + P.ink + '">' + esc(r[k]) + "</text>";
        }
      });
      y += h;
      body += '<line x1="0" x2="' + W + '" y1="' + fmt(y) + '" y2="' + fmt(y) + '" stroke="' + MUTED + '" stroke-width="0.4"/>';
    });
    var H = Math.ceil(y + pad);
    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" font-family="' + FONT + '">' +
      '<rect width="' + W + '" height="' + H + '" fill="' + P.paper + '"/>' + body + "</svg>\n"
    );
  }

  /*
   * Dateiname ohne Endung: <Saite>_<Teiltöne>_at_<k-n>, z. B. C#1_4-7-11_at_3-11.
   * name = Saitenname wie „C♯1“; partials = Liste; k, n = Berührungspunkt (fehlt: nur Saite).
   */
  function baseName(name, partials, k, n) {
    var s = String(name).replace(/♯/g, "#").replace(/♭/g, "b");
    if (partials && partials.length) s += "_" + partials.join("-");
    if (k != null && n != null) s += "_at_" + k + "-" + n;
    return s;
  }

  // --- ZIP (Methode „stored“) ---------------------------------------------

  var CRC = [];
  for (var c = 0; c < 256; c++) {
    var v = c;
    for (var b = 0; b < 8; b++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    CRC[c] = v >>> 0;
  }

  function crc32(bytes) {
    var v = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) v = CRC[(v ^ bytes[i]) & 0xff] ^ (v >>> 8);
    return (v ^ 0xffffffff) >>> 0;
  }

  function utf8(s) {
    return new TextEncoder().encode(s);
  }

  /* files = [{ name, data (String) }] → Uint8Array einer ZIP-Datei */
  function zip(files) {
    var parts = [];
    var central = [];
    var offset = 0;
    var now = new Date();
    var time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    function header(sig, size) {
      var h = new DataView(new ArrayBuffer(size));
      h.setUint32(0, sig, true);
      return h;
    }
    files.forEach(function (f) {
      var name = utf8(f.name);
      var data = utf8(f.data);
      var crc = crc32(data);
      var l = header(0x04034b50, 30);
      l.setUint16(4, 20, true);
      l.setUint16(6, 0x0800, true); // Namen in UTF-8
      l.setUint16(10, time, true);
      l.setUint16(12, date, true);
      l.setUint32(14, crc, true);
      l.setUint32(18, data.length, true);
      l.setUint32(22, data.length, true);
      l.setUint16(26, name.length, true);
      parts.push(new Uint8Array(l.buffer), name, data);
      var e = header(0x02014b50, 46);
      e.setUint16(4, 20, true);
      e.setUint16(6, 20, true);
      e.setUint16(8, 0x0800, true);
      e.setUint16(12, time, true);
      e.setUint16(14, date, true);
      e.setUint32(16, crc, true);
      e.setUint32(20, data.length, true);
      e.setUint32(24, data.length, true);
      e.setUint16(28, name.length, true);
      e.setUint32(42, offset, true);
      central.push(new Uint8Array(e.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (s, a) {
      return s + a.length;
    }, 0);
    var end = header(0x06054b50, 22);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true);
    end.setUint32(16, offset, true);
    var all = parts.concat(central, [new Uint8Array(end.buffer)]);
    var out = new Uint8Array(offset + csize + 22);
    var p = 0;
    all.forEach(function (a) {
      out.set(a, p);
      p += a.length;
    });
    return out;
  }

  var API = { notationFile: notationFile, catalogueFile: catalogueFile, baseName: baseName, zip: zip, crc32: crc32, printColors: printColors };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.PMSvgFile = API;
})(this);
