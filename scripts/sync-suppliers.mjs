// Pulls in-stock items from your Shopify B2B suppliers, adds your markup and writes js/supplier-stock.json,
// which the website loads alongside your own stock.
//
// Supplier links are never written in this file (the repository is public). They come from:
//   - on GitHub: the SUPPLIER_URLS secret (Settings → Secrets and variables → Actions)
//   - on your computer: scripts/suppliers.local.txt (one link per line; this file is git-ignored)
//
// Run locally:  node scripts/sync-suppliers.mjs
//
// Rules
//  - Only sizes the supplier currently has in stock are listed; items with none are left out, unless the
//    supplier is set to soldout=show (then they're listed as "Sold", after everything in stock).
//  - Each supplier can have its own markup (default 15%; see suppliers() below for the settings).
//  - The same new item sold by several suppliers becomes one listing. Each size takes the cheapest
//    supplier that has it, plus that supplier's markup. One-off pre-owned pieces are never merged.
//  - Prices are rounded up to the next .95 (e.g. £97.69 → £97.95, £97.97 → £98.95).
//  - If any supplier can't be reached, the sync stops without changing anything, so items are
//    never removed by mistake.

import { readFile, writeFile, mkdir, rm, copyFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
import { cutout, cutoutByBackground, removeLooseObjects } from "./cutout.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "js", "supplier-stock.json");
const IMG_DIR = path.join(ROOT, "Media", "supplier"); // processed photos (rebuilt each sync, not uploaded to GitHub)
const MARKUP = Number(process.env.MARKUP ?? 0.15);

// Photo framing: every item is trimmed to its edges, scaled so its longest side fills the same share
// of the square, and centred, so all products line up the same size in the grid.
const IMG_SIZE = 900;   // square output, px
const IMG_FILL = 0.84;  // the item's longest side fills 84% of the square (even margin all round)

// ---------- Settings ----------
// Brand names as they should appear on the site, checked against the start of each product title
const BRANDS = [
  ["air jordan", "Jordan"], ["jordan", "Jordan"], ["nike", "Nike"], ["air max", "Nike"], ["air force", "Nike"],
  ["asics", "Asics"], ["saucony", "Saucony"], ["new balance", "New Balance"], ["adidas", "Adidas"],
  ["yeezy", "Yeezy"], ["fear of god", "Fear of God"], ["essentials", "Fear of God"], ["hoka", "Hoka"],
  ["salomon", "Salomon"], ["on running", "On"], ["corteiz", "Corteiz"], ["stussy", "Stüssy"], ["stüssy", "Stüssy"],
  // Designer houses
  ["louis vuitton", "Louis Vuitton"], ["lv", "Louis Vuitton"], ["goyard", "Goyard"], ["chrome hearts", "Chrome Hearts"],
  ["christian dior", "Dior"], ["dior", "Dior"], ["amiri", "Amiri"], ["gucci", "Gucci"], ["rick owens", "Rick Owens"],
  ["hermes", "Hermès"], ["hermès", "Hermès"], ["chanel", "Chanel"], ["prada", "Prada"], ["moncler", "Moncler"],
  ["canada goose", "Canada Goose"], ["stone island", "Stone Island"], ["loro piana", "Loro Piana"],
  ["balenciaga", "Balenciaga"], ["off-white", "Off-White"], ["off white", "Off-White"], ["bottega veneta", "Bottega Veneta"],
  ["celine", "Celine"], ["saint laurent", "Saint Laurent"], ["ysl", "Saint Laurent"], ["fendi", "Fendi"],
  ["burberry", "Burberry"], ["givenchy", "Givenchy"], ["valentino", "Valentino"], ["palm angels", "Palm Angels"],
  ["represent", "Represent"], ["gallery dept", "Gallery Dept"], ["denim tears", "Denim Tears"], ["trapstar", "Trapstar"],
  ["cp company", "C.P. Company"], ["c.p. company", "C.P. Company"], ["arc'teryx", "Arc'teryx"], ["the north face", "The North Face"],
  ["supreme", "Supreme"], ["kith", "Kith"], ["vintage", "Vintage"], ["miu miu", "Miu Miu"], ["loewe", "Loewe"],
  ["cartier", "Cartier"], ["rolex", "Rolex"], ["vivienne westwood", "Vivienne Westwood"], ["maison margiela", "Maison Margiela"],
  ["a bathing ape bape", "BAPE"], ["a bathing ape", "BAPE"], ["bape", "BAPE"], ["see by chloé", "See by Chloé"], ["see by chloe", "See by Chloé"],
  ["marc by marc jacobs", "Marc Jacobs"], ["marc jacobs", "Marc Jacobs"], ["balmain", "Balmain"], ["rayban", "Ray-Ban"], ["ray-ban", "Ray-Ban"],
  ["under armour", "Under Armour"], ["christian louboutin", "Christian Louboutin"], ["kapital", "Kapital"], ["marni", "Marni"],
  ["seiko", "Seiko"], ["rhude", "Rhude"], ["annie bing", "Anine Bing"], ["anine bing", "Anine Bing"], ["matty boy", "Matty Boy"],
  ["travis scott", "Nike"],
];
// Canada Goose sells under model names (e.g. "Wyndham Parka"); these titles keep the model as the name
const CANADA_GOOSE_MODELS = /^(portland|savona|wyndham|chelsea|shelburne|carson|mac ?millan|macmillan|belleville|chilliwack|garson|mackenzie|expedition|langford|crofton|lodge|freestyle|trillium|rossclair|kensington|victoria|montebello|approach|hybridge|constable|emory|citadel|jasper|borden|chateau|cypress|lorette|clair|byward|aurora|camp|junction|everett|paradigm|hendriksen|silverthorne|chilliwack)\b/i;
// Footwear models used by the Footwear menu (model:<slug>)
const MODELS = [
  [/\b1130\b/i, "1130"], [/kayano[\s-]*14/i, "Kayano 14"], [/\bnyc\b/i, "NYC"], [/venture[\s-]*6/i, "Gel Venture 6"],
  [/\bp[\s-]?6000\b/i, "P6000"], [/air[\s-]*max/i, "Air Max"], [/air[\s-]*force/i, "Air Force"],
  [/progrid|pro[\s-]grid/i, "ProGrid Omni 9"],
];
// Words in titles → the colour names used by the site's Colour filter
const COLOURS = {
  black: "Black", carbon: "Black", obsidian: "Black", onyx: "Black", noir: "Black",
  white: "White", sail: "Cream", ivory: "Cream", cream: "Cream", oatmeal: "Beige", sand: "Beige", beige: "Beige", birch: "Beige",
  grey: "Grey", gray: "Grey", slate: "Grey", concrete: "Grey", gravel: "Grey", smoke: "Grey", cement: "Grey",
  silver: "Silver", metallic: "Silver", gold: "Gold",
  navy: "Navy", midnight: "Navy", blue: "Blue", aqua: "Blue", cobalt: "Blue",
  green: "Green", sage: "Green", olive: "Green", fern: "Green", verdigris: "Green", forest: "Green",
  brown: "Brown", mocha: "Brown", chocolate: "Brown", tan: "Tan", khaki: "Beige",
  red: "Red", crimson: "Red", burgundy: "Burgundy", maroon: "Burgundy", wine: "Burgundy",
  pink: "Pink", peony: "Pink", rose: "Pink", purple: "Purple", lilac: "Purple", lavender: "Purple",
  yellow: "Yellow", orange: "Orange",
};
// What an item is, from its title (checked first) or the supplier's product type: [pattern, category, type].
// Order matters: the first match wins (e.g. "wallet" before "bag", "belt bag" before "belt").
const TYPES = [
  [/wallet|card ?holder|cardholder|coin purse|key ?pouch|passport/i, "accessories", "Wallets"],
  [/cross ?body|messenger|sling|belt bag|bum ?bag|waist bag/i, "bags", "Cross Body"],
  [/\bbelts?\b/i, "accessories", "Belts"],
  [/sunglass|eyewear|glasses/i, "accessories", "Sunglasses"],
  [/jewel|\brings?\b|necklace|bracelet|pendant|earring|\bbangle/i, "accessories", "Jewellery"],
  [/\bwatch\b|watches/i, "accessories", "Watches"],
  [/\bhat\b|beanie|\bcap\b|bucket|balaclava|trucker/i, "accessories", "Hats"],
  [/scarf|scarves|gloves?|winter accessor/i, "accessories", "Scarves"],
  [/\btote/i, "bags", "Totes"],
  [/duffel|duffle|keepall|holdall|weekender|travel bag|boston/i, "bags", "Keepall"],
  [/backpack|rucksack/i, "bags", "Backpacks"],
  [/wash ?bag|toiletry|pouch|clutch|pochette|organi[sz]er|vanity/i, "bags", "Pouches"],
  [/\bbags?\b|handbag|shoulder|hobo|neverfull|speedy|saint louis|anjou|artois|saigon|alma|bowling|satchel/i, "bags", "Handbags"],
  [/sandal|\bslides?\b|slider|mule|flip ?flop/i, "footwear", "Sliders"],
  [/loafer|\bboots?\b|derby|oxford|espadrille|\bflats?\b|\bheels?\b|pumps?\b/i, "footwear", "Shoes"],
  [/trainer|sneaker|runner|\bb\d{2}\b|air force|air max|dunk|yeezy|jordan \d|kayano|gel-|1130|progrid|p-?6000/i, "footwear", "Trainers"],
  [/\btee\b|t-?shirts?|\btops?\b|long ?sleeve/i, "clothing", "T-Shirts"],
  [/hoodie|hooded/i, "clothing", "Hoodies"],
  [/tracksuit/i, "clothing", "Tracksuits"],
  [/sweatshirt|crew ?neck/i, "clothing", "Sweatshirts"],
  [/knit|jumper|sweater|cardigan/i, "clothing", "Jumpers"],
  [/parka|\bcoat\b|overcoat|trench/i, "clothing", "Coats"],
  [/gilet|\bvest\b|bodywarmer/i, "clothing", "Gilets"],
  [/jacket|bomber|puffer|windbreaker|anorak|varsity/i, "clothing", "Jackets"],
  [/\bpolo/i, "clothing", "Polos"],
  [/\bshirt/i, "clothing", "Shirts"],
  [/jeans|denim/i, "clothing", "Jeans"],
  [/\bshorts\b|\bswim/i, "clothing", "Shorts"],
  [/jogger|sweatpant|track ?pant|\bpants?\b|trousers?|bottoms/i, "clothing", "Joggers"],
  [/\bshoes?\b|footwear/i, "footwear", "Shoes"],
  [/clothing/i, "clothing", "Clothing"],
];
const CLOTHING_TYPES = TYPES.filter(([, cat]) => cat === "clothing").map(([re, , type]) => [re, type]);
const SKIP = /membership|syncio|gift ?card|subscription|\btest\b|shipping protection/i;
const CLOTHING_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL"];

// ---------- Helpers ----------
const roundTo95 = (x) => {
  let r = Math.floor(x) + 0.95;
  if (r < x - 1e-9) r += 1;
  return Math.round(r * 100) / 100;
};
const norm = (s) => s.toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/['’‘"“”]/g, "")
  .replace(/\bgel[\s-]+/g, "gel ")
  .replace(/\bpro[\s-]*grid\b/g, "progrid")
  .replace(/[-\s]*\b(ss|aw|fw)\d{2}\b/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();

// Shop names to ignore as brands: generic words, plus each supplier's web address (filled in once the
// supplier list is read, so no supplier is named in this file)
const STORE_WORDS = [/supplier/i, /crep/i, /trainer/i];
const isStoreName = (vendor) => {
  const squashed = vendor.toLowerCase().replace(/[^a-z0-9]/g, "");
  return STORE_WORDS.some((w) => (typeof w === "string" ? squashed.includes(w) : w.test(vendor)));
};

function splitBrand(title, vendor) {
  const t = title.trim();
  const low = t.toLowerCase();
  if (CANADA_GOOSE_MODELS.test(t)) return { brand: "Canada Goose", name: t };
  for (const [prefix, brand] of BRANDS) {
    if (low.startsWith(prefix + " ")) {
      // Keep "Air Max"/"Air Force"/"Essentials"/"Travis Scott" in the name; drop a leading brand word
      const keep = ["air max", "air force", "essentials", "travis scott"].includes(prefix);
      let rest = t.slice(prefix.length).trim();
      if (rest.toLowerCase().startsWith(prefix + " ")) rest = rest.slice(prefix.length).trim(); // "Marni Marni …"
      return { brand, name: keep ? t : rest };
    }
  }
  // A "vendor" that's really the supplier's shop name (not a brand) is ignored
  const v = vendor && !isStoreName(vendor) ? vendor : t.split(" ")[0];
  const brand = v === v.toUpperCase() ? v.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : v;
  // Don't repeat the brand in the name ("Marni Marni Black Sabot" → "Black Sabot")
  const name = low.startsWith(brand.toLowerCase() + " ") ? t.slice(brand.length).trim() : t;
  return { brand, name };
}
// Tidies names so each model is written one way: "Gel-1130", "Gel-Kayano 14", "Gel-NYC", "ProGrid Omni 9"
const cleanName = (n) => n
  .replace(/['’‘"“”]/g, "")
  .replace(/\s+-\s+(new|xxs|xs|s|m|l|xl|xxl|xxxl|\dxl|uk\s?\d+(\.5)?|eu\s?\d+|\d{1,2}(\.5)?)\s*$/i, "") // "Wyndham Parka Black - M" → size goes in the size field
  .replace(/\s*\((pre ?order)\)\s*/i, " ")
  .replace(/\s+(trainers|sneakers)\s*$/i, "")                         // "Gel-1130 White Midnight Trainers" → same name as other suppliers
  .replace(/^(pro ?grid)\s+(.+?)\s+(omni 9)$/i, "$1 $3 $2")              // "ProGrid Silver Grey Omni 9" → "ProGrid Omni 9 Silver Grey"
  .replace(/\s*-\s*(SS|AW|FW)\d{2}\b/gi, "")
  .replace(/^(1130|kayano|nyc|venture|nimbus|quantum|kahana)\b/i, "Gel-$1")
  .replace(/\bgel[\s-]+/i, "Gel-")
  .replace(/\bGel-(kayano|nyc|venture|nimbus|quantum|kahana)\b/i, (m, w) => "Gel-" + (w.toUpperCase() === "NYC" ? "NYC" : w[0].toUpperCase() + w.slice(1).toLowerCase()))
  .replace(/\bpro[\s-]*grid\b/i, "ProGrid")
  .replace(/^omni\b/i, "ProGrid Omni")
  .replace(/\b(14|1130|6000|9)s\b/g, "$1")                      // "Kayano 14's" → "Kayano 14"
  .replace(/\b(low|mid|high|retro|og)\b/g, (w) => w === "og" ? "OG" : w[0].toUpperCase() + w.slice(1))
  .replace(/\bmetalic\b/gi, "Metallic").replace(/\bshark skin\b/gi, "Sharkskin")
  .replace(/\b([a-z])([a-z]*)\b/g, (m, a, b) => (m === "x" ? m : a.toUpperCase() + b)) // "cool grey" → "Cool Grey"
  .replace(/\s+/g, " ").trim();

// Size words and codes → the sizes used by the site's filters
const SIZE_WORDS = {
  xxs: "XXS", "xx-small": "XXS", xs: "XS", "x-small": "XS", "extra small": "XS", s: "S", small: "S", m: "M", medium: "M",
  l: "L", large: "L", xl: "XL", "x-large": "XL", "extra large": "XL", xxl: "XXL", "2xl": "XXL", "xx-large": "XXL",
  xxxl: "XXXL", "3xl": "XXXL", "4xl": "4XL", "5xl": "5XL",
};
// kind: "footwear", "clothing" or anything else; decides how bare numbers are read
function sizeOf(product, variant, kind = "footwear") {
  const i = product.options.findIndex((o) => /size|accessor/i.test(o.name));
  let s = String(variant[`option${(i >= 0 ? i : 0) + 1}`] ?? variant.title ?? "").trim();
  if (!s || /^(default title|title|n\/a)$/i.test(s)) return "";
  s = s.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();                 // "Medium (Fits Small)" → "Medium"
  if (/^(os|o\/s|one ?size|osfa|free ?size)$/i.test(s)) return "One size";
  if (SIZE_WORDS[s.toLowerCase()]) return SIZE_WORDS[s.toLowerCase()];
  let m = s.match(/^uk\s*(\d{1,2}(?:\.5)?)$/i) || s.match(/^(\d{1,2}(?:\.5)?)\s*uk$/i);
  if (m) return `UK ${m[1]}`;
  if ((m = s.match(/^eu\s*(\d{2}(?:\.5)?)$/i))) return `EU ${m[1]}`;
  if (kind === "footwear" && (m = s.match(/^(\d{1,2}(?:\.5)?)\s*w$/i))) return `Women's ${m[1]}`;
  if ((m = s.match(/^(eastern|western)$/i))) return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} fit`;
  if ((m = s.match(/^(\d{2})\s*mm$/i))) return `${m[1]}mm`;
  if ((m = s.match(/^(\d{1,2}(?:\.5)?)$/))) {
    const n = Number(m[1]);
    if (kind === "footwear") return n >= 30 ? `EU ${m[1]}` : `UK ${m[1]}`;
    if (kind === "clothing") return n >= 24 && n <= 44 ? `W${m[1]}` : `UK ${m[1]}`; // jeans waists; dress sizes
    return m[1];
  }
  return s.toUpperCase().replace(/^UK(\d)/, "UK $1");
}

// Pre-owned condition from the supplier's description or tags (only for suppliers set to detect it).
// "Condition | 9.5/10" → Excellent; "Brand New With Tags" → new.
const stripHtml = (h) => (h || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
function conditionOf(p) {
  const body = stripHtml(p.body_html);
  const tags = (p.tags || []).map((t) => t.toLowerCase());
  const condText = (body.match(/condition\s*\|?\s*(.{0,40}?)(?:\s+rrp\b|$)/i) || [])[1] || "";
  if (/brand new|new with tags|bnwt|deadstock|unworn/i.test(condText) || /^brand new\b/i.test(body)) return { preloved: false };
  const score = condText.match(/(\d+(?:\.\d+)?)\s*(?:-\s*\d+(?:\.\d+)?)?\s*\/\s*10/);
  if (score) {
    const n = Number(score[1]);
    return { preloved: true, condition: n >= 9.5 ? "Excellent" : n >= 8.5 ? "Very good" : "Good", score: condText.replace(/\s*-\s*$/, "").trim() };
  }
  if (tags.includes("pre-owned") || tags.includes("preloved") || /\bpre-?owned\b|\bworn\b/i.test(body)) return { preloved: true, condition: "Pre-owned" };
  if (tags.includes("new")) return { preloved: false };
  return { preloved: false };
}
const sizeOrder = (s) => {
  const ci = CLOTHING_SIZES.indexOf(s);
  if (ci >= 0) return ci;
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  return isNaN(n) ? 999 : 100 + n;
};
function imageUrl(src) {
  if (!src) return "";
  try { const u = new URL(src.startsWith("//") ? "https:" + src : src); u.searchParams.set("width", "1200"); return u.toString(); }
  catch { return src; }
}
const fileSlug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Background removal runs one photo at a time (it uses every CPU core), while downloads carry on in parallel
let cutoutLock = Promise.resolve();
function runCutout(buf) {
  const result = cutoutLock.then(() => cutout(buf));
  cutoutLock = result.catch(() => {});
  return result;
}

// Finished photos are cached by their source link, so each one is only processed once
// (on GitHub the cache folder is kept between runs). Bump PHOTO_VERSION to redo them all.
const CACHE_DIR = path.join(ROOT, ".cache", "photos");
const PHOTO_VERSION = "3";

// Downloads a product photo and frames it on plain white: the product is cut out from anything else in the
// photo (table, wall, business cards) when `clean` is set or the background isn't plain, then trimmed,
// scaled and centred on a square. Returns the site path of the new photo, or null if it couldn't be
// processed (the original is used).
async function framePhoto(url, name, { clean = false } = {}) {
  try {
    const file = `${fileSlug(name)}.webp`;
    const cached = path.join(CACHE_DIR, createHash("sha1").update(`${PHOTO_VERSION}|${clean ? "clean" : ""}|${url}`).digest("hex") + ".webp");
    // A cached photo is reused only if it opens (a run stopped mid-write can leave an empty file)
    if (existsSync(cached) && await sharp(cached).metadata().then(() => true, () => false)) {
      await copyFile(cached, path.join(IMG_DIR, file));
      return `Media/supplier/${file}`;
    }
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (stock sync)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let flat = await sharp(Buffer.from(await res.arrayBuffer())).rotate().flatten({ background: "#ffffff" }).toBuffer();
    // Background colour = the corner pixels; it's "plain" if all four corners are near-white and match
    const { width, height } = await sharp(flat).metadata();
    const corners = await Promise.all([[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].map(async ([left, top]) =>
      [...(await sharp(flat).extract({ left, top, width: 1, height: 1 }).raw().toBuffer())]));
    let plain = corners.every((c) => c.every((v) => v >= 225) && c.every((v, i) => Math.abs(v - corners[0][i]) <= 12));
    if (!plain) {
      // Shot on a table, wall or floor: cut the product out with the AI model. If that fails its quality
      // check, the product is separated from the background colour instead; if that fails too, the full
      // original photo is used (fitted, not cropped) so nothing is ever cut off.
      const cut = await runCutout(flat).catch((e) => { console.warn(`  Background not removed for "${name}" (${e.message})`); return null; })
        ?? await cutoutByBackground(flat).catch(() => null);
      if (cut) { flat = cut; plain = true; }
    } else if (clean) {
      // Already on white: just remove separate loose objects (e.g. a business card beside the product)
      flat = await removeLooseObjects(flat);
    }
    let out;
    if (plain) {
      // Off-white studio backgrounds (light grey, cream) become pure white, so every tile matches
      const { data, info } = await sharp(flat).raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += info.channels) {
        if (data[i] >= 232 && data[i + 1] >= 232 && data[i + 2] >= 232) data[i] = data[i + 1] = data[i + 2] = 255;
      }
      const white = { r: 255, g: 255, b: 255 };
      const clean = await sharp(data, { raw: info }).png().toBuffer();
      const trimmed = await sharp(clean).trim({ background: white, threshold: 10 }).toBuffer().catch(() => clean);
      const box = Math.round(IMG_SIZE * IMG_FILL);
      const pad = (IMG_SIZE - box) / 2;
      out = sharp(trimmed)
        .resize(box, box, { fit: "contain", background: white })
        .extend({ top: Math.floor(pad), bottom: Math.ceil(pad), left: Math.floor(pad), right: Math.ceil(pad), background: white });
    } else {
      out = sharp(flat).resize(IMG_SIZE, IMG_SIZE, { fit: "contain", background: { r: 255, g: 255, b: 255 } });
    }
    await mkdir(CACHE_DIR, { recursive: true });
    await out.webp({ quality: 82 }).toFile(cached);
    await copyFile(cached, path.join(IMG_DIR, file));
    return `Media/supplier/${file}`;
  } catch (e) {
    console.warn(`  Photo not processed for "${name}" (${e.message}); using the original.`);
    return null;
  }
}

// Runs async jobs a few at a time (kinder to the suppliers' servers than all at once)
async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

async function fetchJSON(url, tries = 3) {
  for (let a = 1; ; a++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (stock sync)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (a >= tries) throw e;
      await new Promise((r) => setTimeout(r, 2000 * a));
    }
  }
}
async function fetchCatalogue(base) {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const { products = [] } = await fetchJSON(`${base}/products.json?limit=250&page=${page}`);
    all.push(...products);
    if (products.length < 250) break;
  }
  return all;
}

// One supplier per line, optionally followed by settings:
//   https://example.com                         → default markup (MARKUP, 15%), in-stock items only
//   https://example.com markup=0.10 soldout=show condition=detect
//     markup=0.10      10% on this supplier
//     soldout=show     also list sold-out items, marked "Sold" (with "Source one for me"), after everything in stock
//     condition=detect read pre-owned condition from the supplier's descriptions/tags (one-off items stay separate)
//     photos=clean     cut every product out onto plain white (removes tables, walls, business cards, logos)
async function suppliers() {
  let raw = process.env.SUPPLIER_URLS || "";
  if (!raw) {
    try { raw = await readFile(path.join(ROOT, "scripts", "suppliers.local.txt"), "utf8"); } catch {}
  }
  const list = [];
  for (const line of raw.split(/\r?\n/)) {
    const parts = line.trim().split(/[\s,]+/).filter(Boolean);
    for (const [i, part] of parts.entries()) {
      if (!/^https?:\/\//.test(part)) continue;
      const opts = Object.fromEntries(parts.slice(i + 1).filter((x) => x.includes("=")).map((x) => x.split("=")));
      list.push({
        url: part.replace(/\/+$/, ""),
        markup: opts.markup !== undefined ? Number(opts.markup) : MARKUP,
        soldout: opts.soldout === "show",
        detect: opts.condition === "detect",
        clean: opts.photos === "clean",
      });
    }
  }
  return list;
}

function classify(p) {
  const hit = TYPES.find(([re]) => re.test(p.title)) || TYPES.find(([re]) => re.test(p.product_type || ""));
  if (hit) return { category: hit[1], type: hit[2] };
  // No keyword: letter sizes mean clothing, UK/EU sizes mean trainers, otherwise an accessory
  if (p.variants.some((v) => CLOTHING_SIZES.includes(sizeOf(p, v, "clothing")))) return { category: "clothing", type: "Clothing" };
  if (p.variants.some((v) => /^(UK|EU) /.test(sizeOf(p, v, "footwear")))) return { category: "footwear", type: "Trainers" };
  return { category: "accessories", type: "Accessories" };
}

// ---------- Main ----------
const sources = await suppliers();
for (const { url } of sources) {
  const host = new URL(url).hostname.replace(/^www\./, "").split(".")[0].replace(/[^a-z0-9]/g, "");
  if (host.length >= 4) STORE_WORDS.push(host, host.replace(/uk$|store$|clo$/, "")); // "shopuk" → also "shop"
}
if (!sources.length) {
  console.error("No supplier links found. Set SUPPLIER_URLS or create scripts/suppliers.local.txt.");
  process.exit(1);
}

const merged = new Map(); // key -> listing in stock
const soldOnly = [];      // sold-out listings (suppliers with soldout=show)
let seen = 0, skipped = 0;
for (const [n, src] of sources.entries()) {
  let catalogue;
  try { catalogue = await fetchCatalogue(src.url); }
  catch (e) {
    console.error(`Supplier ${n + 1} couldn't be reached (${e.message}). Stopping without changes.`);
    process.exit(1);
  }
  console.log(`Supplier ${n + 1}: ${catalogue.length} products (${Math.round(src.markup * 100)}% markup${src.soldout ? ", sold-out shown" : ""})`);
  for (const p of catalogue) {
    seen++;
    if (SKIP.test(p.title) || SKIP.test(p.product_type || "")) { skipped++; continue; }
    const { brand, name } = splitBrand(p.title, p.vendor);
    const title = `${brand} ${cleanName(name)}`;
    const { category, type } = classify(p);
    const cond = src.detect ? conditionOf(p) : { preloved: false };
    const sizes = {}, costs = {}; // selling price and the supplier's cost for each size in stock
    const allSizes = [];
    let cheapest = Infinity;
    for (const v of p.variants) {
      const price = Number(v.price);
      if (!(price > 5)) continue;
      const size = sizeOf(p, v, category) || "One size";
      allSizes.push(size);
      cheapest = Math.min(cheapest, price);
      if (!v.available) continue;
      const sell = roundTo95(price * (1 + src.markup));
      if (!(size in sizes) || sell < sizes[size]) { sizes[size] = sell; costs[size] = { cost: price, markup: src.markup }; }
    }
    const inStock = Object.keys(sizes).length > 0;
    if (!inStock && !(src.soldout && cheapest < Infinity)) continue; // sold out and not shown

    const words = norm(p.title).split(" ");
    const colours = [...new Set(words.map((w) => COLOURS[w]).filter(Boolean))];
    const model = category === "footwear" ? (MODELS.find(([re]) => re.test(p.title)) || [])[1] : null;
    const preorder = /pre ?order/i.test(p.title);
    const noBox = /no box/i.test(p.title);
    const intro = stripHtml(p.body_html).slice(0, 40);
    const women = /\b(wmns|women|womens|ladies)\b|\(w\)/i.test(p.title + " " + intro) || (p.tags || []).some((t) => /^wom[ae]n/i.test(t));
    const base = {
      brand,
      name: cleanName(name),
      category, type,
      gender: women ? "Women" : "Unisex",
      condition: cond.condition || (category === "footwear" ? (noBox ? "New" : "New with box") : "New with tags"),
      details: (cond.preloved
        ? `Pre-owned${cond.score ? `, condition ${cond.score}` : ""} and 100% authentic.`
        : category === "footwear" ? (noBox ? "Brand new (no box) and 100% authentic." : "Brand new in box and 100% authentic.") : "Brand new and 100% authentic.")
        + (inStock ? (Object.keys(sizes).length > 1 ? " The sizes shown are available to order now." : " Available to order now.") : "")
        + (preorder ? " Pre-order: we'll confirm the delivery date when you enquire." : ""),
      image: imageUrl(p.images?.[0]?.src),
      fit: "contain",
      sizePrices: {},
      createdAt: p.created_at || "",
    };
    if (colours.length) base.colour = colours.length > 1 ? colours : colours[0];
    if (model) base.model = model;
    if (cond.preloved) base.preloved = true;
    if (src.clean) base.cleanPhoto = true; // used only while framing photos, never published

    if (!inStock) {
      // Sold out: shown as "Sold" at the price it would sell for (cost + markup), with no sizes to pick
      soldOnly.push({
        ...base, sold: true, key: norm(title),
        size: [...new Set(allSizes)].filter((s) => s !== "One size"),
        price: roundTo95(cheapest * (1 + src.markup)), soldCost: { cost: cheapest, markup: src.markup },
      });
      continue;
    }
    // One-off pre-owned pieces are never merged with other listings; new items merge by name across suppliers
    const key = cond.preloved ? `${n}|${p.handle}` : norm(title);
    let item = merged.get(key);
    if (!item) { item = { ...base, sizeCosts: {} }; merged.set(key, item); }
    for (const [size, price] of Object.entries(sizes)) {
      if (!(size in item.sizePrices) || price < item.sizePrices[size]) { item.sizePrices[size] = price; item.sizeCosts[size] = costs[size]; }
    }
    if (!item.image) item.image = imageUrl(p.images?.[0]?.src);
    if ((p.created_at || "") > item.createdAt) item.createdAt = p.created_at;
  }
}

// In stock first (newest first), then sold items (newest first). A sold item is dropped if the same
// thing is in stock from another supplier, or is already shown as sold.
const inStockList = [...merged.values()]
  .filter((p) => p.image)
  .map((p) => {
    const order = Object.keys(p.sizePrices).sort((a, b) => sizeOrder(a) - sizeOrder(b));
    const sizePrices = Object.fromEntries(order.map((s) => [s, p.sizePrices[s]]));
    return { ...p, sizePrices, size: order, price: Math.min(...Object.values(sizePrices)) };
  })
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const inStockKeys = new Set(merged.keys());
const soldSeen = new Set();
const soldList = soldOnly
  .filter((p) => {
    const k = p.key + "|" + p.size.join(",");
    if (!p.image || inStockKeys.has(p.key) || soldSeen.has(k)) return false;
    soldSeen.add(k);
    return true;
  })
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const products = [...inStockList, ...soldList].map(({ createdAt, key, ...p }) => p);

// Frame every photo the same way. Existing photos are overwritten in place (never emptied first, so a run
// that stops part-way leaves the site's photos intact); photos of items that have gone are removed after.
await mkdir(IMG_DIR, { recursive: true });
let framed = 0;
const usedNames = new Map();
await inBatches(products, 8, async (p) => {
  let fileName = `${p.brand} ${p.name}${p.size.length === 1 ? " " + p.size[0] : ""}${p.sold ? " sold" : ""}`;
  const k = fileSlug(fileName);
  usedNames.set(k, (usedNames.get(k) || 0) + 1);
  if (usedNames.get(k) > 1) fileName += ` ${usedNames.get(k)}`;
  const local = await framePhoto(p.image, fileName, { clean: !!p.cleanPhoto });
  if (local) { p.image = local; p.fit = "framed"; framed++; }
});
console.log(`Framed ${framed} of ${products.length} photos`);
const inUse = new Set(products.map((p) => path.basename(p.image)));
for (const f of await readdir(IMG_DIR)) if (!inUse.has(f)) await rm(path.join(IMG_DIR, f), { force: true });

// Safety check: every price must be at least cost + that supplier's markup (and, after rounding up to
// .95, less than £1 more). If anything fails, stop without publishing so a wrong price never goes live.
const problems = [];
let checked = 0;
const margins = {};
const check = (label, sell, c) => {
  const floor = c.cost * (1 + c.markup);
  checked++;
  if (!(c.cost > 0) || sell < floor - 1e-9 || sell - floor >= 1) problems.push(`${label}: cost £${c.cost}, price £${sell}`);
  const pct = Math.round(c.markup * 100), m = ((sell - c.cost) / c.cost) * 100;
  margins[pct] = [Math.min(margins[pct]?.[0] ?? Infinity, m), Math.max(margins[pct]?.[1] ?? 0, m)];
};
for (const p of products) {
  if (p.sold) check(`${p.brand} ${p.name} (sold)`, p.price, p.soldCost);
  else for (const [size, sell] of Object.entries(p.sizePrices)) check(`${p.brand} ${p.name} ${size}`, sell, p.sizeCosts[size]);
}
if (problems.length) {
  console.error(`Price check FAILED for ${problems.length} prices. Nothing was published:\n  ` + problems.join("\n  "));
  process.exit(1);
}
console.log(`Price check passed: ${checked} prices, all at cost + markup rounded up to .95. ` +
  Object.entries(margins).map(([pct, [lo, hi]]) => `${pct}% suppliers: margins ${lo.toFixed(1)}%-${hi.toFixed(1)}%`).join("; "));

// Cost prices are only used for the check above and are never published
for (const p of products) { delete p.sizeCosts; delete p.soldCost; delete p.cleanPhoto; }
await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), products }, null, 1) + "\n");
console.log(`Checked ${seen} products (${skipped} non-stock items skipped): ${inStockList.length} in stock + ${soldList.length} sold = ${products.length} listings written to js/supplier-stock.json`);
