'use client';

import React, { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  AreaSeries,
  LineType,
  LineStyle,
  AreaData,
  Time,
  UTCTimestamp,
  IPriceLine,
} from 'lightweight-charts';
import { StockPricePoint } from '@finpilot/shared-types';

interface TradingViewChartProps {
  data: StockPricePoint[];
  height?: number;
  currentPrice?: number;
  previousClose?: number;
  onBuyClick?: () => void;
  onSellClick?: () => void;
}

export default function TradingViewChart({
  data,
  height = 360,
  currentPrice,
  previousClose,
  onBuyClick,
  onSellClick,
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const floatingLabelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    const container = chartContainerRef.current;

    // Detect if timestamps are intraday (contains 'T' with time details)
    const isIntraday = data.some(
      (p) =>
        p.timestamp.includes('T') &&
        p.timestamp.split('T')[1]?.length > 0 &&
        !p.timestamp.endsWith('T00:00:00.000Z') &&
        !p.timestamp.endsWith('T00:00:00Z'),
    );

    // Convert StockPricePoint array to AreaData array
    const formattedData: AreaData<Time>[] = data
      .map((p) => {
        let timeVal: Time;
        if (isIntraday) {
          timeVal = Math.floor(new Date(p.timestamp).getTime() / 1000) as UTCTimestamp;
        } else {
          timeVal = (p.timestamp.includes('T') ? p.timestamp.split('T')[0] : p.timestamp) as Time;
        }
        return {
          time: timeVal,
          value: p.close,
        };
      })
      .filter((item) => !!item.time && !isNaN(item.value))
      .sort((a, b) => {
        if (typeof a.time === 'number' && typeof b.time === 'number') {
          return a.time - b.time;
        }
        return String(a.time).localeCompare(String(b.time));
      })
      .reduce((acc, current) => {
        if (acc.length === 0) return [current];
        const prev = acc[acc.length - 1];
        if (prev.time === current.time) {
          acc[acc.length - 1] = current;
          return acc;
        }
        return acc.concat([current]);
      }, [] as AreaData<Time>[]);

    if (formattedData.length === 0) return;

    // Compute whether stock is UP or DOWN for the selected period
    const firstPoint = formattedData[0];
    const lastPoint = formattedData[formattedData.length - 1];
    const latestPrice = currentPrice ?? lastPoint.value;
    const startPrice = firstPoint.value;
    const isPeriodUp = latestPrice >= startPrice;

    // Palette: Green gradient when up, Red/Pink gradient when down
    const lineColor = isPeriodUp ? '#059669' : '#dc2626';
    const topGradientColor = isPeriodUp ? 'rgba(5, 150, 105, 0.28)' : 'rgba(220, 38, 38, 0.28)';
    const bottomGradientColor = isPeriodUp ? 'rgba(5, 150, 105, 0.00)' : 'rgba(220, 38, 38, 0.00)';

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#64748b',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(0, 0, 0, 0.04)' },
        horzLines: { color: 'rgba(0, 0, 0, 0.04)' },
      },
      crosshair: {
        vertLine: {
          color: isPeriodUp ? 'rgba(5, 150, 105, 0.4)' : 'rgba(220, 38, 38, 0.4)',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: isPeriodUp ? 'rgba(5, 150, 105, 0.4)' : 'rgba(220, 38, 38, 0.4)',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: isIntraday,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
      },
      width: container.clientWidth,
      height,
    });

    // 1. Single Continuous Smooth Line / Area Series (Volume histogram removed)
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: topGradientColor,
      bottomColor: bottomGradientColor,
      lineWidth: 2,
      lineType: LineType.Curved,
      priceLineVisible: true,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: '#ffffff',
      crosshairMarkerBackgroundColor: lineColor,
    });

    areaSeries.setData(formattedData);

    // 2. Dashed Horizontal Reference Line marking Previous Close
    const effectivePrevClose =
      previousClose ?? (data.length > 0 ? (data[0].open ?? data[0].close) : undefined);
    let prevCloseLine: IPriceLine | null = null;
    if (effectivePrevClose && effectivePrevClose > 0) {
      prevCloseLine = areaSeries.createPriceLine({
        price: effectivePrevClose,
        color: '#94a3b8',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Prev close ₹${effectivePrevClose.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      });
    }

    chart.timeScale().fitContent();

    // 3. Dynamic Positioning of Floating Latest Price Label at rightmost point of the line
    const updateFloatingLabel = () => {
      if (!floatingLabelRef.current || !container) return;
      const y = areaSeries.priceToCoordinate(latestPrice);
      const x = chart.timeScale().timeToCoordinate(lastPoint.time);

      if (
        y !== null &&
        x !== null &&
        y >= 0 &&
        y <= height &&
        x >= 0 &&
        x <= container.clientWidth
      ) {
        floatingLabelRef.current.style.display = 'flex';
        floatingLabelRef.current.style.top = `${y}px`;
        floatingLabelRef.current.style.left = `${x}px`;

        // Prevent clipping at container boundaries
        const isNearRightEdge = x > container.clientWidth - 110;
        floatingLabelRef.current.style.transform = isNearRightEdge
          ? 'translate(-100%, -125%)'
          : x < 70
          ? 'translate(0%, -125%)'
          : 'translate(-50%, -125%)';
      } else {
        floatingLabelRef.current.style.display = 'none';
      }
    };

    const rafId = requestAnimationFrame(() => {
      updateFloatingLabel();
    });

    // Update label position when time scale or range changes
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateFloatingLabel);
    chart.timeScale().subscribeVisibleTimeRangeChange(updateFloatingLabel);

    const handleResize = () => {
      if (container) {
        chart.applyOptions({ width: container.clientWidth });
        updateFloatingLabel();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateFloatingLabel);
      chart.timeScale().unsubscribeVisibleTimeRangeChange(updateFloatingLabel);
      if (prevCloseLine) {
        try {
          areaSeries.removePriceLine(prevCloseLine);
        } catch {}
      }
      chart.remove();
    };
  }, [data, height, currentPrice, previousClose]);

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: `${height}px`,
          color: '#64748b',
          fontSize: '0.88rem',
        }}
      >
        No chart data available
      </div>
    );
  }

  // Pre-calculate for initial render styling
  const firstPoint = data[0];
  const lastPoint = data[data.length - 1];
  const latestPrice = currentPrice ?? (lastPoint?.close || 0);
  const startPrice = firstPoint?.open ?? firstPoint?.close ?? latestPrice;
  const isPeriodUp = latestPrice >= startPrice;

  return (
    <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
      <div ref={chartContainerRef} style={{ width: '100%', height: `${height}px` }} />

      {/* 3. Small Floating Label at the rightmost point of the line */}
      <div
        ref={floatingLabelRef}
        style={{
          position: 'absolute',
          pointerEvents: 'none',
          zIndex: 15,
          display: 'none',
          flexDirection: 'column',
          alignItems: 'center',
          transition: 'top 0.1s ease, left 0.1s ease',
        }}
      >
        <div
          style={{
            background: isPeriodUp ? '#059669' : '#dc2626',
            color: '#ffffff',
            fontSize: '0.75rem',
            fontWeight: 800,
            padding: '0.22rem 0.55rem',
            borderRadius: '9999px',
            boxShadow: isPeriodUp
              ? '0 2px 8px rgba(5, 150, 105, 0.45)'
              : '0 2px 8px rgba(220, 38, 38, 0.45)',
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
          }}
        >
          ₹{latestPrice.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isPeriodUp ? '#059669' : '#dc2626',
            border: '2px solid #ffffff',
            boxShadow: isPeriodUp
              ? '0 0 0 3px rgba(5, 150, 105, 0.35)'
              : '0 0 0 3px rgba(220, 38, 38, 0.35)',
            marginTop: '3px',
          }}
        />
      </div>

      {/* 7. Floating BUY / SELL Overlay Buttons near Price Scale (Unchanged) */}
      {currentPrice && (onBuyClick || onSellClick) && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '70px',
            display: 'flex',
            gap: '0.5rem',
            zIndex: 10,
          }}
        >
          {onBuyClick && (
            <button
              onClick={onBuyClick}
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.4rem 0.8rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              BUY ₹{currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </button>
          )}
          {onSellClick && (
            <button
              onClick={onSellClick}
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.4rem 0.8rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              SELL ₹{currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
