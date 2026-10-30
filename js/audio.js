/*
 * Klang wie im Original: jede Frequenz als gehaltener Ton aus 16 Sinus-Teiltönen
 * (Parameter aus PM.synthPartials), 40 ms Ein-/Ausblenden, Master-Gain 0.25.
 * Dazu "Strike": der ganze Multiphonic angeschlagen mit Ausklingen (js/piano.js).
 * Der AudioContext entsteht erst beim ersten Tippen (nötig auf iPad/iOS).
 */
(function (root) {
  "use strict";

  var ctx = null;
  var master = null;
  var masterLevel = 0.25;

  var stateListeners = [];

  function notify() {
    var st = state();
    stateListeners.forEach(function (fn) {
      fn(st);
    });
  }

  // "off" (noch nicht gestartet), "running", "suspended", "interrupted" (iOS), "closed"
  function state() {
    return ctx ? ctx.state : "off";
  }

  function onState(fn) {
    stateListeners.push(fn);
  }

  /*
   * AudioContext anlegen bzw. wieder starten. Muss aus einem Tippen/Klick heraus
   * aufgerufen werden (Safari, iPad). Absicherungen für Safari:
   * - Audio-Session "playback": spielt auch im Lautlos-Modus (Safari ≥ 16.4)
   * - stiller 1-Sample-Puffer schaltet Web Audio frei (ältere iOS-Versionen)
   * - resume() auch bei "interrupted" (iOS nach Anruf, Sperrbildschirm …)
   */
  function ensure() {
    if (!ctx) {
      try {
        if (root.navigator && root.navigator.audioSession) root.navigator.audioSession.type = "playback";
      } catch (e) {}
      var AC = root.AudioContext || root.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = masterLevel;
      master.connect(ctx.destination);
      var buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      ctx.onstatechange = notify;
    }
    if (ctx.state !== "running" && ctx.state !== "closed") {
      var p = ctx.resume();
      if (p && p.then) p.then(notify, notify);
    }
    notify();
    return ctx;
  }

  // Beim ersten Tippen irgendwo auf der Seite freischalten
  function unlock() {
    ensure();
    if (ctx && ctx.state === "running") {
      ["touchend", "pointerdown", "keydown", "click"].forEach(function (t) {
        root.document.removeEventListener(t, unlock, true);
      });
    }
  }
  if (root.document) {
    ["touchend", "pointerdown", "keydown", "click"].forEach(function (t) {
      root.document.addEventListener(t, unlock, true);
    });
  }

  function setMaster(v) {
    masterLevel = v;
    if (master) master.gain.setValueAtTime(v, ctx.currentTime);
  }

  function Voice(freq) {
    var c = ensure();
    var now = c.currentTime;
    this.fade = c.createGain();
    this.fade.gain.setValueAtTime(0, now);
    this.fade.gain.linearRampToValueAtTime(1, now + 0.04);
    this.fade.connect(master);
    var self = this;
    this.oscs = PM.synthPartials(freq).map(function (p) {
      var o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = Math.min(p.freq, 22050);
      var g = c.createGain();
      g.gain.value = p.gain;
      o.connect(g);
      g.connect(self.fade);
      o.start(now);
      return o;
    });
  }

  Voice.prototype.stop = function () {
    var c = ctx;
    var now = c.currentTime;
    var g = this.fade.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.00001, now + 0.04);
    this.oscs.forEach(function (o) {
      o.stop(now + 0.06);
    });
    var fade = this.fade;
    setTimeout(function () {
      fade.disconnect();
    }, 200);
  };

  /*
   * Anschlag mit Ausklingen (Klavier-Synthese, js/piano.js): jeder Teilton ein Sinus,
   * 5 ms Anstieg, dann exponentiell mit Zeitkonstante tau gegen 0.
   */
  function Strike(partials, onEnd) {
    var c = ensure();
    var now = c.currentTime;
    this.out = c.createGain();
    this.out.gain.value = 1;
    this.out.connect(master);
    var self = this;
    var end = 0;
    this.oscs = partials.map(function (p) {
      var o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = p.freq;
      var g = c.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(p.gain, now + 0.005);
      g.gain.setTargetAtTime(0, now + 0.005, p.tau);
      o.connect(g);
      g.connect(self.out);
      o.start(now);
      var stopAt = now + 0.005 + 7 * p.tau;
      o.stop(stopAt);
      end = Math.max(end, stopAt);
      return o;
    });
    this.timer = setTimeout(function () {
      self.out.disconnect();
      if (onEnd) onEnd();
    }, (end - now) * 1000 + 100);
  }

  Strike.prototype.stop = function () {
    var now = ctx.currentTime;
    var g = this.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.00001, now + 0.05);
    this.oscs.forEach(function (o) {
      try {
        o.stop(now + 0.07);
      } catch (e) {}
    });
    clearTimeout(this.timer);
    var out = this.out;
    setTimeout(function () {
      out.disconnect();
    }, 200);
  };

  // Laufende Töne, Schlüssel frei wählbar (z. B. "0:3" = Spalte 0, Zeile 3)
  var playing = {};

  // Anschlag; onEnd wird nach natürlichem Ausklingen aufgerufen
  function strike(key, partials, onEnd) {
    if (playing[key]) playing[key].stop();
    var s = new Strike(partials, function () {
      if (playing[key] === s) delete playing[key];
      if (onEnd) onEnd();
    });
    playing[key] = s;
  }

  function isPlaying(key) {
    return !!playing[key];
  }

  function start(key, freq) {
    if (playing[key]) playing[key].stop();
    playing[key] = new Voice(freq);
  }

  function stop(key) {
    if (playing[key]) {
      playing[key].stop();
      delete playing[key];
    }
  }

  function stopAll(prefix) {
    Object.keys(playing).forEach(function (k) {
      if (!prefix || k.indexOf(prefix) === 0) stop(k);
    });
  }

  root.PMAudio = { state: state, onState: onState, ensure: ensure, start: start, strike: strike, stop: stop, stopAll: stopAll, isPlaying: isPlaying, setMaster: setMaster };
})(this);
