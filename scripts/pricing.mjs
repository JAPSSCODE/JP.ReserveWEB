// The shop's selling price for an item, from what the supplier charges (used by every stock import and sync).
//
//   Supplier cost        Added on top
//   under £150           a flat £20
//   £150 to £500         22%
//   over £500 to £2,000  18%, but never less than a £500 item sells for (£610)
//   over £2,000          15%, but never less than a £2,000 item sells for (£2,360)
//
// The "never less" floors stop a dearer item selling for less than a cheaper one where the rate steps down.
// The result is always rounded UP to the next .95, so the profit is never below the rule.

export const RULE_TEXT = "under £150 +£20 · £150–£500 +22% · £500–£2,000 +18% · over £2,000 +15% (rounded up to .95)";

// The minimum price before rounding
export function targetPrice(cost) {
  if (cost < 150) return cost + 20;
  if (cost <= 500) return cost * 1.22;
  if (cost <= 2000) return Math.max(cost * 1.18, 500 * 1.22);
  return Math.max(cost * 1.15, 2000 * 1.18);
}

export function roundTo95(x) {
  let r = Math.floor(x) + 0.95;
  if (r < x - 1e-9) r += 1;
  return Math.round(r * 100) / 100;
}

export const sellPrice = (cost) => roundTo95(targetPrice(cost));

// Price check: at least the rule's price, and less than £1 above it (only the rounding)
export function priceOk(sell, cost) {
  const t = targetPrice(cost);
  return cost > 0 && sell >= t - 1e-9 && sell - t < 1;
}
