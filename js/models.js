/*
 * Flügelmodelle: Saitenlängen je Saite (Erweiterung, Vesikkala 2016).
 *
 * Die Länge hängt vom Modell und von der Saite ab. Jeder Eintrag hat `strings`: Schlüssel
 * wie "a0", "c#1", "eb1" (Saitenname klein, ♯ als #, ♭ als b, dann Oktave), Wert = schwingende
 * Länge in cm von der Agraffe bis zum Stimmnagel-seitigen Ende (Vesikkala misst den ganzen
 * Stahlkern, nicht nur die Umspinnung). Unbelegte Saiten fehlen – dann gibt es keine
 * cm-Anzeige. Quellen in docs/modelle.md.
 *
 * Eigene Modelle werden im Browser gespeichert (localStorage) und lassen sich als JSON
 * exportieren und einlesen. Die Modellwahl ist auch die Grundlage für Schritt 4
 * (Hammerpunkt, Dämpferbereich, Reichweite je Modell).
 *
 * Läuft als klassisches <script> (global `PMModels`) und unter Node (module.exports).
 */
(function (root) {
  "use strict";

  var STORE_KEY = "piano-multiphonics:models";

  // Saitennamen wie PM.STRING_NAMES, aber ASCII (für Schlüssel und Eingabe).
  var KEY_NAMES = ["c", "c#", "d", "eb", "e", "f", "f#", "g", "ab", "a", "bb", "b"];
  var ALIASES = { db: 1, "d#": 3, gb: 6, "g#": 8, "a#": 10, h: 11, hb: 10 };

  var MODELS = [
    { id: "generic", name: "Generic (no string lengths)", strings: {}, source: "" },
    {
      id: "estonia-aalto",
      name: "Estonia (half-built, Aalto lab)",
      strings: { a0: 141 },
      source: "Vesikkala 2016, ch. 3.1: lowest monochord string ca. 141 cm, 6.5 grooves per cm",
    },
    { id: "steinway-d", name: "Steinway D", strings: {}, source: "no verified lengths yet" },
    { id: "steinway-b", name: "Steinway B", strings: {}, source: "no verified lengths yet" },
    { id: "boesendorfer-225", name: "Bösendorfer 225", strings: {}, source: "no verified lengths yet" },
    { id: "fazioli-f212", name: "Fazioli F212", strings: {}, source: "no verified lengths yet" },
  ];

  function stringKey(tone, octave) {
    return KEY_NAMES[((tone % 12) + 12) % 12] + octave;
  }

  // "C#1", "Eb1", "e♭1", "A0" → { tone, octave } oder null.
  function parseKey(text) {
    var m = String(text || "")
      .trim()
      .toLowerCase()
      .replace(/♯/g, "#")
      .replace(/♭/g, "b")
      .match(/^([a-h](?:#|b)?)\s*(-?\d)$/);
    if (!m) return null;
    var name = m[1];
    var tone = KEY_NAMES.indexOf(name);
    if (tone < 0 && ALIASES[name] != null) tone = ALIASES[name];
    if (tone < 0) return null;
    return { tone: tone, octave: parseInt(m[2], 10) };
  }

  // Saitenlänge in cm für Saite (tone, octave) im Modell, sonst null.
  function lengthFor(model, tone, octave) {
    if (!model || !model.strings) return null;
    var v = model.strings[stringKey(tone, octave)];
    return typeof v === "number" && v > 0 ? v : null;
  }

  /*
   * Eingabe "A0 141 / C#1: 120.5 / Eb1 = 118" (eine Saite je Zeile oder durch Semikolon,
   * Schrägstrich oder Komma vor dem nächsten Saitennamen getrennt; Dezimalkomma erlaubt)
   * → { a0: 141, "c#1": 120.5, eb1: 118 }. Unlesbare Teile werden übergangen und in
   * `errors` genannt.
   */
  function parseLengths(text) {
    var strings = {};
    var errors = [];
    String(text || "")
      .split(/[\n;\/]+|,\s*(?=[A-Ha-h])/)
      .forEach(function (part) {
        var t = part.trim();
        if (!t) return;
        var m = t.match(/^([A-Ha-h](?:#|b|♯|♭)?\s*-?\d)\s*[:=]?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:cm)?$/);
        var key = m && parseKey(m[1]);
        if (!key) {
          errors.push(t);
          return;
        }
        strings[stringKey(key.tone, key.octave)] = parseFloat(m[2].replace(",", "."));
      });
    return { strings: strings, errors: errors };
  }

  // Umkehrung für das Formular: { a0: 141 } → "A0 141".
  function lengthsText(strings) {
    return Object.keys(strings || {})
      .map(function (k) {
        var p = parseKey(k);
        return { k: k, p: p, v: strings[k] };
      })
      .filter(function (e) {
        return e.p && typeof e.v === "number";
      })
      .sort(function (a, b) {
        return a.p.octave - b.p.octave || a.p.tone - b.p.tone;
      })
      .map(function (e) {
        var n = KEY_NAMES[e.p.tone];
        return n.charAt(0).toUpperCase() + n.slice(1) + e.p.octave + " " + e.v;
      })
      .join("\n");
  }

  function makeId(name, taken) {
    var base =
      String(name || "model")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "model";
    var id = base;
    var i = 2;
    while (taken && taken.indexOf(id) >= 0) id = base + "-" + i++;
    return id;
  }

  // Ein Modell prüfen und säubern (für JSON-Import und Formular); null wenn unbrauchbar.
  function normalize(m, taken) {
    if (!m || typeof m !== "object" || !m.name) return null;
    var strings = {};
    Object.keys(m.strings || {}).forEach(function (k) {
      var p = parseKey(k);
      var v = Number(m.strings[k]);
      if (p && v > 0) strings[stringKey(p.tone, p.octave)] = v;
    });
    return {
      id: typeof m.id === "string" && m.id && !(taken && taken.indexOf(m.id) >= 0) ? m.id : makeId(m.name, taken),
      name: String(m.name),
      strings: strings,
      source: m.source ? String(m.source) : "",
      custom: true,
    };
  }

  function all(custom) {
    return MODELS.concat(custom || []);
  }

  function find(id, custom) {
    var list = all(custom);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return MODELS[0];
  }

  function toJSON(models) {
    return JSON.stringify(
      (Array.isArray(models) ? models : [models]).map(function (m) {
        return { id: m.id, name: m.name, strings: m.strings, source: m.source || "" };
      }),
      null,
      2
    );
  }

  // JSON (ein Modell oder eine Liste) → Liste gültiger Modelle; wirft bei kaputtem JSON.
  function fromJSON(text, taken) {
    var data = JSON.parse(text);
    var list = Array.isArray(data) ? data : [data];
    var ids = (taken || []).slice();
    var out = [];
    list.forEach(function (m) {
      var n = normalize(m, ids);
      if (n) {
        out.push(n);
        ids.push(n.id);
      }
    });
    return out;
  }

  function loadCustom() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(STORE_KEY);
      return raw ? fromJSON(raw, MODELS.map(function (m) { return m.id; })) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCustom(list) {
    try {
      root.localStorage && root.localStorage.setItem(STORE_KEY, toJSON(list));
    } catch (e) {}
  }

  var API = {
    STORE_KEY: STORE_KEY,
    MODELS: MODELS,
    KEY_NAMES: KEY_NAMES,
    stringKey: stringKey,
    parseKey: parseKey,
    lengthFor: lengthFor,
    parseLengths: parseLengths,
    lengthsText: lengthsText,
    makeId: makeId,
    normalize: normalize,
    all: all,
    find: find,
    toJSON: toJSON,
    fromJSON: fromJSON,
    loadCustom: loadCustom,
    saveCustom: saveCustom,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.PMModels = API;
})(this);
