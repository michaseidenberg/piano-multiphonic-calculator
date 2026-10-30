// node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const N = require("../js/notation.js");
const F = require("../js/svgfile.js");

test("Dateiname: Saite, klingende Teiltöne, Berührungspunkt", () => {
  assert.equal(F.baseName("C1", [4, 7, 11], 3, 11), "C1_4-7-11_at_3-11");
  assert.equal(F.baseName("C♯1", [2, 3], 2, 5), "C#1_2-3_at_2-5");
  assert.equal(F.baseName("B♭0"), "Bb0");
});

test("Notation als Datei: Druckfarben, keine CSS-Variablen", () => {
  const live = N.spectrumSVG([{ cents: 4800, color: "var(--sc0)", label: "1" }, { cents: 6000, color: "var(--muted)", label: "2" }]);
  const svg = F.notationFile(live);
  assert.ok(svg.startsWith("<?xml"));
  assert.match(svg, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg" version="1.1" width="[\d.]+" height="[\d.]+" viewBox="0 0 /);
  assert.doesNotMatch(svg, /var\(|currentColor|class="notation/);
  assert.match(svg, /#c8322b/);
  assert.match(svg, /#5d666c/);
});

test("Katalog als Datei: eine Zeile je Eintrag, Akkord verschachtelt", () => {
  const chord = N.chordSVG([{ cents: 4800 }, { cents: 5502 }], "");
  const svg = F.catalogueFile("Catalogue · C1", [
    { node: "1/3", percent: "33.3 %", partials: "3_6_9", notes: "G1 · G2", chord: chord },
    { node: "1/2", percent: "50.0 %", partials: "2_4", notes: "C2", chord: "" },
  ]);
  assert.equal((svg.match(/<svg /g) || []).length, 2);
  assert.match(svg, />1\/3</);
  assert.match(svg, />Catalogue · C1</);
  assert.doesNotMatch(svg, /var\(|currentColor/);
});

test("ZIP: Prüfsumme und Aufbau", () => {
  assert.equal(F.crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const z = F.zip([{ name: "a.svg", data: "<svg/>" }, { name: "b.svg", data: "äöü" }]);
  const v = new DataView(z.buffer);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  const end = z.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50);
  assert.equal(v.getUint16(end + 10, true), 2);
});
