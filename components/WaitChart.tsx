"use client";

import { useId, useMemo } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceDot,
  ReferenceArea,
  Line,
} from "recharts";
import type { ChartDataPoint } from "@/types";
import { useChartColors } from "./ThemeProvider";
import {
  formatParkTime,
  getParkDayChartWindow,
  formatParkDateLabel,
} from "@/lib/park-time";

type ChartColors = ReturnType<typeof useChartColors>;

interface EnrichedPoint extends ChartDataPoint {
  timeMs: number;
  displayLabel: string;
  historical_avg?: number;
}

function averageWait(points: EnrichedPoint[]): number {
  const open = points.filter(
    (p) => p.is_open !== false && p.wait_time !== null
  );
  if (open.length === 0) return 0;
  return Math.round(
    open.reduce((s, p) => s + (p.wait_time ?? 0), 0) / open.length
  );
}

function getClosedSpans(
  points: EnrichedPoint[]
): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  let spanStart: number | null = null;

  for (let i = 0; i < points.length; i++) {
    const closed = points[i].is_open === false;
    if (closed) {
      if (spanStart === null) spanStart = points[i].timeMs;
    } else if (spanStart !== null) {
      spans.push({ start: spanStart, end: points[i].timeMs });
      spanStart = null;
    }
  }

  if (spanStart !== null && points.length > 0) {
    const last = points[points.length - 1];
    spans.push({
      start: spanStart,
      end: last.timeMs + 5 * 60 * 1000,
    });
  }

  return spans;
}

function waitStatus(value: number, avg: number): string {
  if (avg <= 0) return "";
  if (value >= avg * 1.15) return "Higher than average";
  if (value <= avg * 0.85) return "Lower than average";
  return "Near average";
}

function buildTimeTicks(startMs: number, endMs: number, count = 4): number[] {
  if (endMs <= startMs) return [startMs];
  const step = (endMs - startMs) / Math.max(count - 1, 1);
  return Array.from({ length: count }, (_, i) =>
    Math.round(startMs + step * i)
  );
}

interface PremiumTooltipProps {
  active?: boolean;
  payload?: { value: number; payload?: EnrichedPoint & { average?: number } }[];
  colors: ChartColors;
  valueLabel?: string;
  avg?: number;
}

function PremiumTooltip({
  active,
  payload,
  colors,
  valueLabel = "min",
  avg,
}: PremiumTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0];
  const row = point.payload as EnrichedPoint | undefined;
  const isClosed = row?.is_open === false;
  const value = point.value;
  const time =
    row?.displayLabel ??
    (row?.timeMs ? formatParkTime(row.timeMs) : row?.label ?? "");
  const referenceAvg = avg ?? row?.historical_avg ?? 0;
  const status =
    !isClosed && value != null ? waitStatus(value, referenceAvg) : "";

  return (
    <div
      className="rounded-xl border px-3.5 py-2.5 shadow-lg backdrop-blur-sm"
      style={{
        background: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        boxShadow: colors.tooltipShadow,
      }}
    >
      <p className="text-[11px] font-medium tracking-wide text-[var(--fg-muted)]">
        {time}
      </p>
      {isClosed ? (
        <>
          <p className="metric mt-0.5 text-base font-semibold text-[var(--fg-muted)]">
            Closed
          </p>
          <p className="mt-1 text-[10px] text-[var(--fg-secondary)]">
            Snapshot collected · ride reported closed by source
          </p>
        </>
      ) : (
        <>
          <p className="metric mt-0.5 text-base font-semibold text-[var(--fg)]">
            {value} {valueLabel}
          </p>
          {status && (
            <p className="mt-1 text-[10px] text-[var(--fg-secondary)]">{status}</p>
          )}
        </>
      )}
    </div>
  );
}

function LatestMarker({
  cx,
  cy,
  colors,
}: {
  cx?: number;
  cy?: number;
  colors: ChartColors;
}) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill={colors.glow}
        fillOpacity={0.35}
      />
      <circle
        cx={cx}
        cy={cy}
        r={3.5}
        fill={colors.line}
        stroke={colors.tooltipBg}
        strokeWidth={2}
      />
    </g>
  );
}

function HighlightMarker({
  cx,
  cy,
  color,
  stroke,
}: {
  cx?: number;
  cy?: number;
  color: string;
  stroke: string;
}) {
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill={color}
      stroke={stroke}
      strokeWidth={1.5}
      opacity={0.85}
    />
  );
}

interface DailyWaitChartProps {
  data: ChartDataPoint[];
  currentWait?: number;
  isOpen?: boolean;
  snapshotCount?: number;
  closedSnapshotCount?: number;
  historicalAverage?: number | null;
}

export function DailyWaitChart({
  data,
  currentWait,
  isOpen,
  snapshotCount = 0,
  closedSnapshotCount = 0,
  historicalAverage,
}: DailyWaitChartProps) {
  const colors = useChartColors();
  const fillId = useId().replace(/:/g, "");
  const { chartStartMs, visibleEndMs } = getParkDayChartWindow();
  const parkDateLabel = formatParkDateLabel();
  const xEnd = Math.max(visibleEndMs, chartStartMs + 60 * 60 * 1000);
  const xTicks = useMemo(
    () => buildTimeTicks(chartStartMs, xEnd, 4),
    [chartStartMs, xEnd]
  );

  const chartData: EnrichedPoint[] = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        timeMs: new Date(d.timestamp).getTime(),
        displayLabel: d.label,
      })),
    [data]
  );

  const avg = useMemo(() => averageWait(chartData), [chartData]);

  const openPoints = useMemo(
    () =>
      chartData.filter(
        (p) => p.is_open !== false && p.wait_time !== null
      ),
    [chartData]
  );

  const closedSpans = useMemo(
    () => getClosedSpans(chartData),
    [chartData]
  );

  const closedMarkers = useMemo(
    () => chartData.filter((p) => p.is_open === false),
    [chartData]
  );

  const highlights = useMemo(() => {
    if (openPoints.length < 2) {
      return { peak: null, low: null, latest: chartData[chartData.length - 1] ?? null };
    }
    const peak = openPoints.reduce((max, p) =>
      (p.wait_time ?? 0) > (max.wait_time ?? 0) ? p : max
    );
    const low = openPoints.reduce((min, p) =>
      (p.wait_time ?? 0) < (min.wait_time ?? 0) ? p : min
    );
    const latest = chartData[chartData.length - 1];
    return { peak, low, latest };
  }, [chartData, openPoints]);

  if (data.length === 0) {
    return (
      <div className="card flex h-56 flex-col items-center justify-center gap-2 px-6 text-center sm:h-64">
        <p className="text-sm text-[var(--fg-muted)]">
          Today&apos;s trend builds as data is collected every 5 minutes. Gray
          bands mean we collected a snapshot but the ride was reported closed.
        </p>
        <p className="text-xs text-[var(--fg-muted)]">
          {parkDateLabel} · Eastern time
        </p>
      </div>
    );
  }

  const yMax = Math.max(
    ...openPoints.map((d) => d.wait_time ?? 0),
    ...chartData.map((d) => d.historical_avg ?? 0),
    0
  );
  const yDomain: [number, number] = [0, Math.max(yMax + 10, 15)];

  const showPeak =
    highlights.peak &&
    highlights.latest &&
    highlights.peak.timeMs !== highlights.latest.timeMs;
  const showLow =
    highlights.low &&
    highlights.latest &&
    highlights.low.timeMs !== highlights.latest.timeMs &&
    highlights.low.timeMs !== highlights.peak?.timeMs;

  const hasHistoricalOverlay = chartData.some(
    (d) => d.historical_avg !== undefined && d.historical_avg > 0
  );

  return (
    <div className="card overflow-hidden p-4 sm:p-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          {isOpen && currentWait !== undefined ? (
            <>
              <p className="label">Current</p>
              <p className="metric text-3xl font-semibold tracking-tight text-[var(--fg)]">
                {currentWait}
                <span className="ml-1 text-base font-normal text-[var(--fg-muted)]">
                  min
                </span>
              </p>
              {historicalAverage !== null && historicalAverage !== undefined && (
                <p className="mt-1 text-xs text-[var(--fg-muted)]">
                  Typical now: {historicalAverage} min
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--fg-muted)]">Wait trend today</p>
          )}
        </div>
        <div className="text-right text-[10px] leading-relaxed text-[var(--fg-muted)]">
          {snapshotCount > 0 && (
            <p>
              {snapshotCount} open
              {closedSnapshotCount > 0 &&
                ` · ${closedSnapshotCount} closed`}
            </p>
          )}
          <p>{parkDateLabel}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240} className="sm:!h-[260px]">
        <AreaChart
          data={chartData}
          margin={{ top: 12, right: 8, left: -8, bottom: 4 }}
        >
          <defs>
            <linearGradient id={`fill-${fillId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.fillStart} stopOpacity={1} />
              <stop offset="85%" stopColor={colors.fillEnd} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`stroke-${fillId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={colors.line} stopOpacity={0.35} />
              <stop offset="50%" stopColor={colors.line} stopOpacity={1} />
              <stop offset="100%" stopColor={colors.line} stopOpacity={0.75} />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke={colors.grid}
            strokeDasharray="4 6"
            vertical={false}
          />

          <XAxis
            type="number"
            dataKey="timeMs"
            domain={[chartStartMs, xEnd]}
            ticks={xTicks}
            tickFormatter={(ms) => formatParkTime(ms)}
            tick={{ fill: colors.tick, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            scale="time"
            dy={6}
          />

          <YAxis
            tick={{ fill: colors.tick, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={28}
            domain={yDomain}
            tickCount={4}
            tickFormatter={(v) => `${v}`}
            unit="m"
          />

          <Tooltip
            content={
              <PremiumTooltip colors={colors} avg={avg} valueLabel="min" />
            }
            cursor={{
              stroke: colors.cursor,
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
            animationDuration={180}
          />

          {closedSpans.map((span) => (
            <ReferenceArea
              key={`${span.start}-${span.end}`}
              x1={span.start}
              x2={span.end}
              y1={0}
              y2={yDomain[1]}
              fill={colors.closed}
              strokeOpacity={0}
              ifOverflow="hidden"
            />
          ))}

          <Area
            type="monotone"
            dataKey="wait_time"
            stroke={`url(#stroke-${fillId})`}
            strokeWidth={1.75}
            fill={`url(#fill-${fillId})`}
            dot={false}
            connectNulls={false}
            activeDot={{
              r: 4.5,
              fill: colors.line,
              stroke: colors.tooltipBg,
              strokeWidth: 2,
            }}
            animationDuration={900}
            animationEasing="ease-out"
            isAnimationActive
          />

          {closedMarkers.map((point) => (
            <ReferenceDot
              key={point.timestamp}
              x={point.timeMs}
              y={3}
              shape={(props) => (
                <HighlightMarker
                  {...props}
                  color={colors.closedDot}
                  stroke={colors.tooltipBg}
                />
              )}
              ifOverflow="hidden"
            />
          ))}

          {hasHistoricalOverlay && (
            <Line
              type="monotone"
              dataKey="historical_avg"
              stroke={colors.tick}
              strokeWidth={1.25}
              strokeDasharray="6 4"
              dot={false}
              activeDot={false}
              animationDuration={900}
              animationEasing="ease-out"
            />
          )}

          {showPeak && highlights.peak && (
            <ReferenceDot
              x={highlights.peak.timeMs}
              y={highlights.peak.wait_time ?? 0}
              shape={(props) => (
                <HighlightMarker
                  {...props}
                  color={colors.high}
                  stroke={colors.tooltipBg}
                />
              )}
              ifOverflow="hidden"
            />
          )}

          {showLow && highlights.low && (
            <ReferenceDot
              x={highlights.low.timeMs}
              y={highlights.low.wait_time ?? 0}
              shape={(props) => (
                <HighlightMarker
                  {...props}
                  color={colors.low}
                  stroke={colors.tooltipBg}
                />
              )}
              ifOverflow="hidden"
            />
          )}

          {highlights.latest &&
            highlights.latest.wait_time !== null &&
            highlights.latest.is_open !== false && (
            <ReferenceDot
              x={highlights.latest.timeMs}
              y={highlights.latest.wait_time}
              shape={(props) => <LatestMarker {...props} colors={colors} />}
              ifOverflow="hidden"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-[var(--fg-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: colors.line }}
          />
          Live trend
        </span>
        {showPeak && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: colors.high }}
            />
            Peak
          </span>
        )}
        {showLow && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: colors.low }}
            />
            Lowest
          </span>
        )}
        {hasHistoricalOverlay && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-px w-3 border-t border-dashed border-[var(--fg-muted)]" />
            Historical avg
          </span>
        )}
        {closedSnapshotCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-4 rounded-sm"
              style={{ background: colors.closed }}
            />
            Closed (collected)
          </span>
        )}
      </div>
    </div>
  );
}

interface WeeklyPatternChartProps {
  data: { label: string; average: number; hour: number }[];
  bestHour?: number;
  peakHour?: number;
}

export function WeeklyPatternChart({
  data,
  bestHour,
  peakHour,
}: WeeklyPatternChartProps) {
  const colors = useChartColors();
  const fillId = useId().replace(/:/g, "");

  const enriched = useMemo(
    () => data.map((d) => ({ ...d, displayLabel: d.label })),
    [data]
  );

  const avg = useMemo(() => {
    if (enriched.length === 0) return 0;
    return Math.round(
      enriched.reduce((s, d) => s + d.average, 0) / enriched.length
    );
  }, [enriched]);

  if (data.length < 2) {
    return (
      <div className="card flex h-52 items-center justify-center px-6 text-center sm:h-56">
        <p className="text-sm text-[var(--fg-muted)]">
          Weekly patterns appear after several days of data.
        </p>
      </div>
    );
  }

  const yMax = Math.max(...enriched.map((d) => d.average));
  const yDomain: [number, number] = [0, Math.max(yMax + 8, 12)];

  const bestPoint = bestHour !== undefined
    ? enriched.find((d) => d.hour === bestHour)
    : undefined;
  const peakPoint = peakHour !== undefined
    ? enriched.find((d) => d.hour === peakHour)
    : undefined;

  return (
    <div className="card overflow-hidden p-4 sm:p-6">
      <div className="mb-4">
        <p className="label">Typical day</p>
        <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
          Average wait by hour · last 30 days
        </p>
      </div>

      <ResponsiveContainer width="100%" height={220} className="sm:!h-[240px]">
        <AreaChart
          data={enriched}
          margin={{ top: 8, right: 8, left: -8, bottom: 4 }}
        >
          <defs>
            <linearGradient id={`weekly-fill-${fillId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.fillStart} stopOpacity={0.9} />
              <stop offset="100%" stopColor={colors.fillEnd} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke={colors.grid}
            strokeDasharray="4 6"
            vertical={false}
          />

          <XAxis
            dataKey="label"
            tick={{ fill: colors.tick, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
            dy={6}
          />

          <YAxis
            tick={{ fill: colors.tick, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={28}
            domain={yDomain}
            tickCount={4}
            tickFormatter={(v) => `${v}`}
            unit="m"
          />

          <Tooltip
            content={
              <PremiumTooltip
                colors={colors}
                avg={avg}
                valueLabel="min avg"
              />
            }
            cursor={{
              stroke: colors.cursor,
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
            animationDuration={180}
          />

          <Area
            type="monotone"
            dataKey="average"
            stroke={colors.line}
            strokeWidth={1.75}
            fill={`url(#weekly-fill-${fillId})`}
            dot={false}
            activeDot={{
              r: 4.5,
              fill: colors.line,
              stroke: colors.tooltipBg,
              strokeWidth: 2,
            }}
            animationDuration={900}
            animationEasing="ease-out"
          />

          {bestPoint && (
            <ReferenceDot
              x={bestPoint.label}
              y={bestPoint.average}
              shape={(props) => (
                <HighlightMarker
                  {...props}
                  color={colors.low}
                  stroke={colors.tooltipBg}
                />
              )}
              ifOverflow="hidden"
            />
          )}

          {peakPoint && peakPoint.label !== bestPoint?.label && (
            <ReferenceDot
              x={peakPoint.label}
              y={peakPoint.average}
              shape={(props) => (
                <HighlightMarker
                  {...props}
                  color={colors.high}
                  stroke={colors.tooltipBg}
                />
              )}
              ifOverflow="hidden"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-[var(--fg-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: colors.low }}
          />
          Best window
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: colors.high }}
          />
          Peak window
        </span>
      </div>
    </div>
  );
}

export { DailyWaitChart as WaitChart };
