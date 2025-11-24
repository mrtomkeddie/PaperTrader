import { symbols } from '../config/symbols';

export type StrategyId = 'VWAP_MEAN_REV' | 'BTC_RANGE_RETEST';
export type Side = 'BUY' | 'SELL';

export const RISK_PER_TRADE = 0.01;

export function isWeekendUTC(now: Date): boolean {
  const d = now.getUTCDay();
  return d === 0 || d === 6;
}

export function computeLotSize(symbol: string, entry: number, stopLoss: number, balance: number): number {
  const cfg = (symbols as any)[symbol];
  const monetaryRisk = balance * RISK_PER_TRADE;
  const slDistance = Math.abs(entry - stopLoss);
  if (slDistance <= 0) return 0;
  const rawLot = monetaryRisk / (slDistance * cfg.valuePerPoint);
  let lot = Math.max(cfg.minLot, Math.min(rawLot, cfg.maxLot));
  lot = Math.round(lot / cfg.lotStep) * cfg.lotStep;
  return lot;
}

export function sma(series: number[], period: number): number {
  if (series.length < period) return 0;
  const s = series.slice(-period);
  const sum = s.reduce((a, b) => a + b, 0);
  return sum / s.length;
}

export function rsi(series: number[], period: number = 14): number {
  if (series.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = series.length - period; i < series.length; i++) {
    const d = series[i] - series[i - 1];
    if (d >= 0) gains += d; else losses += Math.abs(d);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

export interface VWAPState { pv: number; v: number; vwap: number; day?: number; }
export function updateVWAP(state: VWAPState, price: number, volume: number, ts: number): VWAPState {
  const now = new Date(ts);
  const dayKey = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
  let pv = state.pv, v = state.v, vwap = state.vwap;
  if (state.day !== dayKey) { pv = 0; v = 0; vwap = price; }
  pv += price * volume;
  v += volume;
  vwap = v > 0 ? pv / v : price;
  return { pv, v, vwap, day: dayKey };
}

export interface RangeState { high: number | null; low: number | null; frozen: boolean; brokeAbove: boolean; brokeBelow: boolean; }
export function updateWeekendRange(state: RangeState, candle: { time: number; high: number; low: number; close?: number }): RangeState {
  const now = new Date(candle.time);
  const dow = now.getUTCDay();
  const hour = now.getUTCHours();
  const withinWindow = (dow === 5 && hour >= 18) || (dow === 6 && hour < 10);
  let high = state.high, low = state.low, frozen = state.frozen, brokeAbove = state.brokeAbove, brokeBelow = state.brokeBelow;
  if (!frozen && withinWindow) {
    high = high == null ? candle.high : Math.max(high, candle.high);
    low = low == null ? candle.low : Math.min(low, candle.low);
  }
  if (!frozen && dow === 6 && hour >= 10) frozen = true;
  if (frozen && candle.close != null) {
    if (high != null && candle.close > high) brokeAbove = true;
    if (low != null && candle.close < low) brokeBelow = true;
  }
  return { high, low, frozen, brokeAbove, brokeBelow };
}

export function checkRangeBreakRetestLong(state: RangeState, candle: { close: number; low: number }): boolean {
  if (!state.frozen || state.high == null) return false;
  if (!state.brokeAbove) return false;
  const touched = candle.low <= state.high * 1.001;
  const reclaimed = candle.close >= state.high;
  return touched && reclaimed;
}

export function checkRangeBreakRetestShort(state: RangeState, candle: { close: number; high: number }): boolean {
  if (!state.frozen || state.low == null) return false;
  if (!state.brokeBelow) return false;
  const touched = candle.high >= state.low * 0.999;
  const reclaimed = candle.close <= state.low;
  return touched && reclaimed;
}