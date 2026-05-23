"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Bar,
  BarChart,
} from "recharts";
import { format } from "date-fns";
import type { ChartDataPoint, TimeRange } from "@/types";
import { useChartColors } from "./ThemeProvider";

interface WaitChartProps {
  data: ChartDataPoint[];
  range: TimeRange;
}

function ChartTooltip({
  active,
  payload,
  label,
  colors,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  colors: ReturnType<typeof useChartColors>;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg"
      style={{
        background: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
      }}
    >
      <p className="text-[11px] text-[var(--fg-muted)]">{label}</p>
      <p className="metric mt-0.5 text-lg font-semibold">{payload[0].value} min</p>
    </div>
  );
}

export function WaitChart({ data, range }: WaitChartProps) {
  const colors = useChartColors();

  if (data.length === 0) {
    return (
      <div className="card flex h-64 items-center justify-center">
        <p className="text-sm text-[var(--fg-muted)]">
          History builds as data is collected every 5 minutes.
        </p>
      </div>
    );
  }

  if (data.length === 1) {
    return (
      <div className="card flex h-64 flex-col items-center justify-center gap-2">
        <p className="metric text-4xl font-semibold">{data[0].wait_time} min</p>
        <p className="text-xs text-[var(--fg-muted)]">First snapshot recorded</p>
      </div>
    );
  }

  const formatXAxis = (timestamp: string) => {
    const date = new Date(timestamp);
    if (range === "today") return format(date, "h:mm a");
    if (range === "7d") return format(date, "EEE");
    return format(date, "MMM d");
  };

  const chartData = data.map((d) => ({
    ...d,
    displayLabel: formatXAxis(d.timestamp),
  }));

  const min = Math.min(...chartData.map((d) => d.wait_time));
  const max = Math.max(...chartData.map((d) => d.wait_time));

  return (
    <div className="card p-4 sm:p-6">
      <div className="mb-4 flex gap-4 text-xs text-[var(--fg-muted)]">
        <span>Low {min}m</span>
        <span>Peak {max}m</span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.line} stopOpacity={0.12} />
              <stop offset="100%" stopColor={colors.line} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="displayLabel"
            tick={{ fill: colors.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: colors.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            unit="m"
            width={32}
          />
          <Tooltip
            content={<ChartTooltip colors={colors} />}
            cursor={{ stroke: colors.grid }}
          />
          <Area
            type="monotone"
            dataKey="wait_time"
            stroke={colors.line}
            strokeWidth={2}
            fill="url(#chartFill)"
            dot={false}
            activeDot={{ r: 4, fill: colors.line }}
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface HourlyChartProps {
  data: { label: string; average: number }[];
}

export function HourlyWaitChart({ data }: HourlyChartProps) {
  const colors = useChartColors();

  if (data.length === 0) {
    return (
      <div className="card flex h-48 items-center justify-center">
        <p className="text-sm text-[var(--fg-muted)]">Not enough data yet</p>
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-6">
      <p className="label mb-4">Average wait by hour</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: colors.tick, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: colors.tick, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            unit="m"
            width={28}
          />
          <Tooltip content={<ChartTooltip colors={colors} />} />
          <Bar
            dataKey="average"
            fill={colors.line}
            fillOpacity={0.2}
            stroke={colors.line}
            strokeWidth={1}
            radius={[4, 4, 0, 0]}
            animationDuration={600}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
