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

  /* ---------- Trending brands (Brands + Sale menus, and the "Brands we source" strip) ---------- */
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const brandLinks = (list) => list.map((b) =>
    `<li><a href="#brand-${slug(b)}" data-nav-filter="brand:${escapeHTML(b)}">${escapeHTML(b)}</a></li>`
  ).join("");
  document.querySelectorAll(".trending-brands, #brand-list").forEach((ul) => { ul.innerHTML = brandLinks(TRENDING_BRANDS); });
  document.getElementById("sale-brands").innerHTML = brandLinks(SALE_TRENDING_BRANDS);

  // A filter is one or more parts joined with "+", and an item must match every part, e.g.
  // "clothing+line:activewear+brand:Nike". Parts: "all", a category, "preloved", "saved", "sale",
  // "sale-<category>", "brand:<name>", "line:<activewear|designer>", "set", "model:<slug>" (e.g. "model:air-max").
  const matchesPart = (p, part) => {
    if (part === "all") return true;
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
    accessories: "Accessories", preloved: "Pre-Loved", sale: "Sale", saved: "Your Wishlist",
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
    grid.scrollLeft = 0;
    requestAnimationFrame(updateCarousel);
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
    if (card) openQuickView(card.dataset.product);
  });

  /* ---------- Latest Arrivals carousel ---------- */
  const carousel = document.getElementById("stock-carousel");
  const prevBtn = carousel.querySelector(".carousel-prev");
  const nextBtn = carousel.querySelector(".carousel-next");
  const progress = document.querySelector(".carousel-progress");
  const bar = document.getElementById("carousel-bar");

  function updateCarousel() {
    const max = grid.scrollWidth - grid.clientWidth;
    const scrollable = max > 2;
    prevBtn.disabled = !scrollable || grid.scrollLeft <= 2;
    nextBtn.disabled = !scrollable || grid.scrollLeft >= max - 2;
    progress.hidden = !scrollable;
    if (scrollable) {
      const visible = grid.clientWidth / grid.scrollWidth;
      bar.style.width = visible * 100 + "%";
      bar.style.transform = `translateX(${(grid.scrollLeft / max) * (1 / visible - 1) * 100}%)`;
    }
    // Keep the arrows level with the middle of the product photos
    const img = grid.querySelector(".product-media");
    if (img) carousel.style.setProperty("--card-img-h", img.offsetHeight + "px");
  }

  // Each arrow moves one "page" of cards; snap points line the next card up neatly
  const page = (dir) => grid.scrollBy({ left: dir * grid.clientWidth, behavior: reduceMotion() ? "auto" : "smooth" });
  prevBtn.addEventListener("click", () => page(-1));
  nextBtn.addEventListener("click", () => page(1));
  grid.addEventListener("scroll", () => requestAnimationFrame(updateCarousel), { passive: true });
  window.addEventListener("resize", updateCarousel);
  grid.addEventListener("load", updateCarousel, true); // re-measure as product photos load

  const stockTitle = document.getElementById("stock-title");

  let currentFilter = "all";
  function setFilter(filter) {
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
    document.getElementById("sale-toggle").classList.toggle("is-current", isSale);
    document.getElementById("brands-toggle").classList.toggle("is-current", filter.startsWith("brand:"));
    document.getElementById("clothing-toggle").classList.toggle("is-current", filter.split("+")[0] === "clothing");
    document.getElementById("footwear-toggle").classList.toggle("is-current", filter.split("+")[0] === "footwear");
    // Menu links can set their own heading with data-title (e.g. "Nike Air Max")
    const titled = document.querySelector(`[data-nav-filter="${CSS.escape(filter)}"][data-title]`);
    stockTitle.textContent = titled ? titled.dataset.title : titleFor(filter);
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
      setFilter(a.dataset.navFilter);
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
  function filterFromHash() {
    const link = document.querySelector(`[data-nav-filter][href="${CSS.escape(location.hash)}"]`);
    return link ? link.dataset.navFilter : null;
  }

  /* ---------- Reviews ---------- */
  function renderReviews() {
    const star = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';
    document.getElementById("review-grid").innerHTML = REVIEWS.map((r) => `
      <li class="card review">
        <div class="stars" role="img" aria-label="5 out of 5 stars">${star.repeat(5)}</div>
        <blockquote>“${escapeHTML(r.text)}”</blockquote>
        <p class="review-meta"><strong>${escapeHTML(r.name)}</strong>${r.item ? ` · ${escapeHTML(r.item)}` : ""}</p>
      </li>`).join("");
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
    document.querySelectorAll(".section-head, .split-copy, .form, .about-photo, .about-copy, .review-grid, .product-grid")
      .forEach((el) => { el.classList.add("reveal"); io.observe(el); });
  }

  renderContact();
  updateSavedFilter();
  const initialFilter = location.hash ? filterFromHash() : null;
  setFilter(initialFilter || "all");
  if (initialFilter) requestAnimationFrame(() => stock.scrollIntoView());
  else document.querySelectorAll("[data-nav-filter][aria-current]").forEach((a) => a.removeAttribute("aria-current"));
  renderReviews();
  wireWhatsApp(document);
  wireForm("sourcing-form", "Hi JP, I'd like to request an item:");
  wireForm("sell-form", "Hi JP, I'd like a valuation on an item I'm selling:");
})();
