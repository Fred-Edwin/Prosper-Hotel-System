// Kenyan Shillings throughout. See docs/architecture.md non-functionals.
// Every `*Minor` field is a plain shilling amount, cent-precise (up to 2dp)
// — there is no minor unit. Nothing should ever scale a shilling amount by
// 100 (see BUG-11). Shows decimals only when the value actually has them —
// "KSh 45" stays whole, "KSh 253.33" shows its cents — so a figure never
// displays with more or less precision than it was recorded at.
export const money = (n: number) =>
  `KSh ${n.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

/** Compact form for axis ticks and sparkline labels, where space is scarce. */
export const moneyCompact = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sign}${abs}`;
};
