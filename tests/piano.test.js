// node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/piano.js");

test("Anschlag: alle Partialtöne, Summe der Lautstärken 0.8", () => {
  const ps = P.strikePartials(32.85, [1, 2, 3, 4, 7, 11]);
  assert.deepEqual(ps.map((p) => p.partial), [1, 2, 3, 4, 7, 11]);
  assert.ok(Math.abs(ps.reduce((s, p) => s + p.gain, 0) - 0.8) < 1e-12);
  assert.ok(Math.abs(ps[3].freq - 4 * 32.85) < 1e-9); // B = 0 → harmonisch
});

test("Hohe Teiltöne leiser und kürzer", () => {
  const ps = P.strikePartials(55, [1, 5, 13]);
  assert.ok(ps[0].gain > ps[1].gain && ps[1].gain > ps[2].gain);
  assert.ok(ps[0].tau > ps[1].tau && ps[1].tau > ps[2].tau);
});

test("tilt 0 → gleich laut; doppelte Partialtöne nur einmal", () => {
  const ps = P.strikePartials(100, [1, 2, 2, 3], { tilt: 0 });
  assert.equal(ps.length, 3);
  ps.forEach((p) => assert.ok(Math.abs(p.gain - 0.8 / 3) < 1e-12));
});

test("Gewichte (Vesikkala): Faktor vor der Normierung, 0 lässt den Teilton weg", () => {
  const ps = P.strikePartials(100, [1, 2, 3], { tilt: 0, weights: { 1: 0, 2: 0.5, 3: 1 } });
  assert.deepEqual(ps.map((p) => p.partial), [2, 3]);
  assert.ok(Math.abs(ps[0].gain * 2 - ps[1].gain) < 1e-12);
  assert.ok(Math.abs(ps[0].gain + ps[1].gain - 0.8) < 1e-12);
});

test("Inharmonizität streckt nach oben", () => {
  const ps = P.strikePartials(100, [10], { inharmonicity: 0.0004 });
  assert.ok(Math.abs(ps[0].freq - 1000 * Math.sqrt(1.04)) < 1e-9);
});

test("Teiltöne ab 20 kHz fallen weg, Abklingzeit begrenzt", () => {
  assert.equal(P.strikePartials(4000, [1, 6]).length, 1);
  assert.equal(P.tauFor(5, 1), 12);
  assert.equal(P.tauFor(1e6, 1), 0.15);
});
