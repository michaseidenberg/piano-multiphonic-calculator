/*
 * Schlichte Klavier-Synthese für den ganzen Multiphonic (nicht im Original).
 *
 * Alle Partialtöne der Ergebnistabelle erklingen gleichzeitig als Sinus mit
 * Anschlag und exponentiellem Ausklingen:
 *
 *   Frequenz   f_n = n · f · sqrt(1 + B · n²)      (B = Inharmonizität, Default 0)
 *   Lautstärke a_n = n^(−tilt), dann so skaliert, dass Σ a_n = 0.8
 *   Abklingen  τ_n = decay · 3 s · sqrt(100 Hz / f_n), begrenzt auf 0.15 … 12 s
 *              (Zeitkonstante: nach τ ist der Ton auf 37 %, nach ~7 τ auf −60 dB)
 *
 * Tiefe Teiltöne klingen also lange, hohe kurz – wie beim Klavier.
 */
(function (root) {
  "use strict";

  var DEFAULTS = { tilt: 0.5, decay: 1, inharmonicity: 0 };

  function tauFor(freq, decay) {
    var t = decay * 3 * Math.sqrt(100 / freq);
    return Math.min(12 * decay, Math.max(0.15, t));
  }

  /*
   * fundamental: Grundfrequenz der Saite
   * partials: Partialtonnummern (aus den Zeilen, z. B. [1, 2, 3, 4, 7, 11])
   * opts: { tilt, decay, inharmonicity, weights }
   *   weights (Erweiterung, Vesikkala): { Partialton: Faktor 0 … 1 } auf die Lautstärke
   *   vor der Normierung; Faktor 0 lässt den Teilton weg.
   * → [{ partial, freq, gain, tau }]
   */
  function strikePartials(fundamental, partials, opts) {
    var o = Object.assign({}, DEFAULTS, opts || {});
    var list = partials
      .filter(function (n, i, a) {
        return a.indexOf(n) === i;
      })
      .map(function (n) {
        var f = n * fundamental * Math.sqrt(1 + o.inharmonicity * n * n);
        var w = o.weights && o.weights[n] != null ? o.weights[n] : 1;
        return { partial: n, freq: f, gain: Math.pow(n, -o.tilt) * w, tau: tauFor(f, o.decay) };
      })
      .filter(function (p) {
        return p.freq < 20000 && p.gain > 0;
      });
    var sum = list.reduce(function (s, p) {
      return s + p.gain;
    }, 0);
    list.forEach(function (p) {
      p.gain = sum > 0 ? (p.gain / sum) * 0.8 : 0;
    });
    return list;
  }

  var API = { DEFAULTS: DEFAULTS, strikePartials: strikePartials, tauFor: tauFor };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.PMPiano = API;
})(this);
