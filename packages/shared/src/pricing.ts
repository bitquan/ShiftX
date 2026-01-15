/**
 * Pricing utilities for currency conversion and formatting
 */

/**
 * Convert dollars to cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Format cents as currency string
 * @param cents - Amount in cents
 * @param currency - Currency code (default: 'USD')
 * @param locale - Locale for formatting (default: 'en-US')
 */
export function formatCurrency(
  cents: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  const dollars = centsToDollars(cents);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Format cents as decimal string (no currency symbol)
 */
export function formatDecimal(cents: number, decimals: number = 2): string {
  const dollars = centsToDollars(cents);
  return dollars.toFixed(decimals);
}

/**
 * Parse currency string to cents
 * Removes currency symbols and converts to cents
 */
export function parseCurrencyToCents(value: string): number {
  // Remove currency symbols, commas, and whitespace
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const dollars = parseFloat(cleaned);
  
  if (isNaN(dollars)) {
    return 0;
  }
  
  return dollarsToCents(dollars);
}

/**
 * Calculate percentage of amount
 */
export function calculatePercentage(amount: number, percentage: number): number {
  return Math.round((amount * percentage) / 100);
}

/**
 * Add amounts safely (all in cents)
 */
export function addAmounts(...amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0);
}

/**
 * Calculate tip amount
 */
export function calculateTip(amount: number, tipPercentage: number): number {
  return calculatePercentage(amount, tipPercentage);
}

/**
 * Pricing constants
 */
export const PricingConstants = {
  // Minimum fare
  MIN_FARE_CENTS: 500, // $5.00
  
  // Service fees
  SERVICE_FEE_PERCENTAGE: 15, // 15%
  
  // Tax rates
  TAX_RATE_PERCENTAGE: 8.5, // 8.5%
  
  // Surge pricing
  MAX_SURGE_MULTIPLIER: 3.0,
  
  // Tip presets
  TIP_PRESETS: [10, 15, 20, 25], // percentages
  
  // Currency
  DEFAULT_CURRENCY: 'USD',
} as const;
