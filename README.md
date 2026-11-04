# Piano Multiphonic Calculator

A developed version of Caspar Johannes Walter’s
[Piano Multiphonic Calculator](https://www.casparjohanneswalter.de/research/piano_multiphonic_calculator),
integrating Juhani T. Vesikkala’s research on grand piano multiphonics (2016).
Published with kind permission of [Caspar Johannes Walter](https://www.casparjohanneswalter.de).

**Open the app:** <https://michaseidenberg.github.io/piano-multiphonic-calculator/>

The calculation of the touch point from two partials is Walter’s. This version adds the string
graphic, notation, sound and Vesikkala’s catalogue and playing indications.

## Features

- Nodes on the string up to partial N; tap a node for a flageolet, a ○ for a multiphonic
- Up to 10 strings, touch point with sounding partials, percent of the string and grip interval
- Notation with Extended Helmholtz-Ellis arrow accidentals (1/12 tone)
- Sound: held sine partials as in the original, and a piano-like strike
- Catalogue of all nodes of a string with partial groups (Vesikkala 2016, Appendix 3)
- Export: midicents, cents, Hz, playing indications, MusicXML, the string graphic as SVG

## Use

Open `index.html` in a browser (double-click works, no server, no internet needed), or use the
link above. On iPad/iPhone: “Share → Add to Home Screen”. Settings are kept in the browser.

A single self-contained file: `node tools/build.js` → `dist/piano-multiphonics.html`.

Tests: `node --test`

## Documentation

The formulas, the original and the extensions, are described in
[`docs/formeln.md`](docs/formeln.md); string lengths of piano models in
[`docs/modelle.md`](docs/modelle.md) (both in German).

## Sources

- Walter, C. J. (n.d.). *Piano multiphonic calculator* [Web application].
  <https://www.casparjohanneswalter.de/research/piano_multiphonic_calculator>
- Vesikkala, J. T. (2016). *Multiphonics of the grand piano – Timbral composition and performance
  with flageolets*. Sibelius Academy.
- Torres, R., & Ferreira-Lopes, P. (2012). Multiphonics as a compositional element in writing for
  amplified guitar (1). *Emille*, 10, 55–66. Part (2): *Journal of Science and Technology of the
  Arts*, 4(1), 61–69. Node tolerance ±10 %, cited after Vesikkala 2016.

## License

Code: [MIT](LICENSE), © 2026 Micha Seidenberg.
Music symbols: [Bravura](https://github.com/steinbergmedia/bravura), © Steinberg Media Technologies
GmbH, [SIL Open Font License 1.1](https://openfontlicense.org). `js/glyphs.js` contains only the
outlines of the symbols used; regenerate it with `tools/extract_glyphs.py`.
