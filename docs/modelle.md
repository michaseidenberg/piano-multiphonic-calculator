# Flügelmodelle: Saitenlängen

Datenobjekt `MODELS` in `js/models.js`. Je Modell ein Objekt `strings` mit Schlüssel
`Saite + Oktave` (klein, ♯ als `#`, ♭ als `b`: `a0`, `c#1`, `eb1`) und Wert = schwingende Länge
in cm. Gemessen wird wie Vesikkala (Kap. 3.1): der ganze schwingende Stahlkern von der Agraffe
bis zum Steg-/Anhangstift-seitigen Ende, nicht nur die Umspinnung. Unbelegte Saiten bleiben
weg; die App zeigt dann keinen cm-Wert.

Die Modellwahl ist auch die Grundlage für Schritt 4 (Hammerpunkt, Dämpferbereich, Reichweite
je Modell); diese Felder kommen dann dazu.

## Eingebaute Modelle

| id | Name | Belegte Saiten | Quelle |
|---|---|---|---|
| `generic` | Generic (no string lengths) | – | – |
| `estonia-aalto` | Estonia (half-built, Aalto lab) | A0 ≈ 141 cm | Vesikkala 2016, Kap. 3.1: „lowest monochord string … ca. 141 centimetres“, 6,5 Rillen je cm. Die tiefste Monochord-Saite dieses Instruments war A0 (Abb. 3.1-1: Monochorde A…D). Kleiner Flügel, halbfertig, nur für die Messungen. |
| `steinway-d` | Steinway D | – | noch keine belegten Längen |
| `steinway-b` | Steinway B | – | noch keine belegten Längen |
| `boesendorfer-225` | Bösendorfer 225 | – | noch keine belegten Längen |
| `fazioli-f212` | Fazioli F212 | – | noch keine belegten Längen |

Die vier leeren Einträge sind Vesikkalas Instrumente (Anhang 6). Längen dafür liefert
Hirvelä (2013, Vergleich von 56 Modellen; Finnisch, noch nicht ausgewertet) oder Michas
eigene Messung. Nicht übernommen: die Gesamtlänge 274 cm des Steinway D (Kap. 2.2) ist die
Länge des Instruments, nicht einer Saite.

## Eigene Modelle

Im Panel „Input“: „Add model“, Name und je Zeile `Saite Länge` (`A0 141`, `C#1: 125.5`,
`Eb1 = 118 cm`; Dezimalkomma erlaubt). Gespeichert im Browser unter
`localStorage["piano-multiphonics:models"]`, getrennt von den übrigen Einstellungen.
„Copy JSON“ kopiert alle eigenen Modelle als JSON, „Import JSON“ liest ein Modell oder eine
Liste wieder ein (z. B. vom Mac aufs iPad). Format:

```json
[{ "id": "mein-fluegel", "name": "Mein Flügel", "strings": { "a0": 140, "c1": 130.5 }, "source": "own measurement" }]
```

Eigene Modelle lassen sich bearbeiten und löschen; die eingebauten nicht.
