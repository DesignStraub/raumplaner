# Raumplaner

Eine kleine Web-App zum Einrichten von Häusern und Wohnungen – direkt im Browser, auch auf dem Handy.

**Live:** https://designstraub.github.io/raumplaner/

## Funktionen

1. **Grundriss** – Vorlage laden oder Räume selbst zeichnen (Rechteck oder Vieleck), Räume benennen, Ecken und Räume verschieben. Mehrere Ebenen (Stockwerke).
2. **Voreinstellungen** – Raumhöhe pro Ebene, Wandstärke sowie Textur und Farbe für alle Wände und Böden.
3. **3D-Einrichtung** – Wandseiten und Böden einzeln texturieren, Türen, Fenster und Möbel (nach Kategorien, mit Suche) und Treppen setzen und per Ziehen verschieben, Wände abschneiden. Im Begehen-Modus rennt man standardmäßig (Umschalt = langsam), springt mit der Leertaste und läuft über Treppen in andere Stockwerke.
4. **Ganzes Haus** – alle Ebenen von außen, oberste Ebene als Dachgeschoss mit Sattel-, Walm- oder Flachdach. Neigung, Kniestock und Deckung sind wählbar; die Dachschrägen erscheinen innen und im Grundriss (Linien bei 1 m und 2 m), die Wohnfläche wird nach WoFlV berechnet. Dazu Fassadentextur, Gartengröße, Umgebung Garten oder belebte Großstadt (Läden, Autos, Fußgänger, Straßenlaternen), Tag oder Nacht.

Türen, Fenster, Möbel und Texturen bleiben erhalten, wenn der Grundriss später geändert wird.

Alles lässt sich benennen. Der Stand wird automatisch im Browser gespeichert und kann als Datei exportiert/importiert werden.

## Lokal starten

```bash
python3 -m http.server 8765
```

Dann http://localhost:8765 öffnen. Es wird nur `index.html` benötigt; [three.js](https://threejs.org) wird vom CDN geladen.
