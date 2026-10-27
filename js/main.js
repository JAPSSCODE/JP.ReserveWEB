// Runs once the stock is ready (from the Google Sheet if one is set in js/data.js — see js/stock.js)
function startSite() {
  "use strict";

  const waLink = (text) =>
    "https://wa.me/" + SITE.whatsapp + "?text=" + encodeURIComponent(text);

  // Whole pounds show as "£1,150"; prices with pence as "£97.95"
  const gbpWhole = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
  const gbpPence = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const gbp = { format: (n) => (Number.isInteger(n) ? gbpWhole : gbpPence).format(n) };

  const escapeHTML = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- WhatsApp links ---------- */
  function wireWhatsApp(root) {
    root.querySelectorAll("[data-wa]").forEach((a) => {
      a.href = waLink(a.dataset.wa);
      a.target = "_blank";
      a.rel = "noopener";
    });
  }

  /* ---------- Contact details ---------- */
  function renderContact() {
    const wa = "+" + SITE.whatsapp.replace(/^44(\d{4})(\d+)/, "44 $1 $2");
    document.getElementById("wa-display").textContent = wa;
    const list = document.getElementById("contact-links");
    if (SITE.instagram) {
      list.insertAdjacentHTML("beforeend",
        `<li><a href="https://instagram.com/${encodeURIComponent(SITE.instagram)}" target="_blank" rel="noopener">Instagram: @${escapeHTML(SITE.instagram)}</a></li>`);
    }
    if (SITE.email) {
      list.insertAdjacentHTML("beforeend",
        `<li><a href="mailto:${escapeHTML(SITE.email)}">${escapeHTML(SITE.email)}</a></li>`);
    }
    document.getElementById("year").textContent = new Date().getFullYear();
  }

  /* ---------- Products ---------- */
  const grid = document.getElementById("product-grid");
  const empty = document.getElementById("empty-state");

  /* ---------- Brand lists (Brands A–Z, Latest Arrivals "Trending Now", Sale "Trending Brands") ---------- */
  // "Hermès" -> "hermes", "AP x Swatch" -> "ap-x-swatch" (accents dropped so links read cleanly)
  const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const brandLinks = (list) => list.map((b) =>
    `<li><a href="#brand-${slug(b)}" data-nav-filter="brand:${escapeHTML(b)}">${escapeHTML(b)}</a></li>`
  ).join("");
  document.getElementById("latest-brands").innerHTML = brandLinks(LATEST_TRENDING_BRANDS);
  document.getElementById("brands-trending").innerHTML = brandLinks(SALE_TRENDING_BRANDS);

  // Brands A–Z: every brand listed in data.js or found in your stock, grouped by first letter
  const allBrands = [...new Set([...TRENDING_BRANDS, ...PRODUCTS.map((p) => p.brand)])]
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  const byLetter = {};
  allBrands.forEach((b) => {
    const letter = b.normalize("NFD")[0].toUpperCase();
    (byLetter[letter] = byLetter[letter] || []).push(b);
  });
  document.getElementById("brands-az").innerHTML = Object.keys(byLetter).map((letter) => `
    <div class="az-group">
      <span class="az-letter" aria-hidden="true">${letter}</span>
      <ul class="mega-links" aria-label="Brands starting with ${letter}">${brandLinks(byLetter[letter])}</ul>
    </div>`).join("");
  document.getElementById("sale-brands").innerHTML = brandLinks(SALE_TRENDING_BRANDS);
  // A filter is one or more parts joined with "+", and an item must match every part, e.g.
  // "clothing+line:activewear+brand:Nike". Parts: "all", a category, "preloved", "saved", "sale",
  // "sale-<category>", "brand:<name>", "line:<activewear|designer>", "set", "model:<slug>" (e.g. "model:air-max"),
  // "type:<slug>" (accessory type, e.g. "type:belts"), "acc" (bags or accessories) and
  // "collection:<slug>" (e.g. "collection:winter-fits").
  const matchesPart = (p, part) => {
    if (part === "all") return true;
    if (part === "acc") return p.category === "bags" || p.category === "accessories";
    if (part.startsWith("type:")) return !!p.type && slug(p.type) === part.slice(5);
    if (part.startsWith("collection:")) return (p.collections || []).some((c) => slug(c) === part.slice(11));
    if (part.startsWith("brand:")) return p.brand.toLowerCase() === part.slice(6).toLowerCase();
    if (part.startsWith("line:")) return p.line === part.slice(5);
    if (part.startsWith("model:")) return !!p.model && slug(p.model) === part.slice(6);
    if (part === "set") return !!p.set;
    if (part === "preloved") return !!p.preloved;
    if (part === "saved") return wishlist.has(p.id);
    if (part === "sale") return !!p.wasPrice;
    if (part.startsWith("sale-")) return !!p.wasPrice && p.category === part.slice(5);
    return p.category === part;
  };
  const matches = (p, filter) => filter.split("+").every((part) => matchesPart(p, part));

  const TITLES = {
    all: "Latest Arrivals", clothing: "Clothing", footwear: "Footwear", bags: "Bags",
    accessories: "Accessories", acc: "Accessories", preloved: "Pre-Loved", sale: "Sale", saved: "Your Wishlist",
    "sale-clothing": "Sale Clothing", "sale-footwear": "Sale Footwear", "sale-accessories": "Sale Accessories",
  };
  const LINE_TITLES = { activewear: "Activewear", designer: "Designer" };

  // Builds headings like "Nike Activewear", "Activewear Sets" or "Prada Designer Clothing"
  function titleFor(filter) {
    if (TITLES[filter]) return TITLES[filter];
    const parts = filter.split("+");
    const brand = parts.find((x) => x.startsWith("brand:"));
    const line = parts.find((x) => x.startsWith("line:"));
    const category = parts.find((x) => TITLES[x] && x !== "all");
    return [
      brand && brand.slice(6),
      line && LINE_TITLES[line.slice(5)],
      // "Designer Clothing" / "Designer Footwear"; "Activewear" stands on its own
      category && line !== "line:activewear" && TITLES[category],
      parts.includes("set") && "Sets",
    ].filter(Boolean).join(" ") || TITLES.all;
  }

  /* ---------- Wishlist (saved on this device only) ---------- */
  // Each item's id (used for its link and the wishlist) comes from its brand and name; repeats get -2, -3…
  const seenIds = {};
  PRODUCTS.forEach((p) => {
    const base = slug(`${p.brand} ${p.name}`);
    seenIds[base] = (seenIds[base] || 0) + 1;
    p.id = seenIds[base] > 1 ? `${base}-${seenIds[base]}` : base;
  });
  const WISH_KEY = "jp-wishlist";
  let wishlist = new Set();
  try { wishlist = new Set(JSON.parse(localStorage.getItem(WISH_KEY) || "[]")); } catch (e) { /* storage blocked — hearts still work for this visit */ }
  const saveWishlist = () => { try { localStorage.setItem(WISH_KEY, JSON.stringify([...wishlist])); } catch (e) {} };
  const savedBtn = document.querySelector('.filter[data-filter="saved"]');
  const savedCount = document.getElementById("saved-count");
  const headerSaved = document.getElementById("header-saved");
  const headerSavedCount = document.getElementById("header-saved-count");
  const savedBar = document.getElementById("saved-bar");
  function updateSavedFilter() {
    const saved = PRODUCTS.filter((p) => wishlist.has(p.id));
    const n = saved.length;
    savedBtn.hidden = n === 0;
    savedCount.textContent = n;
    headerSavedCount.textContent = n;
    headerSavedCount.hidden = n === 0;
    headerSaved.setAttribute("aria-label", n ? `Your wishlist (${n} saved)` : "Your wishlist");
    // One message listing every saved piece with its link, so ordering takes a single tap
    savedBar.hidden = currentFilter !== "saved" || n === 0;
    document.getElementById("saved-enquire").href = waLink(`Hi JP, I'd like to enquire about these pieces from my wishlist:\n\n${
      saved.map((p) => `• ${p.brand} ${p.name}${p.sold ? " (sold, can you source another?)" : ` (${pricesVary(p) ? "from " : ""}${gbp.format(p.price)})`}\n  ${itemUrl(p)}`).join("\n")}`);
  }
  const heartIcon = '<svg aria-hidden="true" class="icon" viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  const heartBtn = (p) =>
    `<button type="button" class="wish-btn" data-wish="${p.id}" aria-pressed="${wishlist.has(p.id)}" aria-label="Save ${escapeHTML(p.brand)} ${escapeHTML(p.name)} to your wishlist">${heartIcon}</button>`;

  // Brief message at the bottom of the screen
  const toast = document.getElementById("toast");
  let toastTimer;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-shown"), 2600);
  }
  function toggleWish(id) {
    if (wishlist.has(id)) wishlist.delete(id); else wishlist.add(id);
    saveWishlist();
    showToast(wishlist.has(id) ? "Saved to your wishlist" : "Removed from your wishlist");
    document.querySelectorAll(`[data-wish="${id}"]`).forEach((b) => b.setAttribute("aria-pressed", String(wishlist.has(id))));
    updateSavedFilter();
    // Un-saving while viewing the wishlist removes it from view (or goes back to everything if it's now empty)
    if (currentFilter === "saved") setFilter(savedBtn.hidden ? "all" : "saved");
  }

  // Items in several sizes (e.g. supplier stock) can have a different price per size: shown as "From £…"
  const sizesOf = (p) => (Array.isArray(p.size) ? p.size : p.size ? [p.size] : []);
  const pricesVary = (p) => !!p.sizePrices && new Set(Object.values(p.sizePrices)).size > 1;
  const priceHTML = (p, size) => {
    if (size && p.sizePrices && p.sizePrices[size] !== undefined) return `<span class="price-now">${gbp.format(p.sizePrices[size])}</span>`;
    if (p.wasPrice) return `<span class="price-now is-sale">${gbp.format(p.price)}</span> <s class="price-was"><span class="sr-only">Was </span>${gbp.format(p.wasPrice)}</s>`;
    return `<span class="price-now">${pricesVary(p) ? '<span class="price-from">From</span> ' : ""}${gbp.format(p.price)}</span>`;
  };
  // "UK 6 – UK 12" for a run of sizes, the single size, or "4 colours" for items sold in colours
  const sizeSummary = (p) => {
    const s = sizesOf(p);
    if (p.option) return s.length > 1 ? `${s.length} ${p.option.toLowerCase()}s` : s[0] || "";
    return s.length > 1 ? `${s[0]} – ${s[s.length - 1]}` : s[0] || "";
  };
  // Photo style: "framed" = already trimmed and centred on white by the supplier sync; "contain" = show whole on white
  const fitClass = (p) => (p.fit === "framed" ? " is-whole is-framed" : p.fit === "contain" ? " is-whole" : "");
  const metaText = (p) => [sizeSummary(p), p.condition].filter(Boolean).join(" · ");

  // Products show PAGE_SIZE at a time; "Show more" adds the next batch. Any new filter, search or sort starts again.
  const PAGE_SIZE = 48;
  let visibleCount = PAGE_SIZE;
  function renderProducts(filter, showMore = false) {
    const scope = PRODUCTS.filter((p) => matches(p, filter));
    const items = sortItems(scope.filter((p) => passesRefine(p)));
    visibleCount = showMore ? visibleCount + PAGE_SIZE : PAGE_SIZE;
    const loadMore = document.getElementById("load-more");
    const remaining = items.length - Math.min(visibleCount, items.length);
    loadMore.hidden = remaining <= 0;
    loadMore.querySelector("span").textContent = `Show more (${remaining} more)`;
    grid.innerHTML = items.slice(0, visibleCount).map((p) => {
      const badge = p.sold ? `<span class="tag tag-sold">Sold</span>` : p.wasPrice ? `<span class="tag tag-sale">Sale</span>`
        : `<span class="tag tag-live"><i class="live-dot"></i>In stock</span>`;
      const meta = metaText(p);
      // The whole card is one button that opens the quick view; the heart sits on top as its own button
      return `
        <li class="product${p.sold ? " is-sold" : ""}">
          <button type="button" class="product-open" data-product="${p.id}" aria-haspopup="dialog">
            <span class="product-media${fitClass(p)}">
              <img src="${escapeHTML(p.image)}" alt="" loading="lazy" style="object-position:${escapeHTML(p.focus || "center")}">
              ${badge}
            </span>
            <span class="product-body">
              <span class="product-brand">${escapeHTML(p.brand)}</span>
              <span class="product-name">${escapeHTML(p.name)}</span>
              ${meta ? `<span class="product-meta">${escapeHTML(meta)}</span>` : ""}
              <span class="product-price">${priceHTML(p)}</span>
            </span>
          </button>
          ${heartBtn(p)}
        </li>`;
    }).join("");
    // Two empty messages: nothing in this section at all, or the filters ruled everything out
    empty.hidden = scope.length > 0;
    const emptyFiltered = document.getElementById("empty-filtered");
    emptyFiltered.hidden = !(scope.length > 0 && items.length === 0);
    emptyFiltered.querySelector("p").textContent = searchQuery
      ? `Nothing in stock matches “${searchQuery}” right now.`
      : "No pieces match your filters.";
    const count = document.getElementById("result-count");
    count.textContent = scope.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : "";
    renderChips();
    if (filterDrawer.open) updatePanel();
  }

  /* ---------- Quick view pop-up ---------- */
  const qv = document.getElementById("quick-view");
  let qvReturnFocus = null;
  let qvProduct = null;
  let hashBeforeQv = "";

  // Every item has its own link, e.g. …/#item-goyard-saint-louis-pm-burgundy, which opens it straight away
  // Posts to a Brevo sign-up form the same way Brevo's own embed script does (?isAjax=1 returns JSON).
  // If the browser blocks reading the reply, it falls back to a blind post, which Brevo still accepts.
  // Resolves { ok, msg }.
  async function brevoPost(formUrl, fields) {
    const body = new URLSearchParams({ ...fields, email_address_check: "", locale: "en" });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(formUrl + (formUrl.includes("?") ? "&" : "?") + "isAjax=1", { method: "POST", body, signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      const msg = data.message || (data.errors && Object.values(data.errors).join(" ")) || "";
      return { ok: res.ok && data.success !== false, msg };
    } catch (err) {
      if (err.name === "AbortError") throw err;
      await fetch(formUrl, { method: "POST", body, mode: "no-cors", signal: ctrl.signal });
      return { ok: true, msg: "" };
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- Live stock: how long ago the supplier stock was checked ---------- */
  // "just now", "12 min ago", "3 hours ago", or "on 23 Oct" (long form: "12 minutes ago")
  function checkedAgo(long) {
    const t = Date.parse(window.STOCK_UPDATED || "");
    if (!t) return "";
    const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} ${long ? (mins === 1 ? "minute" : "minutes") : "min"} ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    return "on " + new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
  function updateLiveStock() {
    const ago = checkedAgo(false);
    const bar = document.getElementById("live-stock");
    bar.hidden = !ago;
    bar.querySelector(".live-ago").textContent = ago;
    document.querySelectorAll(".live-ago-long").forEach((el) => { el.textContent = checkedAgo(true); });
  }
  setInterval(updateLiveStock, 60000);

  const itemHash = (p) => "#item-" + p.id;
  const itemUrl = (p) => location.origin + location.pathname + itemHash(p);

  function openQuickView(id) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    qvProduct = p;
    if (location.hash !== itemHash(p)) {
      hashBeforeQv = location.hash.startsWith("#item-") ? "" : location.hash;
      history.replaceState(null, "", itemHash(p));
    }
    qv.querySelector(".qv-share-status").textContent = "";
    const title = `${p.brand} ${p.name}`;
    qv.querySelector(".qv-media").className = "qv-media" + fitClass(p);
    const img = qv.querySelector(".qv-img");
    img.removeAttribute("src"); // clear the last item's photo so it never shows while the new one loads
    img.src = p.image;
    img.alt = title;
    img.style.objectPosition = p.focus || "center";
    qv.querySelector(".qv-badge").innerHTML = p.sold ? `<span class="tag tag-sold">Sold</span>` : p.wasPrice ? `<span class="tag tag-sale">Sale</span>` : "";
    qv.querySelector(".qv-brand").textContent = p.brand;
    qv.querySelector(".qv-name").textContent = p.name;
    qv.querySelector(".qv-price").innerHTML = priceHTML(p);
    // Live stock line: only on supplier stock, which is re-checked every hour
    const live = qv.querySelector(".qv-live");
    live.hidden = !(p.live && !p.sold && window.STOCK_UPDATED);
    live.querySelector(".live-ago-long").textContent = checkedAgo(true);
    const sizes = sizesOf(p);
    qv.querySelector(".qv-details").innerHTML = describe(p, sizes);
    // Several sizes: a size picker (each size can have its own price)
    const multi = sizes.length > 1 && !p.sold;
    const picker = qv.querySelector(".qv-sizes");
    picker.hidden = !multi;
    picker.querySelector(".qv-size-list").innerHTML = multi ? sizes.map((s) => `
      <label class="qv-size"><input type="radio" name="qv-size" value="${escapeHTML(s)}"><span>${escapeHTML(s)}</span></label>`).join("") : "";
    picker.querySelector(".qv-size-label").textContent = `Select your ${(p.option || "size").toLowerCase()}`;
    const cta = qv.querySelector(".qv-cta");
    cta.textContent = p.sold ? "Source one for me" : "Enquire on WhatsApp";
    updateEnquiry(p, null);
    // "Request your size": for items that come in sizes (or colours), when the one they want isn't listed
    const request = qv.querySelector(".qv-request");
    const option = (p.option || "size").toLowerCase();
    request.hidden = p.sold || !sizes.length || /^one size$/i.test(sizes[0]);
    request.textContent = `Request your ${option}`;
    request.href = waLink(`Hi JP, I'm interested in the ${title} but can't see my ${option}. Could you source it in ${option}: `);
    qv.querySelector(".qv-wish").outerHTML = heartBtn(p).replace('class="wish-btn"', 'class="wish-btn qv-wish"');
    rememberViewed(p);
    renderQvRecent(p);
    // Opening another piece from inside the listing swaps it in place
    if (qv.open) { qv.scrollTop = 0; qv.querySelector(".qv-panel").scrollTop = 0; return; }
    qvReturnFocus = document.activeElement;
    qv.showModal();
    document.body.classList.add("modal-open");
  }

  /* ---------- Recently viewed (saved on this device only) ----------
     The last 8 pieces opened, newest first. Pieces that have sold or gone are left out. */
  const RECENT_KEY = "jp-recent";
  const RECENT_MAX = 8;
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch (e) { /* storage blocked: still works this visit */ }
  const saveRecent = () => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (e) {} };
  const recentItems = (except) => recent.map((id) => PRODUCTS.find((x) => x.id === id)).filter((p) => p && !p.sold && p.id !== except);
  const recentCard = (p) => `
    <li><button type="button" class="recent-item" data-product="${p.id}" aria-label="${escapeHTML(`${p.brand} ${p.name}`)}">
      <span class="recent-media${fitClass(p)}"><img src="${escapeHTML(p.image)}" alt="" loading="lazy" style="object-position:${escapeHTML(p.focus || "center")}"></span>
      <span class="recent-brand">${escapeHTML(p.brand)}</span>
      <span class="recent-name">${escapeHTML(p.name)}</span>
      <span class="recent-price">${priceHTML(p)}</span>
    </button></li>`;
  function rememberViewed(p) {
    recent = [p.id, ...recent.filter((id) => id !== p.id)].slice(0, RECENT_MAX * 2); // spare room for ones that sell
    saveRecent();
    renderRecent();
  }
  function renderRecent() {
    const items = recentItems().slice(0, RECENT_MAX);
    document.getElementById("recent").hidden = !items.length;
    document.getElementById("recent-list").innerHTML = items.map(recentCard).join("");
  }
  // Inside a listing: up to 4 other recent pieces as small photos
  function renderQvRecent(p) {
    const items = recentItems(p.id).slice(0, 4);
    const box = qv.querySelector(".qv-recent");
    box.hidden = !items.length;
    box.querySelector(".qv-recent-list").innerHTML = items.map((x) => `
      <li><button type="button" class="qv-recent-item" data-product="${x.id}" aria-label="${escapeHTML(`${x.brand} ${x.name}`)}" title="${escapeHTML(`${x.brand} ${x.name}`)}">
        <span class="recent-media${fitClass(x)}"><img src="${escapeHTML(x.image)}" alt="" loading="lazy"></span>
      </button></li>`).join("");
  }
  document.getElementById("recent-clear").addEventListener("click", () => {
    recent = [];
    saveRecent();
    renderRecent();
  });
  // The item description in the shop's house format: condition, tags/box, sizes, availability
  function describe(p, sizes) {
    const notes = p.details || "";
    const isNew = /^new/i.test(p.condition || "");
    // Pre-owned: grade from the supplier's score out of 10 (or their own grade), plus any note they gave
    let condition = "Brand New";
    if (!isNew) {
      const m = notes.match(/condition (.+?) and \d+% authentic/i);
      const graded = m ? m[1].replace(/\s*📦/gu, "").trim() : "";
      const score = parseFloat((graded.match(/(\d+(?:\.\d+)?)(?:\s*-\s*[\d.]+)?\s*\/\s*10/) || [])[1]);
      const grade = /^(excellent|very good|good)$/i.test(p.condition) ? p.condition.replace(/\b\w/g, (c) => c.toUpperCase())
        : score >= 9 ? "Excellent" : score >= 7 ? "Good" : score ? "Fair" : "Good";
      condition = graded ? `${grade} (${graded})` : grade;
    }
    // Tags / box, only where the listing says so (never guessed)
    const text = `${p.name} ${p.condition} ${notes}`;
    const pack = /no box|shoes only/i.test(text) ? "No Box"
      : /with box|in box|og box/i.test(text) ? "With Box"
      : /with tags/i.test(text) ? "With Original Tags" : "";
    const option = p.option || "Size";
    const opt = option.toLowerCase();
    const availability = p.sold
      ? `This piece has sold. Looking for one? Send us a message below, and we'll do our best to source it for you.`
      : `The ${opt}s listed above are available to order now. Looking for a different ${opt}? Send us a message below, and we'll do our best to source it for you.`
        + (/pre-order/i.test(notes) ? " Pre-order: we'll confirm the delivery date when you enquire." : "");
    const lines = [["Condition", condition], ["Tags / Box", pack], [option, sizes.join(", ")], ["Availability", availability]].filter(([, v]) => v);
    return lines.map(([k, v]) => `<p><strong>${k}:</strong> ${escapeHTML(v)}</p>`).join("")
      + `<p class="qv-tagline"><strong>Order with confidence — quality pieces, fresh fits, and attention to detail.</strong></p>`;
  }
  // WhatsApp message for the item, including the chosen size and its price
  function updateEnquiry(p, size) {
    const title = `${p.brand} ${p.name}`;
    const sizes = sizesOf(p);
    let text;
    if (p.sold) text = `Hi JP, I saw the ${title} has sold. Can you source another?`;
    else if (size) text = `Hi JP, is the ${title} in ${size} (${gbp.format(p.sizePrices ? p.sizePrices[size] : p.price)}) still available?`;
    else if (sizes.length > 1) text = `Hi JP, is the ${title} still available? My ${(p.option || "size").toLowerCase()} is: `;
    else text = `Hi JP, is the ${title} (${gbp.format(p.price)}${sizes[0] ? ", " + sizes[0] : ""}) still available?`;
    qv.querySelector(".qv-cta").href = waLink(text);
  }
  qv.querySelector(".qv-size-list").addEventListener("change", (e) => {
    const size = e.target.value;
    const p = qvProduct;
    if (!p) return;
    qv.querySelector(".qv-price").innerHTML = priceHTML(p, size);
    qv.querySelector(".qv-size-label").textContent = `${p.option || "Size"}: ${size}`;
    updateEnquiry(p, size);
  });

  function closeQuickView() { if (qv.open) qv.close(); }
  qv.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    // Put the address back to what it was before the item opened
    if (location.hash.startsWith("#item-")) history.replaceState(null, "", hashBeforeQv || location.pathname + location.search);
    qvProduct = null;
    if (qvReturnFocus && document.contains(qvReturnFocus)) qvReturnFocus.focus();
  });
  qv.querySelector(".qv-share").addEventListener("click", async () => {
    const p = qvProduct;
    if (!p) return;
    const status = qv.querySelector(".qv-share-status");
    const url = itemUrl(p);
    const title = `${p.brand} ${p.name}`;
    if (navigator.share) {
      try { await navigator.share({ title, text: `${title} at JP.ReserveCo`, url }); } catch (e) { /* closed the share menu */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = "Link copied. Paste it anywhere to share this item.";
    } catch (e) {
      status.textContent = url; // clipboard blocked: show the link so it can be copied by hand
    }
  });
  // Opening an item link (on arrival, or pasted into the address bar) shows that item
  function openItemFromHash() {
    if (!location.hash.startsWith("#item-")) return false;
    const p = PRODUCTS.find((x) => x.id === location.hash.slice(6));
    if (!p) return false;
    hashBeforeQv = "";
    document.getElementById("stock").scrollIntoView();
    openQuickView(p.id);
    return true;
  }
  window.addEventListener("hashchange", openItemFromHash);
  qv.querySelector(".qv-close").addEventListener("click", closeQuickView);
  // Clicking the dark backdrop (outside the panel) closes it
  qv.addEventListener("click", (e) => { if (e.target === qv) closeQuickView(); });

  // One listener for every card and heart on the page (cards are re-rendered when filters change)
  document.addEventListener("click", (e) => {
    const wish = e.target.closest("[data-wish]");
    if (wish) { toggleWish(wish.dataset.wish); return; }
    const card = e.target.closest("[data-product]");
    if (card) { closeAllMenus(); openQuickView(card.dataset.product); }
  });

  /* ---------- Client reviews: 3D coverflow carousel ----------
     The active review faces forward; the ones either side angle away in 3D. It loops, and
     you can move with the arrows, the dots, a swipe, a click on a side card or the ← → keys. */
  function setupReviews3D() {
    const root = document.getElementById("review-3d");
    const ring = document.getElementById("review-grid");
    const stage = root.querySelector(".review-stage");
    const dots = document.getElementById("review-dots");
    const cards = [...ring.children];
    const n = cards.length;
    let active = 0;
    root.classList.toggle("is-single", n < 2);
    dots.innerHTML = cards.map((_, i) => `<button type="button" class="review-dot" aria-label="Show review ${i + 1} of ${n}"></button>`).join("");

    function layout() {
      const narrow = window.innerWidth < 700;
      cards.forEach((card, i) => {
        let off = i - active;                  // position relative to the front card…
        if (off > n / 2) off -= n;             // …wrapped so the ring loops both ways
        if (off < -n / 2) off += n;
        const dist = Math.abs(off);
        const shift = narrow ? 78 : 64;        // how far side cards sit from the centre (% of card width)
        card.style.transform = `translateX(${off * shift}%) translateZ(${-dist * 180}px) rotateY(${-off * 34}deg)`;
        card.style.opacity = dist === 0 ? 1 : dist === 1 ? 0.45 : 0;
        card.style.zIndex = String(10 - dist);
        card.classList.toggle("is-active", dist === 0);
        card.classList.toggle("is-side", dist === 1);
        card.setAttribute("aria-hidden", String(dist !== 0));
        card.inert = dist !== 0;               // only the front review is read / focusable
        // A review video only plays while its card is at the front (and never auto-plays for reduced motion)
        const video = card.querySelector("video");
        if (video) {
          if (dist === 0 && !reduceMotion() && !video.dataset.userPaused) video.play().catch(() => {});
          else video.pause();
        }
      });
      [...dots.children].forEach((d, i) => d.setAttribute("aria-current", String(i === active)));
    }
    const go = (i) => { active = (i + n) % n; layout(); };

    root.querySelector(".review-3d-prev").addEventListener("click", () => go(active - 1));
    root.querySelector(".review-3d-next").addEventListener("click", () => go(active + 1));
    dots.addEventListener("click", (e) => { const d = e.target.closest(".review-dot"); if (d) go([...dots.children].indexOf(d)); });
    stage.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
    });
    // Clicking a side card brings it to the front; tapping the front card's video pauses / plays it
    ring.addEventListener("click", (e) => {
      const card = e.target.closest(".review");
      if (!card) return;
      if (card.classList.contains("is-side")) { go(cards.indexOf(card)); return; }
      const video = e.target.closest("video");
      if (video) {
        if (video.paused) { delete video.dataset.userPaused; video.play().catch(() => {}); }
        else { video.dataset.userPaused = "1"; video.pause(); }
      }
    });
    // Swipe left/right (touch or mouse drag)
    let startX = null;
    stage.addEventListener("pointerdown", (e) => { startX = e.clientX; });
    stage.addEventListener("pointerup", (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
    });
    stage.addEventListener("pointercancel", () => { startX = null; });
    window.addEventListener("resize", layout);
    layout();
  }

  const stockTitle = document.getElementById("stock-title");

  let currentFilter = "all";
  // title: optional heading from the link that was clicked (its data-title), e.g. "Nike Air Max"
  function setFilter(filter, title) {
    currentFilter = filter;
    savedBar.hidden = filter !== "saved" || savedBtn.hidden;
    resetRefine(); // picking a new section from the menus or tabs starts with a clean set of filters
    const isSale = filter === "sale" || filter.startsWith("sale-");
    document.querySelectorAll(".filter").forEach((b) => {
      const first = filter.split("+")[0];
      const on = b.dataset.filter === filter || (isSale && b.dataset.filter === "sale") || (filter.includes("+") && b.dataset.filter === first);
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    document.querySelectorAll("[data-nav-filter]").forEach((a) => {
      if (a.dataset.navFilter === filter) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
    // Underline the header tab this filter belongs to; each toggle lists its sections in data-current
    let section = filter.split("+")[0];
    if (section.startsWith("brand:")) section = "brand";
    if (section.startsWith("sale")) section = "sale";
    document.querySelectorAll(".nav-drop-toggle[data-current]").forEach((t) => {
      t.classList.toggle("is-current", t.dataset.current.split(" ").includes(section));
    });
    stockTitle.textContent = title || titleFor(filter);
    // Empty message names what's missing, e.g. "Nothing from Asics in stock right now"
    document.getElementById("empty-what").textContent = filter.startsWith("brand:")
      ? `from ${filter.slice(6)}`
      : `in ${stockTitle.textContent}`;
    renderProducts(filter);
  }

  document.querySelectorAll(".filter").forEach((btn) => {
    btn.addEventListener("click", () => setFilter(btn.dataset.filter));
  });

  /* ---------- Filter panel: category, type, gender, brand, size, colour, price and condition ----------
     These narrow down whatever section is showing (e.g. Footwear or a brand page). Within one group,
     ticking several options shows items matching any of them; across groups, items must match every group.
     Each option shows how many items it would give, and is greyed out when that's none. */
  const filterDrawer = document.getElementById("filter-drawer");
  const filterForm = document.getElementById("filter-form");
  const filterOpenBtn = document.getElementById("filter-open");
  const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const categoryLabel = (v) => (FILTERS.categories.find((c) => c.value === v) || { label: v }).label;

  const FACETS = [
    { key: "availability", label: "Availability", values: (p) => [p.sold ? "Sold" : "In stock"] },
    { key: "category", label: "Category", values: (p) => asList(p.category) },
    { key: "type", label: "Product Type", values: (p) => asList(p.type) },
    // Unisex pieces show under Men and Women as well as Unisex
    { key: "gender", label: "Gender", values: (p) => (p.gender === "Unisex" ? ["Men", "Women", "Unisex"] : asList(p.gender)) },
    { key: "brand", label: "Brand", values: (p) => asList(p.brand) },
    // Items sold in colours rather than sizes (option: "Colour", e.g. beanies) don't appear under Size
    { key: "size", label: "Size", values: (p) => (p.option ? [] : asList(p.size)) },
    { key: "colour", label: "Colour", values: (p) => asList(p.colour) },
    { key: "condition", label: "Condition", values: (p) => asList(p.condition) },
  ];
  const refine = {};
  FACETS.forEach((f) => { refine[f.key] = new Set(); });
  const priceStep = FILTERS.priceStep || 50;
  const priceCeil = Math.max(priceStep, Math.ceil(Math.max(0, ...PRODUCTS.map((p) => p.price)) / priceStep) * priceStep);
  let priceMin = 0, priceMax = priceCeil;
  let sortBy = "newest";
  let searchQuery = ""; // set by the header search bar

  // Search matches every word typed against the item's brand, name, type, colour, size and so on
  // (accents and capitals ignored, so "hermes bouncing" finds "Hermès Bouncing Sneaker")
  const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const searchText = (p) => fold([
    p.brand, p.name, p.type, p.model, p.size, p.condition, p.line, p.gender,
    categoryLabel(p.category), ...asList(p.colour), ...(p.collections || []),
    p.preloved && "pre-loved preloved second hand", p.wasPrice && "sale",
  ].filter(Boolean).join(" "));
  const matchesSearch = (p, q) => fold(q).split(/\s+/).filter(Boolean).every((w) => searchText(p).includes(w));

  // Does the item pass every active filter? (optionally ignoring one group, to count that group's options)
  function passesRefine(p, except) {
    if (searchQuery && !matchesSearch(p, searchQuery)) return false;
    if (p.price < priceMin || p.price > priceMax) return false;
    return FACETS.every((f) => f.key === except || refine[f.key].size === 0 || f.values(p).some((v) => refine[f.key].has(v)));
  }
  // Sold items always come after everything in stock, whatever the sort
  function sortItems(items) {
    const soldLast = (a, b) => (a.sold ? 1 : 0) - (b.sold ? 1 : 0);
    if (sortBy === "price-asc") return [...items].sort((a, b) => soldLast(a, b) || a.price - b.price);
    if (sortBy === "price-desc") return [...items].sort((a, b) => soldLast(a, b) || b.price - a.price);
    return [...items].sort(soldLast); // stable: keeps newest-first within each group
  }
  const activeCount = () => FACETS.reduce((n, f) => n + refine[f.key].size, 0) + (priceMin > 0 || priceMax < priceCeil ? 1 : 0);

  function resetRefine() {
    FACETS.forEach((f) => refine[f.key].clear());
    priceMin = 0; priceMax = priceCeil;
    searchQuery = "";
    filterForm.querySelectorAll("input[type=checkbox]").forEach((i) => { i.checked = false; });
    const lo = document.getElementById("price-min"), hi = document.getElementById("price-max");
    if (lo) { lo.value = 0; hi.value = priceCeil; updatePriceUI(); }
  }

  // Options for each group: your list from FILTERS first, then anything else found in your stock
  const withExtras = (listed, found) => [...listed, ...[...new Set(found)].filter((v) => !listed.includes(v)).sort()];
  function optionGroups(key) {
    const all = (fn) => PRODUCTS.flatMap(fn);
    switch (key) {
      case "availability": return [{ options: ["In stock", "Sold"] }];
      case "category":
        return [{ options: withExtras(FILTERS.categories.map((c) => c.value), all((p) => asList(p.category))) }];
      case "type": {
        // Group by category; only the categories relevant to what's showing
        const picked = [...refine.category];
        const scopeCats = [...new Set(PRODUCTS.filter((p) => matches(p, currentFilter)).map((p) => p.category))];
        const cats = picked.length ? picked : currentFilter === "all" || scopeCats.length !== 1 ? Object.keys(FILTERS.types) : scopeCats;
        return cats.map((cat) => ({
          heading: categoryLabel(cat),
          options: withExtras(FILTERS.types[cat] || [], all((p) => (p.category === cat ? asList(p.type) : []))),
        })).filter((g) => g.options.length);
      }
      case "gender": return [{ options: withExtras(FILTERS.genders, all((p) => asList(p.gender))) }];
      case "brand": return [{ options: [...new Set(all((p) => asList(p.brand)))].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })) }];
      case "size": {
        const listed = Object.values(FILTERS.sizes).flat();
        const groups = Object.entries(FILTERS.sizes).map(([heading, options]) => ({ heading, options }));
        const other = [...new Set(all((p) => asList(p.size)))].filter((s) => !listed.includes(s)).sort();
        if (other.length) groups.push({ heading: "Other", options: other });
        return groups;
      }
      case "colour": return [{ options: withExtras(Object.keys(FILTERS.colours), all((p) => asList(p.colour))) }];
      case "condition": return [{ options: withExtras(FILTERS.conditions, all((p) => asList(p.condition))) }];
    }
    return [];
  }

  function optionHTML(key, value) {
    const id = `f-${key}-${slug(value)}`;
    const input = `<input type="checkbox" id="${id}" data-facet="${key}" value="${escapeHTML(value)}"${refine[key].has(value) ? " checked" : ""}>`;
    const label = key === "category" ? categoryLabel(value) : value;
    if (key === "size") {
      return `<label class="fd-pill" for="${id}">${input}<span>${escapeHTML(label)}</span></label>`;
    }
    const swatch = key === "colour"
      ? `<span class="fd-dot" style="background:${escapeHTML(FILTERS.colours[value] || "var(--surface-2)")}" aria-hidden="true"></span>`
      : `<span class="fd-box" aria-hidden="true"></span>`;
    return `<label class="fd-check" for="${id}">${input}${swatch}<span class="fd-label">${escapeHTML(label)}</span><span class="fd-count"></span></label>`;
  }

  function buildPanel() {
    const openByDefault = ["availability", "category", "price"];
    const section = (key, label, body) => {
      const open = openByDefault.includes(key) || (refine[key] && refine[key].size) ? " open" : "";
      return `<details class="fd-section" data-section="${key}"${open}>
        <summary><span>${label}</span><span class="fd-sum" data-sum="${key}"></span>
          <svg aria-hidden="true" class="icon fd-chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></summary>
        <div class="fd-options">${body}</div>
      </details>`;
    };
    const html = FACETS.map((f) => {
      const groups = optionGroups(f.key);
      const isPills = f.key === "size";
      let body = groups.map((g) => `
        ${g.heading ? `<p class="fd-group">${escapeHTML(g.heading)}</p>` : ""}
        <div class="${isPills ? "fd-pills" : f.key === "colour" ? "fd-list fd-colours" : "fd-list"}">${g.options.map((v) => optionHTML(f.key, v)).join("")}</div>`).join("");
      if (f.key === "brand" && groups[0].options.length > 8) {
        body = `<label class="sr-only" for="brand-search">Search brands</label>
          <input type="search" class="fd-search" id="brand-search" placeholder="Search brands" autocomplete="off">` + body;
      }
      let out = section(f.key, f.label, body);
      // The money slider sits after Colour
      if (f.key === "colour") {
        out += section("price", "Price", `
          <div class="fd-price">
            <p class="fd-price-out"><span id="price-min-out"></span><span aria-hidden="true">–</span><span id="price-max-out"></span></p>
            <div class="fd-range">
              <div class="fd-range-track" aria-hidden="true"><div class="fd-range-fill" id="price-fill"></div></div>
              <input type="range" id="price-min" min="0" max="${priceCeil}" step="${priceStep}" value="${priceMin}" aria-label="Minimum price">
              <input type="range" id="price-max" min="0" max="${priceCeil}" step="${priceStep}" value="${priceMax}" aria-label="Maximum price">
            </div>
          </div>`);
      }
      return out;
    }).join("");
    filterForm.innerHTML = html;
    updatePriceUI();
    updatePanel();
  }

  // Refresh the counts, greyed-out options and selected totals without rebuilding (keeps focus in place)
  function updatePanel() {
    const scope = PRODUCTS.filter((p) => matches(p, currentFilter));
    FACETS.forEach((f) => {
      const pool = scope.filter((p) => passesRefine(p, f.key));
      filterForm.querySelectorAll(`input[data-facet="${f.key}"]`).forEach((input) => {
        const n = pool.filter((p) => f.values(p).includes(input.value)).length;
        const label = input.closest("label");
        const count = label.querySelector(".fd-count");
        if (count) count.textContent = n;
        input.disabled = n === 0 && !input.checked;
        label.classList.toggle("is-empty", input.disabled);
        label.title = input.disabled ? "None in stock right now" : "";
      });
      const sum = filterForm.querySelector(`[data-sum="${f.key}"]`);
      if (sum) sum.textContent = refine[f.key].size ? `(${refine[f.key].size})` : "";
    });
    const priceSum = filterForm.querySelector('[data-sum="price"]');
    if (priceSum) priceSum.textContent = priceMin > 0 || priceMax < priceCeil ? "(1)" : "";
    const n = scope.filter((p) => passesRefine(p)).length;
    document.getElementById("filter-apply").textContent = n ? `Show ${n} item${n === 1 ? "" : "s"}` : "No items match";
  }

  function updatePriceUI() {
    const lo = document.getElementById("price-min");
    if (!lo) return;
    document.getElementById("price-min-out").textContent = gbp.format(priceMin);
    document.getElementById("price-max-out").textContent = gbp.format(priceMax) + (priceMax >= priceCeil ? "+" : "");
    const fill = document.getElementById("price-fill");
    fill.style.left = (priceMin / priceCeil) * 100 + "%";
    fill.style.right = (100 - (priceMax / priceCeil) * 100) + "%";
    lo.setAttribute("aria-valuetext", gbp.format(priceMin));
    document.getElementById("price-max").setAttribute("aria-valuetext", gbp.format(priceMax));
  }

  filterForm.addEventListener("change", (e) => {
    const input = e.target;
    if (!input.dataset.facet) return;
    const set = refine[input.dataset.facet];
    if (input.checked) set.add(input.value); else set.delete(input.value);
    // Changing the category changes which product types are relevant, so rebuild that section
    if (input.dataset.facet === "category") {
      const typeSection = filterForm.querySelector('[data-section="type"] .fd-options');
      const keep = new Set(optionGroups("type").flatMap((g) => g.options));
      [...refine.type].forEach((t) => { if (!keep.has(t)) refine.type.delete(t); });
      typeSection.innerHTML = optionGroups("type").map((g) => `
        ${g.heading ? `<p class="fd-group">${escapeHTML(g.heading)}</p>` : ""}
        <div class="fd-list">${g.options.map((v) => optionHTML("type", v)).join("")}</div>`).join("");
    }
    renderProducts(currentFilter);
  });
  filterForm.addEventListener("input", (e) => {
    if (e.target.id === "brand-search") {
      const q = e.target.value.trim().toLowerCase();
      filterForm.querySelectorAll('[data-section="brand"] .fd-check').forEach((l) => {
        l.hidden = !!q && !l.textContent.toLowerCase().includes(q);
      });
      return;
    }
    if (e.target.id !== "price-min" && e.target.id !== "price-max") return;
    const lo = document.getElementById("price-min"), hi = document.getElementById("price-max");
    let a = Number(lo.value), b = Number(hi.value);
    // The two handles can't cross
    if (a > b) { if (e.target === lo) a = b; else b = a; lo.value = a; hi.value = b; }
    priceMin = a; priceMax = b;
    updatePriceUI();
    renderProducts(currentFilter);
  });

  // Active filters as removable chips above the products
  function renderChips() {
    const chips = [];
    if (searchQuery) chips.push({ key: "search", value: "", label: `“${searchQuery}”` });
    FACETS.forEach((f) => refine[f.key].forEach((v) => chips.push({ key: f.key, value: v, label: f.key === "category" ? categoryLabel(v) : v })));
    if (priceMin > 0 || priceMax < priceCeil) chips.push({ key: "price", value: "", label: `${gbp.format(priceMin)} – ${gbp.format(priceMax)}${priceMax >= priceCeil ? "+" : ""}` });
    const list = document.getElementById("filter-chips");
    list.innerHTML = chips.map((c) => `<li><button type="button" class="chip" data-chip="${c.key}" data-value="${escapeHTML(c.value)}" aria-label="Remove filter: ${escapeHTML(c.label)}">${escapeHTML(c.label)}
        <svg aria-hidden="true" class="icon" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button></li>`).join("")
      + (chips.length > 1 ? `<li><button type="button" class="chip-clear" data-chip="all">Clear all</button></li>` : "");
    const n = activeCount();
    const badge = document.getElementById("filter-open-count");
    badge.hidden = n === 0;
    badge.textContent = n;
    filterOpenBtn.setAttribute("aria-label", n ? `Filter, ${n} active` : "Filter");
  }
  document.getElementById("filter-chips").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-chip]");
    if (!chip) return;
    const key = chip.dataset.chip;
    if (key === "all") resetRefine();
    else if (key === "price") { priceMin = 0; priceMax = priceCeil; }
    else if (key === "search") { searchQuery = ""; stockTitle.textContent = titleFor(currentFilter); }
    else refine[key].delete(chip.dataset.value);
    renderProducts(currentFilter);
    // Keep keyboard focus on the chip list rather than losing it with the removed chip
    const next = document.querySelector("#filter-chips button") || filterOpenBtn;
    next.focus();
  });

  function clearAllFilters() { resetRefine(); renderProducts(currentFilter); }
  document.getElementById("filter-clear").addEventListener("click", () => { clearAllFilters(); buildPanel(); });
  document.getElementById("empty-clear").addEventListener("click", clearAllFilters);
  document.getElementById("sort-select").addEventListener("change", (e) => { sortBy = e.target.value; renderProducts(currentFilter); });
  document.getElementById("load-more").addEventListener("click", () => {
    const firstNew = grid.children.length;
    renderProducts(currentFilter, true);
    // Move keyboard focus to the first newly shown item
    const next = grid.children[firstNew];
    if (next) next.querySelector(".product-open").focus({ preventScroll: true });
  });

  filterOpenBtn.addEventListener("click", () => {
    closeAllMenus();
    buildPanel();
    filterDrawer.showModal();
    document.body.classList.add("modal-open");
  });
  const closeFilters = () => { if (filterDrawer.open) filterDrawer.close(); };
  filterDrawer.querySelector(".fd-close").addEventListener("click", closeFilters);
  document.getElementById("filter-apply").addEventListener("click", () => {
    closeFilters();
    stock.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth" });
  });
  filterDrawer.addEventListener("click", (e) => { if (e.target === filterDrawer) closeFilters(); }); // dark backdrop
  filterDrawer.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    filterOpenBtn.focus();
  });

  /* ---------- Header search ----------
     Suggestions appear as you type: matching brands (opens that brand's page) and items (opens the item).
     Enter, or "See all results", shows every match in the shop with a removable search chip. */
  const searchForm = document.getElementById("header-search");
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  const searchClear = document.getElementById("search-clear");
  const searchToggle = document.getElementById("search-toggle");
  let activeOption = -1;

  const options = () => [...searchResults.querySelectorAll('[role="option"]')];
  function closeSuggestions() {
    searchResults.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
    activeOption = -1;
  }
  function setActive(i) {
    const opts = options();
    if (!opts.length) return;
    activeOption = (i + opts.length) % opts.length;
    opts.forEach((o, n) => o.setAttribute("aria-selected", String(n === activeOption)));
    searchInput.setAttribute("aria-activedescendant", opts[activeOption].id);
    opts[activeOption].scrollIntoView({ block: "nearest" });
  }

  function showSuggestions() {
    const q = searchInput.value.trim();
    searchClear.hidden = !q;
    if (!q) { closeSuggestions(); return; }
    const f = fold(q);
    const brands = allBrands.filter((b) => fold(b).includes(f)).slice(0, 3);
    const items = PRODUCTS.filter((p) => matchesSearch(p, q));
    let n = 0;
    const id = () => `search-opt-${n++}`;
    let html = "";
    if (brands.length) {
      html += `<p class="sr-group" role="presentation">Brands</p>` + brands.map((b) =>
        `<div class="sr-option sr-brand-row" role="option" id="${id()}" aria-selected="false" data-brand="${escapeHTML(b)}">
          <span>${escapeHTML(b)}</span><span class="sr-hint">Shop brand</span></div>`).join("");
    }
    if (items.length) {
      html += `<p class="sr-group" role="presentation">Items</p>` + items.slice(0, 5).map((p) =>
        `<div class="sr-option sr-item" role="option" id="${id()}" aria-selected="false" data-item="${p.id}">
          <img src="${escapeHTML(p.image)}" alt=""${p.fit ? ' class="is-whole"' : ""} style="object-position:${escapeHTML(p.focus || "center")}">
          <span class="sr-text"><span class="sr-brand">${escapeHTML(p.brand)}</span><span class="sr-name">${escapeHTML(p.name)}</span></span>
          <span class="sr-price${p.wasPrice ? " is-sale" : ""}">${pricesVary(p) ? "From " : ""}${gbp.format(p.price)}</span></div>`).join("");
      html += `<div class="sr-option sr-all" role="option" id="${id()}" aria-selected="false" data-all>
        See all ${items.length} result${items.length === 1 ? "" : "s"} for “${escapeHTML(q)}”</div>`;
    }
    if (!brands.length && !items.length) {
      html = `<p class="sr-empty">Nothing in stock matches “${escapeHTML(q)}”.<br>
        <a href="#sourcing" data-search-source>Ask us to source it for you</a></p>`;
    }
    searchResults.innerHTML = html;
    searchResults.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
    activeOption = -1;
    searchInput.removeAttribute("aria-activedescendant");
  }

  function finishSearch() {
    closeSuggestions();
    searchForm.classList.remove("is-open");
    searchToggle.setAttribute("aria-expanded", "false");
  }
  function runSearch(q) {
    q = q.trim();
    if (!q) return;
    setFilter("all");
    searchQuery = q;
    stockTitle.textContent = `Results for “${q}”`;
    renderProducts(currentFilter);
    finishSearch();
    stock.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth" });
  }
  function choose(opt) {
    if (opt.dataset.brand !== undefined) {
      const b = opt.dataset.brand;
      setFilter(`brand:${b}`);
      history.replaceState(null, "", `#brand-${slug(b)}`);
      finishSearch();
      stock.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth" });
    } else if (opt.dataset.item) {
      finishSearch();
      openQuickView(opt.dataset.item);
    } else if (opt.dataset.all !== undefined) {
      runSearch(searchInput.value);
    }
  }

  searchInput.addEventListener("input", showSuggestions);
  searchInput.addEventListener("focus", () => { if (searchInput.value.trim()) showSuggestions(); });
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (searchResults.hidden) showSuggestions(); setActive(activeOption + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(activeOption - 1); }
    else if (e.key === "Escape") {
      if (!searchResults.hidden) closeSuggestions();
      else if (searchForm.classList.contains("is-open")) { finishSearch(); searchToggle.focus(); }
    }
  });
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const opt = options()[activeOption];
    if (opt) choose(opt); else runSearch(searchInput.value);
  });
  // Keep focus in the box while clicking a suggestion
  searchResults.addEventListener("mousedown", (e) => { if (e.target.closest(".sr-option")) e.preventDefault(); });
  searchResults.addEventListener("click", (e) => {
    const opt = e.target.closest(".sr-option");
    if (opt) { choose(opt); return; }
    if (e.target.closest("[data-search-source]")) finishSearch();
  });
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchClear.hidden = true;
    closeSuggestions();
    searchInput.focus();
  });
  document.addEventListener("click", (e) => { if (!searchForm.contains(e.target) && e.target !== searchToggle) closeSuggestions(); });
  // Phones: the icon opens the search as a full-width row under the logo
  searchToggle.addEventListener("click", () => {
    const open = !searchForm.classList.contains("is-open");
    searchForm.classList.toggle("is-open", open);
    searchToggle.setAttribute("aria-expanded", String(open));
    if (open) { closeAllMenus(); searchInput.focus(); } else closeSuggestions();
  });

  // Header links like "Footwear" or "Sale" jump to the stock grid with that filter applied
  const stock = document.getElementById("stock");
  document.querySelectorAll("[data-nav-filter]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      closeAllMenus();
      setFilter(a.dataset.navFilter, a.dataset.title);
      history.replaceState(null, "", a.getAttribute("href"));
      stock.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth" });
    });
  });
  function reduceMotion() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

  /* ---------- Mega menu dropdowns (Brands, Sale) ---------- */
  // Each toggle button has aria-controls pointing at its .mega-menu panel. Only one is open at a time.
  const megaMenus = [...document.querySelectorAll(".nav-drop-toggle")].map((toggle) => ({
    toggle,
    menu: document.getElementById(toggle.getAttribute("aria-controls")),
    hoverOpenedAt: 0,
    closeTimer: null,
  }));

  function setMenu(m, open) {
    if (open) megaMenus.forEach((other) => { if (other !== m) setMenu(other, false); });
    m.menu.hidden = !open;
    m.toggle.setAttribute("aria-expanded", String(open));
  }
  function closeAllMenus() { megaMenus.forEach((m) => setMenu(m, false)); }

  megaMenus.forEach((m) => {
    m.toggle.addEventListener("click", () => {
      // A click straight after hover-open shouldn't immediately close it again
      if (!m.menu.hidden && Date.now() - m.hoverOpenedAt < 600) return;
      setMenu(m, m.menu.hidden);
    });

    // Hover opens the panel whenever a mouse is used (checked per movement, so it works however
    // the page was loaded); a short delay stops it closing while you move down into the panel.
    // Touch taps are ignored here and handled by the click above.
    const open = (e) => {
      if (e.pointerType !== "mouse") return;
      clearTimeout(m.closeTimer);
      if (m.menu.hidden) m.hoverOpenedAt = Date.now();
      setMenu(m, true);
    };
    const close = (e) => {
      if (e.pointerType !== "mouse") return;
      m.closeTimer = setTimeout(() => setMenu(m, false), 200);
    };
    [m.toggle, m.menu].forEach((el) => {
      el.addEventListener("pointerenter", open);
      el.addEventListener("pointerleave", close);
    });

    m.menu.addEventListener("focusout", (e) => {
      if (!m.menu.contains(e.relatedTarget) && e.relatedTarget !== m.toggle) setMenu(m, false);
    });
    // Plain links inside (e.g. "View All Brands") close the panel too
    m.menu.querySelectorAll("a:not([data-nav-filter])").forEach((a) => a.addEventListener("click", () => setMenu(m, false)));
  });

  document.addEventListener("click", (e) => {
    megaMenus.forEach((m) => {
      if (!m.menu.hidden && !m.menu.contains(e.target) && !m.toggle.contains(e.target)) setMenu(m, false);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const openMenu = megaMenus.find((m) => !m.menu.hidden);
    if (openMenu) { setMenu(openMenu, false); openMenu.toggle.focus(); }
  });

  // Support shared links such as yoursite.co.uk/#sale
  function linkFromHash() {
    return document.querySelector(`[data-nav-filter][href="${CSS.escape(location.hash)}"]`);
  }

  /* ---------- Reviews ---------- */
  function renderReviews() {
    const star = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';
    // Optional photo or video sits beside the review text
    const media = (r) => {
      if (r.video) return `
        <div class="review-media">
          <video muted loop playsinline preload="auto" aria-label="Video from ${escapeHTML(r.name)} — tap to pause or play">
            <source src="${escapeHTML(r.video)}" type="video/mp4">
          </video>
        </div>`;
      if (r.photo) return `
        <div class="review-media">
          <img src="${escapeHTML(r.photo)}" alt="Photo from ${escapeHTML(r.name)}'s order" loading="lazy" style="object-position:${escapeHTML(r.focus || "center")}">
        </div>`;
      return "";
    };
    document.getElementById("review-grid").innerHTML = REVIEWS.map((r) => `
      <li class="card review${r.photo || r.video ? " has-media" : ""}">
        ${media(r)}
        <div class="review-text">
          <div class="stars" role="img" aria-label="5 out of 5 stars">${star.repeat(5)}</div>
          <blockquote>“${escapeHTML(r.text)}”</blockquote>
          <p class="review-meta"><strong>${escapeHTML(r.name)}</strong>${r.item ? ` · ${escapeHTML(r.item)}` : ""}</p>
        </div>
      </li>`).join("");
  }

  /* ---------- Source or Sell: one section, a toggle switches the form and the text beside it ---------- */
  const modeTabs = [...document.querySelectorAll(".mode-tab")];
  function setMode(mode, focusTab) {
    modeTabs.forEach((tab) => {
      const on = tab.dataset.mode === mode;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden = !on;
      if (on && focusTab) tab.focus();
    });
    document.querySelectorAll("[data-mode-panel]").forEach((p) => { p.hidden = p.dataset.modePanel !== mode; });
  }
  modeTabs.forEach((tab, i) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
    // Left / right arrow keys move between the two options (standard tab behaviour)
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const next = modeTabs[(i + (e.key === "ArrowRight" ? 1 : -1) + modeTabs.length) % modeTabs.length];
      setMode(next.dataset.mode, true);
    });
  });
  // Any link to #sell opens Sell mode; any link to #sourcing opens Source mode
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href="#sell"], a[href="#sourcing"]');
    if (!a) return;
    e.preventDefault();
    setMode(a.getAttribute("href") === "#sell" ? "sell" : "source");
    history.replaceState(null, "", a.getAttribute("href"));
    document.getElementById("sourcing").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth" });
  });
  if (location.hash === "#sell") setMode("sell");

  /* ---------- Newsletter pop-up (Brevo) ----------
     Appears NEWSLETTER.delaySeconds after arrival. Closing it hides it for NEWSLETTER.hideForDays;
     signing up hides it for good. Only switched on once NEWSLETTER.brevoFormUrl is set
     (add ?newsletter to the address to preview it before then). */
  function setupNewsletter() {
    const nl = document.getElementById("newsletter");
    const form = document.getElementById("nl-form");
    const done = document.getElementById("nl-done");
    const status = document.getElementById("nl-status");
    const submit = document.getElementById("nl-submit");
    const footerBtn = document.getElementById("footer-newsletter");
    const preview = new URLSearchParams(location.search).has("newsletter");
    const enabled = !!NEWSLETTER.brevoFormUrl || preview;
    const KEY = "jp-newsletter";
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { /* storage blocked: still works this visit */ }
    const save = (data) => { saved = { ...saved, ...data }; try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {} };

    // Fill in the offer text and photo from the settings
    const offer = NEWSLETTER.offer.charAt(0).toUpperCase() + NEWSLETTER.offer.slice(1);
    nl.querySelector(".nl-offer").textContent = offer;
    const short = (NEWSLETTER.offer.match(/^\d+% off/) || ["exclusive offers"])[0];
    document.querySelectorAll(".nl-offer-short").forEach((el) => { el.textContent = short; });
    document.getElementById("nl-image").src = NEWSLETTER.image;
    footerBtn.hidden = !enabled || saved.subscribed;

    function open() {
      if (nl.open) return;
      // Don't stack on top of the product quick view; try again shortly
      if (document.getElementById("quick-view").open) { setTimeout(open, 8000); return; }
      nl.showModal();
      document.body.classList.add("modal-open");
    }
    nl.addEventListener("close", () => {
      document.body.classList.remove("modal-open");
      if (!saved.subscribed) save({ dismissedAt: Date.now() });
    });
    nl.addEventListener("click", (e) => { if (e.target === nl) nl.close(); }); // click the dark backdrop
    nl.querySelector(".nl-close").addEventListener("click", () => nl.close());
    document.getElementById("nl-decline").addEventListener("click", () => nl.close());
    document.getElementById("nl-done-close").addEventListener("click", () => nl.close());
    footerBtn.addEventListener("click", open);

    const recentlyClosed = saved.dismissedAt && Date.now() - saved.dismissedAt < NEWSLETTER.hideForDays * 864e5;
    if (enabled && !saved.subscribed && (preview || !recentlyClosed)) {
      setTimeout(open, NEWSLETTER.delaySeconds * 1000);
    }

    // Sends the sign-up to the Brevo form, the same way Brevo's own embed script does (?isAjax=1
    // returns JSON). If the browser blocks reading the reply, it falls back to a blind post,
    // which Brevo still accepts. Resolves { ok, msg }.
    const brevoSubscribe = (fields) => brevoPost(NEWSLETTER.brevoFormUrl, { ...fields, OPT_IN: "1" });

    function setError(id, msg) {
      const input = document.getElementById(id);
      const err = document.getElementById(id + "-err");
      err.textContent = msg;
      if (msg) { input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", err.id); }
      else input.removeAttribute("aria-invalid");
      return !msg;
    }
    function showDone(name, already) {
      save({ subscribed: true });
      footerBtn.hidden = true;
      document.getElementById("nl-done-name").textContent = name ? `, ${name}` : "";
      if (already) done.querySelector(".nl-intro").textContent = "You're already subscribed, so look out for our next email.";
      form.hidden = true;
      done.hidden = false;
      done.focus();
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.textContent = ""; status.classList.remove("is-error");
      const fname = document.getElementById("nl-fname").value.trim();
      const email = document.getElementById("nl-email").value.trim();
      const ok = [
        setError("nl-fname", fname ? "" : "Please enter your first name."),
        setError("nl-email", !email ? "Please enter your email." : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "That email doesn't look quite right. Check it and try again."),
        setError("nl-consent", document.getElementById("nl-consent").checked ? "" : "Please tick the box so we can email you."),
      ];
      if (ok.includes(false)) { form.querySelector('[aria-invalid="true"]').focus(); return; }
      if (document.getElementById("nl-trap").value) { showDone(fname); return; } // a bot filled the hidden field

      if (!NEWSLETTER.brevoFormUrl) {
        status.textContent = "Preview only: add your Brevo form link in js/data.js to start collecting sign-ups.";
        status.classList.add("is-error");
        return;
      }
      submit.classList.add("is-loading");
      submit.textContent = "Signing you up…";
      try {
        const res = await brevoSubscribe({ EMAIL: email, FIRSTNAME: fname });
        const msg = new DOMParser().parseFromString(res.msg, "text/html").body.textContent.trim();
        if (res.ok) showDone(fname);
        else if (/already subscribed/i.test(msg)) showDone(fname, true);
        else { status.textContent = msg || "Something went wrong. Please try again."; status.classList.add("is-error"); }
      } catch (err) {
        status.textContent = "We couldn't reach the sign-up service. Check your connection and try again.";
        status.classList.add("is-error");
      } finally {
        submit.classList.remove("is-loading");
        submit.textContent = "Claim my discount";
      }
    });
  }

  /* ---------- Forms → WhatsApp ---------- */
  /* Photo picker: previews with a remove button, up to MAX_PHOTOS per form */
  const MAX_PHOTOS = 6;
  function wirePhotos(form) {
    const input = form.querySelector(".photo-input");
    if (!input) return () => [];
    const grid = document.getElementById(input.id + "-grid");
    const addItem = grid.querySelector(".photo-add-item");
    const count = document.getElementById(input.id + "-count");
    let photos = []; // { file, url }

    function render(note) {
      grid.querySelectorAll(".photo-thumb").forEach((li) => li.remove());
      photos.forEach((p, i) => {
        addItem.insertAdjacentHTML("beforebegin", `
          <li class="photo-thumb">
            <img src="${p.url}" alt="Photo ${i + 1}">
            <button type="button" class="photo-remove" data-remove="${i}" aria-label="Remove photo ${i + 1}">
              <svg aria-hidden="true" class="icon" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </li>`);
      });
      addItem.hidden = photos.length >= MAX_PHOTOS;
      count.textContent = note || (photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"} added` : "");
    }
    input.addEventListener("change", () => {
      const picked = [...input.files].filter((f) => f.type.startsWith("image/"));
      const room = MAX_PHOTOS - photos.length;
      picked.slice(0, room).forEach((file) => photos.push({ file, url: URL.createObjectURL(file) }));
      input.value = ""; // lets the same photo be picked again after removing it
      render(picked.length > room ? `${photos.length} photos added. That's the maximum of ${MAX_PHOTOS}.` : "");
    });
    grid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove]");
      if (!btn) return;
      const [removed] = photos.splice(Number(btn.dataset.remove), 1);
      URL.revokeObjectURL(removed.url);
      render();
      // Keep focus in the photo area after the thumbnail disappears
      (grid.querySelector(".photo-remove") || input).focus();
    });
    return () => photos.map((p) => p.file);
  }

  function wireForm(formId, intro) {
    const form = document.getElementById(formId);
    const getPhotos = wirePhotos(form);
    const status = document.getElementById(formId + "-status");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let firstInvalid = null;
      form.querySelectorAll("[required]").forEach((input) => {
        const err = document.getElementById(input.id + "-err");
        const label = form.querySelector(`label[for="${input.id}"]`).childNodes[0].textContent.trim();
        if (!input.value.trim()) {
          input.setAttribute("aria-invalid", "true");
          input.setAttribute("aria-describedby", [input.getAttribute("aria-describedby"), err.id].filter(Boolean).join(" "));
          err.textContent = `Please enter ${label.toLowerCase()}.`;
          firstInvalid = firstInvalid || input;
        } else {
          input.removeAttribute("aria-invalid");
          err.textContent = "";
        }
      });
      if (firstInvalid) { firstInvalid.focus(); return; }

      const lines = [intro];
      form.querySelectorAll("input[name], select[name], textarea[name]").forEach((el) => {
        if (el.value.trim()) lines.push(`${el.name}: ${el.value.trim()}`);
      });
      const files = getPhotos();
      status.innerHTML = "";

      // Phones: share the photos and the request together through the share menu (the user picks WhatsApp)
      if (files.length && navigator.canShare && navigator.canShare({ files })) {
        const text = lines.join("\n");
        try {
          await navigator.share({ files, text });
          // Some apps drop the text when photos are shared, so offer a one-tap way to send it too
          showFollowUp("Photos shared. If your message didn't come through with them, send it here:", text);
        } catch (err) {
          if (err.name === "AbortError") return; // they closed the share menu
          showFollowUp("Your phone couldn't share the photos. Send your request here, then attach the photos in the chat:", text);
        }
        return;
      }

      // Computers and older phones: open WhatsApp with the text, and remind them to attach their photos
      if (files.length) lines.push(`(I have ${files.length} photo${files.length === 1 ? "" : "s"} to send)`);
      window.open(waLink(lines.join("\n")), "_blank", "noopener");
      if (files.length) {
        status.innerHTML = `<p>WhatsApp is opening. Please attach your ${files.length} photo${files.length === 1 ? "" : "s"} in the chat.</p>`;
      }
    });

    function showFollowUp(message, text) {
      status.innerHTML = `<p>${escapeHTML(message)}</p>
        <a class="btn btn-ghost btn-block" href="${waLink(text)}" target="_blank" rel="noopener">Send message on WhatsApp</a>`;
    }
  }

  /* ---------- Private Client sign-up ----------
     Opened from the hero button (or a link to #private-client). Three short steps: sizes, style, budget.
     Their answers go into a WhatsApp message, so you can send them first look at new stock that suits them. */
  function setupPrivateClient() {
    const dialog = document.getElementById("private-client");
    const form = document.getElementById("pc-form");
    const name = document.getElementById("pc-name");
    const nameErr = document.getElementById("pc-name-err");
    const steps = [...form.querySelectorAll(".pc-step")];
    const LABELS = ["Your sizes", "Your style", "Your budget"];
    const back = document.getElementById("pc-back");
    const next = document.getElementById("pc-next");
    const submit = document.getElementById("pc-submit");
    let step = 1;
    let returnFocus = null;

    function show(n, focus) {
      step = n = Math.min(Math.max(n, 1), steps.length);
      steps.forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
      dialog.style.setProperty("--pc-progress", `${(n / steps.length) * 100}%`);
      document.getElementById("pc-step-label").textContent = `Step ${n} of ${steps.length} · ${LABELS[n - 1]}`;
      back.hidden = n === 1;
      next.hidden = n === steps.length;
      submit.hidden = n !== steps.length;
      dialog.scrollTop = 0;
      if (focus) steps[n - 1].querySelector(".pc-title").focus();
    }
    function nameOk() {
      if (name.value.trim()) return true;
      nameErr.textContent = "Please enter your name.";
      name.setAttribute("aria-invalid", "true");
      name.setAttribute("aria-describedby", nameErr.id);
      name.focus();
      return false;
    }
    steps.forEach((s) => s.querySelector(".pc-title").setAttribute("tabindex", "-1"));
    next.addEventListener("click", () => { if (step === 1 && !nameOk()) return; show(step + 1, true); });
    back.addEventListener("click", () => show(step - 1, true));
    name.addEventListener("input", () => { nameErr.textContent = ""; name.removeAttribute("aria-invalid"); });
    // Enter in a text box moves on a step rather than sending early
    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.tagName === "INPUT" && step < steps.length) { e.preventDefault(); next.click(); }
    });

    const open = () => {
      if (dialog.open) return;
      returnFocus = document.activeElement;
      show(1, false);
      dialog.showModal();
      document.body.classList.add("modal-open");
    };
    document.querySelectorAll("[data-open-pc]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); open(); }));
    dialog.querySelector(".pc-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); }); // click outside the panel
    dialog.addEventListener("close", () => {
      document.body.classList.remove("modal-open");
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    });
    if (location.hash === "#private-client") open();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!nameOk()) { show(1, false); name.focus(); return; }
      const ticked = (group) => [...form.querySelectorAll(`input[name="${group}"]:checked`)].map((c) => c.value);
      const val = (id) => document.getElementById(id).value.trim();
      const brands = [...ticked("brand"), ...val("pc-other").split(",").map((s) => s.trim()).filter(Boolean)];
      const lines = [
        "Hi JP, I'd like to become a Private Client.",
        "",
        `Name: ${val("pc-name")}`,
        ticked("clothing").length && `Clothing size: ${ticked("clothing")[0]}`,
        val("pc-shoes") && `Shoe size: ${val("pc-shoes")}`,
        brands.length && `Favourite brands: ${brands.join(", ")}`,
        ticked("for").length && `Shopping for: ${ticked("for").join(", ")}`,
        ticked("budget").length && `Budget per piece: ${ticked("budget")[0]}`,
        val("pc-notes") && `Anything else: ${val("pc-notes")}`,
      ].filter((l, i) => i === 1 || l); // keeps the blank line after the greeting, drops empty answers
      window.open(waLink(lines.join("\n")), "_blank", "noopener");
    });
  }

  /* ---------- Announcement ticker: tap/click to pause or resume ---------- */
  const ticker = document.getElementById("announce-ticker");
  ticker.addEventListener("click", () => {
    const paused = ticker.getAttribute("aria-pressed") !== "true";
    ticker.setAttribute("aria-pressed", String(paused));
    ticker.setAttribute("aria-label", paused ? "Resume scrolling banner" : "Pause scrolling banner");
  });

  /* ---------- Nav strip scroll hint (phones) ---------- */
  const navStrip = document.getElementById("main-nav");
  const updateNavHint = () => {
    const more = navStrip.scrollWidth - navStrip.clientWidth - navStrip.scrollLeft > 4;
    navStrip.classList.toggle("has-more", more);
  };
  navStrip.addEventListener("scroll", updateNavHint, { passive: true });
  window.addEventListener("resize", updateNavHint);
  updateNavHint();

  /* ---------- Header shadow on scroll ---------- */
  const header = document.querySelector(".site-header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Hero video ---------- */
  const video = document.getElementById("hero-video");
  const videoBtn = document.getElementById("video-toggle");
  if (video && videoBtn) {
    const setPaused = (paused) => {
      if (paused) video.pause(); else video.play().catch(() => setPaused(true));
      videoBtn.setAttribute("aria-pressed", String(paused));
      videoBtn.setAttribute("aria-label", paused ? "Play background video" : "Pause background video");
    };
    videoBtn.addEventListener("click", () => setPaused(!video.paused));
    if (reduce) { video.removeAttribute("autoplay"); setPaused(true); }
  }

  /* ---------- Subtle reveal ---------- */
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -10% 0px" });
    document.querySelectorAll(".section-head, .split-copy, .form:not(.nl-form),.about-photo, .about-copy, .review-3d, .product-grid")
      .forEach((el) => { el.classList.add("reveal"); io.observe(el); });
  }

  /* Menu links with nothing in stock behind them are hidden (they come back when stock arrives).
     A brand letter, or a whole dropdown, with nothing left in it is hidden too. */
  function hideEmptyMenuLinks() {
    // Is this link hidden by us? (Checks up to its dropdown only: closed dropdowns are always "hidden")
    const shown = (el) => {
      for (let n = el; n && !n.classList.contains("mega-menu"); n = n.parentElement) if (n.hidden) return false;
      return true;
    };
    document.querySelectorAll("[data-nav-filter]").forEach((a) => {
      const empty = !PRODUCTS.some((p) => matches(p, a.dataset.navFilter));
      const li = a.closest("li");
      const target = li && li.querySelectorAll("[data-nav-filter]").length === 1 ? li : a;
      target.hidden = empty;
    });
    document.querySelectorAll(".az-group").forEach((g) => {
      g.hidden = ![...g.querySelectorAll("[data-nav-filter]")].some(shown);
    });
    document.querySelectorAll(".nav-drop-toggle").forEach((t) => {
      const menu = document.getElementById(t.getAttribute("aria-controls"));
      const anything = menu && [...menu.querySelectorAll("[data-nav-filter]")].some(shown);
      // A dropdown whose main "View all" link is empty (e.g. Sale with nothing reduced) is hidden as a whole
      const heads = menu ? [...menu.querySelectorAll(".mega-head[data-nav-filter]")] : [];
      const headEmpty = heads.length > 0 && !heads.some(shown);
      t.closest("li").hidden = !anything || headEmpty;
    });
  }
  hideEmptyMenuLinks();

  renderContact();
  updateSavedFilter();
  updateLiveStock();
  renderRecent();
  // Header heart: straight to the wishlist (or a tip on how to use it if nothing's saved yet)
  headerSaved.addEventListener("click", () => {
    if (savedBtn.hidden) { showToast("Tap the heart on any piece to save it here"); return; }
    setFilter("saved");
    stock.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  const hashLink = location.hash ? linkFromHash() : null;
  const initialFilter = hashLink ? hashLink.dataset.navFilter : null;
  setFilter(initialFilter || "all", hashLink ? hashLink.dataset.title : undefined);
  if (initialFilter) requestAnimationFrame(() => stock.scrollIntoView());
  else document.querySelectorAll("[data-nav-filter][aria-current]").forEach((a) => a.removeAttribute("aria-current"));
  renderReviews();
  setupReviews3D();
  wireWhatsApp(document);
  wireForm("sourcing-form", "Hi JP, I'd like to request an item:");
  wireForm("sell-form", "Hi JP, I'd like a valuation on an item I'm selling:");
  setupPrivateClient();
  setupNewsletter();
  openItemFromHash();
}
loadStock().then(startSite);
