/*
 * Export des resultierenden Multiphonics als Text zum Kopieren.
 *
 * Formate (alle bezogen auf den eingestellten Kammerton):
 *   midicents  MIDI · 100, C4 = 6000, A4 = 6900   = Cent über C0 + 1200
 *   cents      Cent über C0 (C0 = A / 2^4.75, wie im Original)
 *   hz         Frequenz in Hz
 * Werte mit Leerzeichen getrennt, aufsteigend wie in der Tabelle, auf 2 Nachkommastellen
 * (Nullen am Ende weggelassen).
 *   playing    Spielangabe nach Vesikkala (Erweiterung, js/vesikkala.js): eine Zeile
 *              "M · C♯1 · 27.3 % (72.7 %) · [1 2 3 4 7 11]" mit allen Teiltönen; braucht
 *              dazu die Saite (tone, octave) und den Berührungspunkt (result).
 */
(function (root) {
  "use strict";

  var V = root.PMVesikkala || (typeof require !== "undefined" ? require("./vesikkala.js") : null);

  var FORMATS = {
    midicents: { label: "Midicents (C4 = 6000)", fn: function (row) { return row.cents + 1200; } },
    cents: { label: "Cents above C0", fn: function (row) { return row.cents; } },
    hz: { label: "Hz", fn: function (row) { return row.freq; } },
    playing: { label: "Playing indication (Vesikkala)", line: true },
  };

  /*
   * Spielangabe einer Spalte: r = PM.computeString(...) mit result und rows,
   * str = { tone, octave }. Leer, wenn es keinen Berührungspunkt gibt.
   */
  function playingText(r, str) {
    if (!r || r.result == null || !r.rows.length) return "";
    return V.line(
      str.tone,
      str.octave,
      r.result,
      r.rows.map(function (row) {
        return row.partial;
      })
    );
  }

  // Zahlformat; die Spielangabe (line) hat keins, dann Midicents.
  function numberFn(format) {
    var fmt = FORMATS[format];
    return fmt && fmt.fn ? fmt.fn : FORMATS.midicents.fn;
  }

  function num(v) {
    return String(Math.round(v * 100) / 100);
  }

  // rows: Zeilen aus PM.computeString(...).rows
  function rowsText(rows, format) {
    var f = numberFn(format);
    return rows
      .map(function (r) {
        return num(f(r));
      })
      .join(" ");
  }

  // Beide Spalten zusammen: aufsteigend, doppelte Werte nur einmal
  function combinedText(rowLists, format) {
    var f = numberFn(format);
    var vals = [];
    rowLists.forEach(function (rows) {
      rows.forEach(function (r) {
        vals.push(f(r));
      });
    });
    vals.sort(function (a, b) {
      return a - b;
    });
    var out = [];
    vals.forEach(function (v) {
      var t = num(v);
      if (out[out.length - 1] !== t) out.push(t);
    });
    return out.join(" ");
  }

  /*
   * MusicXML (Erweiterung): ein Takt je Saite, ganze Noten als Akkord (Violin- und
   * Bassschlüssel), darüber die Saite als Text. Tonhöhe wie in der Notation der App
   * (nächster Halbton + Pfeile, 72er-Stufe); <alter> trägt die genaue Abweichung in Halbtönen
   * (2 Nachkommastellen), das Vorzeichen die Pfeile (Helmholtz-Ellis, SMuFL-Namen).
   * strings = [{ label, rows: [{ cents }] }]
   */
  var STEPS = ["C", "D", "E", "F", "G", "A", "B"];
  var STEP_CENTS = [0, 200, 400, 500, 700, 900, 1100];
  var ARROW_WORDS = ["", "One", "Two", "Three"];

  function notation() {
    return root.PMNotation || (typeof require !== "undefined" ? require("./notation.js") : null);
  }

  function xmlEsc(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function accidentalXML(sp) {
    var acc = sp.accidental || (sp.arrows ? "natural" : "");
    if (!acc) return "";
    var n = Math.abs(sp.arrows);
    if (!n) return "<accidental>" + acc + "</accidental>";
    var dir = sp.arrows > 0 ? "up" : "down";
    if (n === 1) return "<accidental>" + acc + "-" + dir + "</accidental>";
    var smufl = "accidental" + acc.charAt(0).toUpperCase() + acc.slice(1) + ARROW_WORDS[n] + "Arrows" + (dir === "up" ? "Up" : "Down");
    return '<accidental smufl="' + smufl + '">other</accidental>';
  }

  function pitchOf(cents) {
    var sp = notation().spell(cents);
    var step = ((sp.diatonic % 7) + 7) % 7;
    var octave = Math.floor(sp.diatonic / 7);
    var alter = Math.round((cents - (octave * 1200 + STEP_CENTS[step])) / 100 * 100) / 100;
    return { sp: sp, step: STEPS[step], octave: octave, alter: alter, staff: sp.diatonic >= 28 ? 1 : 2 };
  }

  function noteXML(p, chord, voice) {
    return (
      "<note>" + (chord ? "<chord/>" : "") +
      "<pitch><step>" + p.step + "</step>" + (p.alter ? "<alter>" + p.alter + "</alter>" : "") + "<octave>" + p.octave + "</octave></pitch>" +
      "<duration>4</duration><voice>" + voice + "</voice><type>whole</type>" + accidentalXML(p.sp) + "<staff>" + p.staff + "</staff></note>"
    );
  }

  function restXML(staff, voice) {
    return "<note><rest/><duration>4</duration><voice>" + voice + "</voice><type>whole</type><staff>" + staff + "</staff></note>";
  }

  function musicXML(strings, title) {
    var measures = strings
      .map(function (str, i) {
        var seen = {};
        var ps = str.rows
          .map(function (r) {
            return pitchOf(r.cents);
          })
          .filter(function (p) {
            var k = p.step + p.octave + ":" + p.alter;
            if (seen[k]) return false;
            seen[k] = true;
            return true;
          })
          .sort(function (a, b) {
            return a.octave * 1200 + STEP_CENTS[STEPS.indexOf(a.step)] + a.alter * 100 - (b.octave * 1200 + STEP_CENTS[STEPS.indexOf(b.step)] + b.alter * 100);
          });
        function staffNotes(staff, voice) {
          var list = ps.filter(function (p) {
            return p.staff === staff;
          });
          if (!list.length) return restXML(staff, voice);
          return list
            .map(function (p, j) {
              return noteXML(p, j > 0, voice);
            })
            .join("");
        }
        return (
          '<measure number="' + (i + 1) + '">' +
          (i === 0
            ? "<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time print-object=\"no\"><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves>" +
              '<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>'
            : "") +
          '<direction placement="above"><direction-type><words>' + xmlEsc(str.label) + "</words></direction-type><staff>1</staff></direction>" +
          staffNotes(1, 1) + "<backup><duration>4</duration></backup>" + staffNotes(2, 5) +
          (i === strings.length - 1 ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : "") +
          "</measure>"
        );
      })
      .join("\n");
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
      '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' +
      '<score-partwise version="4.0"><work><work-title>' + xmlEsc(title || "Piano multiphonics") + "</work-title></work>" +
      '<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>\n<part id="P1">\n' + measures + "\n</part></score-partwise>\n"
    );
  }

  var API = { FORMATS: FORMATS, rowsText: rowsText, combinedText: combinedText, playingText: playingText, musicXML: musicXML, pitchOf: pitchOf };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.PMExport = API;
})(this);
