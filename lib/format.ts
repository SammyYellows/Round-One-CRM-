export const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: pence % 100 ? 2 : 0 }).format(pence / 100);

export const pct = (x: number) => `${(x * 100).toFixed(x > 0 && x < 0.1 ? 2 : 1)}%`;
