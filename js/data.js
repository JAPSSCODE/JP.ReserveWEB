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
   STOCK
   SAMPLE ITEMS — replace with your real stock.
   category: "bags" | "footwear" | "clothing" | "accessories"
   line: "activewear" (clothing) or "designer" (clothing or footwear) — used by the Clothing and Footwear menus
   model: footwear only — matches the Footwear menu, e.g. "P6000", "Air Max", "Air Force",
          "1130", "Kayano 14", "NYC", "Gel Venture 6"
   set: true for clothing sets, e.g. a matching tracksuit (shows under Activewear > Sets)
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
    size: "PM",
    condition: "New with tags",
    details: "Goyardine canvas with black leather trim. Comes with dust bag and receipt.",
    image: "Media/IMG_9872.jpeg",
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
    image: "Media/IMG_9293.jpeg",
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
    image: "Media/IMG_9872.jpeg",
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
    image: "Media/IMG_9293.jpeg",
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
    image: "Media/IMG_9293.jpeg",
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
    image: "Media/IMG_9872.jpeg",
    focus: "10% 75%",
  },
];

/* Brands listed under "Trending Brands" in the Sale menu.
   Each one links to your stock filtered by that brand (matches the "brand" field above). */
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

const REVIEWS = [
  { name: "Jack", text: "Brilliant service, order arrived very quick & top quality, will definitely be back.", item: "" },
  { name: "Tommy", text: "Top man! Needed a last minute pair of Saucony's and got sorted within a day. Unbelievable service, will definitely be back.", item: "Saucony trainers" },
];
