# Mitbauen am Raumplaner

Schön, dass du mitmachen willst! Der Raumplaner ist Open Source (MIT-Lizenz) – jede Hilfe zählt: Fehler melden, Ideen einbringen, Möbel ergänzen, Texte verbessern oder neue Funktionen bauen.

## So geht's

1. **Issue aufmachen** – Fehler oder Idee kurz beschreiben, gern mit Screenshot und Gerät/Browser.
2. **Forken und Branch anlegen** – z. B. `feature/wintergarten` oder `fix/treppe-dach`.
3. **Lokal starten**
   ```bash
   python3 -m http.server 8765
   ```
   Dann http://localhost:8765 öffnen. Es gibt keinen Build-Schritt: alles steckt in `index.html`, three.js kommt vom CDN.
4. **Testen** – am Rechner und am Handy (oder in den Entwicklertools mit Handy-Ansicht). `?lite` erzwingt den Sparmodus fürs Handy, `?debug` stellt einige Helfer unter `window.__rp` bereit.
5. **Pull Request** – kurz beschreiben, was sich ändert und wie man es ausprobiert.

## Gute Einstiegsthemen

- **Neue Möbel**: Einträge im Objekt `FURN` bestehen aus einfachen Quadern, Zylindern und Kugeln – ideal für den Anfang.
- **Neue Vorlagen**: Grundrisse im Objekt `TEMPLATES`.
- **Texturen**: prozedurale Texturen werden im Code gezeichnet, ganz ohne Bilddateien.
- **Übersetzungen**: die Oberfläche ist derzeit deutsch.

## Grundsätze

- Die App soll ohne Anmeldung, ohne Server und auch auf dem Handy flüssig laufen.
- Lieber klein und verständlich als groß und kompliziert.
- Sei freundlich und respektvoll – wir bauen das gemeinsam.

Mit deinem Beitrag stimmst du zu, dass er unter der MIT-Lizenz dieses Projekts veröffentlicht wird.
