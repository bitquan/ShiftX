export function centsToDollars(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toFixed(2);
}

// Allows typing states: "", "1", "1.", "1.5", "1.50"
export function parseDollarsToCents(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (!/^\d*\.?\d*$/.test(s)) return null;

  const [whole = "0", frac = ""] = s.split(".");
  const frac2 = (frac + "00").slice(0, 2);
  const cents = Number(whole) * 100 + Number(frac2 || "0");

  return Number.isFinite(cents) ? cents : null;
}
