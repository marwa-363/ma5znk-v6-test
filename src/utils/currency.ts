export type CurrencyCode = 'SAR' | 'EGP';

export const getCurrencySymbol = (currency?: string, lang: 'ar' | 'en' = 'ar') => {
  if (currency === 'SAR') {
    return lang === 'ar' ? 'ر.س' : 'SAR';
  }
  if (currency === 'EGP') {
    return lang === 'ar' ? 'ج.م' : 'EGP';
  }
  // Default to EGP
  return lang === 'ar' ? 'ج.م' : 'EGP';
};

export const formatCurrency = (amount: number, currency?: string, lang: 'ar' | 'en' = 'ar') => {
  const symbol = getCurrencySymbol(currency, lang);
  const formattedAmount = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  
  return lang === 'ar' ? `${formattedAmount} ${symbol}` : `${symbol} ${formattedAmount}`;
};
