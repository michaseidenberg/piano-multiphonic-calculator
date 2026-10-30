/*
 * Spielangaben nach Vesikkalas Notationsvorschlag (Erweiterung, Vesikkala 2016,
 * Kap. 5.2.5 und 5.4, Anhang 3).
 *
 * Zusätzlich zur Bruchanzeige das, was ein Pianist braucht: Griffprozent (Abstand vom
 * vorderen Saitenende als Anteil der Saitenlänge), Spiegelpunkt (derselbe Knoten vom
 * anderen Ende her), Griffintervall (die Tonhöhe, auf die die Saite „gegriffen“ wäre;
 * Vesikkala zeigt sie in Anhang 3, rät aber ausdrücklich davon ab) und, wenn eine
 * Saitenlänge bekannt ist, der Abstand in cm und eine grobe Rillenzahl.
 *
 * Nichts davon ändert Walters Formeln: d ist das Ergebnis aus PM.nodeSeries (0 … 1/2).
 *
 * Zweiter Teil (Kap. 2.3): Was man an einem beliebigen Punkt der Saite hört. Für einen
 * Berührungspunkt d und einen Teilton n:
 *   x   = d · n                        (Vesikkala: GripDistance × PartialNumber)
 *   acc = |0.5 − (x − floor(x))| · 2   (GripAccuracy, 1 = genau auf einem Knoten,
 *                                       0 = genau auf einem Schwingungsbauch)
 * floor(x) sagt, wie viele synonyme Knoten des Teiltons schon passiert sind. Der Teilton
 * klingt, wenn acc ≥ 1 − tol. Vesikkala nennt 0.9 (±5 % des Zyklus), Torres & Ferreira-Lopes
 * ±10 %, empirisch 15–20 %; darum ist tol einstellbar (Default 0.20).
 *
 * Läuft als klassisches <script> (global `PMVesikkala`) und unter Node (module.exports).
 */
(function (root) {
  "use strict";

  var PM = root.PM || (typeof require !== "undefined" ? require("./multiphonic.js") : null);

  // Katalog erst beim Aufruf holen (Ladereihenfolge der <script>-Tags egal).
  function catalogModule() {
    return root.PMCatalog || (typeof require !== "undefined" ? require("./catalog.js") : null);
  }

  // Vesikkala, Kap. 3.1: 6,5 Rillen je cm auf der tiefsten Saite des Estonia-Flügels
  // (ca. 141 cm). Nur ein Anhaltspunkt – die Dichte hängt von der Saite ab.
  var GROOVES_PER_CM = 6.5;

  // Saitennamen für die Spielangabe: wie die String-Auswahl, groß geschrieben, mit ♯/♭.
  var FUNDAMENT_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

  function fundamentName(tone, octave) {
    return FUNDAMENT_NAMES[((tone % 12) + 12) % 12] + octave;
  }

  // Griffprozent und Spiegelpunkt.
  function percent(d) {
    return 100 * d;
  }

  function mirror(d) {
    return 1 - d;
  }

  /*
   * Griffintervall in Cent über dem Grundton für einen Griff bei d (vom vorderen Ende):
   * die verbleibende Länge 1 − d schwingt, also 1200 · log2(1 / (1 − d)).
   * Anhang 3 (Grundton G1): 1/19 → −6 ¢ gegen den nächsten Halbton, 1/18 → −1 ¢,
   * 1/17 → +5 ¢, 1/16 → +12 ¢, 1/15 → +19 ¢, 1/14 → −22 ¢ (Vesikkala rundet auf ganze Cent).
   * Für den Spiegelpunkt gripCents(1 − d) = 1200 · log2(1 / d), z. B. 3/4 → 2400 ¢.
   */
  function gripCents(d) {
    if (!(d > 0 && d < 1)) return null;
    return 1200 * Math.log2(1 / (1 - d));
  }

  /*
   * Griffintervall als Note mit Cent-Abweichung wie in der Spalte „Note“ (gleiche
   * Funktionen): fundamentCents = Cent des Grundtons über C0.
   */
  function gripInfo(d, fundamentCents) {
    var c = gripCents(d);
    if (c == null) return null;
    var cents = fundamentCents + c;
    return { interval: c, cents: cents, note: PM.noteInfo(cents), text: PM.noteText(cents) };
  }

  // Abstand von der Agraffe in cm bei Saitenlänge L (cm); null ohne Länge.
  function distanceCm(d, lengthCm) {
    if (!(lengthCm > 0)) return null;
    return lengthCm * d;
  }

  // Rillenschätzung ≈ 6,5 · L · d (Vesikkala); null ohne Länge.
  function grooves(d, lengthCm) {
    var cm = distanceCm(d, lengthCm);
    return cm == null ? null : GROOVES_PER_CM * cm;
  }

  /*
   * Alles für eine Spalte.
   *   d              Berührungspunkt (PM.computeString(...).result)
   *   fundamentCents Cent des Grundtons über C0 (Zeile Partialton 1)
   *   lengthCm       Saitenlänge in cm oder null
   * Rückgabe { d, percent, mirror, mirrorPercent, grip, gripMirror, cm, cmMirror,
   *            grooves, groovesMirror } – die Spiegelwerte gelten für den Griff vom
   *            hinteren Saitenende her (1 − d).
   */
  function info(d, fundamentCents, lengthCm) {
    if (d == null || !(d > 0 && d < 1)) return null;
    var m = mirror(d);
    return {
      d: d,
      percent: percent(d),
      mirror: m,
      mirrorPercent: percent(m),
      grip: gripInfo(d, fundamentCents),
      gripMirror: gripInfo(m, fundamentCents),
      lengthCm: lengthCm > 0 ? lengthCm : null,
      cm: distanceCm(d, lengthCm),
      cmMirror: distanceCm(m, lengthCm),
      grooves: grooves(d, lengthCm),
      groovesMirror: grooves(m, lengthCm),
    };
  }

  function pct(v) {
    return v.toFixed(1) + " %";
  }

  /*
   * Spielangabe als eine Zeile, Vesikkalas Vorschlag (Kap. 5.4): M, Grundton,
   * Griffprozent (Spiegelpunkt in Klammern), Teiltöne.
   *   M · C♯1 · 30.0 % (70.0 %) · [7 10 13]
   * partials: Liste der Partialtöne, die genannt werden sollen (alle oder die oberen).
   */
  function line(tone, octave, d, partials) {
    var parts = (partials || []).join(" ");
    return "M · " + fundamentName(tone, octave) + " · " + pct(percent(d)) + " (" + pct(percent(mirror(d))) + ")" + (parts ? " · [" + parts + "]" : "");
  }

  // --- Hörbarkeit am Berührungspunkt (Kap. 2.3) ---------------------------------------

  var DEFAULT_TOL = 0.2;
  var TOL_MIN = 0.05;
  var TOL_MAX = 0.3;

  // Genauigkeit des Griffs d für Teilton n, dazu der nächste Knoten k/n und der Abstand
  // in Zyklen des Teiltons (0 … 0.5; Vesikkalas Prozent „of the partial's cycle“).
  function gripAccuracy(d, n) {
    var x = d * n;
    var passed = Math.floor(x);
    var frac = x - passed;
    var accuracy = Math.abs(0.5 - frac) * 2;
    var k = Math.round(x);
    return { partial: n, x: x, passed: passed, accuracy: accuracy, k: k, node: k / n, cycles: Math.abs(x - k) };
  }

  function threshold(tol) {
    if (tol == null) tol = DEFAULT_TOL;
    return 1 - tol;
  }

  function audible(d, n, tol) {
    return gripAccuracy(d, n).accuracy >= threshold(tol) - 1e-12;
  }

  /*
   * Alle Teiltöne 1 … nMax, die am Punkt d klingen, sortiert nach Genauigkeit (bei
   * Gleichstand der tiefere zuerst). → [{ partial, accuracy, k, node, cycles, passed }]
   */
  function audibleAt(d, nMax, tol) {
    var th = threshold(tol);
    var out = [];
    for (var n = 1; n <= nMax; n++) {
      var g = gripAccuracy(d, n);
      if (g.accuracy >= th - 1e-12) out.push(g);
    }
    out.sort(function (a, b) {
      return Math.round(b.accuracy * 1e9) - Math.round(a.accuracy * 1e9) || a.partial - b.partial;
    });
    return out;
  }

  /*
   * Lautstärkefaktor nach Genauigkeit: 0.5 an der Hörschwelle, 1 genau auf dem Knoten,
   * dazwischen linear; unterhalb der Schwelle 0. Eigene Annahme, kein Wert aus der Arbeit.
   */
  function weight(accuracy, tol) {
    var th = threshold(tol);
    if (accuracy < th - 1e-12) return 0;
    var span = 1 - th;
    return span > 0 ? 0.5 + 0.5 * Math.min(1, (accuracy - th) / span) : 1;
  }

  // Katalogknoten (k/n ≤ 1/2, n ≤ nMax), der d am nächsten liegt; d > 1/2 wird gespiegelt.
  function nearestNode(d, nMax) {
    var p = d > 0.5 ? 1 - d : d;
    var best = null;
    catalogModule().catalog(nMax).forEach(function (e) {
      var dist = Math.abs(e.pos - p);
      if (!best || dist < best.dist) best = { entry: e, dist: dist };
    });
    return best ? best.entry : null;
  }

  var API = {
    GROOVES_PER_CM: GROOVES_PER_CM,
    FUNDAMENT_NAMES: FUNDAMENT_NAMES,
    fundamentName: fundamentName,
    percent: percent,
    mirror: mirror,
    gripCents: gripCents,
    gripInfo: gripInfo,
    distanceCm: distanceCm,
    grooves: grooves,
    info: info,
    line: line,
    DEFAULT_TOL: DEFAULT_TOL,
    TOL_MIN: TOL_MIN,
    TOL_MAX: TOL_MAX,
    gripAccuracy: gripAccuracy,
    threshold: threshold,
    audible: audible,
    audibleAt: audibleAt,
    weight: weight,
    nearestNode: nearestNode,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.PMVesikkala = API;
})(this);
