/*
 * Rechenkern des Piano Multiphonic Calculator.
 *
 * Nachgebaut aus dem Original von Caspar Johannes Walter
 * (https://www.casparjohanneswalter.de/research/piano_multiphonic_calculator,
 * Komponente "Bn" im gebündelten index.js). Formeln und Sonderfälle sind
 * absichtlich unverändert übernommen; Abweichungen stehen bei der Funktion.
 *
 * Läuft als klassisches <script> im Browser (global `PM`) und unter Node
 * (module.exports) – ohne Abhängigkeiten.
 */
(function (root) {
  "use strict";

  // Notennamen der String-Auswahl im Original (Index = Halbtöne über c).
  var STRING_NAMES = ["c", "c#", "d", "e♭", "e", "f", "f#", "g", "a♭", "a", "b♭", "b"];

  // Notennamen der Ergebnis-Spalte "Note" im Original (Komponente "Fe").
  var NOTE_NAMES = ["C", "#C", "D", "bE", "E", "F", "#F", "G", "bA", "A", "bB", "B"];

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      var t = a % b;
      a = b;
      b = t;
    }
    return a;
  }

  // Bruch k/n: k = Knoten, n = Partialton. Wird wie im Original NICHT gekürzt.
  function Fraction(numerator, denominator) {
    this.numerator = numerator;
    this.denominator = denominator;
  }
  Object.defineProperty(Fraction.prototype, "value", {
    get: function () {
      return this.numerator / this.denominator;
    },
  });
  Fraction.prototype.toString = function () {
    return this.numerator + "/" + this.denominator;
  };

  /*
   * Grundfrequenz der Saite.
   *   f = A / 2^(3/4) / 16 · 2^(Ton/12) · 2^Oktave
   * A / 2^(3/4) ist das c unter dem Kammerton, /16 führt vier Oktaven tiefer
   * (C0). Oktave 1 + Ton c bei A = 442 ergibt 32.85 Hz.
   */
  function stringFrequency(concertPitch, tone, octave) {
    return (concertPitch / Math.pow(2, 3 / 4) / 16) * Math.pow(2, tone / 12) * Math.pow(2, octave);
  }

  function isPositiveInt(x) {
    return typeof x === "number" && isFinite(x) && x > 0 && Math.floor(x) === x;
  }

  /*
   * Fraction-Windowing (Walter): aus zwei teilerfremden Partialtönen p1, p2
   * die Kette der Knoten/Partialton-Brüche berechnen, deren letzter Bruch der
   * Berührungspunkt auf der Saite ist (Anteil der Saitenlänge, ≤ 1/2).
   *
   * 1. Subtraktive Euklid-Folge: u = [max, min], dann immer |vorletztes − letztes|
   *    anhängen, bis die Differenz 0 ist (die letzte Zahl wird verworfen).
   * 2. Folge umdrehen und nur die Werte behalten, die ein neues Maximum sind → h.
   * 3. Brüche: s = [0/1, 1/2, 1/3]; für jedes weitere h[p]:
   *      m = h[p] − h[p−1];  d = s[Index von m in h];  g = s[p−1]
   *      s[p] = (d.Zähler + g.Zähler) / h[p]
   *    (Mediant-Bildung: der neue Bruch liegt zwischen zwei Vorgängern.)
   * 4. Ergebnis = Wert des letzten Bruchs.
   *
   * Rückgabe { error, result, fractions } wie im Original. Ohne beide Eingaben
   * → leere Liste, result null.
   *
   * Sonderfälle wie im Original: s startet immer mit drei Einträgen, auch wenn
   * h kürzer ist (z. B. p1=2, p2=1 → result 1/3).
   * Abweichung: Nicht-ganzzahlige oder nicht-positive Eingaben geben hier eine
   * Fehlermeldung (im Original wirft mathjs.gcd eine Ausnahme).
   */
  function nodeSeries(p1, p2) {
    if (p1 == null || p2 == null || p1 === 0 || p2 === 0) {
      return { error: null, result: null, fractions: [] };
    }
    if (!isPositiveInt(p1) || !isPositiveInt(p2)) {
      return { error: "Partials must be positive integers", result: null, fractions: [] };
    }
    var g = gcd(p1, p2);
    if (g !== 1) {
      return { error: "Greatest common divisor: " + g, result: null, fractions: [] };
    }

    var u = [Math.max(p1, p2), Math.min(p1, p2)];
    for (;;) {
      var diff = Math.abs(u[u.length - 2] - u[u.length - 1]);
      if (diff === 0) {
        u.pop();
        break;
      }
      u.push(diff);
    }
    u.reverse();

    var max = 0;
    var h = [];
    u.forEach(function (x) {
      if (x > max) {
        max = x;
        h.push(x);
      }
    });

    var s = [new Fraction(0, 1), new Fraction(1, 2), new Fraction(1, 3)];
    for (var p = 3; p < h.length; p++) {
      var m = h[p] - h[p - 1];
      var d = s[h.indexOf(m)];
      var prev = s[p - 1];
      s.push(new Fraction(d.numerator + prev.numerator, h[p]));
    }
    return { error: null, result: s[s.length - 1].value, fractions: s };
  }

  // Bezugsfrequenz C0 = A / 2^4.75 (16.43 Hz bei A = 442).
  function c0Frequency(concertPitch) {
    return concertPitch / Math.pow(2, 4.75);
  }

  // Cent über C0.
  function centsAboveC0(freq, concertPitch) {
    return 1200 * Math.log2(freq / c0Frequency(concertPitch));
  }

  function mod(a, n) {
    return ((a % n) + n) % n;
  }

  // Oktavnummer zur Cent-Angabe, gerundet auf den nächsten Halbton (Original "Ce").
  function octaveOf(cents) {
    var t = (cents + 50) / 1200;
    var n = Math.trunc(t);
    if (t < 0) n--;
    return n;
  }

  /*
   * Notenname, Oktave und Abweichung in Cent (Original "Fe"):
   * nächster temperierter Halbton, Abweichung im Bereich (−50, +50].
   */
  function noteInfo(cents) {
    var name = NOTE_NAMES[Math.trunc(mod(cents + 50, 1200) / 100)];
    var c = mod(cents, 1200);
    var base = 100 * Math.trunc(c / 100);
    var n = Math.abs(c - base);
    var deviation = n < 50 ? n : -(100 - n);
    return { name: name, semitone: NOTE_NAMES.indexOf(name), octave: octaveOf(cents), deviation: deviation };
  }

  // Abweichung formatiert wie im Original: "+12.3¢", "-4.0¢", bei 0 leer.
  function centsText(deviation) {
    if (deviation === 0) return "";
    return (deviation > 0 ? "+" : "") + deviation.toFixed(1) + "¢";
  }

  // Ganze Notenangabe wie in der Spalte "Note" des Originals, z. B. "bB3 -31.2¢".
  function noteText(cents) {
    var n = noteInfo(cents);
    var c = centsText(n.deviation);
    return n.name + n.octave + (c ? " " + c : "");
  }

  /*
   * Index im 72-tönigen Raster (Zwölfteltöne) innerhalb der Oktave, wie ihn
   * das Original für die Notenbilder verwendet (Komponente "Le"):
   *   floor(72 · (Cent + 100/12) / 1200) mod 72  → auf 1/12-Ton gerundet.
   */
  function step72(cents) {
    return mod(Math.floor((72 * (cents + 100 / 12)) / 1200), 72);
  }

  /*
   * Alles, was die Ergebnistabelle einer Saite braucht.
   * data = { tone, octave, p1, p2 }
   */
  function computeString(concertPitch, data) {
    var freq = stringFrequency(concertPitch, data.tone, data.octave);
    var series = nodeSeries(data.p1, data.p2);
    var rows = series.fractions.map(function (f) {
      var pf = freq * f.denominator;
      var cents = centsAboveC0(pf, concertPitch);
      return {
        node: f.numerator,
        partial: f.denominator,
        freq: pf,
        cents: cents,
        note: noteInfo(cents),
        step72: step72(cents),
      };
    });
    return { freq: freq, error: series.error, result: series.result, fractions: series.fractions, rows: rows };
  }

  /*
   * Synthese wie im Original (Komponente "ve"): jede gespielte Frequenz f
   * erklingt mit 16 Sinus-Teiltönen k·f (k = 1..16), Lautstärke
   *   v_k = base · r^(k−1),  r = 1 / sqrt(max(f, 32) / 16),  base = 0.5
   * Teiltöne ab 22050 Hz bleiben stumm. Master-Gain 0.25.
   */
  function synthPartials(freq, base) {
    if (base == null) base = 0.5;
    var r = 1 / Math.sqrt(Math.max(freq, 32) / 16);
    var out = [];
    for (var i = 0; i < 16; i++) {
      var f = (i + 1) * freq;
      out.push({ freq: f, gain: f >= 22050 ? 0 : Math.pow(r, i) * base });
    }
    return out;
  }

  var PM = {
    STRING_NAMES: STRING_NAMES,
    NOTE_NAMES: NOTE_NAMES,
    Fraction: Fraction,
    gcd: gcd,
    stringFrequency: stringFrequency,
    nodeSeries: nodeSeries,
    c0Frequency: c0Frequency,
    centsAboveC0: centsAboveC0,
    octaveOf: octaveOf,
    noteInfo: noteInfo,
    centsText: centsText,
    noteText: noteText,
    step72: step72,
    computeString: computeString,
    synthPartials: synthPartials,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = PM;
  else root.PM = PM;
})(this);
