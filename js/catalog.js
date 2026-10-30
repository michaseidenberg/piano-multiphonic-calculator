/*
 * Katalog aller Multiphonics einer Saite (Erweiterung, Vesikkala 2016, Anhang 3).
 *
 * Jeder gekürzte Bruch k/n mit 1 ≤ k, 2k ≤ n ≤ nMax ist ein Knoten auf der ersten
 * Saitenhälfte. Zu jedem Knoten gehört die Teiltongruppe, die Walters Fraction-Windowing
 * (PM.nodeSeries) liefert: der kleinste zu n teilerfremde Partialton b < n, dessen Kette
 * in k/n endet, bestimmt die Gruppe (die Nenner der Kette). Mit nMax = 19 sind das
 * Vesikkalas 60 Multiphonics. Die Original-Formeln bleiben unverändert; hier wird nur
 * aufgezählt und sortiert.
 *
 * Läuft als klassisches <script> (global `PMCatalog`) und unter Node (module.exports).
 */
(function (root) {
  "use strict";

  var PM = root.PM || (typeof require !== "undefined" ? require("./multiphonic.js") : null);

  var DEFAULT_NMAX = 19; // Vesikkalas Grenze (seine Annahme, einstellbar)

  var SORTS = {
    node: "Node position",
    partial: "Highest partial",
    pitch: "Highest pitch",
  };

  /*
   * Teiltongruppe zum Knoten k/n: kleinstes b < n, gcd(n, b) = 1, dessen Kette in k/n
   * endet. Rückgabe { b, fractions: [[Knoten, Partialton], …] } oder null.
   * Sonderfall 1/2: das Original liefert für 2/1 den Bruch 1/3 (s. formeln.md), darum
   * fest [[0, 1], [1, 2]].
   */
  function group(k, n) {
    if (n === 2 && k === 1) return { b: 1, fractions: [[0, 1], [1, 2]] };
    for (var b = 1; b < n; b++) {
      if (PM.gcd(n, b) !== 1) continue;
      var s = PM.nodeSeries(n, b);
      if (s.error || !s.fractions.length) continue;
      var last = s.fractions[s.fractions.length - 1];
      if (last.numerator === k && last.denominator === n) {
        return {
          b: b,
          fractions: s.fractions.map(function (f) {
            return [f.numerator, f.denominator];
          }),
        };
      }
    }
    return null;
  }

  /*
   * Die oberen drei bis vier Teiltöne der Gruppe, wie Vesikkala sie schreibt (5_9_14):
   * die lückenlose Folge 1, 2, 3, … am Anfang wird weggelassen, mindestens drei und
   * höchstens vier Teiltöne bleiben stehen.
   */
  function shownPartials(partials) {
    var i = 0;
    while (i < partials.length && partials[i] === i + 1) i++;
    var start = Math.min(i, Math.max(0, partials.length - 3));
    start = Math.max(start, partials.length - 4);
    return partials.slice(start);
  }

  function groupText(partials) {
    return partials.join("_");
  }

  var memo = {};

  // Alle Knoten bis nMax, aufsteigend nach k/n.
  function catalog(nMax) {
    nMax = Math.max(2, Math.floor(nMax || DEFAULT_NMAX));
    if (memo[nMax]) return memo[nMax];
    var list = [];
    for (var n = 2; n <= nMax; n++) {
      for (var k = 1; 2 * k <= n; k++) {
        if (PM.gcd(k, n) !== 1) continue;
        var g = group(k, n);
        var fractions = g ? g.fractions : [[k, n]];
        var partials = fractions.map(function (f) {
          return f[1];
        });
        list.push({
          k: k,
          n: n,
          b: g ? g.b : null,
          pos: k / n,
          percent: (100 * k) / n,
          fractions: fractions,
          partials: partials,
          shown: shownPartials(partials),
        });
      }
    }
    list.sort(function (a, b) {
      return a.pos - b.pos || a.n - b.n;
    });
    memo[nMax] = list;
    return list;
  }

  /*
   * Katalog für eine Saite: je Knoten die Zeilen wie in den Spalten One/Two
   * (gleiche Funktionen: Saitenfrequenz, Cent über C0, Notenname, 72er-Stufe).
   */
  function forString(concertPitch, tone, octave, nMax) {
    var freq = PM.stringFrequency(concertPitch, tone, octave);
    var entries = catalog(nMax).map(function (e) {
      var rows = e.fractions.map(function (f) {
        var pf = freq * f[1];
        var cents = PM.centsAboveC0(pf, concertPitch);
        return { node: f[0], partial: f[1], freq: pf, cents: cents, note: PM.noteInfo(cents), step72: PM.step72(cents) };
      });
      var out = Object.assign({}, e);
      out.rows = rows;
      out.top = rows[rows.length - 1];
      return out;
    });
    return { freq: freq, entries: entries };
  }

  // Sortierte Kopie: node (Knotenlage), partial (höchster Teilton), pitch (höchste Tonhöhe).
  function sort(entries, mode) {
    var cmp = {
      node: function (a, b) {
        return a.pos - b.pos || a.n - b.n;
      },
      partial: function (a, b) {
        return a.n - b.n || a.pos - b.pos;
      },
      pitch: function (a, b) {
        var ca = a.top ? a.top.cents : a.n;
        var cb = b.top ? b.top.cents : b.n;
        return ca - cb || a.pos - b.pos;
      },
    }[mode] || null;
    var out = entries.slice();
    if (cmp) out.sort(cmp);
    return out;
  }

  // Suchtext "7 10" → [7, 10]; alles andere als Zahlen wird ignoriert.
  function parseSearch(text) {
    return String(text || "")
      .split(/[^0-9]+/)
      .filter(Boolean)
      .map(Number);
  }

  /*
   * Filter: maxPartial = nur Knoten mit n ≤ maxPartial (leer = alle);
   * search = Teiltonnummern, die alle in der Gruppe vorkommen müssen.
   */
  function filter(entries, opts) {
    opts = opts || {};
    var max = opts.maxPartial;
    var want = Array.isArray(opts.search) ? opts.search : parseSearch(opts.search);
    return entries.filter(function (e) {
      if (max > 0 && e.n > max) return false;
      for (var i = 0; i < want.length; i++) if (e.partials.indexOf(want[i]) < 0) return false;
      return true;
    });
  }

  var API = {
    DEFAULT_NMAX: DEFAULT_NMAX,
    SORTS: SORTS,
    group: group,
    shownPartials: shownPartials,
    groupText: groupText,
    catalog: catalog,
    forString: forString,
    sort: sort,
    parseSearch: parseSearch,
    filter: filter,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.PMCatalog = API;
})(this);
