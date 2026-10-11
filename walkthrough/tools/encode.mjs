// Turns the recording from record.mjs into one MP4 clip per step (plus a still of its last frame).
// Usage: node encode.mjs <rec-dir> <media-out-dir>
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [REC = '/tmp/walkthrough-capture/rec', MEDIA] = process.argv.slice(2);
const timeline = JSON.parse(readFileSync(join(REC, 'timeline.json'), 'utf8'));
rmSync(MEDIA, { recursive: true, force: true });
mkdirSync(MEDIA, { recursive: true });
const work = join(REC, 'lists'); rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true });

const cuts = timeline.cuts.sort((a, b) => a[0] - b[0]);
const inCut = t => cuts.some(([a, b]) => t > a && t < b);
// Position on the trimmed timeline.
const trimmed = t => t - cuts.filter(([, b]) => b <= t).reduce((sum, [a, b]) => sum + (b - a), 0) - cuts.filter(([a, b]) => a < t && t < b).reduce((sum, [a]) => sum + (t - a), 0);
const frames = timeline.frames.filter(frame => !inCut(frame.t)).map(frame => ({ ...frame, at: trimmed(frame.t) })).sort((a, b) => a.at - b.at);

const manifest = [];
let segmentStart = trimmed(timeline.start);
timeline.steps.forEach((step, index) => {
  if (step.start) segmentStart = trimmed(step.start);
  const segmentEnd = trimmed(step.end);
  // The segment opens on whatever was on screen at its start, then plays every frame up to its end.
  const before = [...frames].reverse().find(frame => frame.at <= segmentStart) || frames[0];
  const inside = frames.filter(frame => frame.at > segmentStart && frame.at <= segmentEnd);
  const list = [{ file: before.file, at: segmentStart }, ...inside];
  const lines = list.map((frame, i) => {
    const next = i + 1 < list.length ? list[i + 1].at : segmentEnd + 0.05;
    return `file '${join(REC, 'frames', frame.file)}'\nduration ${Math.max(0.001, next - frame.at).toFixed(4)}`;
  });
  lines.push(`file '${join(REC, 'frames', list.at(-1).file)}'`);
  const listFile = join(work, `${step.name}.txt`);
  writeFileSync(listFile, lines.join('\n') + '\n');
  const clip = `${String(index + 1).padStart(2, '0')}-${step.name}.mp4`, poster = `${String(index + 1).padStart(2, '0')}-${step.name}.webp`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-fps_mode', 'cfr', '-r', '60', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-an', join(MEDIA, clip)]);
  execFileSync('cwebp', ['-quiet', '-q', '82', join(REC, 'frames', list.at(-1).file), '-o', join(MEDIA, poster)]);
  manifest.push({ name: step.name, clip, poster, duration: +(segmentEnd - segmentStart).toFixed(2), hotspot: step.hotspot, focus: step.focus });
  console.log(`${clip}  ${(segmentEnd - segmentStart).toFixed(1)}s  ${list.length} frames`);
  segmentStart = segmentEnd;
});
writeFileSync(join(MEDIA, 'manifest.json'), JSON.stringify(manifest, null, 1));
