// node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../js/vesikkala.js");
const PM = require("../js/multiphonic.js");

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test("Griff genau auf dem Knoten: 1/5 → Teilton 5 mit Genauigkeit 1, Vielfache ebenso", () => {
  near(V.gripAccuracy(0.2, 5).accuracy, 1, 1e-12);
  assert.equal(V.gripAccuracy(0.2, 5).passed, 1);
  near(V.gripAccuracy(0.2, 10).accuracy, 1, 1e-12);
  assert.equal(V.gripAccuracy(0.2, 10).passed, 2);
  // Schwingungsbauch: Teilton 2 bei 1/4 → 0
  near(V.gripAccuracy(0.25, 2).accuracy, 0, 1e-12);
});

test("Vesikkalas Beispiele Kap. 2.3 (Abstand in Zyklen des Teiltons)", () => {
  // 1/5 (20 %) gegen 4/19 (21.05 %): 1.05 % der Saite = 20 % des 19er-Zyklus → acc 0.6
  const g19 = V.gripAccuracy(0.2, 19);
  assert.equal(g19.k, 4);
  near(g19.cycles, 0.2);
  near(g19.accuracy, 0.6);
  // 1/5 gegen 3/16 (18.75 %): 1.25 % der Saite = 20 % des 16er-Zyklus
  near(V.gripAccuracy(0.2, 16).cycles, 0.2);
  // Griff 4/19, Teilton 14 (Knoten 3/14 bei 21.43 %): 0.38 % = 5.32 % des 14er-Zyklus → 0.894
  const g14 = V.gripAccuracy(4 / 19, 14);
  near(g14.cycles, 0.0532);
  near(g14.accuracy, 0.894);
  // Griff 3/14, Teilton 19: Vesikkala 7.22 % des 19er-Zyklus (aus gerundeten 0.38 %),
  // exakt 1/14 = 7.14 % → 0.857, hörbar erst ab tol ≈ 0.15
  const g = V.gripAccuracy(3 / 14, 19);
  near(g.cycles, 0.0714);
  near(g.accuracy, 0.857);
  assert.ok(!V.audible(3 / 14, 19, 0.1));
  assert.ok(V.audible(3 / 14, 19, 0.15));
  // 2/7 (28.57 %) gegen 5/17 (29.41 %) und 5/18 (27.78 %): 0.84 % bzw. 0.79 % der Saite
  near(Math.abs(5 / 17 - 2 / 7) * 100, 0.84, 0.01);
  near(Math.abs(2 / 7 - 5 / 18) * 100, 0.79, 0.01);
  // in Zyklen des 7. Teiltons (14.29 % der Saite): 5.9 % und 5.5 %
  near(V.gripAccuracy(5 / 17, 7).cycles, 0.0588);
  near(V.gripAccuracy(5 / 18, 7).cycles, 0.0556);
  near(V.gripAccuracy(5 / 17, 7).accuracy, 0.882);
  near(V.gripAccuracy(5 / 18, 7).accuracy, 0.889);
});

test("Walters Kette 3/14: tiefe Zwischenbrüche klingen nicht, 5, 9, 14 schon", () => {
  const d = 3 / 14;
  const acc = [1, 2, 3, 4, 5, 9, 14].map((n) => +V.gripAccuracy(d, n).accuracy.toFixed(2));
  assert.deepEqual(acc, [0.57, 0.14, 0.29, 0.71, 0.86, 0.86, 1]);
  assert.deepEqual(
    V.audibleAt(d, 19, 0.15).map((a) => a.partial),
    [14, 5, 9, 19] // 5, 9 und 19 liegen alle 1/14 Zyklus daneben → nach Teilton
  );
  assert.deepEqual(V.audibleAt(d, 19, 0.1).map((a) => a.partial), [14]);
  assert.deepEqual(V.audibleAt(d, 40, 0.1).map((a) => a.partial), [14, 28]);
});

test("Flageolett 1/4: nur Vielfache von 4 bei kleiner Toleranz", () => {
  assert.deepEqual(V.audibleAt(0.25, 20, 0.1).map((a) => a.partial), [4, 8, 12, 16, 20]);
  // Grundton klingt nur bei sehr tiefem Griff
  assert.ok(V.audible(0.04, 1, 0.1));
  assert.ok(!V.audible(0.1, 1, 0.1));
});

test("Sortierung nach Genauigkeit, Schwelle 1 − tol, Default 0.20", () => {
  const list = V.audibleAt(0.3, 20, 0.25);
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].accuracy >= list[i].accuracy - 1e-9);
  assert.equal(list[0].partial, 10);
  list.forEach((a) => assert.ok(a.accuracy >= 0.75));
  assert.equal(V.threshold(), 0.8);
  assert.equal(V.DEFAULT_TOL, 0.2);
  assert.equal(V.TOL_MAX, 0.3);
});

test("Default 0.20: Vesikkalas Katalogeinträge (obere drei der Kette) klingen ab Teilton 10", () => {
  // Genauigkeit der beiden Eltern-Teiltöne eines Knotens k/n ist 1 − 2/n
  near(V.gripAccuracy(3 / 11, 4).accuracy, 1 - 2 / 11, 1e-12);
  near(V.gripAccuracy(3 / 11, 7).accuracy, 1 - 2 / 11, 1e-12);
  assert.deepEqual(V.audibleAt(3 / 11, 11).map((a) => a.partial), [11, 4, 7]); // Anhang 3: 11 7 4
  assert.deepEqual(V.audibleAt(4 / 13, 13).map((a) => a.partial), [13, 3, 10]); // 13 10 3
  assert.deepEqual(V.audibleAt(2 / 9, 9).map((a) => a.partial), [9]); // 9 5 4 erst ab tol 0.23
  assert.deepEqual(V.audibleAt(2 / 7, 7, 0.3).map((a) => a.partial), [7, 3, 4]);
});

test("Lautstärkefaktor: 0 unter der Schwelle, 0.5 an der Schwelle, 1 auf dem Knoten", () => {
  assert.equal(V.weight(0.8, 0.1), 0);
  near(V.weight(0.9, 0.1), 0.5, 1e-12);
  near(V.weight(0.95, 0.1), 0.75, 1e-12);
  near(V.weight(1, 0.1), 1, 1e-12);
});

test("Nächster Katalogknoten, gespiegelt für d > 1/2", () => {
  assert.equal(V.nearestNode(0.2, 19).n, 5);
  const e = V.nearestNode(0.21, 19);
  assert.equal(e.k + "/" + e.n, "4/19");
  assert.equal(V.nearestNode(0.785, 19).n, 14); // 1 − 0.785 = 0.215 ≈ 3/14
  assert.equal(V.nearestNode(0.5, 19).n, 2);
  assert.equal(V.nearestNode(0, 19).n, 19); // 1/19 ist der tiefste Katalogknoten
});

test("Beispiel mit Noten: 3/14 auf c1, hörbare Teiltöne wie im Katalog", () => {
  const r = PM.computeString(442, { tone: 0, octave: 1, p1: 14, p2: 5 });
  const audible = r.rows.filter((row) => V.audible(r.result, row.partial, 0.15)).map((row) => row.partial);
  assert.deepEqual(audible, [5, 9, 14]);
});
