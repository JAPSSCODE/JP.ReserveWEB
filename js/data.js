/* ==========================================================
   JP.ReserveCo — site settings & stock list
   Edit this file to update contact details and products.
   ========================================================== */

const SITE = {
  // International format, digits only (no +, spaces or leading 0)
  whatsapp: "447495051804",
  // Leave blank ("") to hide from the site
  instagram: "JP.ReserveCo",       // no @
  email: "JP.ReserveCo@gmail.com",
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
   category: "bags" | "footwear" | "clothing" | "accessories"
   line: "activewear" (clothing) or "designer" (clothing or footwear) — used by the Clothing and Footwear menus
   model: footwear only — matches the Footwear menu, e.g. "P6000", "Air Max", "Air Force",
          "1130", "Kayano 14", "NYC", "Gel Venture 6"
   set: true for clothing sets, e.g. a matching tracksuit (shows under Activewear > Sets)
   type: matches the Accessories menu —
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
const PRODUCTS = [
  {
    brand: "Goyard",
    name: "Belvedère PM Messenger — Black",
    price: 2400,
    category: "bags",
    type: "Cross Body",
    size: "PM",
    condition: "New with tags",
    details: "Goyardine canvas with black leather trim. Comes with dust bag and receipt.",
    image: "Media/web/IMG_9872.jpg",
    focus: "50% 55%",
  },
  {
    brand: "Louis Vuitton",
    name: "LV Trainer — Grey Monogram Denim",
    line: "designer",
    price: 1150,
    wasPrice: 1295,
    category: "footwear",
    size: "UK 9",
    condition: "New with box",
    details: "Monogram denim and grained calf leather. Full packaging included.",
    image: "Media/web/IMG_9293.jpg",
    focus: "50% 85%",
  },
  {
    brand: "Goyard",
    name: "Saint Louis GM Tote — Black / Tan",
    price: 2150,
    wasPrice: 2300,
    category: "bags",
    size: "GM",
    condition: "New with tags",
    image: "Media/web/IMG_9872.jpg",
    focus: "35% 15%",
  },
  {
    brand: "Hermès",
    name: "Bouncing Sneaker — Black Suede",
    line: "designer",
    price: 890,
    category: "footwear",
    size: "UK 9",
    condition: "Excellent",
    preloved: true,
    image: "Media/web/IMG_9293.jpg",
    focus: "60% 40%",
  },
  {
    brand: "Christian Louboutin",
    name: "Spike Sock Runner — White",
    line: "designer",
    price: 760,
    category: "footwear",
    size: "UK 8",
    condition: "Very good",
    preloved: true,
    image: "Media/web/IMG_9293.jpg",
    focus: "70% 18%",
    sold: true,
  },
  {
    brand: "Goyard",
    name: "Saint Louis PM — Burgundy",
    price: 1890,
    category: "bags",
    size: "PM",
    condition: "New with tags",
    image: "Media/web/IMG_9872.jpg",
    focus: "10% 75%",
  },
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
   Optional: photo: "Media/..." OR video: "Media/....mov" shown beside the review; focus: "50% 40%" to centre the photo */
const REVIEWS = [
  { name: "Jack", text: "Brilliant service, order arrived very quick & top quality, will definitely be back.", item: "",
    video: "Media/0C27E380-EB49-4B1A-8663-E095CB152EFA.mov" },
  { name: "Tommy", text: "Top man! Needed a last minute pair of Saucony's and got sorted within a day. Unbelievable service, will definitely be back.", item: "Saucony trainers",
    photo: "Media/web/IMG_9837.jpg", focus: "50% 45%" },
];
