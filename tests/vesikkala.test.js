// node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const PM = require("../js/multiphonic.js");
const V = require("../js/vesikkala.js");
const M = require("../js/models.js");
const E = require("../js/export.js");
const C = require("../js/catalog.js");

// Grundton G1 wie in Vesikkalas Anhang 3 (Kammerton 442: ca. 49 Hz)
const g1 = PM.centsAboveC0(PM.stringFrequency(442, 7, 1), 442);

test("Prozent und Spiegelpunkt", () => {
  assert.equal(V.percent(3 / 11).toFixed(1), "27.3");
  assert.equal(V.percent(V.mirror(3 / 11)).toFixed(1), "72.7");
  assert.equal(V.mirror(0.3), 0.7);
});

test("Griffintervall: 1/19 → −6 ¢ gegen den nächsten Halbton (Vesikkala, Anhang 3)", () => {
  const g = V.gripInfo(1 / 19, g1);
  assert.equal(Math.round(g.note.deviation), -6);
  assert.equal(g.note.name + g.note.octave, "bA1");
  assert.equal(g.text, "bA1 -6.4¢");
  // weitere Werte aus Anhang 3: 1/18 −1 ¢, 1/17 +5 ¢, 1/16 +12 ¢, 1/15 +19 ¢ gegen den
  // Halbton, 1/14 −22 ¢ gegen Vesikkalas Viertelton (150 ¢) = +28 ¢ gegen den Halbton
  const expected = { 18: 99, 17: 105, 16: 112, 15: 119, 14: 128 };
  Object.keys(expected).forEach((n) => {
    assert.equal(Math.round(V.gripCents(1 / n)), expected[n], "1/" + n);
  });
  assert.equal(Math.round(V.gripInfo(1 / 14, g1).note.deviation), 28);
});

test("Griffintervall: 1/2 → 1200 ¢, Spiegel von 1/4 (3/4) → 2400 ¢", () => {
  assert.ok(Math.abs(V.gripCents(1 / 2) - 1200) < 1e-9);
  assert.ok(Math.abs(V.gripCents(3 / 4) - 2400) < 1e-9);
  assert.ok(Math.abs(V.gripCents(V.mirror(1 / 4)) - 2400) < 1e-9);
  assert.ok(Math.abs(V.gripCents(1 / 3) - 1200 * Math.log2(1.5)) < 1e-9);
  assert.equal(V.gripCents(0), null);
  assert.equal(V.gripCents(1), null);
  assert.equal(V.gripInfo(null, g1), null);
});

test("Abstand in cm: L = 141, d = 0.3 → 42.3; Rillen ≈ 6.5 · cm", () => {
  assert.ok(Math.abs(V.distanceCm(0.3, 141) - 42.3) < 1e-9);
  assert.equal(V.distanceCm(0.3, null), null);
  assert.equal(V.distanceCm(0.3, 0), null);
  assert.ok(Math.abs(V.grooves(0.3, 141) - 6.5 * 42.3) < 1e-9);
  assert.equal(V.grooves(0.3, null), null);
  assert.equal(V.GROOVES_PER_CM, 6.5);
});

test("info: alles für eine Spalte, mit und ohne Saitenlänge", () => {
  const r = PM.computeString(442, { tone: 9, octave: 0, p1: 11, p2: 4 });
  const i = V.info(r.result, r.rows[0].cents, 141);
  assert.equal(i.percent.toFixed(1), "27.3");
  assert.equal(i.mirrorPercent.toFixed(1), "72.7");
  assert.equal(i.lengthCm, 141);
  assert.equal(i.cm.toFixed(2), (141 * 3 / 11).toFixed(2));
  assert.equal(i.cmMirror.toFixed(2), (141 * 8 / 11).toFixed(2));
  assert.ok(Math.abs(i.grip.interval - 1200 * Math.log2(11 / 8)) < 1e-9);
  assert.ok(Math.abs(i.gripMirror.interval - 1200 * Math.log2(11 / 3)) < 1e-9);
  const j = V.info(r.result, r.rows[0].cents, null);
  assert.equal(j.lengthCm, null);
  assert.equal(j.cm, null);
  assert.equal(j.grooves, null);
  assert.equal(V.info(null, 0, 141), null);
});

test("Spielangabe als Zeile: M · Grundton · % (Spiegel) · [Teiltöne]", () => {
  assert.equal(V.line(1, 1, 0.3, [7, 10, 13]), "M · C♯1 · 30.0 % (70.0 %) · [7 10 13]");
  assert.equal(V.line(3, 1, 3 / 11, []), "M · E♭1 · 27.3 % (72.7 %)");
  assert.equal(V.fundamentName(9, 0), "A0");
  assert.equal(V.fundamentName(11, 1), "B1");
  // obere Teiltöne wie im Katalog
  const e = C.catalog(19).find((x) => x.k === 4 && x.n === 13);
  assert.equal(V.line(0, 1, e.pos, e.shown), "M · C1 · 30.8 % (69.2 %) · [7 10 13]");
});

test("Export: Format „Spielangabe“ mit allen Teiltönen", () => {
  const r = PM.computeString(442, { tone: 0, octave: 1, p1: 11, p2: 4 });
  assert.equal(E.playingText(r, { tone: 0, octave: 1 }), "M · C1 · 27.3 % (72.7 %) · [1 2 3 4 7 11]");
  assert.equal(E.playingText(PM.computeString(442, { tone: 0, octave: 1, p1: 12, p2: 8 }), { tone: 0, octave: 1 }), "");
  assert.ok(E.FORMATS.playing.line);
  // die Zahlformate bleiben unverändert, "playing" fällt dort auf Midicents zurück
  assert.equal(E.rowsText(r.rows, "playing"), E.rowsText(r.rows, "midicents"));
});

test("Modelle: Schlüssel, Länge je Saite, Estonia A0 = 141 cm", () => {
  assert.equal(M.stringKey(9, 0), "a0");
  assert.equal(M.stringKey(1, 1), "c#1");
  assert.equal(M.stringKey(3, 1), "eb1");
  assert.deepEqual(M.parseKey("C#1"), { tone: 1, octave: 1 });
  assert.deepEqual(M.parseKey("e♭1"), { tone: 3, octave: 1 });
  assert.deepEqual(M.parseKey("Db1"), { tone: 1, octave: 1 });
  assert.deepEqual(M.parseKey("H1"), { tone: 11, octave: 1 });
  assert.equal(M.parseKey("x1"), null);
  const estonia = M.find("estonia-aalto");
  assert.equal(M.lengthFor(estonia, 9, 0), 141);
  assert.equal(M.lengthFor(estonia, 0, 1), null);
  assert.equal(M.lengthFor(M.find("generic"), 9, 0), null);
  assert.equal(M.find("nope").id, "generic");
  assert.ok(M.MODELS.every((m) => m.id && m.name && m.strings));
});

test("Modelle: Eingabe je Saite, JSON hin und zurück", () => {
  const p = M.parseLengths("A0 141\nC#1: 120.5, Eb1 = 118 cm; bogus");
  assert.deepEqual(p.strings, { a0: 141, "c#1": 120.5, eb1: 118 });
  assert.deepEqual(M.parseLengths("A0 140,5\nC1 130,25").strings, { a0: 140.5, c1: 130.25 });
  assert.deepEqual(p.errors, ["bogus"]);
  assert.equal(M.lengthsText(p.strings), "A0 141\nC#1 120.5\nEb1 118");
  const custom = M.normalize({ name: "Mein Flügel", strings: { "A0": 140, "c1": "x" } }, ["generic"]);
  assert.equal(custom.id, "mein-fl-gel");
  assert.deepEqual(custom.strings, { a0: 140 });
  assert.equal(custom.custom, true);
  const back = M.fromJSON(M.toJSON([custom]), ["generic"]);
  assert.equal(back.length, 1);
  assert.equal(back[0].name, "Mein Flügel");
  assert.deepEqual(back[0].strings, { a0: 140 });
  assert.equal(M.fromJSON('{"name":"X","strings":{}}')[0].id, "x");
  assert.equal(M.makeId("Steinway D", ["steinway-d"]), "steinway-d-2");
  assert.equal(M.all([custom]).length, M.MODELS.length + 1);
  assert.equal(M.find("mein-fl-gel", [custom]).name, "Mein Flügel");
});
