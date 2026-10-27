// Cuts the product out of a photo and puts it on plain white, removing tables, walls, floors and anything
// lying next to it (business cards, tags, logos). Uses the open-source IS-Net model (from the rembg project),
// run locally with ONNX Runtime; nothing is sent to an outside service.
//
// The model file (≈170 MB) is downloaded once to scripts/models/ (git-ignored). On GitHub it's cached
// between runs by the workflow.

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import * as ort from "onnxruntime-node";

const MODEL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "models");
const MODEL = path.join(MODEL_DIR, "isnet-general-use.onnx");
const MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx";
const S = 1024; // the model works on 1024×1024

let session = null;
async function getSession() {
  if (session) return session;
  if (!existsSync(MODEL)) {
    await mkdir(MODEL_DIR, { recursive: true });
    console.log("Downloading the background-removal model (one time, ~170 MB)…");
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`model download failed: HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(MODEL));
  }
  session = await ort.InferenceSession.create(MODEL, { intraOpNumThreads: Math.max(1, os.cpus().length - 1) });
  return session;
}

// Keeps the main object: every connected part at least `minShare` the size of the largest one
// (so both shoes of a pair stay, but a business card or tag lying beside the product goes).
function keepMainObject(mask, w, h, minShare = 0.15) {
  const labels = new Int32Array(w * h);
  const sizes = [0];
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (mask[i] < 128 || labels[i]) continue;
    const id = sizes.length;
    let n = 0;
    labels[i] = id; stack.push(i);
    while (stack.length) {
      const k = stack.pop(); n++;
      const x = k % w, y = (k - x) / w;
      if (x > 0 && mask[k - 1] >= 128 && !labels[k - 1]) { labels[k - 1] = id; stack.push(k - 1); }
      if (x < w - 1 && mask[k + 1] >= 128 && !labels[k + 1]) { labels[k + 1] = id; stack.push(k + 1); }
      if (y > 0 && mask[k - w] >= 128 && !labels[k - w]) { labels[k - w] = id; stack.push(k - w); }
      if (y < h - 1 && mask[k + w] >= 128 && !labels[k + w]) { labels[k + w] = id; stack.push(k + w); }
    }
    sizes.push(n);
  }
  const largest = Math.max(0, ...sizes);
  const keep = sizes.map((n) => n >= largest * minShare);
  for (let i = 0; i < w * h; i++) if (!keep[labels[i]] || (!labels[i] && mask[i] >= 128)) mask[i] = 0;
  // Soft edges below the threshold that don't touch a kept part are dropped too
  return largest;
}

// For photos already on plain white: removes separate loose objects (a business card or tag lying beside the
// product) without the AI model, by keeping only the main non-white shape(s). Returns a PNG, or the input
// unchanged if nothing separate was found.
export async function removeLooseObjects(input) {
  const { data: rgb, info } = await sharp(input).flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  // Work on a smaller copy for speed; "object" = anything clearly darker or more colourful than white
  const scale = Math.min(1, 600 / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * scale)), sh = Math.max(1, Math.round(h * scale));
  const small = await sharp(rgb, { raw: info }).resize(sw, sh, { fit: "fill" }).raw().toBuffer();
  const mask = Buffer.alloc(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    const r = small[i * 3], g = small[i * 3 + 1], b = small[i * 3 + 2];
    if (Math.min(r, g, b) < 225 || Math.max(r, g, b) - Math.min(r, g, b) > 25) mask[i] = 255;
  }
  // Close small gaps so one product made of pale and dark parts stays one shape
  const grown = Buffer.from(mask);
  for (let pass = 0; pass < 3; pass++) {
    const src = Buffer.from(grown);
    for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) {
      const k = y * sw + x;
      if (!src[k] && (src[k - 1] || src[k + 1] || src[k - sw] || src[k + sw])) grown[k] = 255;
    }
  }
  const keep = Buffer.from(grown);
  keepMainObject(keep, sw, sh, 0.15);
  let removed = 0;
  for (let i = 0; i < sw * sh; i++) if (grown[i] && !keep[i]) removed++;
  if (!removed) return input;
  // Paint removed areas white on the full-size photo
  const keepFull = await sharp(keep, { raw: { width: sw, height: sh, channels: 1 } }).resize(w, h, { fit: "fill" }).extractChannel(0).raw().toBuffer();
  const grownFull = await sharp(grown, { raw: { width: sw, height: sh, channels: 1 } }).resize(w, h, { fit: "fill" }).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < w * h; i++) if (grownFull[i] >= 128 && keepFull[i] < 128) rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = 255;
  return sharp(rgb, { raw: info }).png().toBuffer();
}

// Grows (on) or shrinks (off) the "on" area of a mask by one pixel per pass
function morph(mask, w, h, passes, grow) {
  for (let p = 0; p < passes; p++) {
    const src = Buffer.from(mask);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const k = y * w + x;
      const n = [src[k - 1], src[k + 1], src[k - w], src[k + w]];
      if (grow ? !src[k] && n.some(Boolean) : src[k] && !n.every(Boolean)) mask[k] = grow ? 255 : 0;
    }
  }
}

// Second try when the AI model misses the product (e.g. a white T-shirt on a grey floor, where it picks the
// small card instead): everything that clearly differs from the background colour around the edges is the
// product; thin lines (floor tile joints) and small separate objects are dropped and holes are filled.
// Returns a PNG of the product on white, or null if it doesn't look reliable.
export async function cutoutByBackground(input) {
  const { data: rgb, info } = await sharp(input).rotate().flatten({ background: "#ffffff" }).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const scale = Math.min(1, 600 / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * scale)), sh = Math.max(1, Math.round(h * scale));
  const small = await sharp(rgb, { raw: info }).resize(sw, sh, { fit: "fill" }).blur(1.2).raw().toBuffer();
  // Background colour = median of a thin border
  const bw = Math.max(2, Math.round(Math.min(sw, sh) * 0.02));
  const ch = [[], [], []];
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    if (x >= bw && x < sw - bw && y >= bw && y < sh - bw) continue;
    for (let c = 0; c < 3; c++) ch[c].push(small[(y * sw + x) * 3 + c]);
  }
  const bg = ch.map((a) => a.sort((p, q) => p - q)[a.length >> 1]);
  const mask = Buffer.alloc(sw * sh);
  const diff = new Uint8Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    diff[i] = Math.max(...[0, 1, 2].map((c) => Math.abs(small[i * 3 + c] - bg[c])));
    if (diff[i] > 30) mask[i] = 255;
  }
  morph(mask, sw, sh, 3, false);
  keepMainObject(mask, sw, sh, 0.15);
  morph(mask, sw, sh, 3, true);
  // Close bites along shadowed edges, but only over pixels that aren't plainly background colour
  const closed = Buffer.from(mask);
  morph(closed, sw, sh, 12, true);
  morph(closed, sw, sh, 12, false);
  for (let i = 0; i < sw * sh; i++) if (closed[i] && !mask[i] && diff[i] > 24) mask[i] = 255;
  // Fill holes: anything not reachable from the border without crossing the product is part of it
  const outside = Buffer.alloc(sw * sh);
  const stack = [];
  for (let x = 0; x < sw; x++) stack.push(x, (sh - 1) * sw + x);
  for (let y = 0; y < sh; y++) stack.push(y * sw, y * sw + sw - 1);
  while (stack.length) {
    const k = stack.pop();
    if (outside[k] || mask[k]) continue;
    outside[k] = 1;
    const x = k % sw;
    if (x > 0) stack.push(k - 1);
    if (x < sw - 1) stack.push(k + 1);
    if (k >= sw) stack.push(k - sw);
    if (k < sw * (sh - 1)) stack.push(k + sw);
  }
  let covered = 0;
  for (let i = 0; i < sw * sh; i++) if (!outside[i]) { mask[i] = 255; covered++; }
  const share = covered / (sw * sh);
  if (share < 0.05 || share > 0.9) return null;
  // Soft edge at full size, then the product on pure white
  const full = await sharp(mask, { raw: { width: sw, height: sh, channels: 1 } }).resize(w, h, { fit: "fill" }).blur(1).extractChannel(0).raw().toBuffer();
  const outRgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const a = full[i] / 255;
    for (let c = 0; c < 3; c++) outRgb[i * 3 + c] = Math.round(rgb[i * 3 + c] * a + 255 * (1 - a));
  }
  return sharp(outRgb, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

// Returns a PNG of the product on white, or null if the cut-out doesn't look reliable.
export async function cutout(input) {
  const sess = await getSession();
  const { data: rgb, info } = await sharp(input).rotate().flatten({ background: "#ffffff" }).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  // Model input: 1024×1024, scaled to 0–1 and centred on 0.5
  const small = await sharp(rgb, { raw: info }).resize(S, S, { fit: "fill" }).raw().toBuffer();
  const tensor = new Float32Array(3 * S * S);
  for (let i = 0; i < S * S; i++) {
    tensor[i] = small[i * 3] / 255 - 0.5;
    tensor[S * S + i] = small[i * 3 + 1] / 255 - 0.5;
    tensor[2 * S * S + i] = small[i * 3 + 2] / 255 - 0.5;
  }
  const out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor("float32", tensor, [1, 3, S, S]) });
  const pred = out[sess.outputNames[0]].data;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < S * S; i++) { if (pred[i] < lo) lo = pred[i]; if (pred[i] > hi) hi = pred[i]; }
  const m = Buffer.alloc(S * S);
  for (let i = 0; i < S * S; i++) m[i] = Math.round(((pred[i] - lo) / (hi - lo || 1)) * 255);

  // Back to the photo's own size, keep only the main object, check it looks sensible
  // (extractChannel keeps it one channel; otherwise the image library quietly converts it to RGB)
  const mask = await sharp(m, { raw: { width: S, height: S, channels: 1 } }).resize(w, h, { fit: "fill" }).extractChannel(0).raw().toBuffer();
  if (mask.length !== w * h) throw new Error("mask size mismatch");
  let before = 0;
  for (let i = 0; i < w * h; i++) if (mask[i] >= 128) before++;
  keepMainObject(mask, w, h);
  let covered = 0;
  for (let i = 0; i < w * h; i++) if (mask[i] >= 128) covered++;
  const share = covered / (w * h);
  // Quality check: reject the cut-out if it found almost nothing / everything, or if keeping only the main
  // object would throw away a big part of what was detected (a sign the product was split up, e.g. a bag
  // body lost and only the handles kept). The caller then uses the full original photo instead.
  if (share < 0.05 || share > 0.97) return null;
  if (covered < before * 0.75) return null;

  // Product on pure white
  const outRgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const a = mask[i] / 255;
    for (let c = 0; c < 3; c++) outRgb[i * 3 + c] = Math.round(rgb[i * 3 + c] * a + 255 * (1 - a));
  }
  return sharp(outRgb, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}
