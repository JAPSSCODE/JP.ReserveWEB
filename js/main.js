(function () {
  "use strict";

  const waLink = (text) =>
    "https://wa.me/" + SITE.whatsapp + "?text=" + encodeURIComponent(text);

  const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

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
  PRODUCTS.forEach((p) => { p.id = slug(`${p.brand} ${p.name}`); });
  const WISH_KEY = "jp-wishlist";
  let wishlist = new Set();
  try { wishlist = new Set(JSON.parse(localStorage.getItem(WISH_KEY) || "[]")); } catch (e) { /* storage blocked — hearts still work for this visit */ }
  const saveWishlist = () => { try { localStorage.setItem(WISH_KEY, JSON.stringify([...wishlist])); } catch (e) {} };
  const savedBtn = document.querySelector('.filter[data-filter="saved"]');
  const savedCount = document.getElementById("saved-count");
  function updateSavedFilter() {
    const n = PRODUCTS.filter((p) => wishlist.has(p.id)).length;
    savedBtn.hidden = n === 0;
    savedCount.textContent = n;
  }
  const heartIcon = '<svg aria-hidden="true" class="icon" viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  const heartBtn = (p) =>
    `<button type="button" class="wish-btn" data-wish="${p.id}" aria-pressed="${wishlist.has(p.id)}" aria-label="Save ${escapeHTML(p.brand)} ${escapeHTML(p.name)} to your wishlist">${heartIcon}</button>`;

  function toggleWish(id) {
    if (wishlist.has(id)) wishlist.delete(id); else wishlist.add(id);
    saveWishlist();
    document.querySelectorAll(`[data-wish="${id}"]`).forEach((b) => b.setAttribute("aria-pressed", String(wishlist.has(id))));
    updateSavedFilter();
    // Un-saving while viewing the wishlist removes it from view (or goes back to everything if it's now empty)
    if (currentFilter === "saved") setFilter(savedBtn.hidden ? "all" : "saved");
  }

  const priceHTML = (p) => p.wasPrice
    ? `<span class="price-now is-sale">${gbp.format(p.price)}</span> <s class="price-was"><span class="sr-only">Was </span>${gbp.format(p.wasPrice)}</s>`
    : `<span class="price-now">${gbp.format(p.price)}</span>`;
  const metaText = (p) => [p.size, p.condition].filter(Boolean).join(" · ");

  function renderProducts(filter) {
    const items = PRODUCTS.filter((p) => matches(p, filter));
    grid.innerHTML = items.map((p) => {
      const badge = p.sold ? `<span class="tag tag-sold">Sold</span>` : p.wasPrice ? `<span class="tag tag-sale">Sale</span>` : "";
      const meta = metaText(p);
      // The whole card is one button that opens the quick view; the heart sits on top as its own button
      return `
        <li class="product${p.sold ? " is-sold" : ""}">
          <button type="button" class="product-open" data-product="${p.id}" aria-haspopup="dialog">
            <span class="product-media">
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
    empty.hidden = items.length > 0;
  }

  /* ---------- Quick view pop-up ---------- */
  const qv = document.getElementById("quick-view");
  let qvReturnFocus = null;

  function openQuickView(id) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    const title = `${p.brand} ${p.name}`;
    const img = qv.querySelector(".qv-img");
    img.src = p.image;
    img.alt = title;
    img.style.objectPosition = p.focus || "center";
    qv.querySelector(".qv-badge").innerHTML = p.sold ? `<span class="tag tag-sold">Sold</span>` : p.wasPrice ? `<span class="tag tag-sale">Sale</span>` : "";
    qv.querySelector(".qv-brand").textContent = p.brand;
    qv.querySelector(".qv-name").textContent = p.name;
    qv.querySelector(".qv-price").innerHTML = priceHTML(p);
    const facts = [["Size", p.size], ["Condition", p.condition]].filter(([, v]) => v);
    qv.querySelector(".qv-facts").innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHTML(v)}</dd></div>`).join("");
    const details = qv.querySelector(".qv-details");
    details.textContent = p.details || "";
    details.hidden = !p.details;
    const cta = qv.querySelector(".qv-cta");
    cta.textContent = p.sold ? "Source one for me" : "Enquire on WhatsApp";
    cta.href = waLink(p.sold
      ? `Hi JP, I saw the ${title} has sold. Can you source another?`
      : `Hi JP, is the ${title} (${gbp.format(p.price)}${p.size ? ", " + p.size : ""}) still available?`);
    qv.querySelector(".qv-wish").outerHTML = heartBtn(p).replace('class="wish-btn"', 'class="wish-btn qv-wish"');
    qvReturnFocus = document.activeElement;
    qv.showModal();
    document.body.classList.add("modal-open");
  }
  function closeQuickView() { if (qv.open) qv.close(); }
  qv.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    if (qvReturnFocus) qvReturnFocus.focus();
  });
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
    async function brevoSubscribe(fields) {
      const body = new URLSearchParams({ ...fields, OPT_IN: "1", email_address_check: "", locale: "en" });
      const url = NEWSLETTER.brevoFormUrl + (NEWSLETTER.brevoFormUrl.includes("?") ? "&" : "?") + "isAjax=1";
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      try {
        const res = await fetch(url, { method: "POST", body, signal: ctrl.signal });
        const data = await res.json().catch(() => ({}));
        const msg = data.message || (data.errors && Object.values(data.errors).join(" ")) || "";
        return { ok: res.ok && data.success !== false, msg };
      } catch (err) {
        if (err.name === "AbortError") throw err;
        await fetch(NEWSLETTER.brevoFormUrl, { method: "POST", body, mode: "no-cors", signal: ctrl.signal });
        return { ok: true, msg: "" };
      } finally {
        clearTimeout(timer);
      }
    }

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
  function wireForm(formId, intro) {
    const form = document.getElementById(formId);
    form.addEventListener("submit", (e) => {
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
      form.querySelectorAll("input, select, textarea").forEach((el) => {
        if (el.value.trim()) lines.push(`${el.name}: ${el.value.trim()}`);
      });
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

  renderContact();
  updateSavedFilter();
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
  setupNewsletter();
})();
