// node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const PM = require("../js/multiphonic.js");

const pairs = (fr) => fr.map((f) => [f.numerator, f.denominator]);

test("Saitenfrequenz: c, Oktave 1, A = 442 → 32.85 Hz (Default im Original)", () => {
  assert.equal(PM.stringFrequency(442, 0, 1).toFixed(2), "32.85");
  // a in Oktave 4 ist der Kammerton
  assert.ok(Math.abs(PM.stringFrequency(442, 9, 4) - 442) < 1e-9);
});

test("Fraction-Windowing 11/4 → Knoten 3/11", () => {
  const r = PM.nodeSeries(11, 4);
  assert.equal(r.error, null);
  assert.deepEqual(pairs(r.fractions), [[0, 1], [1, 2], [1, 3], [1, 4], [2, 7], [3, 11]]);
  assert.equal(r.result, 3 / 11);
});

test("Reihenfolge der Eingaben egal", () => {
  assert.deepEqual(pairs(PM.nodeSeries(4, 11).fractions), pairs(PM.nodeSeries(11, 4).fractions));
});

test("5/3 → 2/5, 13/5 → 5/13", () => {
  assert.equal(PM.nodeSeries(5, 3).result, 2 / 5);
  assert.deepEqual(pairs(PM.nodeSeries(13, 5).fractions), [[0, 1], [1, 2], [1, 3], [2, 5], [3, 8], [5, 13]]);
});

test("Gemeinsamer Teiler → Fehlermeldung wie im Original", () => {
  const r = PM.nodeSeries(12, 8);
  assert.equal(r.error, "Greatest common divisor: 4");
  assert.equal(r.result, null);
  assert.deepEqual(r.fractions, []);
});

test("Fehlende Eingabe → leer", () => {
  assert.deepEqual(PM.nodeSeries(undefined, 3), { error: null, result: null, fractions: [] });
});

test("Sonderfall des Originals: 2/1 liefert 1/3", () => {
  assert.equal(PM.nodeSeries(2, 1).result, 1 / 3);
});

test("Ungültige Eingaben", () => {
  assert.ok(PM.nodeSeries(2.5, 3).error);
  assert.ok(PM.nodeSeries(-3, 2).error);
});

test("Notenname und Abweichung", () => {
  const rows = PM.computeString(442, { tone: 0, octave: 1, p1: 11, p2: 4 }).rows;
  const fmt = rows.map((r) => `${r.note.name}${r.note.octave} ${r.note.deviation.toFixed(1)}`);
  assert.deepEqual(fmt, ["C1 0.0", "C2 0.0", "G2 2.0", "C3 0.0", "bB3 -31.2", "#F4 -48.7"]);
  assert.deepEqual(rows.map((r) => r.step72), [0, 0, 42, 0, 58, 33]);
});

test("Synthese: 16 Teiltöne, Lautstärke fällt mit r^k", () => {
  const p = PM.synthPartials(64);
  assert.equal(p.length, 16);
  assert.equal(p[0].gain, 0.5);
  assert.equal(p[1].gain, 0.25); // r = 1/sqrt(64/16) = 1/2
  assert.equal(PM.synthPartials(2000)[15].gain, 0); // 32000 Hz → stumm
});
