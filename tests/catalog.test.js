// node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const PM = require("../js/multiphonic.js");
const C = require("../js/catalog.js");

const find = (list, k, n) => list.find((e) => e.k === k && e.n === n);

test("Vesikkalas Katalog: 60 Multiphonics bis Teilton 19", () => {
  const c = C.catalog(19);
  assert.equal(c.length, 60);
  assert.ok(c.every((e) => PM.gcd(e.k, e.n) === 1 && 2 * e.k <= e.n && e.k >= 1));
  assert.equal(C.DEFAULT_NMAX, 19);
});

test("Teiltongruppen wie bei Vesikkala (obere drei)", () => {
  const c = C.catalog(19);
  assert.deepEqual(find(c, 3, 14).shown, [5, 9, 14]);
  assert.deepEqual(find(c, 2, 19).shown, [9, 10, 19]);
  assert.deepEqual(find(c, 4, 13).partials, [1, 2, 3, 4, 7, 10, 13]);
  assert.equal(C.groupText(find(c, 4, 13).shown), "7_10_13");
  assert.deepEqual(find(c, 1, 2).partials, [1, 2]);
  assert.deepEqual(find(c, 1, 2).fractions, [[0, 1], [1, 2]]);
});

test("Gruppe kommt aus nodeSeries(n, b) und endet mit n", () => {
  C.catalog(40).forEach((e) => {
    assert.ok(e.b != null && e.b < e.n, "kein b für " + e.k + "/" + e.n);
    assert.equal(e.partials[e.partials.length - 1], e.n);
    if (e.n === 2) return;
    const s = PM.nodeSeries(e.n, e.b);
    assert.equal(s.error, null);
    assert.deepEqual(s.fractions.map((f) => f.denominator), e.partials);
    assert.equal(s.result, e.pos);
    // kein kleineres b mit demselben Knoten
    for (let b = 1; b < e.b; b++) {
      if (PM.gcd(e.n, b) !== 1) continue;
      assert.notEqual(PM.nodeSeries(e.n, b).result, e.pos);
    }
  });
});

test("Angezeigte Teiltöne: drei bis vier, ohne die Folge 1, 2, 3, …", () => {
  assert.deepEqual(C.shownPartials([1, 2, 3, 4, 5, 9, 14]), [5, 9, 14]);
  assert.deepEqual(C.shownPartials([1, 2, 3, 4, 7, 11, 15, 19]), [7, 11, 15, 19]);
  assert.deepEqual(C.shownPartials([1, 2, 3, 5, 7, 9, 11, 13, 15]), [9, 11, 13, 15]);
  assert.deepEqual(C.shownPartials([1, 2, 3]), [1, 2, 3]);
  assert.deepEqual(C.shownPartials([1, 2]), [1, 2]);
  C.catalog(40).forEach((e) => assert.ok(e.shown.length >= Math.min(3, e.partials.length) && e.shown.length <= 4));
});

test("Sortierung: Knotenlage (Default), höchster Teilton, höchste Tonhöhe", () => {
  const c = C.catalog(19);
  for (let i = 1; i < c.length; i++) assert.ok(c[i - 1].pos < c[i].pos);
  assert.equal(c[0].k + "/" + c[0].n, "1/19");
  assert.equal(c[c.length - 1].k + "/" + c[c.length - 1].n, "1/2");

  const s = C.forString(442, 0, 1, 19);
  const byPartial = C.sort(s.entries, "partial");
  for (let i = 1; i < byPartial.length; i++) {
    const a = byPartial[i - 1], b = byPartial[i];
    assert.ok(a.n < b.n || (a.n === b.n && a.pos < b.pos));
  }
  assert.equal(byPartial[0].n, 2);
  const byPitch = C.sort(s.entries, "pitch");
  for (let i = 1; i < byPitch.length; i++) assert.ok(byPitch[i - 1].top.cents <= byPitch[i].top.cents);
  assert.equal(C.sort(s.entries, "node")[0].n, 19);
  // Eingabe bleibt unverändert
  assert.equal(s.entries[0].n, 19);
});

test("Zeilen je Saite wie in den Spalten One/Two", () => {
  const s = C.forString(442, 0, 1, 19);
  const e = find(s.entries, 3, 11);
  const ref = PM.computeString(442, { tone: 0, octave: 1, p1: 11, p2: 4 });
  assert.equal(s.freq, ref.freq);
  assert.deepEqual(e.rows, ref.rows);
  assert.equal(e.top.partial, 11);
  assert.equal(PM.noteText(e.top.cents), "#F4 -48.7¢");
  assert.equal(e.percent.toFixed(1), "27.3");
  const half = find(s.entries, 1, 2);
  assert.deepEqual(half.rows.map((r) => [r.node, r.partial]), [[0, 1], [1, 2]]);
});

test("Filter: nur bis Teilton N, Suche nach Teiltonnummern", () => {
  const c = C.catalog(19);
  assert.equal(C.filter(c, { maxPartial: 7 }).length, 9);
  assert.ok(C.filter(c, { maxPartial: 7 }).every((e) => e.n <= 7));
  const with7and10 = C.filter(c, { search: "7, 10" });
  assert.deepEqual(
    with7and10.map((e) => e.k + "/" + e.n),
    ["1/19", "1/18", "1/17", "1/16", "1/15", "1/14", "1/13", "1/12", "1/11", "1/10", "2/19", "5/17", "3/10", "4/13", "5/16", "6/19"]
  );
  assert.equal(C.filter(c, { search: "" }).length, 60);
  assert.deepEqual(C.parseSearch(" 7 x 10 "), [7, 10]);
});
