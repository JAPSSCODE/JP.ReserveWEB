# Updating your stock from a Google Sheet

Once this is set up, you add, edit or remove items in a Google Sheet (on your phone or computer) and the website updates by itself. You don't need to touch any code.

## One-time setup (about 5 minutes)

1. Go to **sheets.google.com** and create a blank spreadsheet. Name it something like "JP.ReserveCo Stock".
2. **File → Import → Upload**, and choose `docs/stock-sheet-template.csv` from the website folder. Pick **"Replace current sheet"**. You'll get the column headings plus the 6 sample items as examples.
3. **File → Share → Publish to web.**
   - Under "Link", choose the stock sheet (not "Entire document") and **Comma-separated values (.csv)**.
   - Click **Publish** and confirm.
   - Copy the link it gives you. It ends in `output=csv`.
4. Send that link to Claude, or paste it into `js/data.js` here:
   ```js
   const STOCK_SHEET_URL = "PASTE THE LINK HERE";
   ```
   Then push the site.

From then on the shop shows whatever is in the sheet. Changes appear on the website **within about 5 minutes**, because Google refreshes the published copy every few minutes.

Publishing makes the sheet readable by anyone who has the link, which the website needs. Only put stock details in it, never customer information.

## The columns

Only **Brand**, **Name** and **Price** are required. Leave any other cell empty if it doesn't apply. A row without a brand, name or price is skipped, so a half-finished row won't appear on the site.

| Column | What to put | Example |
|---|---|---|
| Brand | The brand, spelled the same each time | `Louis Vuitton` |
| Name | Item name, shown on the product card | `Keepall 55 — Monogram` |
| Price | Price in pounds, numbers only | `1450` |
| Was price | Original price, for sale items. Fill it in to put the item in the Sale section | `1650` |
| Category | `clothing`, `footwear`, `bags`, `accessories` or `swimwear` | `bags` |
| Type | Kind of item, for the Product Type filter | `Hoodies`, `Trainers`, `Keepall`, `Belts` |
| Gender | `Men`, `Women` or `Unisex` | `Unisex` |
| Colour | One colour, or several separated by commas | `Black, Gold` |
| Size | Size as shown to customers | `M`, `UK 9`, `One size` |
| Condition | `New with tags`, `New with box`, `New`, `Excellent`, `Very good`, `Good` or `Fair` | `Excellent` |
| Pre-loved | `yes` for second-hand items (shows under Pre-Loved) | `yes` |
| Sold | `yes` to show it as sold | `yes` |
| Line | `activewear` or `designer`, for the Clothing and Footwear menus | `designer` |
| Model | Footwear model, for the Footwear menu | `P6000`, `Air Max`, `Kayano 14` |
| Set | `yes` for matching sets (Activewear → Sets) | `yes` |
| Collections | For the Top Trending tiles, separated by commas | `Winter Fits, Streetwear` |
| Details | A sentence or two shown when the item is opened | `Comes with dust bag and receipt.` |
| Photo | See "Photos" below | |
| Focus | Optional: which part of the photo to centre on | `50% 80%` |

Use the type, colour and condition names from the lists in `js/data.js` (under `FILTERS`) so they line up with the filter options. A new name still works; it's just added to the end of the filter list.

## Photos

The **Photo** column takes either of these:

- **A Google Drive link** (easiest from your phone):
  1. Upload the photo to Google Drive.
  2. Tap the three dots → **Share** → change "General access" to **Anyone with the link**.
  3. Copy the link and paste it into the Photo cell.
  Tip: square or portrait photos look best, and photos are shown square on the site.
- **A file name** from the website's `Media/web` folder, for photos added to the site itself, e.g. `IMG_9872.jpg`.

## Newest first

Items appear on the site in the same order as the sheet, so put new arrivals **at the top** (insert a row under the headings).

## If something looks wrong

- **Item missing:** check it has a Brand, Name and Price, and that the price is a number.
- **Photo not showing:** check the Drive file is shared as "Anyone with the link".
- **Change not showing yet:** wait 5 minutes and refresh the page.
- **Shop shows "nothing in stock":** the sheet link may be wrong, or the sheet is no longer published. Check **File → Share → Publish to web**.
