// node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const PM = require("../js/multiphonic.js");
const N = require("../js/notation.js");
const S = require("../js/stringview.js");

const C4 = 4800; // Cent über C0

test("Schreibweise folgt dem 72er-Raster des Originals", () => {
  // Pfeile = 72er-Stufe minus 6 · Halbton (Halbton wie Spalte "Note")
  for (let c = -600; c < 12000; c += 7.3) {
    const sp = N.spell(c);
    const info = PM.noteInfo(c);
    let off = (((PM.step72(c) - 6 * info.semitone) % 72) + 72) % 72;
    if (off > 36) off -= 72;
    assert.equal(sp.arrows, off);
    assert.ok(Math.abs(sp.arrows) <= 3, "höchstens drei Pfeile bei " + c);
    assert.equal(sp.name, info.name);
    assert.equal(sp.deviation, info.deviation);
  }
});

test("Schlüssel und Oktavierung", () => {
  assert.equal(N.spell(C4).clef, "treble");
  assert.equal(N.spell(C4 - 100).clef, "bass");
  assert.equal(N.spell(C4 + 3600).ottava, 1); // C7
  assert.equal(N.spell(1200).ottava, -1); // C1
  assert.equal(N.spell(0).ottava, -2); // C0
});

test("Vorzeichen: es/as/b als Be, cis/fis als Kreuz", () => {
  assert.equal(N.spell(C4 + 300).accidental, "flat");
  assert.equal(N.spell(C4 + 600).accidental, "sharp");
  assert.equal(N.spell(C4 + 400).accidental, "");
});

test("SVGs entstehen ohne Fehler", () => {
  const r = PM.computeString(442, { tone: 0, octave: 1, p1: 11, p2: 4 });
  r.rows.forEach((row) => assert.match(N.noteSVG(row.cents, "red"), /^<svg/));
  const spec = N.spectrumSVG(r.rows.map((row) => ({ cents: row.cents, label: String(row.partial) })));
  assert.equal((spec.match(/<g><title>/g) || []).length, r.rows.length);
  const sv = S.stringSVG(20, [{ color: "red", result: r.result, fractions: r.fractions }]);
  assert.match(sv, /3\/11 = 0\.2727/);
});

test("Akkord: eigenes Doppelsystem, gleiche Tonhöhe einmal", () => {
  const C4 = 4800;
  const notes = [C4, C4 + 400, C4 + 700, C4 + 702, C4 + 1000, C4 - 1300].map((cents) => ({ cents }));
  const svg = N.chordSVG(notes, "Audible");
  assert.match(svg, /^<svg[^>]*class="notation chord"/);
  assert.equal((svg.match(/class="cnote"/g) || []).length, 5);
  assert.match(svg, />Audible</);
  assert.equal(N.chordSVG([], "Audible"), "");
  // Oktaven sind verschiedene Töne
  assert.equal((N.chordSVG([1200, 2400, 3600].map((cents) => ({ cents }))).match(/class="cnote"/g) || []).length, 3);
});

test("Akkord: Sekunde versetzt, Vorzeichen überdecken sich nicht", () => {
  // C♯4, D4 + 1/4 Ton, E♭4: enge Lage mit drei Vorzeichen
  const svg = N.chordSVG([4900, 5050, 5100].map((cents) => ({ cents })));
  const xs = [...svg.matchAll(/translate\(([\d.]+),([\d.]+)\)/g)].map((m) => +m[1]);
  // Notenköpfe (Pfade nach dem Schlüssel) stehen nicht alle an derselben x-Position
  assert.ok(new Set(xs).size > 4);
});

test("Knotenliste: alle gekürzten k/n ≤ 1/2", () => {
  const nodes = S.nodes(20);
  assert.ok(nodes.every((n) => n.pos <= 0.5 && PM.gcd(n.k, n.n) === 1));
  // 0/1 + Summe der teilerfremden k ≤ n/2 für n = 2..20
  let count = 1;
  for (let n = 2; n <= 20; n++) for (let k = 1; 2 * k <= n; k++) if (PM.gcd(k, n) === 1) count++;
  assert.equal(nodes.length, count);
});

test("Jede Tonhöhe hat ein Vorzeichen-Zeichen aus Bravura", () => {
  const G = require("../js/glyphs.js");
  for (let c = -600; c < 12000; c += 3.1) {
    const name = N.accidentalGlyph(N.spell(c));
    if (name) assert.ok(G[name], "fehlt: " + name + " bei " + c);
  }
  assert.equal(N.accidentalGlyph(N.spell(C4 + 600 - 16.7)), "sharp_down1");
  assert.equal(N.accidentalGlyph(N.spell(C4 + 50)), "sharp_down3");
  assert.equal(N.accidentalGlyph(N.spell(C4 + 33.3)), "natural_up2");
});

test("Saitengrafik: aktive Saite kräftig, andere blass, bis 10 Saiten", () => {
  const marks = [];
  [11, 13, 17, 19, 23, 29, 31, 37, 41, 43].forEach((p1, i) => {
    const r = PM.computeString(442, { tone: 0, octave: 1, p1, p2: 4 });
    marks.push({ color: "c" + i, result: r.result, fractions: r.fractions, active: i === 2 });
  });
  const sv = S.stringSVG(20, marks);
  // nur die aktive Beschriftung in 14 px fett, die anderen klein
  assert.equal((sv.match(/font-size="14" font-weight="700"/g) || []).length, 1);
  assert.equal((sv.match(/font-size="11" font-weight="600"/g) || []).length, 9);
  // die Beschriftung steht oben am Strich (Oberkante bei y = 30), rechts an der Spitze
  const ys = [...sv.matchAll(/<text x="[\d.]+" y="([\d.]+)" font-size="1[14]"/g)].map((m) => +m[1]);
  assert.equal(ys.length, 10);
  assert.ok(Math.min(...ys) < 50);
});

test("Saitengrafik: Multiphonics als Kreise auf der Saite, Zahlen als Knöpfe", () => {
  const sv = S.stringSVG(20, [], { multiphonics: [{ k: 3, n: 11 }, { k: 5, n: 19 }] });
  assert.equal((sv.match(/class="multibtn"/g) || []).length, 2);
  assert.match(sv, /class="nodebtn" data-k="1" data-n="10"/);
});

test("Saitengrafik als eigenständige SVG-Datei", () => {
  const live = S.stringSVG(30, [{ color: "var(--sc0)", result: 0.25, fractions: [{ numerator: 1, denominator: 4 }], active: true }], {
    pointer: 0.3,
    multiphonics: [{ k: 1, n: 5 }],
  });
  const svg = S.standaloneSVG(live);
  assert.ok(svg.startsWith("<?xml"));
  assert.match(svg, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg" version="1.1" width="1000" height="300" viewBox="0 0 1000 300"/);
  assert.doesNotMatch(svg, /var\(|currentColor|cursor/);
  assert.match(svg, /#c8322b/);
  // Trefferflächen weg, sichtbare Knöpfe bleiben
  assert.doesNotMatch(svg, /class="(nodebtn|multibtn)"[^>]*><title>[^<]*<\/title><rect/);
  assert.match(svg, /<circle fill="#ffffff" cx=/);
  assert.equal((svg.match(/class="nodebtn"/g) || []).length, (live.match(/class="nodebtn"/g) || []).length);
});
