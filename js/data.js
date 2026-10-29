/* ==========================================================
   JP.ReserveCo — site settings & stock list
   Edit this file to update contact details and products.
   ========================================================== */

const SITE = {
  // International format, digits only (no +, spaces or leading 0)
  whatsapp: "447495051804",
  // Leave blank ("") to hide from the site
  instagram: "JP.ReserveCo",       // no @
  email: "Jake@jpreserveco.info",
};

/* ----------------------------------------------------------
   NEWSLETTER POP-UP (Brevo)
   brevoFormUrl: paste your Brevo sign-up form link here.
     In Brevo: Contacts > Forms > create a subscription form (fields: Email + FIRSTNAME),
     save it, then on the "Share" step choose "Embed the HTML code" and copy the URL inside
     action="..." — it looks like:
     https://abc123.sibforms.com/serve/MUIFAxxxxxxxxxxxxxxxx
   Until it's filled in, the pop-up stays switched off for visitors.
   (You can still preview it by adding ?newsletter to the address, e.g. index.html?newsletter)
   ---------------------------------------------------------- */
const NEWSLETTER = {
  brevoFormUrl: "https://cda120cb.sibforms.com/serve/MUIFACY4wvvt5RFo6nuXLsxzIkOyZ7gV4mJO1ZIvTm4mSlSPIPGj53nxtGbQS_rUpM8d1Ro8nYs1_2kxuMxW6tQimZDey_lZTPhju3h_nr0hYtdK1i9rfXVqt5K3OqUxAgYmKGWxW4daFSJRCg07ti9Tl-iWkP-tB1LM0mblM4Au0GdXPG9I23oURmkuIIlbf6ss1MSkRKKsVwfdbQ==",
  offer: "10% off your first order",     // headline offer shown in the pop-up and footer
  delaySeconds: 7,                        // wait this long after someone arrives
  hideForDays: 30,                        // after it's closed, don't show it again for this long
  image: "Media/web/unnamed (1).jpg",     // photo on the left of the pop-up (hidden on phones)
};

/* ----------------------------------------------------------
   STOCK
   SAMPLE ITEMS — replace with your real stock.
   category: "clothing" | "footwear" | "bags" | "accessories" | "swimwear"
   gender: "Men", "Women" or "Unisex" (Unisex shows under both Men and Women in the filters)
   colour: one colour, or a list for more than one, e.g. "Black" or ["Black", "Gold"] —
           use the names in FILTERS.colours below so they match the swatches
   line: "activewear" (clothing) or "designer" (clothing or footwear) — used by the Clothing and Footwear menus
   model: footwear only — matches the Footwear menu, e.g. "P6000", "Air Max", "Air Force",
          "1130", "Kayano 14", "NYC", "Gel Venture 6"
   set: true for clothing sets, e.g. a matching tracksuit (shows under Activewear > Sets)
   type: the kind of item, shown in the "Product Type" filter — use a name from FILTERS.types below,
         e.g. "T-Shirts", "Hoodies", "Trainers". It also matches the Accessories menu:
         for category "accessories": "Wallets", "Belts", "Hats", "Jewellery", "Sunglasses" or "Watches"
         for category "bags": "Cross Body" or "Keepall" (Keepalls & Holdalls tile)
   collections: optional list for the "Top Trending Collections" tiles, e.g. ["Winter Fits"] or
         ["Streetwear"] (Luxury Bags and Trainers pick up all bags / all footwear automatically)
   size: optional, e.g. "UK 9", "M", "One size"
   condition: optional, e.g. "New with tags", "Excellent"
   details: optional, a sentence or two shown in the quick-view pop-up
   wasPrice: optional, shows a strikethrough price and puts the item under "Sale"
   preloved: true puts the item under "Pre-Loved" (second-hand items)
   sold: true shows the item as sold (pop-up offers to source another)
   focus: optional, which part of the photo to centre on (e.g. "50% 80%")
   ---------------------------------------------------------- */
/* ----------------------------------------------------------
   STOCK FROM A GOOGLE SHEET (recommended — update stock from your phone)
   Paste your sheet's "Publish to web" CSV link below (see docs/stock-sheet-guide.md).
   It looks like: https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv
   When it's set, the shop shows the items in the sheet instead of the PRODUCTS list below.
   Leave it blank ("") to keep using the PRODUCTS list in this file.
   ---------------------------------------------------------- */
const STOCK_SHEET_URL = "";

/* ----------------------------------------------------------
   DUPLICATE LISTINGS (supplier stock)
   Each line is one product that suppliers list under different names (or in adult and kids/GS
   versions). The site shows it once: the cheapest listing's photo and name, with every size any
   of them has, each at the cheapest price. Write each as "Brand Name" exactly as it appears on
   the site (capitals don't matter). All checked by photo, so different colourways aren't merged.
   ---------------------------------------------------------- */
const DUPLICATES = [
  ["Asics Gel-1130 Graphite Grey Gravel", "Asics Gel-1130 Graphite Grey", "Asics Gel-1130 Graphite Grey Black"],
  ["Asics Gel-1130 Piedmont Grey Midnight", "Asics Gel-1130 Piedmont Blue"],
  ["Asics Gel-1130 White Midnight Navy", "Asics Gel-1130 White Midnight"],
  ["Asics Gel-1130 White Clay Canyon", "Asics Gel-1130 Clay Canyon"],
  ["Asics Gel-1130 Black Glacier Grey", "Asics Gel-1130 Glacier Grey"],
  ["Asics Gel-1130 Oatmeal Obsidian Grey", "Asics Gel-1130 Oatmeal Obsidian"],
  ["Asics Gel-1130 Sharkskin", "Asics Gel-1130 White Sharkskin"],
  ["Asics Gel-1130 Larminar Blue Silver", "Asics Gel-1130 Larimar Blue"],
  ["Asics Gel-Kayano 14 White Graphite Grey", "Asics Gel-Kayano 14 Graphite Grey", "Asics Gel-Kayano 14 White Graphite"],
  ["Asics Gel-Kayano 14 Cream Sweet Pink", "Asics Gel-Kayano 14 Sweet Pink"],
  ["Asics Gel-Kayano 14 White Cloud Grey", "Asics Gel-Kayano 14 Cloud Grey"],
  ["Asics Gel-Kayano 14 Dolphin Grey", "Asics Gel-Kayano 14 Dolphin"],
  ["Asics Gel-Kayano 14 Black Pure Silver"],
  ["Asics Gel-NYC Oatmeal Obsidian Grey", "Asics Gel-NYC Oatmeal Obsidian"],
  ["Asics Gel-NYC Cream White", "Asics Gel-NYC White Cream"],
  ["Saucony ProGrid Omni 9 OG White Brown", "Saucony ProGrid Omni 9 White Brown", "Saucony ProGrid Omni 9 Brown"],
  ["Saucony ProGrid Omni 9 Fair Aqua", "Saucony ProGrid Omni 9 Aqua", "Saucony ProGrid Omni 9 Teal Metallic Silver"],
  ["Saucony ProGrid Omni 9 Mutant", "Saucony ProGrid Omni 9 Silver Mutant"],
  ["Asics Gel-Kayano 14 Slate Grey Sage", "Asics Gel-Kayano 14 White Slate Grey"],
  ["Asics Gel-Kayano 14 White Light Navy", "Asics Gel-Kayano 14 Light Navy"],
  ["Asics Gel-Venture 6 Olive Grey", "Asics Gel-Venture 6 Olive Grey Cream"],
  ["Saucony ProGrid Omni 9 Black Orange", "Saucony ProGrid Omni 9 Vo2 White", "Saucony ProGrid Omni 9 White Vo2 Orange"],
  ["Saucony ProGrid Omni 9 Cadet Vizired", "Saucony ProGrid Omni 9"],
  ["Saucony ProGrid Omni 9 Blissful Blue", "Saucony ProGrid Omni 9 Blissful White"],
  ["Saucony ProGrid Omni 9 Silver Pink", "Saucony ProGrid Omni 9 Pink"],
  ["Saucony ProGrid Omni 9 Black Multicolour", "Saucony ProGrid Omni 9 Black Multi"],
  ["Saucony ProGrid Omni 9 Purple", "Saucony ProGrid Omni 9 Silver Purple"],
  ["Asics Gel-Kayano 14 Cream Raw Indigo", "Asics Gel-Kayano 14 Cream Indigo"],
  ["Saucony ProGrid Omni 9 Silver Gold"],
  ["Saucony ProGrid Omni 9 Black Silver"],
  ["Nike P-6000 Suede Anthracite Metallic Silver", "Nike P-6000 Anthracite Metallic Silver", "Nike P6000 Anthracite Chrome"],
  ["Nike P-6000 Cool Grey", "Nike P6000 Cool grey"],
  ["Nike P-6000 Flat Pewter"],
  ["Nike Air Force 1 Low x Supreme White", "Nike Air Force 1 Supreme White"],
  ["Jordan Air Jordan 1 Low OG x Travis Scott Sail Tropical Pink", "Jordan 1 Low Travis Scott Sail Tropical Pink"],
  ["Jordan Air Jordan 4 Retro Black Cat", "Jordan 4 Black Cat 2025"],
  ["Jordan Air Jordan 4 Retro Fear", "Jordan 4 Fear GS", "Jordan 4 Fear"],
  ["Jordan 4 Rare Air GS", "Jordan 4 Rare Air"],
  ["Jordan 4 White Thunder GS", "Jordan 4 White Thunder"],
  ["Jordan 4 White Cement", "Jordan 4 White Cement GS"],
];

/* ----------------------------------------------------------
   PRODUCT FILTERS (the "Filter" panel above the products)
   Options appear in the order listed here. An option with nothing in stock is greyed out
   until you add an item that matches it. Brands, and any size or type you use that isn't
   listed, are picked up from your stock automatically.
   ---------------------------------------------------------- */
const FILTERS = {
  categories: [
    { value: "clothing", label: "Clothing" },
    { value: "footwear", label: "Footwear" },
    { value: "bags", label: "Bags" },
    { value: "accessories", label: "Accessories" },
    { value: "swimwear", label: "Swimwear" },
  ],
  // Product types, grouped by category
  types: {
    clothing: ["T-Shirts", "Shirts", "Polos", "Jumpers", "Hoodies", "Sweatshirts", "Vests", "Jackets", "Coats", "Gilets", "Tracksuits", "Trousers", "Joggers", "Jeans", "Shorts"],
    footwear: ["Trainers", "Boots", "Loafers", "Sliders"],
    bags: ["Cross Body", "Keepall", "Totes", "Backpacks"],
    accessories: ["Wallets", "Belts", "Hats", "Scarves", "Jewellery", "Sunglasses", "Watches"],
    swimwear: ["Swim Shorts", "Swimsuits"],
  },
  genders: ["Men", "Women", "Unisex"],
  sizes: {
    Clothing: ["XXS", "XS", "S", "M", "L", "XL", "XXL"],
    Footwear: ["UK 3", "UK 4", "UK 5", "UK 6", "UK 6.5", "UK 7", "UK 7.5", "UK 8", "UK 8.5", "UK 9", "UK 9.5", "UK 10", "UK 10.5", "UK 11", "UK 12"],
  },
  // name: swatch colour shown in the filter
  colours: {
    Black: "#0d0d0d", White: "#f5f5f2", Grey: "#8d8d8d", Navy: "#1f2a4a", Blue: "#3b6fb6",
    Green: "#3f6b45", Brown: "#6b4a2f", Tan: "#b98a5a", Beige: "#d8c7a8", Cream: "#efe6d2",
    Red: "#b3262e", Burgundy: "#6d1f2c", Pink: "#e7a6b8", Purple: "#6b4b8f", Yellow: "#e9c645",
    Orange: "#e07a2f", Gold: "#d4af5a", Silver: "#c0c0c0", Multi: "conic-gradient(#b3262e, #e9c645, #3f6b45, #3b6fb6, #6b4b8f, #b3262e)",
  },
  conditions: ["New with tags", "New with box", "New", "Excellent", "Very good", "Good", "Fair"],
  priceStep: 50,     // the money slider moves in £50 steps
};

// Your own stock (items you hold yourself). Supplier stock is added automatically after these
// (see scripts/sync-suppliers.mjs). Copy the example below to add an item; newest first.
const PRODUCTS = [
  // {
  //   brand: "Goyard",
  //   name: "Saint Louis PM — Burgundy",
  //   price: 1890,
  //   category: "bags",
  //   type: "Totes",
  //   gender: "Women",
  //   colour: "Burgundy",
  //   size: "PM",
  //   condition: "New with tags",
  //   details: "Comes with dust bag and receipt.",
  //   image: "Media/web/IMG_9872.jpg",
  //   focus: "10% 75%",
  // },
];

/* Every brand you deal in. Shown in the Brands menu A–Z (sorted automatically).
   Each links to its own brand page — your stock
   filtered by that brand (matches the "brand" field above, so spell it the same way). */
const TRENDING_BRANDS = [
  "Asics",
  "Nike",
  "Canada Goose",
  "Louis Vuitton",
  "Dior",
  "Goyard",
  "Casablanca",
  "Amiri",
  "Hermès",
  "Chrome Hearts",
  "Burberry",
  "Yeezy",
  "Supreme",
  "Saucony",
  "Fear of God",
  "Moncler",
  "Cartier",
  "Prada",
  "Chanel",
  "Loro Piana",
  "AP x Swatch",
  "Berghaus",

  // Luxury houses
  "Balenciaga",
  "Bottega Veneta",
  "Celine",
  "Fendi",
  "Givenchy",
  "Gucci",
  "Loewe",
  "Miu Miu",
  "Saint Laurent",
  "Valentino",

  // Designer streetwear
  "Corteiz",
  "Denim Tears",
  "Gallery Dept",
  "Hellstar",
  "Off-White",
  "Palm Angels",
  "Represent",
  "Rick Owens",
  "Sp5der",
  "Stone Island",

  // Sportswear & running
  "Adidas",
  "Alo",
  "Gymshark",
  "Hoka",
  "Jordan",
  "Lululemon",
  "New Balance",
  "On",

  // Outdoor / gorpcore
  "Arc'teryx",
  "C.P. Company",
  "Patagonia",
  "Salomon",
  "Stüssy",
  "The North Face",
];

/* Shorter list shown under "Trending Brands" in the Sale menu only */
const SALE_TRENDING_BRANDS = [
  "Nike",
  "Louis Vuitton",
  "Chanel",
  "Dior",
  "Prada",
  "Hermès",
  "Moncler",
  "Canada Goose",
];

/* "Trending Now" list in the Latest Arrivals menu (all from TRENDING_BRANDS above) */
const LATEST_TRENDING_BRANDS = [
  "Nike",
  "Louis Vuitton",
  "Chanel",
  "Dior",
  "Prada",
  "Hermès",
  "Moncler",
  "Canada Goose",
  "Asics",
  "Saucony",
  "Goyard",
  "Burberry",
  "Chrome Hearts",
  "Amiri",
  "Fear of God",
  "Loro Piana",
];

/* Client reviews (3D carousel above the products).
   Optional: photo: "Media/..." OR video: "Media/web/....mp4" shown beside the review (iPhone .mov videos
   often won't play on Android/Windows, so convert them to .mp4 first — ask Claude or use tools/make-web-video.ps1); focus: "50% 40%" to centre the photo */
const REVIEWS = [
  { name: "Jack", text: "Brilliant service, order arrived very quick & top quality, will definitely be back.", item: "",
    video: "Media/web/review-jack.mp4" },
  { name: "Tommy", text: "Top man! Needed a last minute pair of Saucony's and got sorted within a day. Unbelievable service, will definitely be back.", item: "Saucony trainers",
    photo: "Media/web/IMG_9837.jpg", focus: "50% 45%" },
  { name: "Tyler", text: "Jake at JP.ReserveCo sorted me out within a couple of days of seeing a pair of P6000s, and saved me some cash in the process. Top quality service, will definitely be back.", item: "Nike P6000",
    photo: "Media/web/unnamed%20(2).jpg", focus: "50% 90%" },
  { name: "Kieran", text: "Great service! The clothes & shoes I purchased were exactly what I was looking for. The service was quick, efficient and the whole experience was very smooth. Very happy with my order and would definitely recommend!", item: "£1K Activewear Bundle",
    photo: "Media/web/IMG_0243.jpg", focus: "50% 45%" },
  { name: "Harry", text: "Bro, I cant thank you enough for this. been trying to get this colourway for like a month now and i had them in hand within 72hrs of messaging you. Legend bro appreciate it!", item: "",
    photo: "Media/web/hp.jpg", focus: "50% 62%" },
];
