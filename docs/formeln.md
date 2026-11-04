# Formeln des Piano Multiphonic Calculator

Quelle: <https://www.casparjohanneswalter.de/research/piano_multiphonic_calculator>
(Caspar Johannes Walter). Ausgelesen aus dem gebündelten `index.js` der Seite (React-Komponente
`Bn` und ihre Hilfskomponenten). Umgesetzt in `js/multiphonic.js`; das Ergebnis stimmt für alle
Partialton-Paare 1…80 und mehrere Saiten mit dem Original überein (25 600 Fälle).

## Eingaben

| Feld | Bedeutung | Default |
|---|---|---|
| Concert Pitch | Kammerton A in Hz | 442 |
| String | Ton der Saite (c … b) | c |
| Octave | Oktave der Saite (0–8) | 1 |
| Partial 1, Partial 2 | zwei Partialtöne, die im Multiphonic hörbar sein sollen | leer |

Das Original hat zwei Spalten („One“, „Two“). Erweiterung: bis zu 10 Saiten (Saitenleiste, die
ersten zwei weiter rot und blau); die Eingaben gelten für die gerade aktive Saite (Abschnitt 11).
Die Rechnung je Saite ist unverändert.

## 1. Grundfrequenz der Saite

```
f = A / 2^(3/4) / 16 · 2^(Ton/12) · 2^Oktave
```

`A / 2^(3/4)` ist das c unter dem Kammerton, `/16` vier Oktaven tiefer. Bei A = 442 sind c, Oktave 1
→ 32.85 Hz.

## 2. Knoten und Partialtöne (Fraction-Windowing)

Gegeben zwei teilerfremde Partialtöne `p1`, `p2`. Gesucht ist der Berührungspunkt auf der Saite,
an dem beide (und eine Kette weiterer) Partialtöne zusammen klingen.

1. **Subtraktive Euklid-Folge:** `u = [max, min]`; solange anhängen `|u[-2] − u[-1]|`, bis die
   Differenz 0 ist (letzte Zahl verwerfen).
2. **Fenster:** `u` umdrehen und nur Werte behalten, die ein neues Maximum sind → `h`
   (aufsteigende Partialtöne, beginnt mit 1).
3. **Brüche (Knoten/Partialton):** `s = [0/1, 1/2, 1/3]`, dann für `p ≥ 3`:
   ```
   m = h[p] − h[p−1]
   s[p] = (Zähler von s[Index von m in h] + Zähler von s[p−1]) / h[p]
   ```
4. **Ergebnis:** Wert des letzten Bruchs = Position des Berührungspunkts als Anteil der
   Saitenlänge (0 … 1/2).

Jede Zeile `k / n` der Ergebnistabelle ist ein Bruch aus `s`: `n` ist der Partialton
(Frequenz `f · n`), `k` der Knoten, an dem er liegt.

Beispiel `p1 = 11`, `p2 = 4`:
`u = 11 4 7 3 4 1 3 2 1` → `h = 1 2 3 4 7 11` →
`0/1, 1/2, 1/3, 1/4, 2/7, 3/11` → Berührungspunkt bei 3/11 ≈ 0.2727 der Saite.
Klingende Partialtöne 1, 2, 3, 4, 7, 11.

Sonderfälle (wie im Original übernommen):
- gemeinsamer Teiler ≠ 1 → Meldung „Greatest common divisor: …“, keine Tabelle;
- `s` beginnt immer mit drei Brüchen. Bei sehr kurzen Folgen (z. B. 2/1 oder 1/1) ist das
  Ergebnis deshalb 1/3.

## 3. Tonhöhe der Partialtöne

```
C0 = A / 2^4.75          (16.43 Hz bei A = 442)
Cent = 1200 · log2(f · n / C0)
```

- **Note:** nächster temperierter Halbton (Namen `C #C D bE E F #F G bA A bB B`), Oktave
  `floor((Cent + 50) / 1200)`, Abweichung in Cent im Bereich −50 … +50.
- **Notenbild:** Das Original zeigt pro Zeile ein Notenbild aus einem 72-tönigen Raster
  (Zwölfteltöne, 16.7 ¢): `Index = floor(72 · (Cent + 100/12) / 1200) mod 72`.

## 4. Grafik

**Saite.** Das Original zeigt ein Bild aller Knoten bis zum 20. Partialton auf der ersten
Saitenhälfte, darauf je Spalte einen farbigen Strich bei `196 · Ergebnis + 0.9` Prozent der
Bildbreite. Der Nachbau zeichnet dieses Bild selbst (`js/stringview.js`): jeder gekürzte Bruch
`k/n ≤ 1/2` mit `n ≤ N` ist ein Ausschlag an Position `k/n`, Höhe `1/√n` (0/1 und 1/2 voll).
N ist einstellbar (Default 20). Die Knoten der Bruchkette einer Spalte sind in deren Farbe
hervorgehoben; der Berührungspunkt ist als Linie markiert.
Dämpfer und Hammer sind wie in Walters Bild nur ungefähr eingezeichnet (abschaltbar):
Dämpfer ≈ 0.097 … 0.181, Anschlagpunkt des Hammers ≈ 0.115 der Saitenlänge. Die echte Lage
hängt vom Instrument und vom Register ab.

**Notation.** Die Notenbilder des Originals sind nach der 72er-Stufe (s. o.) ausgewählt. Der
Nachbau zeichnet dieselbe 72er-Stufe selbst (`js/notation.js`, Zeichen aus Bravura):
Notenkopf auf dem Halbton der Spalte „Note“ (Schreibweise C, C♯, D, E♭, E, F, F♯, G, A♭, A, B♭,
H), Vorzeichen aus dem Satz „Extended Helmholtz-Ellis“ (♭/♮/♯ mit 1–3 Pfeilen):
`Pfeile = 72er-Stufe − 6 · Halbton` (−3 … +3; ein Pfeil = 1/12 Ton = 16.7 ¢, drei = 50 ¢).
Steht kein Vorzeichen, aber ein Pfeil, wird ♮ mit Pfeil gesetzt. Hohe und tiefe Noten bekommen
8va/15ma bzw. 8vb/15mb. Zusätzlich zeigt ein Doppelsystem alle Partialtöne einer Spalte
nebeneinander, mit der Cent-Abweichung wie in der Spalte „Note“.

**Akkord (Erweiterung):** Rechts neben dem Doppelsystem (bei zu wenig Platz darunter) stehen die
klingenden Teiltöne als Akkord in einem eigenen kleinen Doppelsystem, Beschriftung „Audible“
(bei ausgeschaltetem Häkchen „Audible only“ alle Teiltöne, Beschriftung „Chord“). Gleich
geschriebene Töne erscheinen einmal. Sekunden und Töne auf derselben Stufe: der obere Kopf steht
rechts daneben. Vorzeichen stehen in Spalten nach links, von oben nach unten jeweils in der
ersten Spalte, in der sie kein anderes Vorzeichen überdecken (Höhe aus den Glyphenpfaden).
8va/8vb usw. je System und Oktavierung einmal, über dem höchsten bzw. unter dem tiefsten Ton.

## 5. Klang

Jede Zeile hat „Play“, dazu gibt es „Play All“. Jede Frequenz `f` erklingt gehalten (kein
Ausklingen) mit 16 Sinus-Teiltönen:

```
f_k = k · f                      k = 1 … 16
v_k = 0.5 · r^(k−1),  r = 1 / sqrt(max(f, 32) / 16)
```

Tiefe Töne sind also obertonreich, hohe fast sinusförmig. Teiltöne ab 22 050 Hz bleiben stumm.
Ein- und Ausblenden dauert 40 ms, der Master-Gain beträgt 0.25.

## 6. Anschlag mit Ausklingen (Erweiterung, nicht im Original)

„Strike“ spielt alle Partialtöne einer Saite gleichzeitig wie eine angeschlagene Saite
(`js/piano.js`). Jeder Partialton `n` aus der Tabelle ist ein Sinus:

```
f_n = n · f · sqrt(1 + B · n²)              B = Inharmonizität (Default 0 = rein harmonisch)
a_n = n^(−tilt), skaliert auf Σ a_n = 0.8   tilt = Dämpfung hoher Teiltöne (Default 0.5)
τ_n = decay · 3 s · sqrt(100 Hz / f_n)      begrenzt auf 0.15 s … 12 s · decay
```

Hüllkurve: 5 ms Anstieg, dann exponentielles Abklingen mit Zeitkonstante `τ_n`
(nach `τ` noch 37 %, nach etwa `7 τ` −60 dB). Tiefe Teiltöne klingen lange, hohe kurz.
Die drei Regler „Decay“, „Damping of high partials“ und „Inharmonicity B“ verändern
`decay`, `tilt` und `B`.

## 7. Export (Erweiterung)

Der resultierende Multiphonic jeder Saite (und aller zusammen) als Textzeile zum Kopieren,
Werte mit Leerzeichen getrennt, aufsteigend, auf 2 Nachkommastellen:

```
Midicents = Cent über C0 + 1200        (C4 = 6000, A4 = 6900 beim eingestellten Kammerton)
Cent über C0 = 1200 · log2(f · n / C0) (wie im Original)
Hz = f · n
```

„All“ fasst alle Saiten aufsteigend zusammen; gleiche Werte stehen nur einmal (früher „Both“).

## 8. Katalog (Erweiterung, Vesikkala 2016, Anhang 3)

Vesikkala listet in Anhang 3 die 60 Multiphonics einer Saite bis zum 19. Partialton. Das Panel
„Catalogue“ berechnet diese Liste (`js/catalog.js`) für jede Saite und jeden Kammerton, ohne neue
Theorie: Jeder gekürzte Bruch `k / n` mit `1 ≤ k`, `2k ≤ n ≤ N` ist ein Knoten auf der ersten
Saitenhälfte (bei `N = 19` sind das genau Vesikkalas 60; `1/2` gehört dazu). `N` ist einstellbar
8 … 40 (Default 19, Vesikkalas ausdrückliche Annahme) und unabhängig vom Regler „Nodes up to
partial“ der Saitengrafik.

**Teiltongruppe.** Zu jedem Knoten gehört die Kette aus Walters Fraction-Windowing (Abschnitt 2):
das kleinste `b < n` mit `gcd(n, b) = 1`, für das die Kette von `(n, b)` in `k / n` endet; die
Gruppe sind die Partialtöne (Nenner) dieser Kette, z. B. `4/13 → 1_2_3_4_7_10_13`,
`3/14 → 1_2_3_4_5_9_14`. Sonderfall `1/2`: Gruppe `[1, 2]` (für `2/1` liefert das Original den
Bruch `1/3`, Abschnitt 2; darum lässt sich diese Zeile nicht übernehmen).

**Anzeige.** Je Knoten: Bruch, Prozent `100 · k / n` (eine Nachkommastelle), Teiltöne in
Vesikkalas Schreibweise (`5_9_14`: die lückenlose Folge `1, 2, 3, …` am Anfang entfällt, drei
bis vier Teiltöne bleiben; alle im Tooltip), Noten mit Cent wie in der Spalte „Note“
(Abschnitt 3, gleiche Funktionen), höchster Partialton und seine Frequenz. Saite wählbar (eigene
oder „like active“, die aktive Saite). Je Zeile zusätzlich die Teiltöne, die Strike spielt, als
kleiner Akkord (Notation wie Abschnitt 4). Sortierung nach Knotenlage (Default), höchstem Partialton oder
höchster Tonhöhe (auf einer Saite dieselbe Reihenfolge wie nach Partialton; der Schlüssel ist
der Cent-Wert, damit er auch über mehrere Saiten trägt). Filter „Only up to partial“ (`n ≤ N`)
und „With partials“ (alle genannten Teiltöne müssen in der Gruppe vorkommen).

**Übernehmen.** Tipp auf die Zeile setzt in der aktiven Saite Saite, Oktave, `Partial 1 = n` und
`Partial 2 = b`; sie zeigt dann genau diese Zeile (Markierung ● in der Farbe jeder Saite, die auf
der Zeile steht).

**Strike.** Jede Zeile lässt sich direkt anschlagen (Klavier-Synthese wie Abschnitt 6) mit den
Teiltönen der Gruppe. Mit „Audible only“ klingen nur die, deren Genauigkeit am Knoten k/n über
der Schwelle liegt, gewichtet wie bei Strike der Saite (Abschnitt 10); ohne das Häkchen die ganze Gruppe.
Ein neuer Anschlag im Katalog beendet den vorigen.

## 9. Spielangaben (Erweiterung, Vesikkala 2016, Kap. 5.2.5 und 5.4, Anhang 3)

Vesikkala schlägt als Notation vor: `M`, der Grundton (Saite) als „Phantom“-Notenkopf, die
Griffposition in Prozent der Saitenlänge und die klingenden Teiltöne. Die App zeigt für die
aktive Saite im „Touch point“ eine solche Zeile (`js/vesikkala.js`), z. B.
`M · C1 · 27.3 % (72.7 %) · [4 7 11]`, und als Exportformat „Playing indication“ dieselbe Zeile
mit allen Teiltönen. `d` ist Walters Berührungspunkt (Abschnitt 2), nichts daran wird verändert.

```
Prozent            100 · d
Spiegelpunkt       100 · (1 − d)          derselbe Knoten vom anderen Saitenende her
Griffintervall     1200 · log2(1 / (1 − d))   Cent über dem Grundton, Griff bei d
                   1200 · log2(1 / d)         für den Spiegelpunkt
Abstand            L · d  (cm)             L = schwingende Saitenlänge aus dem Flügelmodell
Rillen             ≈ 6.5 · L · d
```

**Griffintervall:** die Tonhöhe, auf die die Saite gegriffen wäre (verbleibende Länge `1 − d`).
Vesikkala zeigt sie in Anhang 3, rät aber ausdrücklich davon ab (Kap. 5.2.5: Prozent sind
linear, Intervalle logarithmisch, und der Pianist kann sie am Flügel nicht prüfen). Anzeige als
Note mit Cent-Abweichung zum nächsten Halbton, mit denselben Funktionen wie die Spalte „Note“
(Abschnitt 3). Beispiel Anhang 3, Grundton G1: `1/19 → 93.6 ¢ = A♭1 −6 ¢` (Vesikkala rundet auf
ganze Cent; er schreibt die Note in 72-TET-Näherung, darum steht bei ihm für `1/14` „−22 ¢“ zum
Viertelton, hier `+28 ¢` zum Halbton – derselbe Wert). `1/2 → 1200 ¢`, Spiegelpunkt von `1/4`
(75 %) `→ 2400 ¢`.

**Abstand und Rillen:** nur, wenn das gewählte Flügelmodell (Panel „Input“, `js/models.js`,
Tabelle in `docs/modelle.md`) die Länge dieser Saite kennt; sonst „–“. Die Rillenzahl ist
Vesikkalas Anhaltspunkt von der tiefsten Saite des Estonia-Flügels (6,5 Rillen je cm auf
ca. 141 cm, Kap. 3.1); die Dichte hängt von der Saite ab, darum „≈“.

**Schreibweise des Grundtons:** wie die String-Auswahl, groß, mit ♯/♭ (C, C♯, D, E♭, E, F, F♯,
G, A♭, A, B♭, B) plus Oktave. Die Teiltöne in der Zeile sind die oberen drei bis vier der Gruppe
wie im Katalog (Abschnitt 8), im Export alle.
## 10. Was man an einem beliebigen Punkt der Saite hört (Erweiterung, Vesikkala 2016, Kap. 2.3)

Walters Kette (Abschnitt 2) nennt alle Brüche der Mediantenbildung, z. B. für 3/14 die Zeilen
0/1, 1/2, 1/3, 1/4, 1/5, 2/9, 3/14. Am Flügel klingen davon nur die Teiltöne, die nahe am
Berührungspunkt einen Knoten haben; die tiefen Zwischenbrüche dämpft der Finger. Vesikkala
rechnet das so (`js/vesikkala.js`):

```
x   = d · n                         d = Berührungspunkt (Anteil der Saite), n = Teilton
acc = |0.5 − (x − floor(x))| · 2    1 = genau auf einem Knoten, 0 = auf einem Schwingungsbauch
```

`floor(x)` zählt die passierten synonymen Knoten; der nächste Knoten ist `round(x) / n`, der Abstand
`|x − round(x)|` in Zyklen des Teiltons (Vesikkalas „% of the partial's cycle“). Teilton `n` klingt,
wenn `acc ≥ 1 − tol`. Für die drei Elemente der Kette oberhalb des Knotens k/n gilt: der höchste
hat `acc = 1`, die beiden darunter `acc = 1 − 2/n` (benachbarte Farey-Brüche).

**Toleranz.** `acc ≥ 1 − tol` heißt: Abstand zum Knoten höchstens `tol/2` des Zyklus. Vesikkala
gibt drei verschiedene Werte: seine Formel mit Schwelle 0.9 (±5 % des Zyklus, `tol` 0.10),
Torres & Ferreira-Lopes (2012) ±10 % (`tol` 0.20), empirisch 15–20 % (`tol` 0.30–0.40). Darum ist
`tol` ein Regler „Node tolerance“ (0.05 … 0.40, Anzeige „0.20 · ±10 % of cycle“, mit Erklärung
in den Settings). Default 0.20 = Torres & Ferreira-Lopes (bis 2026-11-04 stand hier irrtümlich
„der obere empirische Wert“, und die Anzeige zeigte ±20 %): damit klingen die
oberen drei Teiltöne der Kette ab n ≥ 10 zusammen, so wie Anhang 3 sie listet (3/11 → 11 7 4,
4/13 → 13 10 3); für kleinere n (2/9 → 9 5 4, 2/7 → 7 4 3) braucht es 0.23 bzw. 0.29. Mit 0.10
bliebe bei 3/14 nur Teilton 14 übrig.

**Beispiele aus Kap. 2.3** (Vesikkalas Zahlen, mit Korrekturen): Die Nachbarn von 1/5 (20 %) sind
3/16 (18.75 %) und 4/19 (21.05 %); im Text steht „3/19“, gemeint ist 4/19. Der Abstand 1.05 %
der Saite ist 20 % des 19er-Zyklus → `acc = 0.6`. Für die Nachbarn von 2/7 teilt er die
Abstände 0.79 % und 0.84 % durch 28.57 (Knotenlage) statt durch 14.29 (Zyklus); in Zyklen des
7. Teiltons sind es 5.5 % und 5.9 % → `acc ≈ 0.88`. Griff 4/19 und Teilton 14: 5.32 % des
14er-Zyklus → 0.894; Griff 3/14 und Teilton 19: 1/14 = 7.14 % (bei ihm 7.22 % aus gerundeten
0.38 %) → 0.857. `tests/vesikkala.test.js` prüft diese Werte.

**In der Tabelle der aktiven Saite.** Jede Zeile zeigt `acc` („Acc.“); Zeilen unter der Schwelle sind grau
(gedämpft). Mit dem Häkchen „Audible only“ (Default an) verwenden Play All, Strike und der Export
nur die klingenden Zeilen; „Play“ je Zeile bleibt wie im Original. Strike gewichtet die
Lautstärke mit `0.5 + 0.5 · (acc − (1 − tol)) / tol` (0.5 an der Schwelle, 1 auf dem Knoten,
eigene Annahme), als Faktor vor der Normierung aus Abschnitt 6. Häkchen aus → alles wie vorher.

**Zeiger („Free point“).** Auf der Saitengrafik lässt sich ein Punkt setzen und ziehen (Maus und
Touch), auch an der Leiste unter dem Zeigerdreieck. Die Leiste wandert mit und hat „Strike“,
„Take k/n“ und „×“ (Zeiger entfernen); ohne Zeiger setzt „Free point at active string“ ihn auf den
Berührungspunkt der aktiven Saite. „Take“ übernimmt den nächsten Katalogknoten (für d > 1/2
gespiegelt) in die aktive Saite ( Partial 1 = n, Partial 2 = b
wie in Abschnitt 8), die Liste aller Teiltöne 1 … N (N = „Nodes up to partial“), die am Punkt
klingen, sortiert nach `acc`, mit Note und Hz für die gewählte Saite (aktive oder Katalog), und
„Strike“ für diese Liste mit derselben Gewichtung.

## 11. Oberfläche mit mehreren Saiten (Erweiterung)

Bis zu 10 Saiten, je eine Farbe; eine ist aktiv (Eingaben String, Octave, Partial 1, Partial 2,
Tabelle, „Touch point“). Eine neue Saite übernimmt die Werte der aktiven. Die Saitengrafik zeigt
alle Berührungspunkte, die aktive Saite kräftig (mit ihrer Bruchkette in Farbe), die anderen blass.

**Touch point.** Für die aktive Saite: Name und Frequenz (Abschnitt 1), Fingerposition
`100 · d` Prozent und vom anderen Ende `100 · (1 − d)` (Abschnitt 9), die klingenden Teiltöne
(Abschnitt 10) mit Spielangabe, Doppelsystem und Akkord (Abschnitt 4).

**Knoten antippen.** Zwei Arten, jeweils Tippen = aktive Saite, langes Drücken (0.5 s) = alle
Saiten; die Eingaben ändern sich nicht.
- **Zahl k/n = Flageolett:** Teilton n und seine Vielfachen bis N = „Nodes up to partial“ (alle
  haben bei k/n genau einen Knoten), gleich laut: 1/10 → 10, 20.
- **Kreis ○ auf der Saitenlinie = Multiphonic** (übernimmt den Knoten zugleich in die aktive
  Saite, Partial 1 = n, Partial 2 = b wie im Katalog): die Katalogknoten (Abschnitt 8, bis zum N des
  Katalogs), deren Teiltongruppe am Knoten mindestens zwei klingende Teiltöne hat (bei N = 19 und
  Toleranz ±20 % sind es 46 von 60). Klang wie Strike im Katalog: die Gruppe, mit „Audible only“
  nur die klingenden, gewichtet nach Abschnitt 10 (5/19 → 4, 15, 19).
(Michas Wunsch, 3. Oktober 2026: Flageoletts und Multiphonics unterscheiden; vorher spielte die
Zahl ab n ≥ 10 wegen der Toleranz meist einen Multiphonic.)

**Free point, Begriffe.** „Sounding here“ = Teiltöne 1 … N, deren Knoten innerhalb der Toleranz
um den Zeigerpunkt liegt (Abschnitt 10), aufsteigend und als Akkord notiert. „Nearest multiphonic
node“ = nächster Katalogknoten mit Walters Kette (Abschnitt 8). Beides ist nicht dasselbe: Bei
26.0 % klingen 4 (1/4), 8 (2/8), 15 (4/15), 19 (5/19); die Kette von 5/19 ist 1 2 3 4 7 11 15 19
(gezeigt 7_11_15_19), davon klingen genau bei 5/19 nur 4, 15, 19 (7: acc 0.68, 11: 0.79).

## 12. Dynamische Notensysteme und MusicXML (Erweiterung)

**Systeme.** Doppelsystem und Akkord haben immer Violin- und Bassschlüssel. Liegen Töne ab C6
(diatonische Stufe ≥ 42), kommt darüber ein Violinsystem mit „15“ (klingt zwei Oktaven höher, die
Töne stehen dort zwei Oktaven tiefer notiert); liegen Töne unter C2 (Stufe < 14), darunter ein
Basssystem mit „15“ (klingt zwei Oktaven tiefer). Diese Töne bekommen keine 8va/8vb mehr; nur was
auch im „15“-System nicht passt, wird zusätzlich oktaviert. Vorbild: bach.roll (Schlüssel „FFGG“).
Die Einzelnote je Tabellenzeile bleibt ein einzelnes System mit 8va/8vb.

**MusicXML.** Ein Takt je Saite, ganze Noten als Akkord der klingenden Teiltöne (ohne „Audible
only“: alle), Violin- und Bassschlüssel (Stufe ≥ C4 oben), darüber die Spielangabe als Text.
Tonhöhe: Stammton und Oktave wie in der Notation (nächster Halbton, 72er-Stufe),
`alter = (Cent − Cent des Stammtons) / 100`, auf 2 Nachkommastellen; Vorzeichen ♭/♮/♯ mit 1 Pfeil
als `flat-down` usw., mit 2–3 Pfeilen als `other` mit SMuFL-Namen (`accidentalSharpThreeArrowsDown`).
