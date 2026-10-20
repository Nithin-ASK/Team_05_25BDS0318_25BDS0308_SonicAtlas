import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import {
  ScatterChart, LineChart, BarChart, BoxplotChart, RadarChart, ParallelChart, GraphChart, HeatmapChart, CustomChart, LinesChart,
} from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, BrushComponent, VisualMapComponent,
  MarkLineComponent, MarkPointComponent, MarkAreaComponent, TitleComponent, ToolboxComponent, ParallelComponent,
  RadarComponent, DatasetComponent, AriaComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useMemo, forwardRef } from 'react';
import { useTheme } from '../lib/theme';
import { paletteFor } from '../lib/palette';

echarts.use([
  ScatterChart, LineChart, BarChart, BoxplotChart, RadarChart, ParallelChart, GraphChart, HeatmapChart, CustomChart, LinesChart,
  GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, BrushComponent, VisualMapComponent,
  MarkLineComponent, MarkPointComponent, MarkAreaComponent, TitleComponent, ToolboxComponent, ParallelComponent,
  RadarComponent, DatasetComponent, AriaComponent, CanvasRenderer,
]);

export { echarts };

export function useChartColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const dark = theme === 'dark';
    return {
      dark,
      palette: paletteFor(theme),
      text: dark ? '#e6eaf0' : '#1f2937',
      subtle: dark ? '#a3acba' : '#4b5563',
      grid: dark ? '#2d3748' : '#e5e7eb',
      axis: dark ? '#4a5568' : '#9ca3af',
      tooltipBg: dark ? '#1b2230' : '#ffffff',
      bg: 'transparent',
    };
  }, [theme]);
}

export interface ChartProps {
  option: any;
  height?: number | string;
  className?: string;
  /** Accessible description of what the chart shows. */
  ariaLabel: string;
  onEvents?: Record<string, (e: any, chart: any) => void>;
  notMerge?: boolean;
}

/** Applies theme defaults (text colours, axis/grid colours, palette, tooltip) to any ECharts option. */
export const Chart = forwardRef<ReactEChartsCore, ChartProps>(function Chart({ option, height = 360, className, ariaLabel, onEvents, notMerge = true }, ref) {
  const c = useChartColors();
  const themed = useMemo(() => {
    const axisDefaults = (ax: any) => {
      if (!ax) return ax;
      const one = (a: any) => ({
        axisLine: { lineStyle: { color: c.axis } },
        axisTick: { lineStyle: { color: c.axis } },
        axisLabel: { color: c.subtle, ...(a.axisLabel ?? {}) },
        nameTextStyle: { color: c.subtle, ...(a.nameTextStyle ?? {}) },
        splitLine: { lineStyle: { color: c.grid }, ...(a.splitLine ?? {}) },
        ...a,
      });
      return Array.isArray(ax) ? ax.map(one) : one(ax);
    };
    return {
      backgroundColor: 'transparent',
      color: c.palette,
      textStyle: { color: c.text, fontFamily: 'Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif' },
      aria: { enabled: true, label: { description: ariaLabel } },
      animationDuration: 400,
      ...option,
      tooltip: option.tooltip === false ? undefined : {
        backgroundColor: c.tooltipBg,
        borderColor: c.grid,
        textStyle: { color: c.text, fontSize: 12 },
        confine: true,
        ...(option.tooltip ?? {}),
      },
      legend: option.legend ? { textStyle: { color: c.subtle }, inactiveColor: c.grid, ...option.legend } : undefined,
      xAxis: axisDefaults(option.xAxis),
      yAxis: axisDefaults(option.yAxis),
    };
  }, [option, c, ariaLabel]);
  return (
    <div className={className} role="img" aria-label={ariaLabel}>
      <ReactEChartsCore
        ref={ref}
        echarts={echarts}
        option={themed}
        notMerge={notMerge}
        lazyUpdate
        style={{ height, width: '100%' }}
        onEvents={onEvents}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
});
