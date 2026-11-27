# Trailer und Short

Beide Videos entstehen direkt aus der echten App. Ein kleines Regie-Skript steuert sie: Es zeichnet Räume, fährt die Kamera, setzt Möbel und läuft durchs Haus. Gerendert wird Bild für Bild in virtueller Zeit. Jedes Bild ist dadurch perfekt flüssig, egal wie schnell der Rechner ist.

```bash
cd video
npm install
node render.mjs trailer      # out/raumplaner-trailer.mp4  (1920×1080, 30 fps)
node render.mjs short        # out/raumplaner-short.mp4    (1080×1920, 30 fps)
./mux.sh trailer             # Sprache aus vo/trailer/*.mp3 (+ musik/trailer.mp3) darunterlegen
```

Benötigt werden Google Chrome, Node.js und ffmpeg. Einen anderen Chrome-Pfad gibst du mit `--chrome /pfad/zu/chrome` an.

| Datei | Inhalt |
|---|---|
| `director.js` | Regie: Szenen, Kamerafahrten, Texte, Übergänge |
| `stage.html` | Bühne mit App-Fenster, Handy-Rahmen, Kinobalken und Texten |
| `demo-state.js` | Das Vorzeige-Haus (Räume, Türen, Fenster, Möbel, Balkon) |
| `shim.js` | Virtuelle Uhr, damit jedes Bild exakt 1/30 s weiterrückt |
| `render.mjs` | Startet Chrome, nimmt Bild für Bild auf und kodiert mit ffmpeg |
| `SPRECHERTEXTE.md` | Texte für ElevenLabs mit Zeitmarken |
| `YOUTUBE.md` | Titel, Beschreibung, Kapitel und Tags für den Upload |
| `cues.json`, `*.srt` | Zeitmarken und Untertitel |

Für eine schnelle Vorschau speichert `node render.mjs trailer --preview 15` nur jedes 15. Bild als JPG in `frames/`.
