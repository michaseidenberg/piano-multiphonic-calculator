/*
 * Oberfläche: Eingaben wie im Original (Concert Pitch, String/Octave/Partial 1/Partial 2),
 * aber für 1 bis 10 Saiten (Saitenleiste, eine aktive Saite), Saitengrafik,
 * Ergebnistabellen mit Notation und Play.
 */
(function () {
  "use strict";

  // Farben der Saiten: die ersten zwei wie bisher Rot (--one) und Blau (--two)
  var MAX_STRINGS = 10;
  var COLORS = [];
  for (var ci = 0; ci < MAX_STRINGS; ci++) COLORS.push("var(--sc" + ci + ")");
  var STORE_KEY = "piano-multiphonics:v1";

  var state = {
    concertPitch: 442,
    master: 0.25,
    nMax: 20,
    mechanics: true,
    exportFormat: "midicents",
    model: "generic", // Flügelmodell (Erweiterung, Vesikkala): Saitenlängen für cm-Angaben
    piano: { tilt: 0.5, decay: 1, inharmonicity: 0 },
    // Vesikkala Kap. 2.3: Toleranz der Knotenlage, Filter für Play All/Strike/Export, Zeiger
    tolerance: 0.2,
    filter: true,
    pointer: null,
    pointerString: "active",
    // Katalog (Erweiterung, Vesikkala): source "own" = eigene Saite, "active" = wie die aktive
    catalog: { nMax: 19, source: "own", tone: 0, octave: 1, sort: "node", maxPartial: "", search: "" },
    strings: [
      { tone: 0, octave: 1, p1: 11, p2: 4 },
      { tone: 0, octave: 1, p1: 13, p2: 5 },
    ],
    active: 0, // Index der aktiven Saite (Eingaben, Tabelle, Touch point)
  };

  // Eigene Flügelmodelle (localStorage, eigener Schlüssel; s. js/models.js)
  var customModels = [];

  function load() {
    customModels = PMModels.loadCustom();
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && Array.isArray(s.strings) && s.strings.length >= 1) {
          s.strings = s.strings.slice(0, MAX_STRINGS);
          s.piano = Object.assign({}, state.piano, s.piano || {});
          s.catalog = Object.assign({}, state.catalog, s.catalog || {});
          // alter Stand (zwei Spalten One/Two): Katalog und Zeiger „wie One/Two“ → aktive Saite
          if (s.catalog.source === "0" || s.catalog.source === "1") s.catalog.source = "active";
          if (s.pointerString === "0" || s.pointerString === "1") s.pointerString = "active";
          state = Object.assign(state, s);
        }
      }
    } catch (e) {}
    if (!(state.active >= 0 && state.active < state.strings.length)) state.active = 0;
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function $(id) {
    return document.getElementById(id);
  }

  function parseNum(v) {
    v = String(v).trim();
    if (v === "") return null;
    var n = Number(v);
    return isFinite(n) ? n : NaN;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // --- Eingaben -----------------------------------------------------------

  function initInputs() {
    $("concert").value = state.concertPitch;
    $("master").value = state.master;
    $("nmax").value = state.nMax;
    $("mech").checked = state.mechanics;
    $("mech").addEventListener("change", function (e) {
      state.mechanics = e.target.checked;
      update();
    });
    var fmtSel = $("expFormat");
    fmtSel.innerHTML = Object.keys(PMExport.FORMATS)
      .map(function (k) {
        return '<option value="' + k + '">' + PMExport.FORMATS[k].label + "</option>";
      })
      .join("");
    if (!PMExport.FORMATS[state.exportFormat]) state.exportFormat = "midicents";
    fmtSel.value = state.exportFormat;
    fmtSel.addEventListener("change", function (e) {
      state.exportFormat = e.target.value;
      update();
    });
    PMAudio.onState(audioStateLabel);
    audioStateLabel(PMAudio.state());
    $("decay").value = state.piano.decay;
    $("tilt").value = state.piano.tilt;
    $("inharm").value = state.piano.inharmonicity;
    ["decay", "tilt", "inharm"].forEach(function (id) {
      $(id).addEventListener("input", function (e) {
        var key = { decay: "decay", tilt: "tilt", inharm: "inharmonicity" }[id];
        state.piano[key] = parseFloat(e.target.value);
        pianoLabels();
        save();
      });
    });
    pianoLabels();
    PMAudio.setMaster(state.master);
    $("tone").innerHTML = PM.STRING_NAMES.map(function (n, t) {
      return '<option value="' + t + '">' + n + "</option>";
    }).join("");
    fillStringInputs();

    $("concert").addEventListener("input", function (e) {
      var v = parseNum(e.target.value);
      e.target.classList.toggle("bad", !(v > 0));
      if (v > 0) {
        state.concertPitch = v;
        PMAudio.stopAll();
        update();
      }
    });
    $("master").addEventListener("input", function (e) {
      state.master = parseFloat(e.target.value);
      PMAudio.setMaster(state.master);
      $("masterOut").textContent = Math.round((state.master / 0.25) * 100) + "%";
      save();
    });
    $("nmax").addEventListener("input", function (e) {
      state.nMax = parseInt(e.target.value, 10);
      update();
    });
    $("tol").value = state.tolerance;
    $("tol").addEventListener("input", function (e) {
      state.tolerance = parseFloat(e.target.value);
      update();
    });
    $("filter").checked = state.filter;
    $("filter").addEventListener("change", function (e) {
      state.filter = e.target.checked;
      update();
    });
    // Auswahl der Saite des freien Zeigers steht in der aufklappbaren Liste (neu gezeichnet)
    $("pointer").addEventListener("change", function (e) {
      if (e.target.id !== "ptString") return;
      state.pointerString = e.target.value;
      renderPointer();
      save();
    });
    $("pointer").addEventListener("toggle", function (e) {
      if (e.target.id === "ptDetails") ptDetailsOpen = e.target.open;
    }, true);
    initPointerDrag();
    // Eingaben gelten für die aktive Saite
    function changed() {
      PMAudio.stopAll(state.active + ":");
      update();
    }
    $("tone").addEventListener("change", function (e) {
      state.strings[state.active].tone = parseInt(e.target.value, 10);
      changed();
    });
    $("oct").addEventListener("input", function (e) {
      var v = parseInt(e.target.value, 10);
      if (isFinite(v)) {
        state.strings[state.active].octave = v;
        changed();
      }
    });
    ["p1", "p2"].forEach(function (k) {
      $(k).addEventListener("input", function (e) {
        var v = parseNum(e.target.value);
        e.target.classList.toggle("bad", v !== null && !(v > 0 && Math.floor(v) === v));
        state.strings[state.active][k] = v;
        changed();
      });
    });
    $("removeString").addEventListener("click", function () {
      removeString(state.active);
    });

    initCatalogInputs();
    initModelInputs();
    document.addEventListener("click", onClick);
  }

  // --- Saiten (bis zu 10, eine aktive) ------------------------------------

  function fillStringInputs() {
    var s = state.strings[state.active];
    $("tone").value = s.tone;
    $("oct").value = s.octave;
    $("p1").value = s.p1 == null ? "" : s.p1;
    $("p2").value = s.p2 == null ? "" : s.p2;
    ["p1", "p2"].forEach(function (k) {
      $(k).classList.toggle("bad", s[k] != null && !(s[k] > 0 && Math.floor(s[k]) === s[k]));
    });
  }

  function setActive(i) {
    if (i === state.active || !state.strings[i]) return;
    state.active = i;
    fillStringInputs();
    update();
  }

  // Neue Saite übernimmt die Werte der aktiven
  function addString() {
    if (state.strings.length >= MAX_STRINGS) return;
    state.strings.push(Object.assign({}, state.strings[state.active]));
    state.active = state.strings.length - 1;
    fillStringInputs();
    update();
  }

  // Saite entfernen; Töne der folgenden Saiten laufen unter ihrem Index, darum alle anhalten
  function removeString(i) {
    if (state.strings.length <= 1) return;
    PMAudio.stopAll();
    state.strings.splice(i, 1);
    if (state.active >= state.strings.length) state.active = state.strings.length - 1;
    else if (state.active > i) state.active--;
    fillStringInputs();
    update();
  }

  // Kurzname einer Saite: „C1 · 3/11“
  function stringLabel(i) {
    var s = state.strings[i];
    var r = results[i];
    var name = PMVesikkala.fundamentName(s.tone, s.octave);
    if (!r || r.result == null) return name + " · –";
    var last = r.fractions[r.fractions.length - 1];
    return name + " · " + last.numerator + "/" + last.denominator;
  }

  function renderChips() {
    var html = state.strings
      .map(function (s, i) {
        return (
          '<button type="button" class="chip' + (i === state.active ? " active" : "") + '" style="--c:' + COLORS[i] + '" data-chip="' + i + '"' +
          ' aria-pressed="' + (i === state.active) + '">' + esc(stringLabel(i)) + "</button>"
        );
      })
      .join("");
    html += '<button type="button" class="chip add" data-addstring="1"' + (state.strings.length >= MAX_STRINGS ? " disabled" : "") + ">+ String</button>";
    $("chips").innerHTML = html;
    $("removeString").disabled = state.strings.length <= 1;
  }

  // --- Flügelmodelle (Erweiterung, Vesikkala 2016) -------------------------

  var editingModel = null; // id des Modells im Formular, null = neues Modell

  function currentModel() {
    return PMModels.find(state.model, customModels);
  }

  function fillModelSelect() {
    var sel = $("model");
    sel.innerHTML = PMModels.all(customModels)
      .map(function (m) {
        return '<option value="' + esc(m.id) + '">' + esc(m.name) + "</option>";
      })
      .join("");
    if (!PMModels.all(customModels).some(function (m) { return m.id === state.model; })) state.model = "generic";
    sel.value = state.model;
    var m = currentModel();
    var n = Object.keys(m.strings).length;
    $("modelInfo").textContent = n
      ? n + " string length" + (n === 1 ? "" : "s") + ": " + PMModels.lengthsText(m.strings).replace(/\n/g, ", ") + " cm" + (m.source ? " (" + m.source + ")" : "")
      : "No string lengths" + (m.source ? " (" + m.source + ")" : "") + ". Add a model with measured lengths for cm.";
    $("modelEdit").hidden = !m.custom;
    $("modelDelete").hidden = !m.custom;
  }

  function showModelForm(m) {
    editingModel = m ? m.id : null;
    $("modelName").value = m ? m.name : "";
    $("modelStrings").value = m ? PMModels.lengthsText(m.strings) : "";
    $("modelErr").textContent = "";
    $("modelJson").value = PMModels.toJSON(customModels);
    $("modelForm").hidden = false;
    $("modelName").focus();
  }

  function hideModelForm() {
    $("modelForm").hidden = true;
    editingModel = null;
  }

  function initModelInputs() {
    fillModelSelect();
    $("model").addEventListener("change", function (e) {
      state.model = e.target.value;
      fillModelSelect();
      update();
    });
    $("modelAdd").addEventListener("click", function () {
      showModelForm(null);
    });
    $("modelEdit").addEventListener("click", function () {
      var m = currentModel();
      if (m.custom) showModelForm(m);
    });
    $("modelDelete").addEventListener("click", function () {
      var m = currentModel();
      if (!m.custom || !confirm('Delete model "' + m.name + '"?')) return;
      customModels = customModels.filter(function (c) {
        return c.id !== m.id;
      });
      PMModels.saveCustom(customModels);
      state.model = "generic";
      hideModelForm();
      fillModelSelect();
      update();
    });
    $("modelCancel").addEventListener("click", hideModelForm);
    $("modelForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("modelName").value.trim();
      if (!name) {
        $("modelErr").textContent = "Name missing.";
        return;
      }
      var parsed = PMModels.parseLengths($("modelStrings").value);
      if (parsed.errors.length) {
        $("modelErr").textContent = "Not understood: " + parsed.errors.join(" · ") + " (write e.g. A0 141)";
        return;
      }
      var taken = PMModels.all(customModels)
        .map(function (m) {
          return m.id;
        })
        .filter(function (id) {
          return id !== editingModel;
        });
      var model = PMModels.normalize({ id: editingModel, name: name, strings: parsed.strings, source: "own measurement" }, taken);
      customModels = customModels.filter(function (c) {
        return c.id !== editingModel;
      });
      customModels.push(model);
      PMModels.saveCustom(customModels);
      state.model = model.id;
      hideModelForm();
      fillModelSelect();
      update();
    });
    $("modelPaste").addEventListener("click", function () {
      var text = prompt("Paste model JSON (one model or a list):");
      if (!text) return;
      try {
        var taken = PMModels.all(customModels).map(function (m) {
          return m.id;
        });
        var list = PMModels.fromJSON(text, taken);
        if (!list.length) throw new Error("no model found");
        customModels = customModels.concat(list);
        PMModels.saveCustom(customModels);
        state.model = list[0].id;
        hideModelForm();
        fillModelSelect();
        update();
      } catch (err) {
        $("modelErr").textContent = "JSON not readable: " + err.message;
      }
    });
  }

  /*
   * Touch point der aktiven Saite: Saite (Name, Hz), Fingerposition (Prozent, Spiegelpunkt),
   * klingende Teiltöne mit Spielangabe nach Vesikkala (Kap. 5.4), aufklappbar Griffintervall
   * und Abstand in cm (wenn das Modell die Saitenlänge kennt), darunter das Doppelsystem
   * aller Partialtöne und der Akkord der klingenden, dann Play All · Strike · Strike all.
   */
  function renderTouch() {
    var i = state.active;
    var r = results[i];
    var str = state.strings[i];
    var name = PMVesikkala.fundamentName(str.tone, str.octave);
    var head =
      '<div class="tpstring"><span style="color:' + COLORS[i] + '">●</span> String <b>' + esc(name) + "</b> · " + r.freq.toFixed(2) + " Hz</div>";
    if (r.result == null || !r.rows.length) {
      $("touchpoint").innerHTML = head + '<p class="empty">' + esc(r.error || "Enter two partials without a common divisor.") + "</p>";
      strikeBothLabel();
      testLabels(false, false, false);
      return;
    }
    var last = r.fractions[r.fractions.length - 1];
    var model = currentModel();
    var len = PMModels.lengthFor(model, str.tone, str.octave);
    var v = PMVesikkala.info(r.result, r.rows[0].cents, len);
    // klingende Teiltöne (Häkchen „Audible only“), sonst alle; Kurzform wie im Katalog
    var partials = r.audibleRows.map(function (row) {
      return row.partial;
    });
    var line = PMVesikkala.line(str.tone, str.octave, r.result, PMCatalog.shownPartials(partials));
    function cm(x) {
      return x == null ? '<span class="approx">–</span>' : x.toFixed(1) + " cm";
    }
    function gr(x) {
      return x == null ? "" : ' <span class="approx">≈ ' + Math.round(x) + " grooves</span>";
    }
    var lenText = len
      ? "String length " + len + " cm (" + esc(model.name) + ")."
      : "No string length for " + esc(name) + " in “" + esc(model.name) + "” – choose or add a grand piano model under Settings.";
    var grip =
      '<details class="grip"><summary>Grip interval and distance</summary>' +
      "<table><tr><th></th><th>from the front</th><th>mirror point</th></tr>" +
      "<tr><th>Position</th><td>" + v.percent.toFixed(1) + " %</td><td>" + v.mirrorPercent.toFixed(1) + " %</td></tr>" +
      "<tr><th>Grip interval</th><td>" + esc(v.grip.text) + "</td><td>" + esc(v.gripMirror.text) + "</td></tr>" +
      "<tr><th>Distance from agraffe</th><td>" + cm(v.cm) + gr(v.grooves) + "</td><td>" + cm(v.cmMirror) + gr(v.groovesMirror) + "</td></tr>" +
      "</table><p class=\"hint\">" + lenText + " Grip interval = pitch of the stopped string (Vesikkala shows it in Appendix 3 but advises against it). Grooves ≈ 6.5 per cm, only a rough guide.</p></details>";

    var spectrum = spectrumFor(i);
    // klingende Teiltöne als Akkord: rechts daneben oder, wenn der Platz fehlt, darunter
    var chord = chordFor(i);
    var allOn = allPlaying(i, r);
    var struck = PMAudio.isPlaying(strikeKey(i));
    $("touchpoint").innerHTML =
      head +
      '<div class="tpline">Finger at <b>' + last.numerator + "/" + last.denominator + "</b> = " + v.percent.toFixed(1) + " % of the string (" + v.mirrorPercent.toFixed(1) + " % from the other end)</div>" +
      '<div class="tpline">' + (state.filter ? "Sounding partials" : "Partials (Audible only is off)") + ": <b>" + (partials.join(" ") || "–") + "</b> · " +
      '<span class="vline" title="' + esc(PMVesikkala.line(str.tone, str.octave, r.result, partials)) + '">' + esc(line) + "</span></div>" +
      grip +
      '<div class="specwrap"><div class="specscroll">' + spectrum + "</div>" + chord + "</div>" +
      '<div class="dlrow"><button type="button" class="dl" data-dl="partials" title="Download the partials as SVG">⤓ Partials</button>' +
      (chord ? '<button type="button" class="dl" data-dl="audible" title="Download the chord as SVG">⤓ ' + chordLabel() + "</button>" : "") + "</div>" +
      '<div class="tpbtns">' +
      '<button type="button" class="play all' + (allOn ? " on" : "") + '" data-all="' + i + '"' + (r.audibleRows.length ? "" : " disabled") + ">" + (allOn ? "Stop All" : "Play All") + "</button>" +
      '<button type="button" class="play strike' + (struck ? " on" : "") + '" data-strike="' + i + '"' + (r.audibleRows.length ? "" : " disabled") + ">" + (struck ? "Stop" : "Strike") + "</button>" +
      '<button type="button" id="strikeBoth" class="play strike">Strike all strings</button>' +
      "</div>";
    strikeBothLabel();
    testLabels(allOn, struck, r.audibleRows.length > 0);
  }

  // Doppelsystem aller Partialtöne der Saite i: klingende in ihrer Farbe, die anderen grau
  function spectrumFor(i) {
    return PMNotation.spectrumSVG(
      results[i].rows.map(function (row) {
        return { cents: row.cents, color: row.audible ? COLORS[i] : "var(--muted)", label: String(row.partial) };
      })
    );
  }

  function chordLabel() {
    return state.filter ? "Audible" : "Chord";
  }

  // die klingenden Teiltöne der Saite i als Akkord ("" ohne Töne)
  function chordFor(i) {
    return PMNotation.chordSVG(
      results[i].audibleRows.map(function (row) {
        return { cents: row.cents, color: COLORS[i] };
      }),
      chordLabel()
    );
  }

  // Testknöpfe in den Settings: gehaltener Klang (wie Play All) und Anschlag der aktiven Saite
  function testLabels(allOn, struck, any) {
    var h = $("testHold");
    h.textContent = allOn ? "Stop" : "Test";
    h.classList.toggle("on", allOn);
    h.disabled = !any;
    var t = $("testStrike");
    t.textContent = struck ? "Stop" : "Test strike";
    t.classList.toggle("on", struck);
    t.disabled = !any;
  }

  // --- Knoten in der Saitengrafik antippen (Strike) ------------------------

  /*
   * Zwei Arten, an einem Knoten anzuschlagen (Saitengrafik):
   * - Zahl k/n antippen = Flageolett: Teilton n und seine Vielfachen bis „Nodes up to partial“
   *   (alle haben bei k/n genau einen Knoten), gleich gewichtet.
   * - Kreis ○ auf der Saitenlinie antippen = Multiphonic des Katalogknotens: Teiltongruppe
   *   (PMCatalog.group) wie Strike im Katalog, mit „Audible only“ nur die dort klingenden,
   *   gewichtet nach Genauigkeit.
   */
  function flageoletList(k, n) {
    var out = [];
    for (var m = n; m <= Math.max(n, state.nMax); m += n) out.push({ partial: m, weight: 1 });
    return out;
  }

  function multiphonicList(k, n) {
    var g = PMCatalog.group(k, n);
    return (g ? g.fractions : [[k, n]])
      .map(function (f) {
        var acc = PMVesikkala.gripAccuracy(k / n, f[1]).accuracy;
        return { partial: f[1], weight: state.filter ? PMVesikkala.weight(acc, state.tolerance) : 1 };
      })
      .filter(function (p) {
        return p.weight > 0;
      });
  }

  // Katalogknoten, die als Multiphonic gelten: mindestens zwei klingende Teiltöne der Gruppe
  function multiphonicNodes() {
    return PMCatalog.catalog(state.catalog.nMax)
      .filter(function (e) {
        return multiphonicList(e.k, e.n).length >= 2;
      })
      .map(function (e) {
        return { k: e.k, n: e.n };
      });
  }

  // Multiphonic-Kreis antippen übernimmt den Knoten in die aktive Saite (Partial 1 = n,
  // Partial 2 = b wie im Katalog); 1/2 geht nicht (Eigenheit des Originals, formeln.md).
  function takeMultiphonic(k, n) {
    var g = PMCatalog.group(k, n);
    if (!g || n === 2) return;
    var s = state.strings[state.active];
    takeNode(state.active, s.tone, s.octave, n, g.b);
  }

  // Tippen: aktive Saite; langes Drücken (all): alle Saiten. Ersetzt den vorigen Knotenanschlag.
  // kind "multi" = Multiphonic (Kreis auf der Saite), sonst Flageolett (Zahl).
  function strikeNode(k, n, all, kind) {
    PMAudio.stopAll("node:");
    var list = kind === "multi" ? multiphonicList(k, n) : flageoletList(k, n);
    if (!list.length) return;
    var w = {};
    list.forEach(function (p) {
      w[p.partial] = p.weight;
    });
    var partials = list.map(function (p) {
      return p.partial;
    });
    var which = all
      ? state.strings.map(function (s, i) {
          return i;
        })
      : [state.active];
    which.forEach(function (i) {
      var parts = PMPiano.strikePartials(results[i].freq, partials, Object.assign({}, state.piano, { weights: w }));
      PMAudio.strike("node:" + i, parts);
    });
  }

  // --- Katalog (Erweiterung, Vesikkala 2016, Anhang 3) --------------------

  function initCatalogInputs() {
    var c = state.catalog;
    if (!PMCatalog.SORTS[c.sort]) c.sort = "node";
    if (c.source !== "active") c.source = "own";
    $("catTone").innerHTML = PM.STRING_NAMES.map(function (n, t) {
      return '<option value="' + t + '">' + n + "</option>";
    }).join("");
    $("catSort").innerHTML = Object.keys(PMCatalog.SORTS)
      .map(function (k) {
        return '<option value="' + k + '">' + PMCatalog.SORTS[k] + "</option>";
      })
      .join("");
    $("catSource").value = c.source;
    $("catTone").value = c.tone;
    $("catOct").value = c.octave;
    $("catNmax").value = c.nMax;
    $("catSort").value = c.sort;
    $("catMax").value = c.maxPartial;
    $("catSearch").value = c.search;

    function changed() {
      renderCatalog();
      save();
    }
    $("catSource").addEventListener("change", function (e) {
      c.source = e.target.value;
      changed();
    });
    $("catTone").addEventListener("change", function (e) {
      c.tone = parseInt(e.target.value, 10);
      changed();
    });
    $("catOct").addEventListener("input", function (e) {
      var v = parseInt(e.target.value, 10);
      if (isFinite(v)) {
        c.octave = v;
        changed();
      }
    });
    $("catNmax").addEventListener("input", function (e) {
      c.nMax = parseInt(e.target.value, 10);
      changed();
    });
    $("catSort").addEventListener("change", function (e) {
      c.sort = e.target.value;
      changed();
    });
    $("catMax").addEventListener("input", function (e) {
      var v = parseNum(e.target.value);
      e.target.classList.toggle("bad", v !== null && !(v > 0 && Math.floor(v) === v));
      c.maxPartial = e.target.value;
      changed();
    });
    $("catSearch").addEventListener("input", function (e) {
      c.search = e.target.value;
      changed();
    });
  }

  // Saite des Katalogs: eigene Auswahl oder die der aktiven Saite
  function catalogString() {
    var c = state.catalog;
    if (c.source === "active") {
      var s = state.strings[state.active];
      return { tone: s.tone, octave: s.octave };
    }
    return { tone: c.tone, octave: c.octave };
  }

  /*
   * Katalog zeichnen. Neu aufgebaut wird die Tabelle nur, wenn sich ihr Inhalt ändert
   * (Saite, Filter, Sortierung, Kammerton, Toleranz); sonst werden nur Markierungen und
   * Strike-Knöpfe nachgeführt. So bleiben Zeilen und Bildlauf stehen, wenn man eine Zeile
   * übernimmt oder anschlägt.
   */
  var catSig = "";

  function renderCatalog() {
    var c = state.catalog;
    var str = catalogString();
    var own = c.source === "own";
    $("catTone").disabled = !own;
    $("catOct").disabled = !own;
    $("catTone").value = str.tone;
    $("catOct").value = str.octave;
    $("catNmaxOut").textContent = c.nMax;
    $("catTitle").textContent = PMVesikkala.fundamentName(str.tone, str.octave);

    var sig = JSON.stringify([state.concertPitch, str.tone, str.octave, c.nMax, c.sort, c.maxPartial, c.search, state.filter, state.tolerance]);
    if (sig === catSig) {
      patchCatalog();
      return;
    }
    catSig = sig;

    var cat = PMCatalog.forString(state.concertPitch, str.tone, str.octave, c.nMax);
    $("catFreq").textContent = cat.freq.toFixed(2);
    catShown = { freq: cat.freq, tone: str.tone, octave: str.octave, entries: {}, list: [] };
    var maxPartial = parseNum(c.maxPartial);
    var entries = PMCatalog.sort(
      PMCatalog.filter(cat.entries, { maxPartial: maxPartial > 0 ? maxPartial : 0, search: c.search }),
      c.sort
    );
    $("catCount").textContent = entries.length + " of " + cat.entries.length + " nodes";
    catShown.list = entries;

    if (!entries.length) {
      $("catalog").innerHTML = '<p class="empty">No node matches.</p>';
      return;
    }
    var rows = entries
      .map(function (e) {
        var id = e.k + "/" + e.n;
        catShown.entries[id] = e;
        var shownRows = e.rows.slice(e.rows.length - e.shown.length);
        var title = e.rows
          .map(function (r) {
            return r.node + "/" + r.partial + "  " + PM.noteText(r.cents) + "  " + r.freq.toFixed(2) + " Hz";
          })
          .join("\n");
        var hidden = e.partials.length - e.shown.length;
        var notes = shownRows
          .map(function (r) {
            return "<span>" + esc(PM.noteText(r.cents)) + "</span>";
          })
          .join("");
        // Übernehmen per Tipp auf die Zeile. 1/2 geht nicht: das Original liefert für die
        // Partialtöne 2 und 1 den Knoten 1/3 (Eigenheit, s. formeln.md).
        var takeable = !(e.n === 2 || e.b == null);
        return (
          '<tr data-node="' + id + '"' + (takeable ? ' data-take="1" data-n="' + e.n + '" data-b="' + e.b + '"' : "") +
          ' title="' + esc(title + (takeable ? "" : "\nNot available in the original: partials 2 and 1 give node 1/3")) + '">' +
          '<td class="mark"></td>' +
          '<td class="frac"><span>' + e.k + "</span><span>" + e.n + "</span></td>" +
          '<td class="pct">' + e.percent.toFixed(1) + '<span class="unit"> %</span></td>' +
          '<td class="grp">' + (hidden ? '<span class="more">…</span>' : "") + esc(PMCatalog.groupText(e.shown)).replace(/_/g, "_<wbr>") + "</td>" +
          '<td class="chord">' + catChord(e) + "</td>" +
          '<td class="notes">' + notes + "</td>" +
          '<td class="num hi">' + e.n + "</td>" +
          '<td class="num hz">' + e.top.freq.toFixed(2) + "</td>" +
          '<td class="take">' + catStrikeButton(e) + "</td></tr>"
        );
      })
      .join("");
    $("catalog").innerHTML =
      '<table class="rows"><thead><tr><th class="mark"></th><th>Node /<br>Partial</th><th>%</th><th>Partials</th><th class="chord"></th><th class="notes">Notes</th>' +
      '<th class="hi">Highest</th><th class="hz">Hz</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>";
    patchCatalog();
  }

  // Notation je Zeile: die Teiltöne, die Strike spielt, als kleiner Akkord
  function catChord(e) {
    var w = {};
    catStrikeRows(e).forEach(function (p) {
      w[p.partial] = true;
    });
    return PMNotation.chordSVG(
      e.rows
        .filter(function (r) {
          return w[r.partial];
        })
        .map(function (r) {
          return { cents: r.cents };
        }),
      ""
    );
  }

  // Markierungen (welche Saiten stehen auf der Zeile) und Strike-Knöpfe nachführen
  function patchCatalog() {
    var str = catShown;
    var sel = {};
    state.strings.forEach(function (s, i) {
      var r = results[i];
      if (!r || r.result == null || s.tone !== str.tone || s.octave !== str.octave) return;
      var last = r.fractions[r.fractions.length - 1];
      var g = PM.gcd(last.numerator, last.denominator) || 1;
      var id = last.numerator / g + "/" + last.denominator / g;
      (sel[id] = sel[id] || []).push(i);
    });
    var trs = $("catalog").querySelectorAll("tr[data-node]");
    for (var t = 0; t < trs.length; t++) {
      var tr = trs[t];
      var id = tr.getAttribute("data-node");
      var list = sel[id] || [];
      var marks = list
        .map(function (i) {
          return '<span style="color:' + COLORS[i] + '">●</span>';
        })
        .join("");
      var cell = tr.firstChild;
      if (cell.innerHTML !== marks) cell.innerHTML = marks;
      tr.classList.toggle("sel", list.length > 0);
      // Hintergrund in der Farbe der aktiven Saite, sonst der ersten, die hier steht
      if (list.length) tr.style.setProperty("--c", COLORS[list.indexOf(state.active) >= 0 ? state.active : list[0]]);
      else tr.style.removeProperty("--c");
      var e = catShown.entries[id];
      var btn = tr.querySelector("button[data-catstrike]");
      if (e && btn) {
        var on = PMAudio.isPlaying(catStrikeKey(e));
        btn.classList.toggle("on", on);
        btn.textContent = on ? "Stop" : "Strike";
      }
    }
  }

  // Zuletzt gezeichnete Katalogzeilen (für Strike): { freq, entries: { "k/n": Eintrag } }
  var catShown = { freq: 0, tone: 0, octave: 0, entries: {}, list: [] };

  function catStrikeKey(e) {
    return "cat:" + e.k + "/" + e.n;
  }

  // Teiltöne einer Katalogzeile, die Strike spielt: mit „Audible only“ nur die am Knoten
  // klingenden (gewichtet wie in One/Two), sonst die ganze Gruppe.
  function catStrikeRows(e) {
    return e.rows
      .map(function (row) {
        var acc = PMVesikkala.gripAccuracy(e.pos, row.partial).accuracy;
        return { partial: row.partial, weight: state.filter ? PMVesikkala.weight(acc, state.tolerance) : 1 };
      })
      .filter(function (p) {
        return p.weight > 0;
      });
  }

  function catStrikeButton(e) {
    var on = PMAudio.isPlaying(catStrikeKey(e));
    var none = !catStrikeRows(e).length;
    return (
      '<button type="button" class="play take strike' + (on ? " on" : "") + '" data-catstrike="' + e.k + "/" + e.n + '"' +
      (none ? ' disabled title="No partial of the group sounds at this node"' : "") + ">" + (on ? "Stop" : "Strike") + "</button>"
    );
  }

  // Eine Katalogzeile anschlagen; ein neuer Anschlag ersetzt den vorigen aus dem Katalog.
  function catStrike(id) {
    var e = catShown.entries[id];
    if (!e) return;
    var key = catStrikeKey(e);
    if (PMAudio.isPlaying(key)) {
      PMAudio.stop(key);
      renderCatalog();
      return;
    }
    PMAudio.stopAll("cat:");
    var list = catStrikeRows(e);
    if (!list.length) return;
    var w = {};
    list.forEach(function (p) {
      w[p.partial] = p.weight;
    });
    var parts = PMPiano.strikePartials(
      catShown.freq,
      list.map(function (p) {
        return p.partial;
      }),
      Object.assign({}, state.piano, { weights: w })
    );
    PMAudio.strike(key, parts, renderCatalog);
    renderCatalog();
  }

  // Katalogzeile in die aktive Saite übernehmen: Saite, Oktave, Partial 1 = n, Partial 2 = b
  // Die angetippte Zeile bleibt an ihrer Stelle auf dem Bildschirm: Ändert sich die Höhe
  // der Bereiche darüber (Tabelle, Saitengrafik), wird der Bildlauf ausgeglichen. Safari
  // auf dem iPad kennt kein „scroll anchoring“, ohne das springt die Seite.
  function takeFromCatalog(n, b, tr) {
    var id = tr && tr.getAttribute("data-node");
    var before = tr ? tr.getBoundingClientRect().top : null;
    takeNode(state.active, catShown.tone, catShown.octave, n, b);
    if (id == null) return;
    var now = $("catalog").querySelector('tr[data-node="' + id + '"]');
    if (now) {
      var diff = now.getBoundingClientRect().top - before;
      if (Math.abs(diff) > 0.5) window.scrollBy(0, diff);
    }
  }

  function takeNode(i, tone, octave, n, b) {
    state.strings[i] = { tone: tone, octave: octave, p1: n, p2: b };
    if (i === state.active) fillStringInputs();
    PMAudio.stopAll(i + ":");
    update();
  }

  function pianoLabels() {
    $("decayOut").textContent = "×" + state.piano.decay.toFixed(2);
    $("tiltOut").textContent = state.piano.tilt.toFixed(2);
    $("inharmOut").textContent = state.piano.inharmonicity ? state.piano.inharmonicity.toFixed(5) : "0";
  }

  function strikeKey(i) {
    return i + ":strike";
  }

  function strike(i) {
    var r = results[i];
    if (!r.audibleRows.length) return;
    var parts = PMPiano.strikePartials(
      r.freq,
      r.audibleRows.map(function (row) {
        return row.partial;
      }),
      Object.assign({}, state.piano, { weights: strikeWeights(r.audibleRows) })
    );
    PMAudio.strike(strikeKey(i), parts, function () {
      if (results[state.active]) renderTable(state.active, results[state.active]);
    });
  }

  function anyStruck() {
    return results.some(function (r, i) {
      return PMAudio.isPlaying(strikeKey(i));
    });
  }

  function strikeBothLabel() {
    var on = anyStruck();
    var b = $("strikeBoth");
    if (!b) return;
    b.textContent = on ? "Stop" : "Strike all strings";
    b.classList.toggle("on", on);
    b.disabled = !results.some(function (r) {
      return r.audibleRows.length;
    });
  }

  // Play All: alle hörbaren Zeilen laufen
  function allPlaying(i, r) {
    return r.audibleRows.length > 0 && r.audibleRows.every(function (row) {
      return PMAudio.isPlaying(i + ":" + r.rows.indexOf(row));
    });
  }

  function audioStateLabel(st) {
    var el = $("audioState");
    var text = {
      off: "Starts with the first Play or Strike",
      running: "On",
      suspended: "Paused by the browser. Tap Play again.",
      interrupted: "Interrupted by the system. Tap Play again.",
      closed: "Off. Reload the page.",
    }[st] || st;
    el.textContent = text;
    el.classList.toggle("on", st === "running");
  }

  function copyText(id, btn) {
    var input = $(id);
    var text = input.value;
    var label = btn.dataset.label || (btn.dataset.label = btn.textContent);
    function done() {
      btn.textContent = "Copied";
      btn.classList.add("done");
      setTimeout(function () {
        btn.textContent = label;
        btn.classList.remove("done");
      }, 1400);
    }
    function fallback() {
      // ohne Zwischenablage-Zugriff: Text zeigen und markieren (versteckte Felder einblenden)
      input.hidden = false;
      input.focus();
      input.select();
      input.setSelectionRange(0, text.length);
      try {
        if (document.execCommand("copy")) done();
      } catch (e) {}
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  // Eine Zeile je Saite plus „All“ (alle Saiten zusammen); dazu MusicXML aller Saiten
  function renderExport() {
    $("expXml").value = PMExport.musicXML(
      results.map(function (r, i) {
        var s = state.strings[i];
        var line = PMExport.playingText(Object.assign({}, r, { rows: r.audibleRows }), s);
        return { label: line || stringLabel(i), rows: r.audibleRows };
      })
    );
    var f = state.exportFormat;
    var line = PMExport.FORMATS[f] && PMExport.FORMATS[f].line;
    var texts = results.map(function (r, i) {
      // Spielangabe nach Vesikkala: eine Zeile je Saite mit den klingenden Teiltönen
      if (line) return PMExport.playingText(Object.assign({}, r, { rows: r.audibleRows }), state.strings[i]);
      return PMExport.rowsText(r.audibleRows, f);
    });
    var box = $("expRows");
    if (box.children.length !== results.length) {
      box.innerHTML = results
        .map(function (r, i) {
          return (
            '<div class="exprow"><span class="explabel" style="color:' + COLORS[i] + '">' + (i + 1) + '</span><input id="exp' + i + '" type="text" readonly>' +
            '<button type="button" class="play copy" data-copy="exp' + i + '">Copy</button></div>'
          );
        })
        .join("");
    }
    texts.forEach(function (t, i) {
      $("exp" + i).value = t;
      $("exp" + i).title = stringLabel(i);
    });
    if (line) {
      $("expAll").value = texts.filter(Boolean).join(" | ");
      $("expHint").textContent = "M · fundament · grip % (mirror point) · [partials], after Vesikkala 2016.";
    } else {
      $("expAll").value = PMExport.combinedText(
        results.map(function (r) {
          return r.audibleRows;
        }),
        f
      );
      $("expHint").textContent = "Values separated by spaces, ascending, 2 decimals. Paste into bach, a score or a spreadsheet.";
    }
  }

  // --- Ausgabe ------------------------------------------------------------

  var results = [];

  function update() {
    results = state.strings.map(function (s) {
      return annotate(PM.computeString(state.concertPitch, s));
    });
    $("masterOut").textContent = Math.round((state.master / 0.25) * 100) + "%";
    $("nmaxOut").textContent = state.nMax;
    $("tolOut").textContent = "±" + Math.round(state.tolerance * 100) + " % of cycle";

    var ra = results[state.active];
    $("freq").textContent = ra.freq.toFixed(2);
    $("err").textContent = ra.error || "";
    renderChips();
    renderTable(state.active, ra);

    $("string").innerHTML = stringGraphic();
    renderPointer();
    renderExport();
    renderCatalog();
    save();
  }

  function stringGraphic(onlyActive) {
    return PMString.stringSVG(
      state.nMax,
      results
        .map(function (r, i) {
          return { color: COLORS[i], result: r.result, fractions: r.fractions, active: i === state.active };
        })
        .filter(function (s) {
          return !onlyActive || s.active;
        }),
      { mechanics: state.mechanics, pointer: state.pointer, multiphonics: multiphonicNodes() }
    );
  }

  // --- Hörbarkeit am Berührungspunkt (Erweiterung, Vesikkala 2016, Kap. 2.3) ---------

  /*
   * Jede Zeile bekommt accuracy (Genauigkeit des Griffs für diesen Teilton) und audible.
   * Ist der Filter aus, gelten alle Zeilen als hörbar (Verhalten wie im Original).
   * r.audibleRows = die Zeilen, die Play All, Strike und Export verwenden.
   */
  function annotate(r) {
    r.rows.forEach(function (row) {
      row.accuracy = r.result == null ? 1 : PMVesikkala.gripAccuracy(r.result, row.partial).accuracy;
      row.audible = !state.filter || row.accuracy >= PMVesikkala.threshold(state.tolerance) - 1e-12;
    });
    r.audibleRows = r.rows.filter(function (row) {
      return row.audible;
    });
    return r;
  }

  function strikeWeights(rows) {
    var w = {};
    rows.forEach(function (row) {
      w[row.partial] = state.filter ? PMVesikkala.weight(row.accuracy, state.tolerance) : 1;
    });
    return w;
  }

  // Saite des Zeigers: die aktive oder die des Katalogs
  function pointerStringData() {
    if (state.pointerString === "cat") return catalogString();
    var s = state.strings[state.active];
    return { tone: s.tone, octave: s.octave };
  }

  function pointerPartials() {
    var d = state.pointer;
    var str = pointerStringData();
    var freq = PM.stringFrequency(state.concertPitch, str.tone, str.octave);
    return {
      freq: freq,
      list: PMVesikkala.audibleAt(d, state.nMax, state.tolerance).map(function (a) {
        var pf = freq * a.partial;
        var cents = PM.centsAboveC0(pf, state.concertPitch);
        return { partial: a.partial, k: a.k, accuracy: a.accuracy, freq: pf, cents: cents, weight: PMVesikkala.weight(a.accuracy, state.tolerance) };
      }),
    };
  }

  /*
   * Freier Zeiger (Vesikkala Kap. 2.3), direkt an der Saitengrafik: unter dem Dreieck eine
   * Leiste mit Strike, Take (nächster Katalogknoten in die aktive Saite) und ×; darunter eine
   * Zeile mit den dort klingenden Teiltönen und aufklappbar die Liste mit Genauigkeit.
   */
  var ptDetailsOpen = false;

  // Oberkante der Leiste: knapp unter der Spitze des Zeigerdreiecks (PMString.POINTER_BOTTOM)
  function barTop() {
    var svg = $("string").querySelector("svg");
    if (!svg || !svg.viewBox || !svg.viewBox.baseVal.height) return 0;
    // SVG-Elemente haben kein offsetTop: Abstand über die Rechtecke zum Bezug .strwrap
    var r = svg.getBoundingClientRect();
    var top = r.top - $("strwrap").getBoundingClientRect().top;
    return Math.round(top + (PMString.POINTER_BOTTOM + 8) * (r.height / svg.viewBox.baseVal.height));
  }

  /*
   * Zeigerleiste direkt unter das Dreieck setzen und den Streifen darunter genau so hoch
   * machen wie nötig. Neu bei jeder Größenänderung der Grafik (Katalog auf/zu, Drehen),
   * sonst bliebe die Leiste an der alten Höhe stehen.
   */
  function placePointerBar() {
    var strip = $("ptstrip");
    var bar = strip.querySelector(".ptbar");
    if (!bar) {
      strip.style.height = "";
      return;
    }
    var top = barTop();
    bar.style.top = top + "px";
    strip.style.height = Math.max(0, top + bar.offsetHeight + 4 - strip.offsetTop) + "px";
  }

  function watchStringSize() {
    if (typeof ResizeObserver === "undefined") return;
    new ResizeObserver(placePointerBar).observe($("string"));
  }

  function renderPointer() {
    var d = state.pointer;
    var strip = $("ptstrip");
    var box = $("pointer");
    var sum = $("ptsum");
    if (d == null) {
      strip.innerHTML = "";
      strip.style.height = "";
      sum.innerHTML =
        '<div class="pttext"><span class="hint">Free point: tap or drag on the string. ' +
        '<button type="button" class="play small" data-ptset="1">Free point at active string</button></span></div>';
      box.innerHTML = "";
      strip.classList.remove("on");
      return;
    }
    strip.classList.add("on");
    var near = PMVesikkala.nearestNode(d, state.catalog.nMax);
    var pp = pointerPartials();
    var on = PMAudio.isPlaying("pointer");
    // Leiste an der Zeigerposition; am Rand nach innen geklappt, die Spitze bleibt am Zeiger
    var pct = (PMString.x(d) / PMString.W) * 100;
    var side = pct < 12 ? " left" : pct > 88 ? " right" : "";
    var tip = side === " left" ? "14px" : side === " right" ? "calc(100% - 14px)" : "50%";
    var shift = side === " left" ? "calc(" + pct.toFixed(3) + "% - 14px)" : side === " right" ? "calc(" + pct.toFixed(3) + "% + 14px)" : pct.toFixed(3) + "%";
    strip.innerHTML =
      '<div class="ptbar' + side + '" style="left:' + shift + ";top:" + barTop() + "px;--tip:" + tip + '">' +
      '<button type="button" class="play strike' + (on ? " on" : "") + '" data-ptplay="1"' + (pp.list.length ? "" : " disabled") + ' title="Strike the partials that sound at this point">' + (on ? "Stop" : "Strike") + "</button>" +
      (near.n > 2
        ? '<button type="button" class="play take active" style="--c:' + COLORS[state.active] + '" data-pttake="1" title="Take the nearest catalogue node into the active string">Take ' + near.k + "/" + near.n + "</button>"
        : "") +
      '<button type="button" class="clear" data-ptclear="1" title="Remove the free point" aria-label="Remove the free point">×</button>' +
      "</div>";
    placePointerBar();

    // klingende Teiltöne aufsteigend (die Tabelle darunter ordnet nach Genauigkeit)
    var asc = pp.list.slice().sort(function (a, b) {
      return a.partial - b.partial;
    });
    var list = asc
      .map(function (p) {
        return p.partial;
      })
      .join(" ");
    var chord = PMNotation.chordSVG(
      asc.map(function (p) {
        return { cents: p.cents, color: COLORS[state.active] };
      }),
      ""
    );
    sum.innerHTML =
      (chord ? '<div class="ptchord">' + chord + "</div>" : "") +
      '<div class="pttext">' +
      '<div class="ptline">Free point <b>' + (d * 100).toFixed(1) + " %</b> (" + d.toFixed(4) + ")</div>" +
      '<div class="ptline" title="What the finger at this point lets through (tolerance ±' + Math.round(state.tolerance * 100) +
      ' % of the cycle)">Sounding here: <b>' + (list || "–") + "</b></div>" +
      '<div class="ptline" title="Walter’s chain is the multiphonic group of the node; at the exact node only part of it sounds">Nearest multiphonic node <b>' +
      near.k + "/" + near.n + "</b> = " + (near.pos * 100).toFixed(1) + " %, Walter’s chain " + esc(PMCatalog.groupText(near.shown)) + "</div>" +
      "</div>";
    fitChord(sum.querySelector(".ptchord svg"));
    var rows = pp.list
      .map(function (p) {
        return (
          "<tr>" +
          '<td class="frac"><span>' + p.k + "</span><span>" + p.partial + "</span></td>" +
          '<td class="acc"><span class="bar"><i style="width:' + Math.round(p.accuracy * 100) + '%"></i></span>' + p.accuracy.toFixed(2) + "</td>" +
          '<td class="num">' + p.freq.toFixed(2) + "</td>" +
          '<td class="note">' + esc(PM.noteText(p.cents)) + "</td>" +
          "</tr>"
        );
      })
      .join("");
    box.innerHTML =
      '<details id="ptDetails"' + (ptDetailsOpen ? " open" : "") + "><summary>Partials at this point</summary>" +
      '<div class="pthead"><label>String <select id="ptString"><option value="active">active</option><option value="cat">Catalogue</option></select></label>' +
      '<span class="hint">' + pp.freq.toFixed(2) + " Hz · partials up to " + state.nMax + " whose node lies within the tolerance (Vesikkala 2016, ch. 2.3)</span></div>" +
      (pp.list.length
        ? '<div class="tablewrap"><table class="rows pt"><thead><tr><th>Node /<br>Partial</th><th>Accuracy</th><th>Frequency</th><th>Note</th></tr></thead><tbody>' + rows + "</tbody></table></div>"
        : '<p class="empty">No partial up to ' + state.nMax + " has a node within the tolerance.</p>") +
      "</details>";
    $("ptString").value = state.pointerString;
  }

  // Akkord in der festen Zeile über der Saite: Leerraum ober- und unterhalb der Systeme abschneiden
  function fitChord(svg) {
    if (!svg || !svg.getBBox) return;
    try {
      var b = svg.getBBox();
      if (!b.height) return;
      var vb = svg.viewBox.baseVal;
      var y = Math.max(vb.y, b.y - 4), h = Math.min(vb.y + vb.height, b.y + b.height + 4) - y;
      svg.setAttribute("viewBox", vb.x + " " + y + " " + vb.width + " " + h);
      svg.setAttribute("height", h);
    } catch (e) { /* ohne Layout (z. B. versteckt) bleibt der volle Rahmen */ }
  }

  function pointerStrike() {
    var pp = pointerPartials();
    if (!pp.list.length) return;
    var w = {};
    pp.list.forEach(function (p) {
      w[p.partial] = p.weight;
    });
    var parts = PMPiano.strikePartials(
      pp.freq,
      pp.list.map(function (p) {
        return p.partial;
      }),
      Object.assign({}, state.piano, { weights: w })
    );
    PMAudio.strike("pointer", parts, renderPointer);
  }

  // Zeiger setzen: neu zeichnen nur beim Loslassen, beim Ziehen nur die Marke bewegen
  function setPointer(d, light) {
    state.pointer = d;
    if (light) {
      var g = document.getElementById("ptmark");
      if (g) {
        g.setAttribute("transform", "translate(" + PMString.x(d).toFixed(2) + ",0)");
        var t = document.getElementById("ptlabel");
        if (t) t.textContent = (d * 100).toFixed(1) + " %";
      } else {
        update();
        return;
      }
      renderPointer();
    } else {
      update();
      revealPointerBar();
    }
  }

  // iPhone: die Grafik scrollt seitlich; nach dem Loslassen die Zeigerleiste ins Bild holen
  function revealPointerBar() {
    var bar = document.querySelector(".ptbar");
    var sc = document.querySelector(".stringscroll");
    if (!bar || !sc || sc.scrollWidth <= sc.clientWidth) return;
    var b = bar.getBoundingClientRect();
    var c = sc.getBoundingClientRect();
    if (b.right > c.right) sc.scrollLeft += b.right - c.right + 4;
    else if (b.left < c.left) sc.scrollLeft -= c.left - b.left + 4;
  }

  function initPointerDrag() {
    var box = $("strwrap");
    var dragging = false;
    function posOf(e) {
      var svg = box.querySelector("svg");
      if (!svg) return null;
      var rect = svg.getBoundingClientRect();
      if (!rect.width) return null;
      return PMString.posFromX(((e.clientX - rect.left) / rect.width) * PMString.W);
    }
    // Knoten k/n antippen: kurz = Strike der aktiven Saite, lang (0.5 s) = alle Saiten.
    // Wer den Finger bewegt (Scrollen), bricht ab.
    var press = null;
    function endPress(play) {
      if (!press) return;
      clearTimeout(press.timer);
      if (play && !press.long) {
        strikeNode(press.k, press.n, false, press.kind);
        if (press.kind === "multi") takeMultiphonic(press.k, press.n);
      }
      var el = press.el;
      setTimeout(function () {
        el.classList.remove("hit", "long");
      }, 150);
      press = null;
    }
    box.addEventListener("contextmenu", function (e) {
      if (e.target.closest && e.target.closest(".nodebtn, .multibtn")) e.preventDefault();
    });
    box.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest && e.target.closest("button")) return;
      var nb = e.target.closest && e.target.closest(".nodebtn, .multibtn");
      if (nb) {
        endPress(false);
        PMAudio.ensure();
        nb.classList.add("hit");
        press = { k: parseInt(nb.dataset.k, 10), n: parseInt(nb.dataset.n, 10), kind: nb.classList.contains("multibtn") ? "multi" : "flag", x: e.clientX, y: e.clientY, el: nb, long: false };
        var pr = press;
        press.timer = setTimeout(function () {
          if (press !== pr) return;
          pr.long = true;
          nb.classList.add("long");
          strikeNode(pr.k, pr.n, true, pr.kind);
          if (pr.kind === "multi") takeMultiphonic(pr.k, pr.n);
        }, 500);
        return;
      }
      var p = posOf(e);
      if (p == null) return;
      dragging = true;
      try {
        box.setPointerCapture(e.pointerId);
      } catch (err) {}
      e.preventDefault();
      setPointer(p, true);
    });
    box.addEventListener("pointermove", function (e) {
      if (press && Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) > 12) endPress(false);
      if (!dragging) return;
      var p = posOf(e);
      if (p != null) setPointer(p, true);
    });
    function end(e) {
      if (press) {
        endPress(e.type === "pointerup");
        return;
      }
      if (!dragging) return;
      dragging = false;
      var p = posOf(e);
      setPointer(p == null ? state.pointer : p, false);
    }
    box.addEventListener("pointerup", end);
    box.addEventListener("pointercancel", end);
  }

  // Tabelle der aktiven Saite (andere Saiten: nichts zu zeichnen); zeichnet auch den Touch point
  function renderTable(i, r) {
    if (i !== state.active) return;
    renderTouch();
    var box = $("result");
    if (!r.rows.length) {
      box.innerHTML = '<p class="empty">Enter two partials without a common divisor.</p>';
      return;
    }
    var rows = r.rows
      .map(function (row, j) {
        var key = i + ":" + j;
        var on = PMAudio.isPlaying(key);
        var title = row.audible
          ? "Node accuracy " + row.accuracy.toFixed(2)
          : "Damped by the finger: node accuracy " + row.accuracy.toFixed(2) + " is below " + PMVesikkala.threshold(state.tolerance).toFixed(2);
        return (
          '<tr class="' + (row.audible ? "" : "damped") + '" title="' + title + '">' +
          '<td class="frac"><span>' + row.node + "</span><span>" + row.partial + "</span></td>" +
          '<td class="acc">' + row.accuracy.toFixed(2) + "</td>" +
          '<td class="num">' + row.freq.toFixed(2) + "</td>" +
          '<td class="note">' + esc(PM.noteText(row.cents)) + "</td>" +
          '<td class="nota">' + PMNotation.noteSVG(row.cents, row.audible ? COLORS[i] : "var(--muted)") + "</td>" +
          '<td class="btn"><button type="button" class="play' + (on ? " on" : "") + '" data-play="' + key + '" data-freq="' + row.freq + '">' + (on ? "Stop" : "Play") + "</button></td>" +
          "</tr>"
        );
      })
      .join("");
    box.innerHTML =
      '<div class="tablewrap"><table class="rows">' +
      '<thead><tr><th>Node /<br>Partial</th><th title="Node accuracy (Vesikkala): 1 = on the node, below the threshold the finger damps the partial">Acc.</th><th><span class="long">Frequency</span><span class="short">Hz</span></th><th>Note</th><th class="nota"></th><th></th></tr></thead>' +
      "<tbody>" + rows + "</tbody></table></div>";
  }

  function onClick(e) {
    // Katalogzeile antippen (nicht auf Strike) = Knoten in die aktive Saite übernehmen
    var tr = !e.target.closest("button") && e.target.closest("#catalog tr[data-take]");
    if (tr) {
      takeFromCatalog(parseInt(tr.dataset.n, 10), parseInt(tr.dataset.b, 10), tr);
      return;
    }
    var dl = e.target.closest("button[data-dl]");
    if (dl) {
      download(dl.dataset.dl, dl.dataset.scope);
      return;
    }
    var b = e.target.closest("button[data-play], button[data-all], button[data-strike], button[data-copy], button[data-ptset], button[data-pttake], button[data-ptplay], button[data-ptclear], button[data-catstrike], button[data-chip], button[data-addstring], #strikeBoth");
    if (!b) return;
    if (b.dataset.chip != null) {
      setActive(parseInt(b.dataset.chip, 10));
      return;
    }
    if (b.dataset.addstring != null) {
      addString();
      return;
    }
    if (b.dataset.catstrike != null) {
      catStrike(b.dataset.catstrike);
      return;
    }

    if (b.dataset.ptset != null) {
      var rs = results[state.active];
      if (rs.result != null) setPointer(rs.result, false);
      return;
    }
    if (b.dataset.pttake != null) {
      var near = PMVesikkala.nearestNode(state.pointer, state.catalog.nMax);
      var sc = state.strings[state.active];
      takeNode(state.active, sc.tone, sc.octave, near.n, near.b);
      return;
    }
    if (b.dataset.ptclear != null) {
      PMAudio.stop("pointer");
      setPointer(null, false);
      return;
    }
    if (b.dataset.ptplay != null) {
      if (PMAudio.isPlaying("pointer")) PMAudio.stop("pointer");
      else pointerStrike();
      renderPointer();
      return;
    }
    if (b.dataset.copy) {
      copyText(b.dataset.copy, b);
      return;
    }
    if (b.id === "strikeBoth") {
      var any = anyStruck();
      results.forEach(function (rc, c) {
        if (any) PMAudio.stop(strikeKey(c));
        else strike(c);
      });
      renderTable(state.active, results[state.active]);
      return;
    }
    if (b.dataset.strike != null) {
      // „active“: Testknopf in den Settings (aktive Saite)
      var si = b.dataset.strike === "active" ? state.active : parseInt(b.dataset.strike, 10);
      if (PMAudio.isPlaying(strikeKey(si))) PMAudio.stop(strikeKey(si));
      else strike(si);
      renderTable(si, results[si]);
      return;
    }
    if (b.dataset.all != null) {
      var i = b.dataset.all === "active" ? state.active : parseInt(b.dataset.all, 10);
      var r = results[i];
      var allOn = allPlaying(i, r);
      if (allOn) PMAudio.stopAll(i + ":");
      else
        r.audibleRows.forEach(function (row) {
          var j = r.rows.indexOf(row);
          if (!PMAudio.isPlaying(i + ":" + j)) PMAudio.start(i + ":" + j, row.freq);
        });
      renderTable(i, r);
      return;
    }
    var key = b.dataset.play;
    if (PMAudio.isPlaying(key)) PMAudio.stop(key);
    else PMAudio.start(key, parseFloat(b.dataset.freq));
    var col = parseInt(key, 10);
    renderTable(col, results[col]);
  }

  /*
   * Zuklappbare Bereiche: Zustand je Gerät in localStorage (eigener Schlüssel). Vorgabe:
   * Tabelle offen, Katalog offen ab 1200 px (rechts neben der Saite), Settings und Export zu.
   */
  var OPEN_KEY = "piano-multiphonics:open";

  // Höhe der fixierten Katalog-Einstellungen, damit die Spaltenköpfe darunter stehen bleiben
  function watchCatHead() {
    var head = document.querySelector("#catPanel .cathead");
    if (!head || typeof ResizeObserver === "undefined") return;
    new ResizeObserver(function () {
      $("catPanel").style.setProperty("--cathead-h", head.offsetHeight + "px");
    }).observe(head);
  }

  function initPanels() {
    var saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(OPEN_KEY) || "{}") || {};
    } catch (e) {}
    var defaults = { tablePanel: true, catPanel: window.innerWidth >= 1200 };
    Object.keys(defaults).forEach(function (id) {
      var el = $(id);
      el.open = typeof saved[id] === "boolean" ? saved[id] : defaults[id];
      el.addEventListener("toggle", function () {
        saved[id] = el.open;
        try {
          localStorage.setItem(OPEN_KEY, JSON.stringify(saved));
        } catch (e) {}
      });
    });
  }

  // Settings und Export als Overlay: Symbolknöpfe oben rechts (immer sichtbar), schließen mit ×,
  // Tippen auf den Hintergrund oder Esc. Es ist immer höchstens eines offen.
  var OVERLAYS = { setPanel: "setBtn", expPanel: "expBtn" };

  function showOverlay(id, on) {
    Object.keys(OVERLAYS).forEach(function (k) {
      var open = on && k === id;
      $(k).hidden = !open;
      $(OVERLAYS[k]).setAttribute("aria-expanded", open ? "true" : "false");
    });
    $("setBackdrop").hidden = !on;
    if (on) $(id).querySelector(".chipx").focus();
  }

  function initSettings() {
    Object.keys(OVERLAYS).forEach(function (id) {
      $(OVERLAYS[id]).addEventListener("click", function () {
        showOverlay(id, $(id).hidden);
      });
      $(id).querySelector(".chipx").addEventListener("click", function () {
        showOverlay(id, false);
      });
    });
    $("setBackdrop").addEventListener("click", function () {
      showOverlay(null, false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") showOverlay(null, false);
    });
    $("xmlSave").addEventListener("click", saveMusicXML);
  }

  /*
   * MusicXML speichern. In der claude.ai-Seite über die Fähigkeit „downloads“ (erlaubt keine
   * Endung .musicxml, darum .musicxml.txt – vor dem Öffnen umbenennen); lokal (index.html) als
   * normaler Download. Grafiken als .svg bzw. .zip (download()).
   */
  var XML_NAME = "piano-multiphonics.musicxml";

  function xmlStatus(t) {
    $("xmlStatus").textContent = t;
  }

  function svgStatus(t) {
    $("svgStatus").textContent = t;
  }

  function saveMusicXML() {
    saveFile($("expXml").value, XML_NAME, XML_NAME + ".txt", "application/vnd.recordare.musicxml+xml", xmlStatus, " – remove “.txt” before opening.", " Use Copy XML.");
  }

  /*
   * Grafiken herunterladen (Erweiterung). what = string | partials | audible | catalogue | zip;
   * scope = active | all | shown (Saitengrafik wie angezeigt). Ohne scope gilt die Wahl
   * „Strings“ im Export. Dateinamen <Saite>_<klingende Teiltöne>_at_<k-n>_<Art>.svg; mehrere
   * Dateien kommen als .zip.
   */
  function download(what, scope) {
    scope = scope || $("dlScope").value;
    var idx = scope === "active" ? [state.active] : state.strings.map(function (_, i) {
      return i;
    });
    var base = idx.map(dlName).join("+");
    if (base.length > 120) base = idx.length + "-strings";
    var files = [];
    if (what === "string" || what === "zip") {
      files.push({ name: base + "_string.svg", data: PMString.standaloneSVG(stringGraphic(scope === "active")) });
    }
    idx.forEach(function (i) {
      if (!results[i].rows.length) return;
      if (what === "partials" || what === "zip") files.push({ name: dlName(i) + "_partials.svg", data: PMSvgFile.notationFile(spectrumFor(i)) });
      var chord = chordFor(i);
      if (chord && (what === "audible" || what === "zip")) files.push({ name: dlName(i) + "_" + chordLabel().toLowerCase() + ".svg", data: PMSvgFile.notationFile(chord) });
    });
    if ((what === "catalogue" || what === "zip") && catShown.list.length) files.push(catalogueFile());
    if (!files.length) return svgStatus("Nothing to download.");
    if (files.length === 1 && what !== "zip") return saveFile(files[0].data, files[0].name, files[0].name, "image/svg+xml", svgStatus, ".", "");
    var name = base + (what === "zip" ? "" : "_" + what) + ".zip";
    saveFile(PMSvgFile.zip(files), name, name, "application/zip", svgStatus, ".", "");
  }

  // <Saite>_<klingende Teiltöne>_at_<k-n> der Saite i
  function dlName(i) {
    var r = results[i];
    var s = state.strings[i];
    var name = PMVesikkala.fundamentName(s.tone, s.octave);
    if (r.result == null) return PMSvgFile.baseName(name);
    var last = r.fractions[r.fractions.length - 1];
    var g = PM.gcd(last.numerator, last.denominator) || 1;
    var partials = r.audibleRows.map(function (row) {
      return row.partial;
    });
    return PMSvgFile.baseName(name, partials, last.numerator / g, last.denominator / g);
  }

  // Katalog wie angezeigt (Sortierung, Filter), je Zeile der Akkord, den Strike spielt
  function catalogueFile() {
    var name = PMVesikkala.fundamentName(catShown.tone, catShown.octave);
    var title = "Catalogue · " + name + " · " + catShown.freq.toFixed(2) + " Hz · nodes up to partial " + state.catalog.nMax +
      (state.filter ? " · chords: audible partials" : "");
    var rows = catShown.list.map(function (e) {
      var shown = e.rows.slice(e.rows.length - e.shown.length);
      return {
        node: e.k + "/" + e.n,
        percent: e.percent.toFixed(1) + " %",
        partials: (e.partials.length > e.shown.length ? "…" : "") + PMCatalog.groupText(e.shown),
        notes: shown
          .map(function (r) {
            return PM.noteText(r.cents);
          })
          .join(" · "),
        chord: catChord(e),
      };
    });
    return { name: PMSvgFile.baseName(name) + "_catalogue.svg", data: PMSvgFile.catalogueFile(title, rows) };
  }

  // name = Dateiname lokal, hostName = in der claude.ai-Seite
  function saveFile(data, name, hostName, type, status, savedNote, failNote) {
    var host = window.claude && typeof window.claude.use === "function" ? window.claude.use("downloads") : null;
    if (!host) return localDownload(data, name, type, status, failNote);
    host.then(
      function (dl) {
        if (!dl) return localDownload(data, name, type, status, failNote);
        dl.save({ filename: hostName, data: data }).then(
          function () {
            status("Saved as " + hostName + savedNote);
          },
          function (err) {
            if (err && err.code === "declined") return;
            status("Download not available here (" + ((err && err.code) || "error") + ")." + failNote);
          }
        );
      },
      function () {
        localDownload(data, name, type, status, failNote);
      }
    );
  }

  function localDownload(data, name, type, status, failNote) {
    try {
      var url = URL.createObjectURL(new Blob([data], { type: type }));
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 2000);
      status("Saved as " + name + ".");
    } catch (e) {
      status("Download not available here." + failNote);
    }
  }

  load();
  initPanels();
  watchCatHead();
  watchStringSize();
  initSettings();
  initInputs();
  update();
})();
