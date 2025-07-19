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
import allPlotData from '../../all_plot_data.json';
import { useState } from 'react';

interface AnalysisData {
  optimal_break_between_trades?: {
    minutes: number;
    explanation: string;
    pnl_improvement: number;
    confidence: string;
    robustness: string;
  };
  optimal_intraday_drawdown?: {
    percentage: number;
    explanation: string;
    confidence: string;
    consistency_rate: number;
    confidence_interval_95: [number, number];
  };
  optimal_max_trades_per_day?: {
    median_trades_to_peak: number;
    current_avg_trades_per_day: number;
    recommendation: string;
    confidence: string;
    optimal_rate: number;
  };
  optimal_trading_hours?: {
    average_peak_time: string;
    confidence_interval_95: [string, string];
    explanation: string;
    recommendation: string;
    consistency_rate: number;
    confidence: string;
  };
  optimal_time_distance_range?: {
    min_minutes: number;
    max_minutes: number;
    avg_pnl_in_range: number;
    explanation: string;
    recommendation: string;
    confidence: string;
  };
  optimal_win_rate_window?: {
    time_window: string;
    win_rate: number;
    explanation: string;
    recommendation: string;
    confidence: string;
  };
  volume_optimization?: {
    volume_time_correlation: number;
    correlation_significant: string;
    explanation: string;
    recommendation: string;
    confidence: string;
  };
}

interface AnalysisResultsProps {
  analysis: AnalysisData;
}

const getConfidenceColor = (confidence: string) => {
  if (confidence.toLowerCase().includes('high')) {
    return 'bg-profit/20 text-profit-foreground border-profit/30';
  } else if (confidence.toLowerCase().includes('medium')) {
    return 'bg-primary/20 text-primary-foreground !text-white border-primary/30'; // Force white text everywhere
  } else {
    return 'bg-muted/20 text-muted-foreground border-muted/30';
  }
};

const getConfidenceIcon = (confidence: string) => {
  if (confidence.toLowerCase().includes('high')) {
    return CheckCircle;
  } else if (confidence.toLowerCase().includes('medium')) {
    return Info;
  } else {
    return AlertCircle;
  }
};

// Helper to render a plot for each recommendation
function RecommendationPlot({ type }: { type: string }) {
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
    // Rounded corners via CSS below
  };
  const plotStyle = { width: '100%', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px #0002', background: '#18181b', margin: '32px 0' };

  if (type === 'optimal_break_between_trades') {
    const data = allPlotData.cumulative_pnl_vs_cooldown_period;
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
        }]}
        layout={{
          ...commonLayout,
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
        config={{ displayModeBar: false }}
      />
    );
  }
  if (type === 'optimal_intraday_drawdown') {
    const data = allPlotData.cumulative_pnl_vs_drawdown_threshold;
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
        }]}
        layout={{
          ...commonLayout,
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
        config={{ displayModeBar: false }}
      />
    );
  }
  if (type === 'optimal_max_trades_per_day') {
    const data = allPlotData.distribution_of_trades_to_peak;
    const tradesArray = data.trades_to_peak.map(t => typeof t === 'string' ? parseFloat(t) : t);
    
    // Filter out outliers (top 5% of values)
    const sortedTrades = [...tradesArray].sort((a, b) => a - b);
    const cutoffIndex = Math.floor(sortedTrades.length * 0.95);
    const cutoffValue = sortedTrades[cutoffIndex];
    const filteredTrades = tradesArray.filter(t => t <= cutoffValue);
    
    const minTrades = Math.min(...filteredTrades);
    const maxTrades = Math.max(...filteredTrades);
    const tradesRange = maxTrades - minTrades;
    
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
        }]}
        layout={{
          ...commonLayout,
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
        config={{ displayModeBar: false }}
      />
    );
  }
  if (type === 'optimal_trading_hours') {
    const data = allPlotData.distribution_of_peak_pnl_times;
    const pnlArray = data.pnl.map(p => typeof p === 'string' ? parseFloat(p) : p);
    const minPnl = Math.min(...pnlArray);
    const maxPnl = Math.max(...pnlArray);
    const pnlRange = maxPnl - minPnl;
    
    // Convert time strings to minutes since midnight and sort chronologically
    const timeData = data.time.map((timeStr, index) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const minutesSinceMidnight = hours * 60 + minutes;
      return {
        time: timeStr,
        minutesSinceMidnight,
        pnl: pnlArray[index]
      };
    }).sort((a, b) => a.minutesSinceMidnight - b.minutesSinceMidnight);
    
    const sortedTimes = timeData.map(d => d.time);
    const sortedPnls = timeData.map(d => d.pnl);
    const sortedMinutes = timeData.map(d => d.minutesSinceMidnight);
    
    const minTime = Math.min(...sortedMinutes);
    const maxTime = Math.max(...sortedMinutes);
    const timeRange = maxTime - minTime;
    
    return (
      <Plot
        data={[{
          x: sortedMinutes,
          y: sortedPnls,
          type: 'bar',
          marker: { 
            color: '#f59e42',
            width: 0.6
          },
          name: 'Peak P&L'
        }]}
        layout={{
          ...commonLayout,
          title: {
            text: 'Distribution of Peak P&L Times',
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
            range: [minTime - timeRange * 0.1, maxTime + timeRange * 0.1],
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
            range: [minPnl - pnlRange * 0.1, maxPnl + pnlRange * 0.1]
          },
          bargap: 0.2,
          bargroupgap: 0.1,
          barmode: 'overlay'
        }}
        style={plotStyle}
        config={{ displayModeBar: false }}
      />
    );
  }
  if (type === 'optimal_time_distance_range') {
    const data = allPlotData.total_pnl_by_time_distance_bin;
    const data2 = allPlotData.pnl_vs_time_distance;
    const timeArray = data.time_distance_seconds.map(t => typeof t === 'string' ? parseFloat(t) : t);
    const pnlArray = data.total_pnl.map(p => typeof p === 'string' ? parseFloat(p) : p);
    const minTime = Math.min(...timeArray);
    const maxTime = Math.max(...timeArray);
    const timeRange = maxTime - minTime;
    const minPnl = Math.min(...pnlArray);
    const maxPnl = Math.max(...pnlArray);
    const pnlRange = maxPnl - minPnl;
    
    return (
      <>
        <Plot
          data={[{
            x: data.time_distance_seconds,
            y: data.total_pnl,
            type: 'bar',
            marker: { 
              color: '#10b981',
              width: 0.6
            },
            name: 'Total P&L'
          }]}
          layout={{
            ...commonLayout,
            title: {
              text: 'Total P&L by Time Distance Bin',
              font: { size: 18, color: '#f9fafb', family: 'Inter, sans-serif' },
              x: 0.5,
            xanchor: 'center',
            y: 0.95,
            yanchor: 'top'
          },
          xaxis: { 
            title: { text: 'Time Distance (seconds)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a',
            range: [minTime - timeRange * 0.1, maxTime + timeRange * 0.1]
          },
          yaxis: { 
            title: { text: 'P&L ($)', font: { size: 14, color: '#e5e7eb' } },
            color: '#e5e7eb', 
            gridcolor: '#27272a', 
            zerolinecolor: '#27272a',
            range: [minPnl - pnlRange * 0.1, maxPnl + pnlRange * 0.1]
          },
          bargap: 0.2,
          bargroupgap: 0.1,
          barmode: 'overlay'
        }}
        style={plotStyle}
        config={{ displayModeBar: false }}
      />
      <Plot
        data={[{
          x: data2.time_distance_minutes,
          y: data2.pnl,
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
        config={{ displayModeBar: false }}
      />
      </>
    );
  }
  if (type === 'optimal_win_rate_window') {
    const data = allPlotData.win_rate_vs_avg_time_distance_over_15m_window;
    return (
      <Plot
        data={[{
          x: data.time_distance,
          y: data.win_rate,
          type: 'scatter',
          mode: 'markers',
          marker: { color: '#f472b6' },
          name: 'Win Rate'
        }, {
          x: data.time_distance_sorted,
          y: data.rolling_win_rate,
          type: 'scatter',
          mode: 'lines',
          line: { color: '#6366f1', width: 2 },
          name: 'Rolling Win Rate'
        }]}
        layout={{
          ...commonLayout,
          title: {
            text: 'Win Rate vs Avg Time Distance (15m Window)',
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
        config={{ displayModeBar: false }}
      />
    );
  }
  if (type === 'volume_optimization') {
    const data = allPlotData.volume_vs_time_distance;
    return (
      <Plot
        data={[{
          x: data.time_distance,
          y: data.volume,
          type: 'scatter',
          mode: 'markers',
          marker: { color: '#fbbf24' },
          name: 'Volume vs Time Distance'
        }]}
        layout={{
          ...commonLayout,
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
            zerolinecolor: '#27272a' 
          },
        }}
        style={plotStyle}
        config={{ displayModeBar: false }}
      />
    );
  }
  return null;
}

export function AnalysisResults({ analysis, onReset }: AnalysisResultsProps & { onReset?: () => void }) {
  const [showPlots, setShowPlots] = useState(true);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-primary">
          Your Trading Optimization Analysis
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          AI-powered analysis of your trading patterns with actionable optimization recommendations
        </p>
      </div>

      {/* Plot Toggle */}
      <div className="flex justify-center items-center space-x-2">
        <Switch
          id="show-plots"
          checked={showPlots}
          onCheckedChange={setShowPlots}
        />
        <Label htmlFor="show-plots" className="text-sm font-medium">
          Show Analysis Plots
        </Label>
      </div>

      {onReset && (
        <div className="flex justify-center mt-2">
          <Button variant="outline" onClick={onReset}>
            Upload a Different File
          </Button>
        </div>
      )}

      {/* Key Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {analysis.optimal_break_between_trades && (
          <Card className="bg-gradient-card shadow-card hover-scale">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">P&L Improvement</p>
                  <p className="text-2xl font-bold text-profit">
                    +${analysis.optimal_break_between_trades.pnl_improvement.toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-profit" />
              </div>
            </CardContent>
          </Card>
        )}

        {analysis.optimal_break_between_trades && (
          <Card className="bg-gradient-card shadow-card hover-scale">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Optimal Break Time</p>
                  <p className="text-2xl font-bold">
                    {Math.round(analysis.optimal_break_between_trades.minutes)} min
                  </p>
                </div>
                <Clock className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        )}

        {analysis.optimal_intraday_drawdown && (
          <Card className="bg-gradient-card shadow-card hover-scale">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Max Drawdown</p>
                  <p className="text-2xl font-bold text-loss">
                    {analysis.optimal_intraday_drawdown.percentage}%
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-loss" />
              </div>
            </CardContent>
          </Card>
        )}

        {analysis.optimal_win_rate_window && (
          <Card className="bg-gradient-card shadow-card hover-scale">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Peak Win Rate</p>
                  <p className="text-2xl font-bold text-profit">
                    {analysis.optimal_win_rate_window.win_rate}%
                  </p>
                </div>
                <Award className="h-8 w-8 text-profit" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detailed Analysis Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trade Timing Optimization */}
        {(analysis.optimal_break_between_trades || analysis.optimal_time_distance_range) && (
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Trade Timing Optimization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {analysis.optimal_break_between_trades && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Optimal Break Between Trades</span>
                    <Badge variant="outline" className={getConfidenceColor(analysis.optimal_break_between_trades.confidence)}>
                      {analysis.optimal_break_between_trades.confidence.split(' - ')[0]} Confidence
                    </Badge>
                  </div>
                  <div className="bg-muted/10 rounded-lg p-4">
                    <p className="text-2xl font-bold mb-2">
                      {Math.round(analysis.optimal_break_between_trades.minutes)} minutes
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Based on cooldown analysis, waiting {Math.round(analysis.optimal_break_between_trades.minutes)} minutes between trades maximizes cumulative P&L
                    </p>
                    {showPlots && <RecommendationPlot type="optimal_break_between_trades" />}
                  </div>
                </div>
              )}

              {analysis.optimal_time_distance_range && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Optimal Time Distance Range</span>
                    <Badge variant="outline" className={getConfidenceColor(analysis.optimal_time_distance_range.confidence)}>
                      {analysis.optimal_time_distance_range.confidence.split(' - ')[0]} Confidence
                    </Badge>
                  </div>
                  <div className="bg-muted/10 rounded-lg p-4">
                    <p className="text-2xl font-bold mb-2">
                      {analysis.optimal_time_distance_range.min_minutes}-{analysis.optimal_time_distance_range.max_minutes} minutes
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {analysis.optimal_time_distance_range.explanation}
                    </p>
                    {showPlots && <RecommendationPlot type="optimal_time_distance_range" />}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Risk Management */}
        {(analysis.optimal_intraday_drawdown || analysis.optimal_max_trades_per_day) && (
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-loss" />
                Risk Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {analysis.optimal_intraday_drawdown && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Optimal Intraday Drawdown</span>
                    <Badge variant="outline" className={getConfidenceColor(analysis.optimal_intraday_drawdown.confidence)}>
                      {analysis.optimal_intraday_drawdown.confidence.split(' - ')[0]} Confidence
                    </Badge>
                  </div>
                                  <div className="bg-gradient-loss rounded-lg p-4">
                  <p className="text-2xl font-bold mb-2 text-loss-foreground">
                    {analysis.optimal_intraday_drawdown.percentage}%
                  </p>
                  <p className="text-sm text-loss-foreground/80">
                    {analysis.optimal_intraday_drawdown.explanation}
                  </p>
                  {showPlots && <RecommendationPlot type="optimal_intraday_drawdown" />}
                </div>
                </div>
              )}

              {analysis.optimal_max_trades_per_day && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Optimal Max Trades/Day</span>
                    <Badge variant="outline" className={getConfidenceColor(analysis.optimal_max_trades_per_day.confidence)}>
                      {analysis.optimal_max_trades_per_day.confidence.split(' - ')[0]} Confidence
                    </Badge>
                  </div>
                  <div className="bg-muted/10 rounded-lg p-4">
                    <p className="text-2xl font-bold mb-2">
                      {Math.round(analysis.optimal_max_trades_per_day.median_trades_to_peak)} trades
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Consider limiting to {Math.round(analysis.optimal_max_trades_per_day.median_trades_to_peak)} trades per day, as this is the median number of trades needed to reach peak P&L
                    </p>
                    {showPlots && <RecommendationPlot type="optimal_max_trades_per_day" />}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Trading Hours Optimization */}
        {analysis.optimal_trading_hours && (
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Trading Hours Optimization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Optimal Peak Time</span>
                  <Badge variant="outline" className={getConfidenceColor(analysis.optimal_trading_hours.confidence)}>
                    {analysis.optimal_trading_hours.confidence.split(' - ')[0]} Confidence
                  </Badge>
                </div>
                <div className="bg-muted/10 rounded-lg p-4">
                  <p className="text-2xl font-bold mb-2">
                    {analysis.optimal_trading_hours.average_peak_time}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {analysis.optimal_trading_hours.explanation}
                  </p>
                  {showPlots && <RecommendationPlot type="optimal_trading_hours" />}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Volume Analysis */}
        {analysis.volume_optimization && (
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-primary" />
                Volume Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Volume-Time Correlation</span>
                  <Badge variant="outline" className={getConfidenceColor(analysis.volume_optimization.confidence)}>
                    {analysis.volume_optimization.confidence.split(' - ')[0]} Confidence
                  </Badge>
                </div>
                <div className="bg-muted/10 rounded-lg p-4">
                  <p className="text-2xl font-bold mb-2">
                    {analysis.volume_optimization.volume_time_correlation.toFixed(4)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {analysis.volume_optimization.explanation}
                  </p>
                  {showPlots && <RecommendationPlot type="volume_optimization" />}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Items Summary */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Key Action Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {analysis.optimal_break_between_trades && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-profit rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium">Wait {Math.round(analysis.optimal_break_between_trades.minutes)} minutes between trades</p>
                  <p className="text-sm text-muted-foreground">
                    This could improve your P&L by ${analysis.optimal_break_between_trades.pnl_improvement.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {analysis.optimal_intraday_drawdown && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-loss rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium">Stop trading at {analysis.optimal_intraday_drawdown.percentage}% drawdown</p>
                  <p className="text-sm text-muted-foreground">
                    {analysis.optimal_intraday_drawdown.explanation}
                  </p>
                </div>
              </div>
            )}

            {analysis.optimal_trading_hours && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium">Focus trading around {analysis.optimal_trading_hours.average_peak_time}</p>
                  <p className="text-sm text-muted-foreground">
                    Peak P&L typically occurs at this time
                  </p>
                </div>
              </div>
            )}

            {analysis.optimal_max_trades_per_day && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium">Limit to {Math.round(analysis.optimal_max_trades_per_day.median_trades_to_peak)} trades per day</p>
                  <p className="text-sm text-muted-foreground">
                    This is when your cumulative P&L typically peaks
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