#!/usr/bin/env python3
"""Zerlegt eine ElevenLabs-Gesamtaufnahme (vo/<name>.mp3) an den langen Pausen in vo/<name>/01.mp3, 02.mp3 …

Die Zeilen im Sprechertext sind durch <break time="2s" /> getrennt. Das ergibt die längsten Pausen der
Aufnahme. Genau an diesen Pausen wird geschnitten. Kurze Pausen innerhalb einer Zeile (Gedankenstrich, …)
bleiben erhalten.
"""
import json, os, re, subprocess, sys

here = os.path.dirname(os.path.abspath(__file__))
name = sys.argv[1] if len(sys.argv) > 1 else 'trailer'
src = os.path.join(here, 'vo', f'{name}.mp3')
cues = json.load(open(os.path.join(here, 'cues.json')))[name]
n = len(cues)

dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).decode().strip())
log = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', 'silencedetect=noise=-38dB:d=0.35', '-f', 'null', '-'],
                     capture_output=True, text=True).stderr
starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
gaps = [(e - s, s, e) for s, e in zip(starts, ends) if s > 0.05 and e < dur - 0.05]
if len(gaps) < n - 1:
    sys.exit(f'Nur {len(gaps) + 1} Abschnitte gefunden, erwartet {n}. Stehen die <break time="2s" />-Pausen im Text?')
cuts = sorted(sorted(gaps, reverse=True)[:n - 1], key=lambda g: g[1])
shortest_cut, longest_rest = cuts and min(c[0] for c in cuts), max([g[0] for g in gaps if g not in cuts] or [0])
if cuts and shortest_cut < longest_rest * 1.3:
    print(f'Achtung: Pausen zwischen den Zeilen ({shortest_cut:.2f} s) kaum länger als innerhalb ({longest_rest:.2f} s) – bitte Ergebnis prüfen.')

out_dir = os.path.join(here, 'vo', name)
os.makedirs(out_dir, exist_ok=True)
seg_end = [c[1] + 0.08 for c in cuts] + [dur]
seg_beg = [0.0] + [c[2] - 0.06 for c in cuts]
print(f'{name}: {n} Zeilen aus {os.path.basename(src)} ({dur:.1f} s)')
for i, (a, b) in enumerate(zip(seg_beg, seg_end)):
    f = os.path.join(out_dir, f'{i + 1:02d}.mp3')
    # Stille am Anfang/Ende abschneiden, damit die Zeile genau auf ihrer Startzeit einsetzt
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ss', f'{a:.3f}', '-to', f'{b:.3f}',
                    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',
                    '-c:a', 'libmp3lame', '-q:a', '2', f], check=True)
    d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode().strip())
    w = cues[i]['window']
    warn = '  ← länger als das Zeitfenster, evtl. etwas schneller sprechen lassen' if d > w + 0.3 else ''
    print(f'  {i + 1:02d}  {d:4.1f} s / {w:.1f} s  {cues[i]["text"][:60]}{warn}')
