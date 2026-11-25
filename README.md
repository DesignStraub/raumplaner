# Raumplaner

Eine kleine Web-App zum Einrichten von Häusern und Wohnungen – direkt im Browser, auch auf dem Handy.

**Live:** https://designstraub.github.io/raumplaner/

## Funktionen

1. **Grundriss** – Vorlage laden oder Räume selbst zeichnen (Rechteck oder Vieleck), Räume benennen, Ecken und Räume verschieben.
2. **Voreinstellungen** – Wandhöhe, Wandstärke sowie Textur und Farbe für alle Wände und Böden.
3. **3D-Einrichtung** – Wandseiten und Böden einzeln texturieren, Türen und Fenster einbauen, Wände abschneiden, Wohnung begehen.

Alles lässt sich benennen. Der Stand wird automatisch im Browser gespeichert und kann als Datei exportiert/importiert werden.

## Lokal starten

```bash
python3 -m http.server 8765
```

Dann http://localhost:8765 öffnen. Es wird nur `index.html` benötigt; [three.js](https://threejs.org) wird vom CDN geladen.
