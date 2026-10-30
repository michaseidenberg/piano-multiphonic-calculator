// node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const PM = require("../js/multiphonic.js");
const E = require("../js/export.js");

const rows = PM.computeString(442, { tone: 0, octave: 1, p1: 11, p2: 4 }).rows;

test("Midicents: C1 = 2400, Cent über C0 + 1200", () => {
  assert.equal(E.rowsText(rows, "midicents"), "2400 3600 4301.96 4800 5768.83 6551.32");
});

test("Cent über C0 und Hz", () => {
  assert.equal(E.rowsText(rows, "cents"), "1200 2400 3101.96 3600 4568.83 5351.32");
  assert.equal(E.rowsText(rows, "hz"), "32.85 65.7 98.56 131.41 229.96 361.37");
});

test("A4 bei Kammerton = 6900 Midicents", () => {
  const r = PM.computeString(442, { tone: 9, octave: 4, p1: 2, p2: 1 }).rows;
  assert.equal(E.rowsText(r.slice(0, 1), "midicents"), "6900");
});

test("Beide Spalten: aufsteigend, ohne Doppelte", () => {
  const two = PM.computeString(442, { tone: 0, octave: 1, p1: 13, p2: 5 }).rows;
  assert.equal(E.combinedText([rows, two], "midicents"), "2400 3600 4301.96 4800 5186.31 5768.83 6000 6551.32 6840.53");
});

test("MusicXML: ein Takt je Saite, Akkord mit Mikrotönen", () => {
  const r = PM.computeString(442, { tone: 0, octave: 1, p1: 11, p2: 4 });
  const xml = E.musicXML([{ label: "C1 · 3/11", rows: r.rows }, { label: "C1 · 5/13", rows: [] }]);
  assert.match(xml, /^<\?xml/);
  assert.equal((xml.match(/<measure /g) || []).length, 2);
  // 11. Teilton von C1 = F♯4 −48.7 ¢ → F, alter 0.51, drei Pfeile nach unten
  assert.match(xml, /<step>F<\/step><alter>0\.51<\/alter><octave>4<\/octave>/);
  assert.match(xml, /smufl="accidentalSharpThreeArrowsDown"/);
  // C1 im Bassschlüssel, leerer Takt mit Pausen
  assert.match(xml, /<step>C<\/step><octave>1<\/octave><\/pitch><duration>4<\/duration><voice>5<\/voice>/);
  assert.equal((xml.match(/<rest\/>/g) || []).length, 2);
  // gültige Verschachtelung: jedes <note> geschlossen
  assert.equal((xml.match(/<note>/g) || []).length, (xml.match(/<\/note>/g) || []).length);
});
