# Supplier stock: how it works

Your website automatically lists in-stock items from your B2B suppliers, priced by your pricing rule, and keeps them up to date every hour.

## What happens every hour

1. GitHub checks each supplier's current stock.
2. Only sizes the supplier has in stock are listed. Items with no sizes left disappear from your site.
3. The same item sold by more than one supplier becomes **one listing**. Each size uses the cheapest supplier that has it.
4. Each price follows your pricing rule (below), rounded **up** to the next .95, so you never make less than the rule.
5. The site is published with the new stock.

If a supplier's site is down, nothing changes. The last version stays live until the next successful check, so items are never removed by mistake.

**Before taking payment, always confirm the size is still available with the supplier.** An item can sell in the hour between checks. Your Terms already say an order is only confirmed once you've agreed it in writing.

## Your pricing rule

Every item, from every supplier (the hourly websites, the wholesale sheet and WhatsApp stock), is priced from what the supplier charges you:

| Supplier cost | Added on top | Example |
|---|---|---|
| Under £150 | a flat £20 | £95 → £115.95 |
| £150 to £500 | 22% | £300 → £366.95 |
| Over £500 to £2,000 | 18% | £1,000 → £1,180.95 |
| Over £2,000 | 15% | £3,000 → £3,450.95 |

Prices always round **up** to the next .95. Where the rate steps down (at £500 and £2,000), an item never sells for less than one just below the line: anything from £500 to about £517 sells for £610.95, and anything from £2,000 to about £2,052 for £2,360.95.

The rule lives in one place, `scripts/pricing.mjs`. Ask Claude to change it and every price updates on the next sync. Each run also checks every price against the rule, and stops without publishing if one is wrong.

## One-time setup on GitHub

You do this once, after the site is first pushed:

1. **Turn on publishing:** go to **github.com/JAPSSCODE/JP.ReserveWEB → Settings → Pages**. Under "Build and deployment", set **Source** to **GitHub Actions**.
2. **Add your supplier links (kept private):** go to **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `SUPPLIER_URLS`
   - Secret: your supplier links, one per line. Copy them from `scripts/suppliers.local.txt` on your computer
     (that file is never uploaded, so your suppliers stay private). They look like this:
     ```
     https://first-supplier.example
     https://second-supplier.example
     https://retail-partner.example soldout=show condition=detect photos=clean
     ```
     Anything after a link is a setting for that supplier only:
     - `soldout=show`: also list their sold-out items, clearly marked **Sold** with a "Source one for me" button, after everything in stock
     - `condition=detect`: read pre-owned condition from their descriptions (e.g. "9.5/10" → Excellent). Pre-owned items go in Pre-Loved and stay as their own listings
     - `photos=clean`: cut every product out onto plain white, removing tables, walls, business cards and shop logos. (Photos from other suppliers are cleaned automatically when they don't have a plain background.)
   - Click **Add secret**.
3. **Run it the first time:** go to the **Actions** tab → **Sync stock and publish site** → **Run workflow**. After about a minute your site is live at **https://jpreserveco.com/**.

From then on it runs by itself every hour.

## Changing things

| To… | Do this |
|---|---|
| Add or remove a supplier | Edit the `SUPPLIER_URLS` secret. Suppliers must be Shopify stores. |
| Change your prices | Ask Claude to change the pricing rule in `scripts/pricing.mjs`. |
| Update stock right now | Actions tab → **Sync stock and publish site** → **Run workflow**. |
| See if a check failed | Actions tab. A red ✗ means a supplier couldn't be reached that hour. It retries automatically next hour. |

Your own items (from the Google Sheet or `js/data.js`) always show **before** supplier stock and are never changed by the sync.

## Good to know

- **Keeping it running:** GitHub pauses hourly jobs on a repository that hasn't changed for 60 days. If that happens you'll get an email. Just click **Enable workflow** in the Actions tab.
- **Privacy:** your supplier links are only stored in the hidden secret, never in the website's files. Customers see the products and photos, not where they come from.
- **Checking it on your computer:** `node scripts/sync-suppliers.mjs` builds the same stock locally using the links in `scripts/suppliers.local.txt`. That file isn't uploaded.
