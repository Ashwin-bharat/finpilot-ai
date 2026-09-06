import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TradingViewChart from './TradingViewChart';
import { StockPricePoint } from '@finpilot/shared-types';
import * as LightweightCharts from 'lightweight-charts';

// Mock lightweight-charts
const mockAddSeries = vi.fn();
const mockSetData = vi.fn();
const mockCreatePriceLine = vi.fn();
const mockRemovePriceLine = vi.fn();
const mockFitContent = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemove = vi.fn();
const mockSubscribeVisibleLogicalRangeChange = vi.fn();
const mockUnsubscribeVisibleLogicalRangeChange = vi.fn();
const mockSubscribeVisibleTimeRangeChange = vi.fn();
const mockUnsubscribeVisibleTimeRangeChange = vi.fn();

const mockSeries = {
  setData: mockSetData,
  createPriceLine: mockCreatePriceLine,
  removePriceLine: mockRemovePriceLine,
  priceToCoordinate: vi.fn().mockReturnValue(120),
  priceScale: vi.fn().mockReturnValue({ applyOptions: vi.fn() }),
};

const mockChart = {
  addSeries: mockAddSeries.mockReturnValue(mockSeries),
  applyOptions: mockApplyOptions,
  remove: mockRemove,
  timeScale: vi.fn().mockReturnValue({
    fitContent: mockFitContent,
    timeToCoordinate: vi.fn().mockReturnValue(250),
    subscribeVisibleLogicalRangeChange: mockSubscribeVisibleLogicalRangeChange,
    unsubscribeVisibleLogicalRangeChange: mockUnsubscribeVisibleLogicalRangeChange,
    subscribeVisibleTimeRangeChange: mockSubscribeVisibleTimeRangeChange,
    unsubscribeVisibleTimeRangeChange: mockUnsubscribeVisibleTimeRangeChange,
  }),
};

vi.mock('lightweight-charts', async () => {
  const actual = await vi.importActual<typeof LightweightCharts>('lightweight-charts');
  return {
    ...actual,
    createChart: vi.fn(() => mockChart),
  };
});

describe('TradingViewChart Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const generateHistory = (
    startPrice: number,
    endPrice: number,
    count: number,
    isIntraday: boolean = false
  ): StockPricePoint[] => {
    return Array.from({ length: count }).map((_, i) => {
      const price = startPrice + ((endPrice - startPrice) * i) / (count - 1);
      const d = new Date(2026, 8, 1, 9, 15 + i * 5);
      return {
        timestamp: isIntraday ? d.toISOString() : `2026-09-${String(i + 1).padStart(2, '0')}`,
        open: price * 0.998,
        high: price * 1.002,
        low: price * 0.995,
        close: Number(price.toFixed(2)),
        volume: 100000,
      };
    });
  };

  it('renders correctly and initializes single AreaSeries without volume histogram', () => {
    const data = generateHistory(3000, 3150, 10);
    render(
      <TradingViewChart
        data={data}
        currentPrice={3150}
        previousClose={2980}
      />
    );

    // Chart was created
    expect(LightweightCharts.createChart).toHaveBeenCalledTimes(1);

    // addSeries called with AreaSeries
    expect(mockAddSeries).toHaveBeenCalledWith(
      LightweightCharts.AreaSeries,
      expect.objectContaining({
        lineType: LightweightCharts.LineType.Curved,
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
      })
    );

    // Confirmed: No volume histogram sub-panel
    expect(mockAddSeries).not.toHaveBeenCalledWith(
      (LightweightCharts as any).HistogramSeries,
      expect.anything()
    );
  });

  it('flips gradient and line color to GREEN when period is UP', () => {
    const upData = generateHistory(2300, 2450, 15); // +150 UP
    render(
      <TradingViewChart
        data={upData}
        currentPrice={2450}
        previousClose={2290}
      />
    );

    expect(mockAddSeries).toHaveBeenCalledWith(
      LightweightCharts.AreaSeries,
      expect.objectContaining({
        lineColor: '#059669',
        topColor: 'rgba(5, 150, 105, 0.28)',
        bottomColor: 'rgba(5, 150, 105, 0.00)',
      })
    );
  });

  it('flips gradient and line color to RED when period is DOWN', () => {
    const downData = generateHistory(2500, 2320, 15); // -180 DOWN
    render(
      <TradingViewChart
        data={downData}
        currentPrice={2320}
        previousClose={2510}
      />
    );

    expect(mockAddSeries).toHaveBeenCalledWith(
      LightweightCharts.AreaSeries,
      expect.objectContaining({
        lineColor: '#dc2626',
        topColor: 'rgba(220, 38, 38, 0.28)',
        bottomColor: 'rgba(220, 38, 38, 0.00)',
      })
    );
  });

  it('creates dashed horizontal reference line for Previous Close', () => {
    const data = generateHistory(2300, 2350, 10);
    render(
      <TradingViewChart
        data={data}
        currentPrice={2350}
        previousClose={2295.5}
      />
    );

    expect(mockCreatePriceLine).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 2295.5,
        color: '#94a3b8',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: expect.stringContaining('Prev close'),
      })
    );
  });

  it('renders small floating latest price label with correct price', () => {
    const data = generateHistory(2300, 2345.67, 10);
    render(
      <TradingViewChart
        data={data}
        currentPrice={2345.67}
        previousClose={2300}
      />
    );

    expect(screen.getByText('₹2,345.67')).toBeInTheDocument();
  });

  it('renders overlaid BUY / SELL buttons and triggers callbacks', () => {
    const onBuy = vi.fn();
    const onSell = vi.fn();
    const data = generateHistory(2300, 2304, 10);

    render(
      <TradingViewChart
        data={data}
        currentPrice={2304}
        onBuyClick={onBuy}
        onSellClick={onSell}
      />
    );

    const buyBtn = screen.getByText(/BUY ₹2,304/i);
    const sellBtn = screen.getByText(/SELL ₹2,304/i);

    expect(buyBtn).toBeInTheDocument();
    expect(sellBtn).toBeInTheDocument();

    fireEvent.click(buyBtn);
    expect(onBuy).toHaveBeenCalledTimes(1);

    fireEvent.click(sellBtn);
    expect(onSell).toHaveBeenCalledTimes(1);
  });

  describe('Validation across 2 stocks and all 5 timeframe options', () => {
    const testCases = [
      // Stock 1: TCS.NS across all 5 timeframes
      { symbol: 'TCS.NS', range: '1D', isIntraday: true, count: 24, start: 2310, end: 2304, expectedUp: false },
      { symbol: 'TCS.NS', range: '1W', isIntraday: true, count: 35, start: 2280, end: 2304, expectedUp: true },
      { symbol: 'TCS.NS', range: '1M', isIntraday: false, count: 30, start: 2250, end: 2304, expectedUp: true },
      { symbol: 'TCS.NS', range: '1Y', isIntraday: false, count: 250, start: 2600, end: 2304, expectedUp: false },
      { symbol: 'TCS.NS', range: '5Y', isIntraday: false, count: 500, start: 1800, end: 2304, expectedUp: true },

      // Stock 2: RELIANCE.NS across all 5 timeframes
      { symbol: 'RELIANCE.NS', range: '1D', isIntraday: true, count: 24, start: 2980, end: 3015, expectedUp: true },
      { symbol: 'RELIANCE.NS', range: '1W', isIntraday: true, count: 35, start: 3040, end: 3015, expectedUp: false },
      { symbol: 'RELIANCE.NS', range: '1M', isIntraday: false, count: 30, start: 2950, end: 3015, expectedUp: true },
      { symbol: 'RELIANCE.NS', range: '1Y', isIntraday: false, count: 250, start: 2700, end: 3015, expectedUp: true },
      { symbol: 'RELIANCE.NS', range: '5Y', isIntraday: false, count: 500, start: 2100, end: 3015, expectedUp: true },
    ];

    testCases.forEach(({ symbol, range, isIntraday, count, start, end, expectedUp }) => {
      it(`renders correctly for ${symbol} on timeframe [${range}] (${expectedUp ? 'UP/Green' : 'DOWN/Red'})`, () => {
        const history = generateHistory(start, end, count, isIntraday);
        const { unmount } = render(
          <TradingViewChart
            data={history}
            currentPrice={end}
            previousClose={start}
          />
        );

        expect(mockAddSeries).toHaveBeenCalledWith(
          LightweightCharts.AreaSeries,
          expect.objectContaining({
            lineColor: expectedUp ? '#059669' : '#dc2626',
            topColor: expectedUp ? 'rgba(5, 150, 105, 0.28)' : 'rgba(220, 38, 38, 0.28)',
            bottomColor: expectedUp ? 'rgba(5, 150, 105, 0.00)' : 'rgba(220, 38, 38, 0.00)',
            lineType: LightweightCharts.LineType.Curved,
          })
        );

        expect(mockCreatePriceLine).toHaveBeenCalledWith(
          expect.objectContaining({
            price: start,
            lineStyle: LightweightCharts.LineStyle.Dashed,
          })
        );

        unmount();
      });
    });
  });
});
