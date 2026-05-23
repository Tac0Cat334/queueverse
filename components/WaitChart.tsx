"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceDot,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import type { ChartDataPoint } from "@/types";
import { useChartColors } from "./ThemeProvider";

interface ChartTooltipProps {
  active?: boolean;
  payload?: { value: number; payload?: { label?: string } }[];
  colors: ReturnType<typeof useChartColors>;
}

function ChartTooltip({ active, payload, colors }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0];

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg"
      style={{
        background: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
      }}
    >
      <p className="text-[11px] text-[var(--fg-muted)]">
        {point.payload?.label ?? ""}
      </p>
      <p className="metric mt-0.5 text-lg font-semibold">{point.value} min</p>
    </div>
  );
}

interface DailyWaitChartProps {
  data: ChartDataPoint[];
  currentWait?: number;
  isOpen?: boolean;
}

export function DailyWaitChart({ data, currentWait, isOpen }: DailyWaitChartProps) {
  const colors = useChartColors();

  if (data.length === 0) {
    return (
      <div className="card flex h-64 items-center justify-center px-6 text-center">
        <p className="text-sm text-[var(--fg-muted)]">
          Today&apos;s graph builds as data is collected every 5 minutes.
        </p>
      </div>
    );
  }

  if (data.length === 1) {
    return (
      <div className="card flex h-64 flex-col items-center justify-center gap-2">
        <p className="metric text-4xl font-semibold">{data[0].wait_time} min</p>
        <p className="text-xs text-[var(--fg-muted)]">First snapshot today</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    displayLabel: format(new Date(d.timestamp), "h:mm a"),
  }));

  const min = Math.min(...chartData.map((d) => d.wait_time));
  const max = Math.max(...chartData.map((d) => d.wait_time));
  const lastPoint = chartData[chartData.length - 1];

  return (
    <div className="card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-[var(--fg-muted)]">
        <span>Low {min}m</span>
        <span>Peak {max}m</span>
        {isOpen && currentWait !== undefined && (
          <span className="text-[var(--fg-secondary)]">Live {currentWait}m</span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="dailyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.line} stopOpacity={0.18} />
              <stop offset="100%" stopColor={colors.line} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="displayLabel"
            tick={{ fill: colors.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={48}
          />
          <YAxis
            tick={{ fill: colors.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            unit="m"
            width={36}
            domain={[0, "auto"]}
          />
          <Tooltip
            content={<ChartTooltip colors={colors} />}
            cursor={{ stroke: colors.grid, strokeWidth: 1 }}
          />
          {isOpen && currentWait !== undefined && (
            <ReferenceLine
              y={currentWait}
              stroke={colors.low}
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
          )}
          <Area
            type="monotone"
            dataKey="wait_time"
            stroke={colors.line}
            strokeWidth={2.5}
            fill="url(#dailyFill)"
            dot={false}
            activeDot={{ r: 5, fill: colors.line, strokeWidth: 0 }}
            animationDuration={900}
            animationEasing="ease-out"
          />
          <ReferenceDot
            x={lastPoint.displayLabel}
            y={lastPoint.wait_time}
            r={6}
            fill={colors.line}
            stroke={colors.tooltipBg}
            strokeWidth={2}
            ifOverflow="extendDomain"
          />
        </AreaChart>
      </ResponsiveContainer>
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

  if (data.length < 2) {
    return (
      <div className="card flex h-56 items-center justify-center px-6 text-center">
        <p className="text-sm text-[var(--fg-muted)]">
          Weekly patterns appear after several days of data collection.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-6">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="weeklyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.line} stopOpacity={0.1} />
              <stop offset="100%" stopColor={colors.line} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: colors.tick, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={32}
          />
          <YAxis
            tick={{ fill: colors.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            unit="m"
            width={36}
          />
          <Tooltip content={<ChartTooltip colors={colors} />} />
          <Area
            type="monotone"
            dataKey="average"
            stroke={colors.line}
            strokeWidth={2}
            fill="url(#weeklyFill)"
            dot={false}
            activeDot={{ r: 4, fill: colors.line }}
            animationDuration={900}
          />
          {bestHour !== undefined && (
            <ReferenceDot
              x={data.find((d) => d.hour === bestHour)?.label}
              y={data.find((d) => d.hour === bestHour)?.average}
              r={5}
              fill={colors.low}
              stroke={colors.tooltipBg}
              strokeWidth={2}
              ifOverflow="extendDomain"
            />
          )}
          {peakHour !== undefined && (
            <ReferenceDot
              x={data.find((d) => d.hour === peakHour)?.label}
              y={data.find((d) => d.hour === peakHour)?.average}
              r={5}
              fill={colors.high}
              stroke={colors.tooltipBg}
              strokeWidth={2}
              ifOverflow="extendDomain"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Legacy export for any remaining usage
export { DailyWaitChart as WaitChart };
