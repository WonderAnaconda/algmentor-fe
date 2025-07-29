import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Clock, 
  TrendingDown, 
  BarChart3, 
  Calendar, 
  Target, 
  Award, 
  Volume2,
  AlertCircle,
  CheckCircle,
  Info,
  TrendingUp
} from 'lucide-react';
import Plot from 'react-plotly.js';
import latestDemoOutput from '../../latest_demo_output.json';
import { useState } from 'react';
import { AnalysisData, PlotData, AnalysisResultsProps } from '@/types/analysis';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import WeekdayAnalysis from './WeekdayAnalysis';

type LatestDemoOutput = { data: Record<string, unknown> };

const getConfidenceColor = (confidence: string) => {
  if (confidence.toLowerCase().includes('high')) {
    return 'bg-profit/20 text-profit-foreground border-profit/30';
  } else if (confidence.toLowerCase().includes('medium')) {
    return 'bg-primary/20 text-primary-foreground !text-white border-primary/30'; // Force white text everywhere
  } else {
    return 'bg-muted/20 text-muted-foreground border-muted/30';
  }
};

// Helper function to count the number of plots for a given type
const getPlotCount = (type: string, analysis?: AnalysisData): number => {
  switch (type) {
    case 'optimal_break_between_trades':
      // Check if we have Pareto front data
      if (analysis?.break_time_pareto?.all_results) {
        const paretoData = analysis.break_time_pareto.all_results;
        const validData = paretoData.filter(point => 
          !isNaN(point.PnL) && 
          !isNaN(point.break_time) &&
          point.PnL !== null &&
          point.break_time !== null
        );
        if (validData.length > 0) {
          // Get available metrics from the data
          const samplePoint = validData[0];
          const availableMetrics = Object.keys(samplePoint).filter(key => 
            key !== 'break_time' && 
            typeof samplePoint[key as keyof typeof samplePoint] === 'number' &&
            !isNaN(samplePoint[key as keyof typeof samplePoint] as number)
          );
          
          // Return 1 for normal width if exactly 1 parameter, otherwise return number of available metrics for wide width
          return availableMetrics.length === 1 ? 1 : availableMetrics.length;
        }
      }
      return 1; // Single plot for fallback
    case 'optimal_intraday_drawdown':
    case 'optimal_max_trades_per_day':
    case 'optimal_trading_hours':
    case 'optimal_time_distance_range':
    case 'optimal_win_rate_window':
    case 'optimal_trading_time_window':
    case 'volume_optimization':
      return 1; // Single plot for these types
    default:
      return 1;
  }
};

// Helper function to get robust legend positioning: always outside plot area to the right
const getLegendPosition = () => ({
  x: 1.02,
  y: 1,
  xanchor: 'left' as const,
  yanchor: 'top' as const,
  bgcolor: 'rgba(0,0,0,0.8)',
  bordercolor: '#374151',
  borderwidth: 1,
  orientation: 'v',
});

// Update RecommendationPlot to accept plotData as a prop
function RecommendationPlot({ type, analysis, plotData, show3DPlot }: { type: string; analysis?: AnalysisData; plotData: PlotData; show3DPlot: boolean }) {
  // Use the plotData prop instead of latestDemoOutput
  const allPlotData = plotData;

  // Common layout for all plots
  const commonLayout = {
    paper_bgcolor: '#18181b',
    plot_bgcolor: '#18181b',
    font: { color: '#e5e7eb', family: 'Inter, sans-serif', size: 14 },
    margin: { t: 80, l: 80, r: 60, b: 80 }, // Better padding for axis labels
    showlegend: false,
    autosize: true,
    // Title styling
    title: {
      font: { size: 18, color: '#f9fafb', family: 'Inter, sans-serif' },
      x: 0.5,
      xanchor: 'center',
      y: 0.95,
      yanchor: 'top'
    },
    // Responsive settings
    uirevision: 'true', // Maintains zoom/pan state across resizes
    // Rounded corners via CSS below
  };
  const plotStyle = { 
    width: '100%', 
    height: 'auto',
    borderRadius: '16px', 
    overflow: 'hidden', 
    boxShadow: '0 2px 8px #0002', 
    background: '#18181b', 
    margin: '16px 0',
    minHeight: '400px',
    maxWidth: '100%'
  };
  
  // Responsive config for all plots
  const responsiveConfig = { 
    displayModeBar: false,
    responsive: true,
    useResizeHandler: true,
    modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
    toImageButtonOptions: {
      format: 'png',
      filename: 'trading_analysis',
      height: 600,
      width: 800,
      scale: 2
    }
  };

  // Common tooltip configuration to prevent truncation
  const tooltipConfig = {
    hovermode: 'closest',
    hoverlabel: {
      bgcolor: '#1f2937',
      bordercolor: '#374151',
      font: { color: '#f9fafb', size: 12 },
      namelength: -1, // Show full name
      align: 'left'
    }
  };

  if (type === 'optimal_break_between_trades') {
    // Check if we have Pareto front data
    if (analysis?.break_time_pareto?.all_results) {
      const paretoData = analysis.break_time_pareto.all_results;
      
      // Filter out NaN values and invalid data
      const validData = paretoData.filter(point => 
        !isNaN(point.PnL) && 
        !isNaN(point.break_time) &&
        point.PnL !== null &&
        point.break_time !== null
      );
      
      if (validData.length > 0) {
        // Get available metrics from the data
        const samplePoint = validData[0];
        const availableMetrics = Object.keys(samplePoint).filter(key => 
          key !== 'break_time' && 
          typeof samplePoint[key as keyof typeof samplePoint] === 'number' &&
          !isNaN(samplePoint[key as keyof typeof samplePoint] as number)
        );
        
        // Only show 3D plot if there are exactly 2 metrics
        const shouldShow3D = show3DPlot && availableMetrics.length === 2;
        
        // Generate 2D plots for each metric
        const plotComponents = availableMetrics.map((metricKey) => {
          const metricName = metricKey === 'PnL' ? 'Cumulative P&L' : 
                           metricKey === 'pnl_std' ? 'PnL Standard Deviation' :
                           metricKey === 'sample_size' ? 'Sample Size' :
                           metricKey === 'win_rate' ? 'Win Rate' : metricKey;
          
          const yAxisTitle = metricKey === 'PnL' ? 'P&L ($)' :
                           metricKey === 'pnl_std' ? 'PnL Standard Deviation ($)' :
                           metricKey === 'sample_size' ? 'Number of Trades' :
                           metricKey === 'win_rate' ? 'Win Rate (%)' : metricKey;
          
          const color = metricKey === 'PnL' ? '#3b82f6' :
                       metricKey === 'pnl_std' ? '#8b5cf6' :
                       metricKey === 'sample_size' ? '#f59e0b' :
                       metricKey === 'win_rate' ? '#10b981' : '#6b7280';
          
          return (
            <div key={`${metricKey}-vs-break-time`}>
              <Plot
                key={`${metricKey}-vs-break-time`}
                data={[{
                  x: validData.map(p => p.break_time / 60),
                  y: validData.map(p => p[metricKey as keyof typeof p] as number),
                  type: 'scatter',
                  mode: 'lines+markers',
                  name: metricName,
                  line: { color: color },
                  marker: { color: color, size: 6 }
                }, ...(analysis.break_time_pareto.pareto_front ? [{
                  x: analysis.break_time_pareto.pareto_front
                    .filter(p => !isNaN(p.PnL) && !isNaN(p.break_time) && p[metricKey as keyof typeof p] !== undefined)
                    .map(p => p.break_time / 60),
                  y: analysis.break_time_pareto.pareto_front
                    .filter(p => !isNaN(p.PnL) && !isNaN(p.break_time) && p[metricKey as keyof typeof p] !== undefined)
                    .map(p => p[metricKey as keyof typeof p] as number),
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Pareto Front',
                  marker: { 
                    color: '#fbbf24',
                    size: 10,
                    symbol: 'diamond',
                    line: { color: '#ffffff', width: 2 }
                  }
                }] : []), ...(analysis.break_time_pareto.best_balanced_point ? [{
                  x: [analysis.break_time_pareto.best_balanced_point.break_time / 60],
                  y: [analysis.break_time_pareto.best_balanced_point[metricKey as keyof typeof analysis.break_time_pareto.best_balanced_point] as number],
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Balanced Optimal',
                  marker: { 
                    color: '#ef4444',
                    size: 12,
                    symbol: 'star',
                    line: { color: '#ffffff', width: 3 }
                  }
                }] : [])]}
                layout={{
                  ...commonLayout,
                  ...tooltipConfig,
                  title: {
                    text: `${metricName} vs Break Time`,
                    font: { size: 16, color: '#f9fafb', family: 'Inter, sans-serif' },
                    x: 0.5,
                    xanchor: 'center',
                    y: 0.95,
                    yanchor: 'top'
                  },
                  xaxis: { 
                    title: { text: 'Break Time Between Trades (minutes)', font: { size: 14, color: '#e5e7eb' } },
                    color: '#e5e7eb', 
                    gridcolor: '#27272a', 
                    zerolinecolor: '#27272a' 
                  },
                  yaxis: { 
                    title: { text: yAxisTitle, font: { size: 14, color: '#e5e7eb' } },
                    color: '#e5e7eb', 
                    gridcolor: '#27272a', 
                    zerolinecolor: '#27272a'
                  },
                  showlegend: true,
                  legend: getLegendPosition()
                }}
                style={plotStyle}
                config={responsiveConfig}
              />
            </div>
          );
        });
        
        // Create 3D scatter plot if exactly 2 metrics
        const threeDPlot = shouldShow3D ? (
          <div className="lg:col-span-2">
            <Plot
              key="pareto-3d-plot"
              data={[{
                x: validData.map(p => p.break_time / 60),
                y: validData.map(p => p[availableMetrics[0] as keyof typeof p] as number),
                z: validData.map(p => p[availableMetrics[1] as keyof typeof p] as number),
                type: 'scatter3d',
                mode: 'markers',
                name: 'All Points',
                marker: { 
                  color: validData.map(p => p.PnL),
                  colorscale: 'Viridis',
                  size: 5,
                  opacity: 0.8,
                  colorbar: {
                    title: 'P&L ($)',
                    titleside: 'right',
                    thickness: 15,
                    len: 0.5
                  }
                },
                text: validData.map(p => 
                  `Break Time: ${(p.break_time / 60).toFixed(1)} min<br>` +
                  `${availableMetrics[0]}: ${(p[availableMetrics[0] as keyof typeof p] as number).toFixed(2)}<br>` +
                  `${availableMetrics[1]}: ${(p[availableMetrics[1] as keyof typeof p] as number).toFixed(2)}<br>` +
                  `Cumulative P&L: $${p.PnL.toLocaleString()}`
                ),
                hoverinfo: 'text'
              }, ...(analysis.break_time_pareto.pareto_front ? [{
                x: analysis.break_time_pareto.pareto_front
                  .filter(p => !isNaN(p.PnL) && !isNaN(p.break_time) && p[availableMetrics[0] as keyof typeof p] !== undefined && p[availableMetrics[1] as keyof typeof p] !== undefined)
                  .map(p => p.break_time / 60),
                y: analysis.break_time_pareto.pareto_front
                  .filter(p => !isNaN(p.PnL) && !isNaN(p.break_time) && p[availableMetrics[0] as keyof typeof p] !== undefined && p[availableMetrics[1] as keyof typeof p] !== undefined)
                  .map(p => p[availableMetrics[0] as keyof typeof p] as number),
                z: analysis.break_time_pareto.pareto_front
                  .filter(p => !isNaN(p.PnL) && !isNaN(p.break_time) && p[availableMetrics[0] as keyof typeof p] !== undefined && p[availableMetrics[1] as keyof typeof p] !== undefined)
                  .map(p => p[availableMetrics[1] as keyof typeof p] as number),
                type: 'scatter3d',
                mode: 'markers',
                name: 'Pareto Front',
                marker: { 
                  color: '#fbbf24',
                  size: 8,
                  symbol: 'diamond',
                  line: { color: '#ffffff', width: 2 }
                },
                text: analysis.break_time_pareto.pareto_front
                  .filter(p => !isNaN(p.PnL) && !isNaN(p.break_time) && p[availableMetrics[0] as keyof typeof p] !== undefined && p[availableMetrics[1] as keyof typeof p] !== undefined)
                  .map(p => 
                    `Break Time: ${(p.break_time / 60).toFixed(1)} min<br>` +
                    `${availableMetrics[0]}: ${(p[availableMetrics[0] as keyof typeof p] as number).toFixed(2)}<br>` +
                    `${availableMetrics[1]}: ${(p[availableMetrics[1] as keyof typeof p] as number).toFixed(2)}<br>` +
                    `Cumulative P&L: $${p.PnL.toLocaleString()}<br>` +
                    `(Pareto Optimal)`
                  ),
                hoverinfo: 'text'
              }] : []), ...(analysis.break_time_pareto.best_balanced_point ? [{
                x: [analysis.break_time_pareto.best_balanced_point.break_time / 60],
                y: [analysis.break_time_pareto.best_balanced_point[availableMetrics[0] as keyof typeof analysis.break_time_pareto.best_balanced_point] as number],
                z: [analysis.break_time_pareto.best_balanced_point[availableMetrics[1] as keyof typeof analysis.break_time_pareto.best_balanced_point] as number],
                type: 'scatter3d',
                mode: 'markers',
                name: 'Balanced Optimal',
                marker: { 
                  color: '#ef4444',
                  size: 12,
                  symbol: 'star',
                  line: { color: '#ffffff', width: 3 }
                },
                text: [`Break Time: ${(analysis.break_time_pareto.best_balanced_point.break_time / 60).toFixed(1)} min<br>` +
                  `${availableMetrics[0]}: ${(analysis.break_time_pareto.best_balanced_point[availableMetrics[0] as keyof typeof analysis.break_time_pareto.best_balanced_point] as number).toFixed(2)}<br>` +
                  `${availableMetrics[1]}: ${(analysis.break_time_pareto.best_balanced_point[availableMetrics[1] as keyof typeof analysis.break_time_pareto.best_balanced_point] as number).toFixed(2)}<br>` +
                  `Cumulative P&L: $${analysis.break_time_pareto.best_balanced_point.PnL.toLocaleString()}<br>` +
                  `(Balanced Optimal - Closest to Global Optima)`],
                hoverinfo: 'text'
              }] : [])]}
              layout={{
                ...commonLayout,
                scene: {
                  xaxis: { 
                    title: { text: 'Breaks (m)', font: { color: '#e5e7eb', size: 14 } },
                    color: '#e5e7eb',
                    gridcolor: '#27272a',
                    zerolinecolor: '#27272a',
                    tickformat: '.0f',
                    tickfont: { color: '#e5e7eb', size: 12 }
                  },
                  yaxis: { 
                    title: { text: availableMetrics[0], font: { color: '#e5e7eb', size: 14 } },
                    color: '#e5e7eb',
                    gridcolor: '#27272a',
                    zerolinecolor: '#27272a',
                    tickfont: { color: '#e5e7eb', size: 12 }
                  },
                  zaxis: { 
                    title: { text: availableMetrics[1], font: { color: '#e5e7eb', size: 14 } },
                    color: '#e5e7eb',
                    gridcolor: '#27272a',
                    zerolinecolor: '#27272a',
                    tickfont: { color: '#e5e7eb', size: 12 }
                  },
                  camera: {
                    eye: { x: 1.5, y: 1.5, z: 1.5 }
                  }
                },
                title: {
                  text: `3D Pareto Front: ${availableMetrics[0]} vs ${availableMetrics[1]} vs Break Time`,
                  font: { size: 18, color: '#f9fafb', family: 'Inter, sans-serif' },
                  x: 0.5,
                  xanchor: 'center',
                  y: 0.95,
                  yanchor: 'top'
                },
                showlegend: true,
                legend: getLegendPosition()
              }}
              style={plotStyle}
              config={{
                ...responsiveConfig,
                displayModeBar: false
              }}
            />
          </div>
        ) : null;
        
        // Return the plots with 3D plot first if it exists
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-0">
            {threeDPlot}
            {plotComponents}
          </div>
        );
      }
    }
    
    // Fallback to 2D plot if no Pareto data
    const data = allPlotData.cumulative_pnl_vs_cooldown_period as { cooldown_minutes: number[]; cumulative_pnl: number[] };
    const optimalMinutesPnL = analysis?.break_time_pareto?.best_per_metric?.PnL;
    const optimalMinutesWinRate = analysis?.break_time_pareto?.best_per_metric?.win_rate;
    
    // Find the optimal points for highlighting
    const optimalIndexPnL = optimalMinutesPnL ? data.cooldown_minutes.findIndex(min => Math.abs(min - optimalMinutesPnL) < 0.1) : -1;
    const optimalIndexWinRate = optimalMinutesWinRate ? data.cooldown_minutes.findIndex(min => Math.abs(min - optimalMinutesWinRate) < 0.1) : -1;
    
    const optimalPointPnL = optimalIndexPnL >= 0 ? {
      x: [data.cooldown_minutes[optimalIndexPnL]],
      y: [data.cumulative_pnl[optimalIndexPnL]]
    } : null;
    
    const optimalPointWinRate = optimalIndexWinRate >= 0 ? {
      x: [data.cooldown_minutes[optimalIndexWinRate]],
      y: [data.cumulative_pnl[optimalIndexWinRate]]
    } : null;
    
    return (
      <Plot
        data={[{
          x: data.cooldown_minutes,
          y: data.cumulative_pnl,
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Cumulative P&L',
          line: { color: '#3b82f6' },
          marker: { color: '#3b82f6' }
        }, ...(optimalPointPnL ? [{
          x: optimalPointPnL.x,
          y: optimalPointPnL.y,
          type: 'scatter',
          mode: 'markers',
          name: 'Best P&L Point',
          marker: { 
            color: '#fbbf24',
            size: 12,
            symbol: 'diamond',
            line: { color: '#ffffff', width: 2 }
          },
          showlegend: false
        }] : []), ...(optimalPointWinRate ? [{
          x: optimalPointWinRate.x,
          y: optimalPointWinRate.y,
          type: 'scatter',
          mode: 'markers',
          name: 'Best Win Rate Point',
          marker: { 
            color: '#10b981',
            size: 12,
            symbol: 'star',
            line: { color: '#ffffff', width: 2 }
          },
          showlegend: false
        }] : [])]}
        layout={{
          ...commonLayout,
          ...tooltipConfig,
          title: {
            text: 'Cumulative P&L vs Cooldown Period',
            font: { size: 18, color: '#f9fafb', family: 'Inter, sans-serif' },
            x: 0.5,
            xanchor: 'center',
            y: 0.95,
            yanchor: 'top'
          },
          xaxis: { 
            title: { text: 'Pause (minutes)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a' 
          },
          yaxis: { 
            title: { text: 'P&L ($)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a' 
          },
        }}
        style={plotStyle}
        config={responsiveConfig}
      />
    );
  }
  if (type === 'optimal_intraday_drawdown') {
    const data = allPlotData.cumulative_pnl_vs_drawdown_threshold as { drawdown_percentages: string[]; cumulative_pnl: number[] };
    const optimalDrawdown = analysis?.optimal_intraday_drawdown?.percentage;
    
    // Find the optimal point for highlighting
    let optimalIndex = -1;
    if (optimalDrawdown && typeof optimalDrawdown === 'number') {
      optimalIndex = data.drawdown_percentages.findIndex(pct => Math.abs(parseFloat(pct) - optimalDrawdown) < 1);
    }
    const optimalPoint = optimalIndex >= 0 ? {
      x: [data.drawdown_percentages[optimalIndex]],
      y: [data.cumulative_pnl[optimalIndex]]
    } : null;
    
    return (
      <Plot
        data={[{
          x: data.drawdown_percentages,
          y: data.cumulative_pnl,
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Cumulative P&L',
          line: { color: '#ef4444' },
          marker: { color: '#ef4444' }
        }, ...(optimalPoint ? [{
          x: optimalPoint.x,
          y: optimalPoint.y,
          type: 'scatter',
          mode: 'markers',
          name: 'Optimal Point',
          marker: { 
            color: '#fbbf24',
            size: 12,
            symbol: 'diamond',
            line: { color: '#ffffff', width: 2 }
          },
          showlegend: false
        }] : [])]}
        layout={{
          ...commonLayout,
          ...tooltipConfig,
          title: {
            text: 'Cumulative P&L vs Drawdown Threshold',
            font: { size: 18, color: '#f9fafb', family: 'Inter, sans-serif' },
            x: 0.5,
            xanchor: 'center',
            y: 0.95,
            yanchor: 'top'
          },
          xaxis: { 
            title: { text: 'Drawdown Threshold (%)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a' 
          },
          yaxis: { 
            title: { text: 'P&L ($)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a' 
          },
        }}
        style={plotStyle}
        config={responsiveConfig}
      />
    );
  }
  if (type === 'optimal_max_trades_per_day') {
    const data = allPlotData.distribution_of_trades_to_peak as { trades_to_peak: (number|string)[] };
    const tradesArray = data.trades_to_peak.map(t => typeof t === 'string' ? parseFloat(t) : t);
    
    // Filter out outliers (top 5% of values)
    const sortedTrades = [...tradesArray].sort((a, b) => a - b);
    const cutoffIndex = Math.floor(sortedTrades.length * 0.95);
    const cutoffValue = sortedTrades[cutoffIndex];
    const filteredTrades = tradesArray.filter(t => t <= cutoffValue);
    
    const minTrades = Math.min(...filteredTrades);
    const maxTrades = Math.max(...filteredTrades);
    const tradesRange = maxTrades - minTrades;
    
    const medianTrades = analysis?.optimal_max_trades_per_day?.median_trades_to_peak;
    const ci_95 = analysis?.optimal_max_trades_per_day?.confidence_interval_95;
    
    // Calculate the range around median trades for highlighting
    const highlightRange = ci_95 ? [ci_95[0], ci_95[1]] : [0, 0];
    
    // Debug logging
    console.log('Median trades:', medianTrades);
    console.log('Highlight range:', highlightRange);
    console.log('Filtered trades range:', { min: minTrades, max: maxTrades });
    
    return (
      <Plot
        data={[{
          x: filteredTrades,
          type: 'histogram',
          marker: { 
            color: '#6366f1',
            width: 0.6
          },
          name: 'Trades to Peak',
          nbinsx: 40, // Very granular binning
          autobinx: false // Disable auto-binning to use custom nbinsx
        }, ...(medianTrades && typeof medianTrades === 'number' ? [{
          // Highlight area around median trades
          x: [highlightRange[0], highlightRange[0], highlightRange[1], highlightRange[1], highlightRange[0]],
          y: [0, 10, 10, 0, 0], // Cover the full height of the chart
          type: 'scatter',
          mode: 'lines',
          fill: 'toself',
          fillcolor: 'hsla(220, 100.00%, 58.60%, 0.20)', // Semi-transparent yellow
          line: { 
            color: 'hsla(220, 100.00%, 58.60%, 0.20)',
            width: 2,
            dash: 'dash'
          },
          name: 'Optimal Range',
          showlegend: false
        }] : [])]}
        layout={{
          ...commonLayout,
          ...tooltipConfig,
          title: {
            text: 'Distribution of Trades to Peak',
            font: { size: 18, color: '#f9fafb', family: 'Inter, sans-serif' },
            x: 0.5,
            xanchor: 'center',
            y: 0.95,
            yanchor: 'top'
          },
          xaxis: { 
            title: { text: 'Trades to Peak (count)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a',
            range: [minTrades - tradesRange * 0.1, maxTrades + tradesRange * 0.1],
            nticks: 15, // More x-axis labels
            tickmode: 'auto'
          },
          yaxis: { 
            title: { text: 'Frequency (days)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a',
            autorange: true,
            rangemode: 'tozero'
          },
          bargap: 0.2,
          bargroupgap: 0.1,
          barmode: 'overlay'
        }}
        style={plotStyle}
        config={responsiveConfig}
      />
    );
  }
  if (type === 'optimal_trading_hours') {
    const peakData = allPlotData.distribution_of_peak_pnl_times as { pnl: (number|string)[]; time: string[] };
    const troughData = allPlotData.distribution_of_trough_pnl_times as { pnl: (number|string)[]; time: string[] } | undefined;
    
    // Process peak data
    const peakPnlArray = peakData.pnl.map(p => typeof p === 'string' ? parseFloat(p) : p);
    const peakTimeData = peakData.time.map((timeStr, index) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const minutesSinceMidnight = hours * 60 + minutes;
      return {
        time: timeStr,
        minutesSinceMidnight,
        pnl: peakPnlArray[index]
      };
    }).sort((a, b) => a.minutesSinceMidnight - b.minutesSinceMidnight);
    
    // Process trough data (if available)
    let troughPnlArray: number[] = [];
    let troughTimeData: Array<{time: string; minutesSinceMidnight: number; pnl: number}> = [];
    
    if (troughData && troughData.pnl && troughData.time) {
      troughPnlArray = troughData.pnl.map(p => typeof p === 'string' ? parseFloat(p) : p);
      troughTimeData = troughData.time.map((timeStr, index) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const minutesSinceMidnight = hours * 60 + minutes;
        return {
          time: timeStr,
          minutesSinceMidnight,
          pnl: troughPnlArray[index]
        };
      }).sort((a, b) => a.minutesSinceMidnight - b.minutesSinceMidnight);
    }
    
    // Combine all times for range calculation
    const allMinutes = [...peakTimeData.map(d => d.minutesSinceMidnight), ...troughTimeData.map(d => d.minutesSinceMidnight)];
    
    // Filter out outliers using IQR method for more reasonable range
    const sortedMinutes = allMinutes.sort((a, b) => a - b);
    const q1 = sortedMinutes[Math.floor(sortedMinutes.length * 0.25)];
    const q3 = sortedMinutes[Math.floor(sortedMinutes.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    // Use filtered range, but ensure we include at least 90% of the data
    const filteredMinutes = allMinutes.filter(m => m >= lowerBound && m <= upperBound);
    const minTime = Math.min(...filteredMinutes);
    const maxTime = Math.max(...filteredMinutes);
    const timeRange = maxTime - minTime;
    
    const peakClusters = analysis?.optimal_trading_hours?.peak_clusters;
    const troughClusters = analysis?.optimal_trading_hours?.trough_clusters;
    
            // Create highlight shapes for peak and trough clusters
        const clusterShapes = [];
        
        // Add peak cluster shapes (green highlights)
        if (peakClusters && Array.isArray(peakClusters)) {
          peakClusters.forEach((cluster, index) => {
            const startTime = cluster.start_time;
            const endTime = cluster.end_time;
            
            // Convert cluster times to minutes since midnight
            const [startHours, startMinutes] = startTime.split(':').map(Number);
            const [endHours, endMinutes] = endTime.split(':').map(Number);
            const startMinutesSinceMidnight = startHours * 60 + startMinutes;
            const endMinutesSinceMidnight = endHours * 60 + endMinutes;
            
            // Create green colors for peak clusters
            const colors = [
              'rgba(56, 189, 248, 0.1)',   // Light blue, transparent
              'rgba(14, 165, 233, 0.1)',   // Darker light blue, transparent
              'rgba(2, 132, 199, 0.1)',    // Even darker light blue, transparent
            ];
            const color = colors[index % colors.length];
            
            clusterShapes.push({
              type: 'rect',
              x0: startMinutesSinceMidnight,
              x1: endMinutesSinceMidnight,
              y0: 0,
              y1: Math.max(...peakPnlArray),
              fillcolor: color,
              line: { color: color.replace('0.1', '0.4'), width: 1, dash: 'solid' },
              layer: 'below'
            });
          });
        }
        
        // Add trough cluster shapes (red highlights)
        if (troughClusters && Array.isArray(troughClusters) && troughPnlArray.length > 0) {
          troughClusters.forEach((cluster, index) => {
            const startTime = cluster.start_time;
            const endTime = cluster.end_time;
            
            // Convert cluster times to minutes since midnight
            const [startHours, startMinutes] = startTime.split(':').map(Number);
            const [endHours, endMinutes] = endTime.split(':').map(Number);
            const startMinutesSinceMidnight = startHours * 60 + startMinutes;
            const endMinutesSinceMidnight = endHours * 60 + endMinutes;
            
            // Create red colors for trough clusters
            const colors = [
              'rgba(30, 58, 138, 0.1)',   // Dark blue, transparent
              'rgba(30, 58, 138, 0.1)',   // Darker dark blue, transparent
              'rgba(30, 58, 138, 0.1)',   // Even darker dark blue, transparent
            ];
            const color = colors[index % colors.length];
            
            clusterShapes.push({
              type: 'rect',
              x0: startMinutesSinceMidnight,
              x1: endMinutesSinceMidnight,
              y0: Math.min(...troughPnlArray),
              y1: 0,
              fillcolor: color,
              line: { color: color.replace('0.1', '0.4'), width: 1, dash: 'solid' },
              layer: 'below'
            });
          });
        }
    
    // Prepare plot data
    const plotData = [
      {
        x: peakTimeData.map(d => d.minutesSinceMidnight),
        y: peakTimeData.map(d => d.pnl),
        type: 'bar',
        marker: { 
          color: '#38bdf8',
          width: 0.6
        },
        name: 'Peak P&L'
      }
    ];
    
    // Add trough data if available
    if (troughTimeData.length > 0) {
      plotData.push({
        x: troughTimeData.map(d => d.minutesSinceMidnight),
        y: troughTimeData.map(d => d.pnl),
        type: 'bar',
        marker: { 
          color: '#1e3a8a',
          width: 0.6
        },
        name: 'Trough P&L'
      });
    }
    
    return (
      <Plot
        data={plotData}
        layout={{
          ...commonLayout,
          ...tooltipConfig,
          shapes: clusterShapes,
          title: {
            text: 'Distribution of Peak and Trough P&L Times',
            font: { size: 18, color: '#f9fafb', family: 'Inter, sans-serif' },
            x: 0.5,
            xanchor: 'center',
            y: 0.95,
            yanchor: 'top'
          },
          xaxis: { 
            title: { text: 'Time of Day (HH:MM)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a',
            range: [minTime - timeRange * 0.05, maxTime + timeRange * 0.05],
            tickmode: 'array',
            tickvals: Array.from({length: 8}, (_, i) => minTime + (timeRange * i / 7)),
            ticktext: Array.from({length: 8}, (_, i) => {
              const minutes = minTime + (timeRange * i / 7);
              const hours = Math.floor(minutes / 60);
              const mins = Math.floor(minutes % 60);
              return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            })
          },
          yaxis: { 
            title: { text: 'P&L ($)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a',
            range: [
              troughPnlArray.length > 0 ? Math.min(...troughPnlArray) - Math.abs(Math.min(...troughPnlArray)) * 0.1 : Math.min(...peakPnlArray) - Math.abs(Math.min(...peakPnlArray)) * 0.1, 
              Math.max(...peakPnlArray) + Math.abs(Math.max(...peakPnlArray)) * 0.1
            ]
          },
          bargap: 0.2,
          bargroupgap: 0.1,
          barmode: 'overlay'
        }}
        style={plotStyle}
        config={responsiveConfig}
      />
    );
  }
  if (type === 'optimal_time_distance_range') {
    const data = allPlotData.total_pnl_by_time_distance_bin as { time_distance_seconds: (number|string)[]; total_pnl: (number|string)[] };
    const data2 = allPlotData.pnl_vs_time_distance as { time_distance_minutes: (number|string)[]; pnl: (number|string)[] };
    const timeArray = data.time_distance_seconds.map(t => typeof t === 'string' ? parseFloat(t) : t);
    const pnlArray = data.total_pnl.map(p => typeof p === 'string' ? parseFloat(p) : p);
    const minTime = Math.min(...timeArray);
    const maxTime = Math.max(...timeArray);
    const timeRange = maxTime - minTime;
    const minPnl = Math.min(...pnlArray);
    const maxPnl = Math.max(...pnlArray);
    const pnlRange = maxPnl - minPnl;
    
    const optimalMinMinutes = analysis?.optimal_time_distance_range?.min_minutes;
    const optimalMaxMinutes = analysis?.optimal_time_distance_range?.max_minutes;
    
    // Convert to seconds for highlighting
    const optimalMinSeconds = optimalMinMinutes ? optimalMinMinutes * 60 : null;
    const optimalMaxSeconds = optimalMaxMinutes ? optimalMaxMinutes * 60 : null;
    
    return (
      <Plot
        data={[...(optimalMinMinutes && optimalMaxMinutes ? [{
          x: [optimalMinMinutes, optimalMaxMinutes, optimalMaxMinutes, optimalMinMinutes, optimalMinMinutes],
          y: [Math.min(...data2.pnl.map(p => typeof p === 'string' ? parseFloat(p) : p)), Math.min(...data2.pnl.map(p => typeof p === 'string' ? parseFloat(p) : p)), Math.max(...data2.pnl.map(p => typeof p === 'string' ? parseFloat(p) : p)), Math.max(...data2.pnl.map(p => typeof p === 'string' ? parseFloat(p) : p)), Math.min(...data2.pnl.map(p => typeof p === 'string' ? parseFloat(p) : p))],
          type: 'scatter',
          mode: 'lines',
          line: { color: '#fbbf24', width: 2 },
          fill: 'toself',
          fillcolor: 'rgba(251, 191, 36, 0.2)',
          name: 'Optimal Time Range',
          showlegend: false
        }] : []), {
          x: data2.time_distance_minutes.map(t => typeof t === 'string' ? parseFloat(t) : t),
          y: data2.pnl.map(p => typeof p === 'string' ? parseFloat(p) : p),
          type: 'scatter',
          mode: 'markers',
          marker: { 
            color: '#6366f1',
            size: 4,
            opacity: 0.7
          },
          name: 'P&L vs Time Distance'
        }]}
        layout={{
          ...commonLayout,
          ...tooltipConfig,
          title: {
            text: 'P&L vs Time Distance',
            font: { size: 18, color: '#f9fafb', family: 'Inter, sans-serif' },
            x: 0.5,
            xanchor: 'center',
            y: 0.95,
            yanchor: 'top'
          },
          xaxis: { 
            title: { text: 'Time Distance (minutes)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a' 
          },
          yaxis: { 
            title: { text: 'P&L ($)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a' 
          },
        }}
        style={plotStyle}
        config={responsiveConfig}
      />
    );
  }
  if (type === 'optimal_win_rate_window') {
    const data = allPlotData.win_rate_vs_avg_time_distance_over_30m_window as { time_distance: (number|string)[]; win_rate: (number|string)[]; time_distance_sorted: (number|string)[]; rolling_win_rate: (number|string)[] };
    
    return (
      <Plot
        data={[{
          x: data.time_distance.map(t => typeof t === 'string' ? parseFloat(t) : t),
          y: data.win_rate.map(w => typeof w === 'string' ? parseFloat(w) : w),
          type: 'scatter',
          mode: 'markers',
          marker: { 
            color: '#f472b6',
            opacity: 0.2,
            size: 4
          },
          name: 'Win Rate'
        }, {
          x: data.time_distance_sorted.map(t => typeof t === 'string' ? parseFloat(t) : t),
          y: data.rolling_win_rate.map(w => typeof w === 'string' ? parseFloat(w) : w),
          type: 'scatter',
          mode: 'lines',
          line: { color: '#6366f1', width: 2 },
          name: 'Rolling Win Rate'
        }]}
        layout={{
          ...commonLayout,
          ...tooltipConfig,
          title: {
            text: 'Win Rate vs Avg Time Distance (30m Window)',
            font: { size: 18, color: '#f9fafb', family: 'Inter, sans-serif' },
            x: 0.5,
            xanchor: 'center',
            y: 0.95,
            yanchor: 'top'
          },
          xaxis: { 
            title: { text: 'Avg Time Distance (minutes)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a' 
          },
          yaxis: { 
            title: { text: 'Win Rate (%)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a' 
          },
        }}
        style={plotStyle}
        config={responsiveConfig}
      />
    );
  }
  if (type === 'optimal_trading_time_window') {
    const data = allPlotData.win_rate_vs_avg_time_distance_over_30m_window as { time_distance: (number|string)[]; win_rate: (number|string)[]; time_distance_sorted: (number|string)[]; rolling_win_rate: (number|string)[] };
    const optimalTimeDistance = analysis?.optimal_trading_time_window?.optimal_time_distance_minutes;
    const optimalWinRate = analysis?.optimal_trading_time_window?.optimal_win_rate;
    
    // Find the optimal point for highlighting
    let optimalIndex = -1;
    if (optimalTimeDistance && typeof optimalTimeDistance === 'number') {
      optimalIndex = data.time_distance_sorted.map(t => typeof t === 'string' ? parseFloat(t) : t).findIndex(time => Math.abs(time - optimalTimeDistance) < 0.1);
    }
    const optimalPoint = optimalIndex >= 0 ? {
      x: [typeof data.time_distance_sorted[optimalIndex] === 'string' ? parseFloat(data.time_distance_sorted[optimalIndex] as string) : data.time_distance_sorted[optimalIndex]],
      y: [typeof data.rolling_win_rate[optimalIndex] === 'string' ? parseFloat(data.rolling_win_rate[optimalIndex] as string) : data.rolling_win_rate[optimalIndex]]
    } : null;
    
    return (
      <Plot
        data={[{
          x: data.time_distance.map(t => typeof t === 'string' ? parseFloat(t) : t),
          y: data.win_rate.map(w => typeof w === 'string' ? parseFloat(w) : w),
          type: 'scatter',
          mode: 'markers',
          marker: { 
            color: '#f472b6',
            opacity: 0.2,
            size: 4
          },
          name: 'Win Rate'
        }, {
          x: data.time_distance_sorted.map(t => typeof t === 'string' ? parseFloat(t) : t),
          y: data.rolling_win_rate.map(w => typeof w === 'string' ? parseFloat(w) : w),
          type: 'scatter',
          mode: 'lines',
          line: { color: '#6366f1', width: 2 },
          name: 'Rolling Win Rate'
        }, ...(optimalPoint ? [{
          x: optimalPoint.x,
          y: optimalPoint.y,
          type: 'scatter',
          mode: 'markers',
          name: 'Optimal Point',
          marker: { 
            color: '#fbbf24',
            size: 12,
            symbol: 'diamond',
            line: { color: '#ffffff', width: 2 }
          },
          showlegend: false
        }] : [])]}
        layout={{
          ...commonLayout,
          ...tooltipConfig,
          title: {
            text: 'Optimal Trading Time Window',
            font: { size: 18, color: '#f9fafb', family: 'Inter, sans-serif' },
            x: 0.5,
            xanchor: 'center',
            y: 0.95,
            yanchor: 'top'
          },
          xaxis: { 
            title: { text: 'Time Distance (minutes)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a' 
          },
          yaxis: { 
            title: { text: 'Win Rate (%)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a' 
          },
        }}
        style={plotStyle}
        config={responsiveConfig}
      />
    );
  }
  if (type === 'volume_optimization') {
    const data = allPlotData.volume_vs_time_distance as { time_distance: (number|string)[]; volume: (number|string)[] };
    
    // Create coordinate pairs from time_distance and volume arrays
    const points = data.time_distance.map((time, index) => ({
      x: typeof time === 'string' ? parseFloat(time) : time,
      y: typeof data.volume[index] === 'string' ? parseFloat(data.volume[index] as string) : data.volume[index]
    }));
    
    return (
      <Plot
        data={[{
          x: points.map(p => p.x),
          y: points.map(p => p.y),
          type: 'scatter',
          mode: 'markers',
          marker: { color: '#fbbf24' },
          name: 'Volume vs Time Distance'
        }]}
        layout={{
          ...commonLayout,
          ...tooltipConfig,
          title: {
            text: 'Volume vs Time Distance',
            font: { size: 18, color: '#f9fafb', family: 'Inter, sans-serif' },
            x: 0.5,
            xanchor: 'center',
            y: 0.95,
            yanchor: 'top'
          },
          xaxis: { 
            title: { text: 'Time Distance (minutes)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a' 
          },
          yaxis: { 
            title: { text: 'Volume (contracts)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a',
            tickmode: 'linear',
            dtick: 1,
            tickformat: 'd'
          },
        }}
        style={plotStyle}
        config={responsiveConfig}
      />
    );
  }
  return null;
}

export function AnalysisResults({ analysis, onReset, plotData, onExportPDF, analysisResult, elementRef }: AnalysisResultsProps & { onReset?: () => void; plotData: PlotData }) {
  const [showPlots, setShowPlots] = useState(true);
  const [show3DPlot, setShow3DPlot] = useState(false); // NEW: state for 3D plot toggle

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Top Controls Row */}
      {/* Removed duplicate controls row, now only rendered in Dashboard */}

      {/* Key Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        {analysis.optimal_max_trades_per_day && (
            <Card className="bg-gradient-card shadow-card hover-scale">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Optimal Max Trades/Day</p>
                    <p className="text-2xl font-bold text-primary">
                      {analysis.optimal_max_trades_per_day.median_trades_to_peak}
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          )}

        {analysis.optimal_trading_hours && (
          <Card className="bg-gradient-card shadow-card hover-scale">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Optimal Trading Window</p>
                  <p className="text-2xl font-bold text-profit">
                    {analysis.optimal_trading_hours.average_peak_time}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-profit" />
              </div>
            </CardContent>
          </Card>
        )}

        {analysis.break_time_pareto && (
          <Card className="bg-gradient-card shadow-card hover-scale">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Optimal Break Duration</p>
                  <p className="text-2xl font-bold text-profit">
                    {(() => {
                      const breakTimeSeconds = analysis.break_time_pareto.best_balanced_point 
                        ? analysis.break_time_pareto.best_balanced_point.break_time
                        : analysis.break_time_pareto.best_per_metric.PnL;
                      const hours = Math.floor(breakTimeSeconds / 3600);
                      const minutes = Math.floor((breakTimeSeconds % 3600) / 60);
                      const seconds = breakTimeSeconds % 60;
                      let timeString = '';
                      if (hours > 0) {
                        timeString += `${hours}:`;
                      }
                      if (minutes > 0 || hours > 0) {
                        timeString += `${minutes.toString().padStart(2, '0')}:`;
                      }
                      timeString += `${seconds.toString().padStart(2, '0')}`;
                      return timeString;
                    })()}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-profit" />
              </div>
            </CardContent>
          </Card>
        )}

        {analysis.optimal_intraday_drawdown && (
          <Card className="bg-gradient-card shadow-card hover-scale">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ideal Max Drawdown</p>
                  <p className="text-2xl font-bold text-loss">
                    {analysis.optimal_intraday_drawdown.percentage}%
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-loss" />
              </div>
            </CardContent>
          </Card>
        )}  
      </div>

      {/* Detailed Analysis Sections */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Trading Hours Optimization */}
        {analysis.optimal_trading_hours && (
          <Card className={`bg-gradient-card shadow-card ${
            getPlotCount('optimal_trading_hours', analysis) > 2 ? 'lg:col-span-2' : ''
          }`}>
            <CardHeader className="min-h-[96px]">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Trading Hours Optimization
                </CardTitle>
                {/* Add future dollar improvement here if needed */}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Optimal Peak Time</span>
                  {analysis.optimal_trading_hours.confidence !== '?' && (
                    <Badge variant="outline" className={getConfidenceColor(analysis.optimal_trading_hours.confidence)}>
                      {analysis.optimal_trading_hours.confidence.split(' - ')[0]} Confidence
                    </Badge>
                  )}
                </div>
                <div className="bg-muted/10 rounded-lg p-4">
                  <p className="text-2xl font-bold mb-2">
                    {analysis.optimal_trading_hours.average_peak_time}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {analysis.optimal_trading_hours.explanation}
                  </p>
                  
                  {/* Display peak clusters if available */}
                  {analysis.optimal_trading_hours.peak_clusters && analysis.optimal_trading_hours.peak_clusters.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-blue-400">Peak Clusters (Optimal Times):</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {analysis.optimal_trading_hours.peak_clusters.map((cluster, index) => (
                          <div key={index} className="bg-blue-400/10 rounded p-2 border border-blue-400/30">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-medium">
                                {cluster.start_time}-{cluster.end_time}
                              </span>
                              <span className="text-xs text-blue-400 font-bold">
                                {cluster.percentage}%
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {cluster.count} peak{cluster.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}           
                  {/* Display trough clusters if available */}
                  {analysis.optimal_trading_hours.trough_clusters && analysis.optimal_trading_hours.trough_clusters.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-blue-900">Trough Clusters (be cautious):</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {analysis.optimal_trading_hours.trough_clusters
                          .slice() // copy to avoid mutating original
                          .sort((a, b) => {
                            // Parse "hh:mm" to minutes for comparison
                            const [aH, aM] = a.start_time.split(':').map(Number);
                            const [bH, bM] = b.start_time.split(':').map(Number);
                            return (aH * 60 + aM) - (bH * 60 + bM);
                          })
                          .map((cluster, index) => (
                          <div key={index} className="bg-blue-900/10 rounded p-2 border border-blue-900/30">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-medium">
                                {cluster.start_time}-{cluster.end_time}
                              </span>
                              <span className="text-xs text-blue-900 font-bold">
                                {cluster.percentage}%
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {cluster.count} trough{cluster.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {showPlots && <RecommendationPlot type="optimal_trading_hours" analysis={analysis} plotData={plotData} show3DPlot={show3DPlot} />}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Risk Management */}
        {(analysis.optimal_intraday_drawdown || analysis.optimal_max_trades_per_day) && (
          <Card className={`bg-gradient-card shadow-card ${
            (analysis.optimal_intraday_drawdown && getPlotCount('optimal_intraday_drawdown', analysis) > 2) ||
            (analysis.optimal_max_trades_per_day && getPlotCount('optimal_max_trades_per_day', analysis) > 2)
              ? 'lg:col-span-2' 
              : ''
          }`}>
            <CardHeader className="min-h-[96px]">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full gap-2">
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-loss" />
                  Risk Management
                </CardTitle>
                {analysis.optimal_intraday_drawdown?.potential_dollar_gain > 0 && (
                  <div className="flex items-center gap-1 text-profit justify-end md:justify-end">
                    <span className="text-xl font-semibold">
                      +${analysis.optimal_intraday_drawdown.potential_dollar_gain.toLocaleString()}
                    </span>
                    <TrendingUp className="h-4 w-4" />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {analysis.optimal_intraday_drawdown && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Optimal Intraday Drawdown</span>
                    {analysis.optimal_intraday_drawdown.confidence !== '?' && (
                      <Badge variant="outline" className={getConfidenceColor(analysis.optimal_intraday_drawdown.confidence)}>
                        {analysis.optimal_intraday_drawdown.confidence.split(' - ')[0]} Confidence
                      </Badge>
                    )}
                  </div>
                  <div className="bg-gradient-loss rounded-lg p-4">
                    <p className="text-2xl font-bold mb-2 text-loss-foreground">
                      {analysis.optimal_intraday_drawdown.percentage}%
                    </p>
                    <p className="text-sm text-loss-foreground/80">
                      {analysis.optimal_intraday_drawdown.explanation}
                    </p>
                    {/* Ego trading summary info box */}
                    {analysis.optimal_intraday_drawdown.ego_trading_summary && (
                      <Alert className="my-4">
                        <AlertCircle className="w-5 h-5" />
                        <AlertTitle>Ego Trading Analysis</AlertTitle>
                        <AlertDescription>
                          {analysis.optimal_intraday_drawdown.ego_trading_summary}
                        </AlertDescription>
                      </Alert>
                    )}
                    {showPlots && <RecommendationPlot type="optimal_intraday_drawdown" analysis={analysis} plotData={plotData} show3DPlot={show3DPlot} />}
                  </div>
                </div>
              )}

              {analysis.optimal_max_trades_per_day && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Optimal Max Trades/Day</span>
                    {analysis.optimal_max_trades_per_day.confidence !== '?' && (
                      <Badge variant="outline" className={getConfidenceColor(analysis.optimal_max_trades_per_day.confidence)}>
                        {analysis.optimal_max_trades_per_day.confidence.split(' - ')[0]} Confidence
                      </Badge>
                    )}
                  </div>
                  <div className="bg-muted/10 rounded-lg p-4">
                    <p className="text-2xl font-bold mb-2">
                      {Math.round(analysis.optimal_max_trades_per_day.median_trades_to_peak)} trades
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {analysis.optimal_max_trades_per_day.recommendation} {analysis.optimal_max_trades_per_day.explanation}
                    </p>
                    {/* Overtrading summary info box */}
                    {analysis.optimal_max_trades_per_day.overtrading_summary && (
                      <Alert className="my-4">
                        <AlertCircle className="w-5 h-5" />
                        <AlertTitle>Overtrading Analysis</AlertTitle>
                        <AlertDescription>
                          {analysis.optimal_max_trades_per_day.overtrading_summary}
                        </AlertDescription>
                      </Alert>
                    )}
                    {showPlots && <RecommendationPlot type="optimal_max_trades_per_day" analysis={analysis} plotData={plotData} show3DPlot={show3DPlot} />}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Optimal Trading Time Window by pareto front*/}
        {analysis.break_time_pareto && (
          <Card className={`bg-gradient-card shadow-card ${
            getPlotCount('optimal_break_between_trades', analysis) > 1 ? 'lg:col-span-2' : ''
          }`}>
            <CardHeader className="min-h-[96px]">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full gap-2">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Optimal Break Duration
                </CardTitle>
                {analysis.break_time_pareto?.potential_dollar_gain > 0 && (
                  <div className="flex items-center gap-1 text-profit justify-end md:justify-end">
                    <span className="text-xl font-semibold">
                      +${analysis.break_time_pareto.potential_dollar_gain.toLocaleString()}
                    </span>
                    <TrendingUp className="h-4 w-4" />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Break Time Optimization</span>
                  <Badge variant="outline" className="text-green-500 border-green-500">
                    Multi-Objective
                  </Badge>
                </div>
                <div className="bg-muted/10 rounded-lg p-4">
                  <p className="text-2xl font-bold mb-2">
                    {Math.round(analysis.break_time_pareto?.best_balanced_point?.break_time / 60)} minutes
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This shows the optimal pause duration between trades, optimised for: <b>{analysis.break_time_pareto.metrics.join(', ')}</b>. The points labelled 'Pareto Front' are those where getting a more optimal result for one metric would worsen another, so they are optimal in that sense.
                  </p>
                  <div className="flex justify-end items-center mb-4 gap-2">
                    <Label htmlFor="show-3d-plot" className="text-xs">
                      {analysis.break_time_pareto.metrics.length === 2 
                        ? "Show 3D Pareto Front Plot" 
                        : `3D Plot (${analysis.break_time_pareto.metrics.length} parameters - requires exactly 2)`}
                    </Label>
                    <Switch 
                      id="show-3d-plot" 
                      checked={show3DPlot} 
                      onCheckedChange={setShow3DPlot}
                      disabled={analysis.break_time_pareto.metrics.length !== 2}
                    />
                  </div>
                  {showPlots && <RecommendationPlot type="optimal_break_between_trades" analysis={analysis} plotData={plotData} show3DPlot={show3DPlot} />}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Items Summary */}
      <Card className="bg-gradient-primary shadow-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary-foreground">
            <Target className="h-5 w-5 text-primary-foreground" />
            Key Action Items
          </CardTitle>
        </CardHeader>
        <CardContent className="text-primary-foreground">
          <div className="grid gap-4 md:grid-cols-2">
            {analysis.break_time_pareto?.best_balanced_point && (
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center mt-2 flex-shrink-0">
                  <span className="w-3 h-3 bg-profit rounded-full block" style={{ boxShadow: '0 0 0 2px #fff' }}></span>
                </div>
                <div>
                  <p className="font-medium">Wait about {Math.round(analysis.break_time_pareto.best_balanced_point.break_time / 60)} minutes between trades to maximise PnL</p>
                  <p className="text-sm text-black">
                    This could improve your P&L by up to ${analysis.break_time_pareto.potential_dollar_gain?.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {analysis.optimal_intraday_drawdown && (
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center mt-2 flex-shrink-0">
                  <span className="w-3 h-3 bg-loss rounded-full block" style={{ boxShadow: '0 0 0 2px #fff' }}></span>
                </div>
                <div>
                  <p className="font-medium">Stop trading at about {analysis.optimal_intraday_drawdown.percentage}% drawdown</p>
                  <p className="text-sm text-black">
                    {analysis.optimal_intraday_drawdown.explanation}
                  </p>
                </div>
              </div>
            )}

            {analysis.optimal_trading_hours && (
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center mt-2 flex-shrink-0">
                  <span className="w-3 h-3 bg-primary rounded-full block" style={{ boxShadow: '0 0 0 2px #fff' }}></span>
                </div>
                <div>
                  <p className="font-medium">Focus trading around {analysis.optimal_trading_hours.average_peak_time}</p>
                  <p className="text-sm text-black">
                    Your P&L typically peaks within this time window
                  </p>
                </div>
              </div>
            )}

            {analysis.optimal_max_trades_per_day && (
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center mt-2 flex-shrink-0">
                  <span className="w-3 h-3 bg-primary rounded-full block" style={{ boxShadow: '0 0 0 2px #fff' }}></span>
                </div>
                <div>
                  <p className="font-medium">Limit to about {Math.round(analysis.optimal_max_trades_per_day.confidence_interval_95[0])} - {Math.round(analysis.optimal_max_trades_per_day.confidence_interval_95[1]  )} trades per day</p>
                  <p className="text-sm text-black">
                    You reach your peak P&L typically at this number of trades per day
                  </p>
                </div>
              </div>
            )}

            {analysis.optimal_trading_time_window && (
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center mt-2 flex-shrink-0">
                  <span className="w-3 h-3 bg-profit rounded-full block" style={{ boxShadow: '0 0 0 2px #fff' }}></span>
                </div>
                <div>
                  <p className="font-medium">Wait about {Math.floor(analysis.optimal_trading_time_window.optimal_time_distance_minutes)}:{(analysis.optimal_trading_time_window.optimal_time_distance_minutes % 1 * 60).toFixed(0).padStart(2, '0')} between trades to maximise win rate</p>
                  <p className="text-sm text-black">
                    This could improve your win rate by up to +{analysis.optimal_trading_time_window.win_rate_improvement.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 