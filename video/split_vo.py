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
# Schnitte so wählen, dass jede Zeile etwa so lang ist, wie ihr Text es erwarten lässt.
# Lange Pausen werden bevorzugt (falls <break>-Marken umgesetzt wurden), sind aber nicht nötig.
gaps.sort(key=lambda g: g[1])
chars = [len(c['text']) for c in cues]
speech = dur - sum(g[0] for g in gaps)
exp = [speech * k / sum(chars) for k in chars]
maxgap = max(g[0] for g in gaps)
G = len(gaps)
def seg_cost(i, a_end, b_start):  # Zeile i läuft vom Ende einer Pause bis zum Anfang der nächsten
    d = b_start - a_end
    return ((d - exp[i]) / exp[i]) ** 2
INF = float('inf')
# best[i][j]: Zeilen 0..i gesetzt, Zeile i endet an Pause j
best = [[INF] * G for _ in range(n)]; prev = [[-1] * G for _ in range(n)]
for j in range(G): best[0][j] = seg_cost(0, 0.0, gaps[j][1]) - 0.5 * gaps[j][0] / maxgap
for i in range(1, n - 1):
    for j in range(G):
        for k in range(j):
            c = best[i - 1][k] + seg_cost(i, gaps[k][2], gaps[j][1]) - 0.5 * gaps[j][0] / maxgap
            if c < best[i][j]: best[i][j], prev[i][j] = c, k
fin = min(range(G), key=lambda k: best[n - 2][k] + seg_cost(n - 1, gaps[k][2], dur))
idx = [fin]
for i in range(n - 2, 0, -1): idx.append(prev[i][idx[-1]])
cuts = [gaps[j] for j in reversed(idx)]

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
