/*
 * Saitengrafik als SVG: alle Knoten k/n bis Partialton nMax auf der ersten Saitenhälfte
 * (wie das Bild im Original), dazu die Berührungspunkte der beiden Spalten und die Knoten
 * ihrer Bruchkette.
 */
(function (root) {
  "use strict";

  var PM = root.PM || (typeof require !== "undefined" ? require("./multiphonic.js") : null);

  var W = 1000;
  var H = 300; // Beschriftungen der Berührungspunkte stehen oben am Strich; unten nur Hammer und Zeigerdreieck
  var LEFT = 18;
  var RIGHT = 18;
  var BASE = 250; // y der Saite
  var PEAK_MAX = 190; // Höhe des höchsten Ausschlags

  function x(pos) {
    return LEFT + (pos / 0.5) * (W - LEFT - RIGHT);
  }

  // Umkehrung für den Zeiger: x in viewBox-Einheiten → Anteil der Saite (0 … 1/2)
  function posFromX(vx) {
    var p = ((vx - LEFT) / (W - LEFT - RIGHT)) * 0.5;
    return Math.min(0.5, Math.max(0, p));
  }

  // Zeiger (Erweiterung, Vesikkala Kap. 2.3): Gruppe bei x = 0, per transform verschoben,
  // damit app.js ihn beim Ziehen bewegen kann, ohne die Grafik neu zu zeichnen.
  function pointerMark(pos) {
    var px = x(pos);
    return (
      '<g id="ptmark" transform="translate(' + f2(px) + ',0)" style="cursor:ew-resize">' +
      '<line x1="0" x2="0" y1="' + (BASE - PEAK_MAX - 44) + '" y2="' + (BASE + 40) + '" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.8" pointer-events="none"/>' +
      '<path d="M-8,' + (BASE + 40) + ' L8,' + (BASE + 40) + ' L0,' + (BASE + 28) + 'Z" style="fill:currentColor"/>' +
      '<text id="ptlabel" x="0" y="' + (BASE - PEAK_MAX - 50) + '" font-size="13" text-anchor="middle" style="fill:currentColor">' + (pos * 100).toFixed(1) + " %</text>" +
      "</g>"
    );
  }

  function f2(v) {
    return Math.round(v * 100) / 100;
  }

  // Höhe eines Knotens: 0/1 und 1/2 ganz, sonst 1/sqrt(n)
  function peakHeight(n) {
    return n <= 2 ? PEAK_MAX : PEAK_MAX / Math.sqrt(n);
  }

  function nodes(nMax) {
    var list = [];
    for (var n = 1; n <= nMax; n++) {
      for (var k = 0; 2 * k <= n; k++) {
        if (PM.gcd(k, n) !== 1) continue;
        list.push({ k: k, n: n, pos: k / n });
      }
    }
    return list;
  }

  function spike(px, h, width) {
    var top = BASE - h;
    return (
      "M" + f2(px - width) + "," + BASE +
      " Q" + f2(px - width * 0.15) + "," + f2(BASE - h * 0.25) + " " + f2(px) + "," + f2(top) +
      " Q" + f2(px + width * 0.15) + "," + f2(BASE - h * 0.25) + " " + f2(px + width) + "," + BASE + "Z"
    );
  }

  /*
   * Dämpfer und Hammer, ungefähre Lage wie in Walters Grafik (je nach Instrument und
   * Register verschieden): Dämpfer ≈ 0.097 … 0.181, Anschlagpunkt ≈ 0.115 der Saite.
   */
  var DAMPER = [0.097, 0.181];
  var HAMMER = 0.115;

  function mechanics() {
    var s = "<g><title>Damper and hammer: approximate position, depends on piano and register</title>";
    var d0 = x(DAMPER[0]);
    var d1 = x(DAMPER[1]);
    s += '<rect x="' + f2(d0) + '" y="' + (BASE - 24) + '" width="' + f2(d1 - d0) + '" height="22" rx="2" style="fill:var(--mech, #9aa0a4);stroke:currentColor" stroke-width="0.8" opacity="0.8"/>';
    s += '<text x="' + f2((d0 + d1) / 2) + '" y="' + (BASE - 8) + '" font-size="13" text-anchor="middle" style="fill:currentColor">damper</text>';
    var h = x(HAMMER);
    var bar0 = x(0.035);
    s += '<rect x="' + f2(bar0) + '" y="' + (BASE + 9) + '" width="' + f2(h - 4 - bar0) + '" height="18" style="fill:var(--mech, #9aa0a4)" opacity="0.45"/>';
    s += '<text x="' + f2((bar0 + h - 4) / 2) + '" y="' + (BASE + 22) + '" font-size="12" text-anchor="middle" style="fill:currentColor">hammer</text>';
    s += '<rect x="' + f2(h - 4) + '" y="' + (BASE + 4) + '" width="8" height="28" style="fill:var(--mech-dark, #6b7176);stroke:currentColor" stroke-width="0.8"/>';
    return s + "</g>";
  }

  /*
   * marks = [{ color, result, fractions, active }] (je Saite, result null = nichts markieren).
   * Hat eine Marke active, wird nur ihre Bruchkette farbig, die anderen Saiten erscheinen
   * blass; sonst sind alle gleich kräftig.
   */
  /*
   * Multiphonics als Kreise auf der Saitenlinie (Erweiterung): list = [{ k, n }]. Jeder Kreis
   * ist ein Knopf (app.js: Tippen = Multiphonic anschlagen). Die Trefferfläche reicht bis zur
   * halben Strecke zum Nachbarn, höchstens 9 Einheiten, damit dichte Knoten trennbar bleiben.
   */
  function multiphonicMarks(list) {
    var xs = list
      .map(function (m) {
        return { k: m.k, n: m.n, px: x(m.k / m.n) };
      })
      .sort(function (a, b) {
        return a.px - b.px;
      });
    return xs
      .map(function (m, i) {
        var gap = Math.min(i > 0 ? m.px - xs[i - 1].px : 99, i < xs.length - 1 ? xs[i + 1].px - m.px : 99);
        var r = Math.max(2.5, Math.min(9, gap / 2));
        return (
          '<g class="multibtn" data-k="' + m.k + '" data-n="' + m.n + '"><title>Multiphonic ' + m.k + "/" + m.n + "</title>" +
          '<rect x="' + f2(m.px - r) + '" y="' + (BASE - 16) + '" width="' + f2(2 * r) + '" height="32"/>' +
          '<circle cx="' + f2(m.px) + '" cy="' + BASE + '" r="3.8" stroke="currentColor" stroke-width="1.3"/></g>'
        );
      })
      .join("");
  }

  function stringSVG(nMax, marks, opts) {
    opts = opts || {};
    var list = nodes(nMax);
    var body = "";
    var anyActive = marks.some(function (m) {
      return m.active;
    });
    function strong(m) {
      return !anyActive || m.active;
    }

    // Knoten der Bruchketten → Farbe(n)
    var hl = {};
    marks.forEach(function (m) {
      if (m.result == null || !strong(m)) return;
      m.fractions.forEach(function (fr) {
        var g = PM.gcd(fr.numerator, fr.denominator) || 1;
        var key = fr.numerator / g + "/" + fr.denominator / g;
        (hl[key] = hl[key] || []).push(m.color);
      });
    });

    // Spikes
    list.forEach(function (nd) {
      var h = peakHeight(nd.n);
      var w = Math.max(2.2, 7 / Math.sqrt(nd.n));
      var key = nd.k + "/" + nd.n;
      var col = hl[key] ? hl[key][0] : "currentColor";
      body +=
        '<path d="' + spike(x(nd.pos), h, w) + '" style="fill:' + col + '" opacity="' + (hl[key] ? 1 : 0.85) + '">' +
        "<title>Knoten " + nd.k + "/" + nd.n + " · Partialton " + nd.n + " · Position " + nd.pos.toFixed(4) + "</title></path>";
    });

    // Beschriftungen k über n, gierig ohne Überlappung (kleine n zuerst); sie liegen zuoberst,
    // damit die Linien der Berührungspunkte das Antippen nicht abfangen
    var placed = [];
    var labelsBody = "";
    list
      .slice()
      .sort(function (a, b) {
        return a.n - b.n;
      })
      .forEach(function (nd) {
        var fs = nd.n <= 6 ? 13 : nd.n <= 12 ? 10.5 : 8.5;
        var cx = x(nd.pos);
        var top = BASE - peakHeight(nd.n) - 6;
        var box = { x0: cx - fs * 0.75, x1: cx + fs * 0.75, y0: top - fs * 2.1, y1: top };
        for (var i = 0; i < placed.length; i++) {
          var p = placed[i];
          if (box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0) return;
        }
        placed.push(box);
        var key = nd.k + "/" + nd.n;
        var col = hl[key] ? hl[key][0] : "currentColor";
        var weight = hl[key] ? ' font-weight="700"' : "";
        var label =
          '<text x="' + f2(cx) + '" y="' + f2(top - fs * 1.05) + '" font-size="' + fs + '" text-anchor="middle" style="fill:' + col + '"' + weight + ">" + nd.k + "</text>" +
          '<text x="' + f2(cx) + '" y="' + f2(top) + '" font-size="' + fs + '" text-anchor="middle" style="fill:' + col + '"' + weight + ">" + nd.n + "</text>";
        // Beschriftungen k ≥ 1 sind Knöpfe (app.js: Tippen = Strike an diesem Knoten);
        // die Fläche reicht etwas über die Ziffern hinaus, damit man sie mit dem Finger trifft.
        if (nd.k >= 1) {
          var pad = 5;
          label =
            '<g class="nodebtn" data-k="' + nd.k + '" data-n="' + nd.n + '"><title>Strike ' + key + "</title>" +
            '<rect x="' + f2(box.x0 - pad) + '" y="' + f2(box.y0 - pad) + '" width="' + f2(box.x1 - box.x0 + 2 * pad) + '" height="' + f2(box.y1 - box.y0 + 2 * pad + 2) + '" rx="3"/>' +
            label + "</g>";
        }
        labelsBody += label;
      });

    if (opts.mechanics !== false) body += mechanics();

    // Saite
    body += '<line x1="' + LEFT + '" x2="' + (W - RIGHT) + '" y1="' + BASE + '" y2="' + BASE + '" stroke="currentColor" stroke-width="2"/>';

    // Berührungspunkte: Strich mit Punkt auf der Saite, Beschriftung „k/n = 0.xxxx“ oben am
    // Strich, rechts an der Spitze (am rechten Rand links davon). Die aktive Saite (kräftig)
    // wird zuerst platziert; Beschriftungen, die sich überdecken würden, rücken am Strich nach
    // unten. Die aktive Saite wird zuletzt gezeichnet und liegt oben.
    var order = marks
      .map(function (m, i) {
        return i;
      })
      .filter(function (i) {
        return marks[i].result != null;
      })
      .sort(function (a, b) {
        return (strong(marks[a]) ? 1 : 0) - (strong(marks[b]) ? 1 : 0) || a - b;
      });
    var bottom = H;
    var top = BASE - PEAK_MAX - 30;
    var marksBody = "";
    var labels = [];
    order.forEach(function (i) {
      var m = marks[i];
      var st = strong(m);
      var px = x(m.result);
      var last = m.fractions[m.fractions.length - 1];
      marksBody += '<line x1="' + f2(px) + '" x2="' + f2(px) + '" y1="' + top + '" y2="' + (BASE + 22) + '" style="stroke:' + m.color + '" stroke-width="3" opacity="' + (st ? 0.55 : 0.3) + '"/>';
      marksBody += '<circle cx="' + f2(px) + '" cy="' + BASE + '" r="' + (st ? 6 : 4.5) + '" style="fill:' + m.color + '"' + (st ? "" : ' opacity="0.6"') + "/>";
      labels.push({ i: i, st: st, px: px, label: last.numerator + "/" + last.denominator + " = " + m.result.toFixed(4), color: m.color });
    });
    var placed = [];
    labels
      .sort(function (a, b) {
        return (b.st ? 1 : 0) - (a.st ? 1 : 0) || a.i - b.i;
      })
      .forEach(function (l) {
        var fs = l.st ? 14 : 11;
        var w = l.label.length * fs * 0.6;
        var right = l.px > W - RIGHT - w - 10;
        var x0 = right ? l.px - 5 - w : l.px + 5;
        var y = top + fs - 1;
        for (;;) {
          var box = { x0: x0, x1: x0 + w, y0: y - fs, y1: y + 3 };
          var hit = placed.some(function (p) {
            return box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0;
          });
          if (!hit) break;
          y += 15;
        }
        placed.push({ x0: x0, x1: x0 + w, y0: y - fs, y1: y + 3 });
        marksBody +=
          '<text x="' + f2(right ? l.px - 5 : l.px + 5) + '" y="' + y + '" font-size="' + fs + '" font-weight="' + (l.st ? 700 : 600) + '" text-anchor="' + (right ? "end" : "start") + '" style="fill:' + l.color + '"' +
          (l.st ? "" : ' opacity="0.75"') + ">" + l.label + "</text>";
      });
    body += marksBody;

    // Achse
    [0, 0.1, 0.2, 0.3, 0.4, 0.5].forEach(function (t) {
      body += '<line x1="' + f2(x(t)) + '" x2="' + f2(x(t)) + '" y1="' + BASE + '" y2="' + (BASE + 6) + '" stroke="currentColor" stroke-width="1"/>';
    });

    body += labelsBody;
    body += multiphonicMarks(opts.multiphonics || []);
    if (opts.pointer != null) body += pointerMark(opts.pointer);

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" class="stringview" viewBox="0 0 ' + W + " " + bottom +
      '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Knoten auf der ersten Saitenhälfte">' + body + "</svg>"
    );
  }

  /*
   * Eigenständige SVG-Datei der Grafik (Export, Erweiterung): Farben fest in den hellen Werten
   * der Seite (druckfertig, unabhängig vom dunklen Modus), weißer Grund, ohne die
   * unsichtbaren Trefferflächen der Knöpfe. Vektorgrafik, beliebig skalierbar.
   */
  var PRINT = {
    ink: "#1d2124",
    paper: "#ffffff",
    mech: "#a3a9ad",
    mechDark: "#5f666b",
    sc: ["#c8322b", "#1f5fbf", "#2a8a3e", "#b87300", "#7a4cc2", "#0f8a8f", "#c23a87", "#8a5a2b", "#66760f", "#4a5d7a"],
  };

  function standaloneSVG(svg) {
    var bottom = +svg.match(/viewBox="0 0 \d+ (\d+)"/)[1];
    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      svg
        .replace(/(<g class="(?:nodebtn|multibtn)"[^>]*><title>[^<]*<\/title>)<rect[^>]*\/>/g, "$1")
        .replace(/(<g class="multibtn"[^>]*><title>[^<]*<\/title>)<circle /g, '$1<circle fill="' + PRINT.paper + '" ')
        .replace(/var\(--sc(\d)\)/g, function (_, i) {
          return PRINT.sc[+i];
        })
        .replace(/var\(--mech-dark, [^)]*\)/g, PRINT.mechDark)
        .replace(/var\(--mech, [^)]*\)/g, PRINT.mech)
        .replace(/;?cursor:[a-z-]+/g, "")
        .replace(/ style=""/g, "")
        .replace(/currentColor/g, PRINT.ink)
        .replace(
          / class="stringview" viewBox="([^"]+)" preserveAspectRatio="[^"]*" role="img" aria-label="[^"]*">/,
          ' version="1.1" width="' + W + '" height="' + bottom + '" viewBox="$1" font-family="Helvetica, Arial, sans-serif" color="' + PRINT.ink + '">' +
            '<rect width="' + W + '" height="' + bottom + '" fill="' + PRINT.paper + '"/>'
        ) +
      "\n"
    );
  }

  var API = { standaloneSVG: standaloneSVG, POINTER_BOTTOM: BASE + 40, stringSVG: stringSVG, nodes: nodes, DAMPER: DAMPER, HAMMER: HAMMER, x: x, posFromX: posFromX, pointerMark: pointerMark, W: W };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.PMString = API;
})(this);
