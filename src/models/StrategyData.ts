export const DEFAULT_STRATEGIES = [
  'Long Term Investment',
  'Swing Trading',
  'Day Trading',
  'Value Investing',
  'Growth Investing',
  'Fundamental Analysis',
  'Technical Analysis',
  'Momentum Trading',
  'Breakout Trading',
  'Position Trading',
  'Scalping',
  'News Trading'
] as const;

export type TradingStrategy = typeof DEFAULT_STRATEGIES[number];

export interface UserStrategy {
  id?: string;
  user_id: string;
  name: string;
  created_at?: string;
}

export function isDefaultStrategy(strategy: string): strategy is TradingStrategy {
  return DEFAULT_STRATEGIES.includes(strategy as TradingStrategy);
}

export function validateStrategy(strategy: string): boolean {
  return strategy.length >= 3 && strategy.length <= 50;
}