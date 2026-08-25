export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function calculatePortfolioMetrics(holdings: Array<{ quantity: number; avgBuyPrice: number; currentPrice: number }>) {
  let totalCost = 0;
  let currentValue = 0;

  for (const item of holdings) {
    totalCost += item.quantity * item.avgBuyPrice;
    currentValue += item.quantity * item.currentPrice;
  }

  const totalReturn = currentValue - totalCost;
  const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

  return {
    totalCost,
    currentValue,
    totalReturn,
    totalReturnPercent,
  };
}
