/** 金额统一以“分”存整数；本函数只做展示换算。 */
export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error('金额必须是整数分');
  }
  return `¥${(cents / 100).toFixed(2)}`;
}
