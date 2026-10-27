/* ==========================================================
   JP.ReserveCo — loads stock from your Google Sheet
   If STOCK_SHEET_URL (js/data.js) is set, the published sheet replaces the PRODUCTS list.
   Each row is one item; the column headings are listed in docs/stock-sheet-guide.md.
   ========================================================== */
window.loadStock = (function () {
  "use strict";

  // Reads CSV text into rows of cells (handles commas, quotes and line breaks inside cells)
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // "Was price" / "was_price" / "WasPrice" all become "wasprice"
  const key = (h) => h.toLowerCase().replace(/[^a-z]/g, "");
  const yes = (v) => /^(y|yes|true|1|x|✓)$/i.test(v.trim());
  const list = (v) => v.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
  const money = (v) => { const n = parseFloat(v.replace(/[£,\s]/g, "")); return isNaN(n) ? undefined : n; };

  // A photo can be a Google Drive share link, any web link, or a file name in Media/web
  function photoUrl(v) {
    v = v.trim();
    if (!v) return "";
    const drive = v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/);
    if (drive) return `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w1200`;
    if (/^https?:\/\//i.test(v)) return v;
    if (v.startsWith("Media/")) return encodeURI(v);
    return "Media/web/" + encodeURIComponent(v);
  }

  function toProduct(r) {
    const g = (k) => (r[k] || "").trim();
    const p = {
      brand: g("brand"),
      name: g("name") || g("item"),
      price: money(g("price")),
    };
    if (!p.brand || !p.name || p.price === undefined) return null; // skip blank or unfinished rows
    const was = money(g("wasprice"));
    if (was) p.wasPrice = was;
    const cat = g("category").toLowerCase();
    if (cat) p.category = cat;
    ["type", "gender", "size", "condition", "model", "details", "focus"].forEach((k) => { if (g(k)) p[k] = g(k); });
    if (g("line")) p.line = g("line").toLowerCase();
    if (g("colour") || g("color")) {
      const c = list(g("colour") || g("color"));
      p.colour = c.length > 1 ? c : c[0];
    }
    if (g("collections")) p.collections = list(g("collections"));
    if (yes(g("preloved"))) p.preloved = true;
    if (yes(g("sold"))) p.sold = true;
    if (yes(g("set"))) p.set = true;
    p.image = photoUrl(g("photo") || g("image"));
    return p;
  }

  // Supplier stock files (each is { products: [...] }). If a file isn't there, it's skipped.
  //  - js/wholesale-stock.json: imported from your wholesale supplier's sheet (updated when you send a new sheet)
  //  - js/supplier-stock.json:  built every hour by scripts/sync-suppliers.mjs (see .github/workflows/deploy.yml)
  async function loadStockFile(file, onData) {
    try {
      const res = await fetch(file, { cache: "no-cache" });
      if (!res.ok) return [];
      const data = await res.json();
      if (onData) onData(data);
      return Array.isArray(data.products) ? data.products : [];
    } catch (e) {
      return [];
    }
  }

  // Duplicate listings (DUPLICATES in js/data.js) become one: the cheapest listing is kept (its photo
  // and name), with every size any of them has, each at the cheapest price. Your own items are never merged.
  const nameKey = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const sizeNum = (s) => parseFloat(s.replace(/[^\d.]/g, "")) || 0;
  function mergeSupplierItems(items) {
    const groupOf = new Map();
    (typeof DUPLICATES !== "undefined" ? DUPLICATES : []).forEach((names, g) => names.forEach((n) => groupOf.set(nameKey(n), g)));
    const groups = new Map(); // group number -> listings in it
    const out = [];
    for (const p of items) {
      const g = p.sizePrices ? groupOf.get(nameKey(`${p.brand} ${p.name}`)) : undefined;
      if (g === undefined) { out.push(p); continue; }
      if (!groups.has(g)) { groups.set(g, []); out.push({ mergeGroup: g }); } // keeps the first one's place in the list
      groups.get(g).push(p);
    }
    return out.map((p) => {
      if (p.mergeGroup === undefined) return p;
      // Sold copies never win over one that's in stock
      const live = groups.get(p.mergeGroup).filter((item) => !item.sold);
      if (!live.length) return groups.get(p.mergeGroup)[0];
      const keep = live.reduce((a, b) => (b.price < a.price ? b : a));
      const sizePrices = {};
      for (const item of live) {
        for (const [size, price] of Object.entries(item.sizePrices)) {
          if (!(size in sizePrices) || price < sizePrices[size]) sizePrices[size] = price;
        }
      }
      const sizes = Object.keys(sizePrices).sort((a, b) => sizeNum(a) - sizeNum(b));
      return { ...keep, size: sizes, sizePrices: Object.fromEntries(sizes.map((s) => [s, sizePrices[s]])), price: Math.min(...Object.values(sizePrices)) };
    });
  }

  // Labels every item for the menus, from its brand and type, so it shows under the right tabs:
  //  - Clothing/Footwear → Designer (designer houses) or Clothing → Activewear (sportswear brands)
  //  - Activewear → Sets (tracksuits and matching sets)
  //  - Top Trending Collections → Winter Fits (coats, jackets, knits, hoodies, beanies…) and Streetwear (streetwear brands)
  // Anything already labelled in your own stock is kept as you set it.
  const DESIGNER = new Set(["Louis Vuitton", "Dior", "Gucci", "Prada", "Chanel", "Hermès", "Burberry", "Canada Goose", "Moncler",
    "Chrome Hearts", "Loro Piana", "Casablanca", "Stone Island", "C.P. Company", "Balenciaga", "Givenchy", "Valentino", "Fendi",
    "Celine", "Saint Laurent", "Bottega Veneta", "Off-White", "Amiri", "Rick Owens", "Palm Angels", "Marni", "Balmain",
    "Christian Louboutin", "Loewe", "Miu Miu", "Maison Margiela", "Maison Mihara Yasuhiro", "Enfants Riches Deprimes", "Kapital",
    "Goyard", "Marc Jacobs", "See by Chloé", "Vivienne Westwood", "Gallery Dept", "Rhude", "Anine Bing", "Cartier", "Rolex"]);
  const SPORT = new Set(["Nike", "Jordan", "Asics", "Saucony", "Adidas", "New Balance", "Under Armour", "Alo", "Lululemon",
    "Gymshark", "Berghaus", "On", "Hoka", "Salomon", "Arc'teryx", "The North Face", "Patagonia"]);
  const STREET = new Set(["Supreme", "BAPE", "Chrome Hearts", "Amiri", "Gallery Dept", "Denim Tears", "Corteiz", "Fear of God",
    "Palm Angels", "Rhude", "Kith", "Stüssy", "Trapstar", "Valley Dreams", "Represent", "Hellstar", "Sp5der", "Off-White",
    "Matty Boy", "Vintage", "Kapital", "Enfants Riches Deprimes", "Travis Scott"]);
  const WINTER_TYPES = new Set(["Coats", "Jackets", "Gilets", "Jumpers", "Hoodies", "Sweatshirts", "Tracksuits", "Scarves"]);
  function labelForMenus(p) {
    const wearable = p.category === "clothing" || p.category === "footwear";
    if (!p.line && wearable && DESIGNER.has(p.brand)) p.line = "designer";
    if (!p.line && p.category === "clothing" && SPORT.has(p.brand)) p.line = "activewear";
    if (p.line === "activewear" && !p.set && (p.type === "Tracksuits" || /\b(set|tracksuit)\b/i.test(p.name))) p.set = true;
    const collections = new Set(p.collections || []);
    if (WINTER_TYPES.has(p.type) || /beanie|balaclava|scarf|gloves?\b|parka|puffer|fleece/i.test(p.name)) collections.add("Winter Fits");
    if (STREET.has(p.brand)) collections.add("Streetwear");
    if (collections.size) p.collections = [...collections];
    return p;
  }

  // Order on the site: your own items, then wholesale stock, then the hourly supplier stock
  return async function loadStock() {
    const wholesale = loadStockFile("js/wholesale-stock.json"); // download alongside the sheet
    // Supplier stock is re-checked every hour: its items are marked "live", and the time of the last check
    // is kept for the "Live stock · checked 12 min ago" labels
    const supplier = loadStockFile("js/supplier-stock.json", (data) => { window.STOCK_UPDATED = data.updated || null; })
      .then((list) => list.map((p) => ({ ...p, live: true })));
    await loadOwnStock();
    PRODUCTS.push(...mergeSupplierItems([...(await wholesale), ...(await supplier)]));
    PRODUCTS.forEach(labelForMenus);
  };

  async function loadOwnStock() {
    if (typeof STOCK_SHEET_URL === "undefined" || !STOCK_SHEET_URL) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(STOCK_SHEET_URL, { signal: ctrl.signal, cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rows = parseCSV(await res.text()).filter((r) => r.some((c) => c.trim()));
      const headers = (rows.shift() || []).map(key);
      const items = rows
        .map((cells) => toProduct(Object.fromEntries(headers.map((h, i) => [h, cells[i] || ""]))))
        .filter(Boolean);
      PRODUCTS.length = 0;
      PRODUCTS.push(...items);
    } catch (e) {
      // Don't show the sample items if the sheet can't be reached; the shop shows its empty message instead
      console.warn("Stock sheet couldn't be loaded:", e);
      PRODUCTS.length = 0;
    } finally {
      clearTimeout(timer);
    }
  };
})();
