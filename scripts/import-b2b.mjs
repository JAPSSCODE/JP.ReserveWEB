// Turns a B2B supplier's WhatsApp stock posts into shop listings (js/b2b-stock.json + Media/b2b/).
//
// Usage: node scripts/import-b2b.mjs <folder>
//   <folder> holds the unzipped WhatsApp export plus two files made from it:
//     sel.json   the posts to import: { n, t, photos: [file…], text }   (one post = photo(s) + caption)
//     names.txt  one line per item, named by eye from the photos:
//                  post|brand|name|type|colour[|note]     e.g. 6a|Asics|Pink Tee and Black Shorts Set|Sets|Pink
//                "6a" = the first photo of post 6 ("6" = its only/first photo); "6b|=2" = a repost of item 2
//                (the newer post's price and sizes win); "6|-" = skip.
// Prices: the supplier's "£… SHIPPED" price, priced by the shop's rule in scripts/pricing.mjs (rounded up
// to .95). Every price is checked against the rule; supplier costs are never written out.

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { cutout, cutoutByBackground } from "./cutout.mjs";
import { sellPrice, priceOk, RULE_TEXT } from "./pricing.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = process.argv[2];
if (!dir) { console.error("Usage: node scripts/import-b2b.mjs <folder>"); process.exit(1); }
const IMG_DIR = path.join(ROOT, "Media", "b2b");
const CACHE = path.join(dir, "framed");
const IMG_SIZE = 900, IMG_FILL = 0.84;

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const posts = new Map(JSON.parse(await readFile(path.join(dir, "sel.json"), "utf8")).map((p) => [p.n, p]));

// Sizes from the caption: "S/M/L/XL AVAILABLE", "LARGE/XL", "6/6.5/7/…" (UK trainer sizes)
const WORD = { SMALL: "S", MEDIUM: "M", LARGE: "L", XS: "XS", S: "S", M: "M", L: "L", XL: "XL", XXL: "XXL" };
const ORDER = ["XS", "S", "M", "L", "XL", "XXL"];
function sizesOf(text, footwear) {
  for (const line of text.split("\n")) {
    const tokens = line.toUpperCase().replace(/\*/g, "").trim().split(/\s+/)[0].split("/").filter(Boolean);
    if (tokens.length < 1) continue;
    if (footwear && tokens.every((t) => /^\d{1,2}(\.5)?$/.test(t))) return tokens.map((t) => `UK ${t}`);
    if (!footwear && tokens.every((t) => WORD[t])) return [...new Set(tokens.map((t) => WORD[t]))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  }
  return [];
}
const costOf = (text) => Number((text.match(/£\s?(\d+(?:\.\d+)?)\s*SHIPPED/i) || [])[1]) || null;

// Read names.txt: items in post order, with reposts folded into the item they repeat
const items = new Map(); // key ("6a") -> item
const warnings = [];
for (const raw of (await readFile(path.join(dir, "names.txt"), "utf8")).split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const [key, ...rest] = line.split("|").map((s) => s.trim());
  const m = key.match(/^(\d+)([a-z]?)$/);
  if (!m) { warnings.push(`bad line: ${line}`); continue; }
  const post = posts.get(Number(m[1]));
  const photo = m[2] ? m[2].charCodeAt(0) - 97 : 0;
  if (rest[0] === "-") continue;
  if (rest[0].startsWith("=")) {
    const item = items.get(rest[0].slice(1));
    if (!item) { warnings.push(`${key}: repost of unknown ${rest[0]}`); continue; }
    item.posts.push(post); // newer post: its price and sizes are used
    continue;
  }
  const [brand, name, type, colour, note] = rest;
  const footwear = type === "Trainers";
  items.set(key, { key, brand, name, type, colour, note, footwear, photo: post.photos[photo], posts: [post] });
}

const products = [];
for (const item of items.values()) {
  const post = item.posts[item.posts.length - 1];
  const cost = costOf(post.text) ?? costOf(item.posts[0].text);
  const size = sizesOf(post.text, item.footwear).length ? sizesOf(post.text, item.footwear) : sizesOf(item.posts[0].text, item.footwear);
  if (!cost) { warnings.push(`${item.key} ${item.name}: no price in the post, skipped`); continue; }
  if (!size.length) { warnings.push(`${item.key} ${item.name}: no sizes in the post, skipped`); continue; }
  if (!item.photo) { warnings.push(`${item.key} ${item.name}: no photo, skipped`); continue; }
  const price = sellPrice(cost);
  const model = /P-6000/.test(item.name) ? "P6000" : /Air Max/.test(item.name) ? "Air Max" : undefined;
  products.push({
    brand: item.brand,
    name: item.name,
    category: item.footwear ? "footwear" : "clothing",
    type: item.type,
    gender: "Men",
    colour: item.colour,
    condition: item.footwear ? "New with box" : "New with tags",
    details: (item.footwear ? "Brand new in box and 100% authentic." : "Brand new and 100% authentic.")
      + (size.length > 1 ? " The sizes shown are available to order now." : " Available to order now.")
      + (item.note ? " " + item.note : ""),
    ...(item.footwear ? {} : { line: "activewear" }),
    ...(model ? { model } : {}),
    image: "",
    fit: "framed",
    size,
    price,
    t: post.t,
    _cost: cost,
    _photo: item.photo,
  });
}

// Photos: the product cut out onto white (AI model first; colour-difference cut-out if it fails),
// then trimmed, scaled and centred on a 900px square. Cached, so re-runs are quick.
await mkdir(CACHE, { recursive: true });
await rm(IMG_DIR, { recursive: true, force: true });
await mkdir(IMG_DIR, { recursive: true });
let done = 0, plainFallback = 0;
for (const p of products) {
  const file = `${slug(`${p.brand} ${p.name}`)}.webp`;
  const cached = path.join(CACHE, createHash("sha1").update(`1|${p._photo}`).digest("hex") + ".webp");
  if (!existsSync(cached)) {
    const flat = await sharp(path.join(dir, p._photo)).rotate().flatten({ background: "#ffffff" }).png().toBuffer();
    let cut = await cutout(flat).catch(() => null);
    if (!cut) cut = await cutoutByBackground(flat).catch(() => null);
    let out;
    if (cut) {
      const { data, info } = await sharp(cut).raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += info.channels) {
        if (data[i] >= 232 && data[i + 1] >= 232 && data[i + 2] >= 232) data[i] = data[i + 1] = data[i + 2] = 255;
      }
      const white = { r: 255, g: 255, b: 255 };
      const clean = await sharp(data, { raw: info }).png().toBuffer();
      const trimmed = await sharp(clean).trim({ background: white, threshold: 10 }).toBuffer().catch(() => clean);
      const box = Math.round(IMG_SIZE * IMG_FILL), pad = (IMG_SIZE - box) / 2;
      out = sharp(trimmed).resize(box, box, { fit: "contain", background: white })
        .extend({ top: Math.floor(pad), bottom: Math.ceil(pad), left: Math.floor(pad), right: Math.ceil(pad), background: white });
    } else {
      plainFallback++;
      out = sharp(flat).resize(IMG_SIZE, IMG_SIZE, { fit: "contain", background: { r: 255, g: 255, b: 255 } });
    }
    await out.webp({ quality: 82 }).toFile(cached);
  }
  await writeFile(path.join(IMG_DIR, file), await readFile(cached));
  p.image = `Media/b2b/${file}`;
  if (++done % 25 === 0) console.log(`  ${done}/${products.length} photos`);
}

// Price check, then write (newest first; costs and working fields removed)
const bad = products.filter((p) => !priceOk(p.price, p._cost));
if (bad.length) { console.error("Price check failed:", bad.map((p) => p.name)); process.exit(1); }
const profits = products.map((p) => p.price - p._cost);
products.sort((a, b) => b.t.localeCompare(a.t));
const out = products.map(({ t, _cost, _photo, ...p }) => p);
await writeFile(path.join(ROOT, "js", "b2b-stock.json"), JSON.stringify({ updated: new Date().toISOString(), products: out }, null, 1) + "\n");

warnings.forEach((w) => console.warn("  " + w));
console.log(`${out.length} listings written to js/b2b-stock.json (${plainFallback} photos kept on their own background).`);
console.log(`Price check passed: every price follows the pricing rule (${RULE_TEXT}); profit per item £${Math.min(...profits).toFixed(2)}–£${Math.max(...profits).toFixed(2)}.`);
