#!/bin/bash
# Legt die ElevenLabs-Sprachaufnahmen (und optional Musik) unter das gerenderte Video.
#   ./mux.sh trailer   → out/raumplaner-trailer-mit-ton.mp4
#   ./mux.sh short     → out/raumplaner-short-mit-ton.mp4
# Erwartet: vo/<name>.mp3 (eine Gesamtaufnahme, wird an den Pausen zerlegt)
#        oder vo/<name>/01.mp3, 02.mp3 … (Startzeiten stehen in cues.json), optional musik/<name>.mp3
set -euo pipefail
cd "$(dirname "$0")"
NAME="${1:-trailer}"
VIDEO="out/raumplaner-$NAME.mp4"
OUT="out/raumplaner-$NAME-mit-ton.mp4"
[ -f "$VIDEO" ] || { echo "Video fehlt: $VIDEO (erst: node render.mjs $NAME)"; exit 1; }
[ -f "vo/$NAME.mp3" ] && python3 split_vo.py "$NAME"
STARTS=$(python3 -c "import json;print(' '.join(str(c['start']) for c in json.load(open('cues.json'))['$NAME']))")
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
INPUTS=(-i "$VIDEO"); FILTER=""; MIX=""; n=0; idx=1
for S in $STARTS; do
  n=$((n+1)); F=$(printf "vo/%s/%02d.mp3" "$NAME" "$n")
  [ -f "$F" ] || { echo "Hinweis: $F fehlt – wird übersprungen"; continue; }
  INPUTS+=(-i "$F"); MS=$(python3 -c "print(int($S*1000))")
  FILTER+="[$idx:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${MS}|${MS},volume=1.0[v$idx];"; MIX+="[v$idx]"; idx=$((idx+1))
done
NV=$((idx-1))
[ "$NV" -gt 0 ] || { echo "Keine Sprachdateien in vo/$NAME/ gefunden."; exit 1; }
FILTER+="${MIX}amix=inputs=$NV:normalize=0:dropout_transition=0[vo];"
if [ -f "musik/$NAME.mp3" ]; then
  INPUTS+=(-i "musik/$NAME.mp3")
  FILTER+="[$idx:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.55,afade=t=out:st=$(python3 -c "print(max(0,$DUR-2.5))"):d=2.5[mu];"
  FILTER+="[vo]asplit[vo1][vo2];[mu][vo1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];[duck][vo2]amix=inputs=2:normalize=0[a]"
else
  FILTER+="[vo]anull[a]"
fi
ffmpeg -y -loglevel error "${INPUTS[@]}" -filter_complex "$FILTER" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -t "$DUR" -movflags +faststart "$OUT"
echo "fertig: $OUT"
