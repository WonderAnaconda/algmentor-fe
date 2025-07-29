import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import Plot from 'react-plotly.js';

const actionColors = {
  'STOP': 'bg-loss/20 text-loss-foreground border-loss/30',
  'CONTINUE': 'bg-primary/20 text-primary-foreground border-primary/30',
  'INCREASE_RISK': 'bg-profit/20 text-profit-foreground border-profit/30',
};

const actionIcons = {
  'STOP': <AlertCircle className="inline h-4 w-4 mr-1 text-loss" />,
  'CONTINUE': <CheckCircle className="inline h-4 w-4 mr-1 text-primary" />,
  'INCREASE_RISK': <TrendingUp className="inline h-4 w-4 mr-1 text-profit" />,
};

const actionValues = {
  'STOP': 0,
  'CONTINUE': 1,
  'INCREASE_RISK': 2,
};

interface SessionAssistantData {
  timestamp: string;
  performance_score: number;
  action: 'STOP' | 'CONTINUE' | 'INCREASE_RISK';
  cumulative_pnl: number;
}

interface SessionAssistantAnalysisProps {
  sessionAssistant: SessionAssistantData[];
}

export default function SessionAssistantAnalysis({ sessionAssistant }: SessionAssistantAnalysisProps) {
  // Process data for plotting
  const plotData = sessionAssistant.map((item, index) => {
    const time = new Date(item.timestamp);
    const timeStr = time.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    return {
      time: timeStr,
      timestamp: time.getTime(),
      cumulativePnl: item.cumulative_pnl,
      performanceScore: item.performance_score,
      action: actionValues[item.action],
      actionLabel: item.action,
    };
  }).sort((a, b) => a.timestamp - b.timestamp);

  // Calculate actual performance score range
  const performanceScores = plotData.map(d => d.performanceScore);
  const minPerformance = Math.min(...performanceScores);
  const maxPerformance = Math.max(...performanceScores);
  const performanceRange = maxPerformance - minPerformance;
  const performancePadding = performanceRange * 0.1; // 10% padding

  // Common Plotly configuration
  const commonLayout = {
    autosize: true,
    margin: { l: 80, r: 80, t: 60, b: 0 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e5e7eb', family: 'Inter, sans-serif' },
    showlegend: true,
    legend: {
      x: 0.5,
      y: 1.02,
      xanchor: 'center',
      orientation: 'h',
      bgcolor: 'rgba(0,0,0,0)',
      bordercolor: 'rgba(0,0,0,0)'
    }
  };

  const responsiveConfig = {
    responsive: true,
    displayModeBar: false,
    staticPlot: false
  };

  const plotStyle = {
    width: '100%',
    height: '100%'
  };

  return (
    <div className="mt-8">
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Real-Time Session Assistant</h2>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
          Live Analysis
        </Badge>
      </div>

      {/* Combined Chart with Subplot */}
      <div style={{ height: '500px' }}>
        <Plot
          data={[
            // Main plot - Cumulative PnL
            {
              x: plotData.map(d => d.time),
              y: plotData.map(d => d.cumulativePnl),
              type: 'scatter',
              mode: 'lines+markers',
              name: 'Cumulative PnL',
              line: { color: '#a855f7', width: 2 },
              marker: { size: 4, color: '#a855f7' },
              yaxis: 'y',
              showlegend: true,
              legendgroup: 'main',
              legendgrouptitle: { text: 'Performance Metrics' }
            },
            // Main plot - Performance Score
            {
              x: plotData.map(d => d.time),
              y: plotData.map(d => d.performanceScore),
              type: 'scatter',
              mode: 'lines+markers',
              name: 'Performance Score',
              line: { color: '#10b981', width: 2 },
              marker: { size: 4, color: '#10b981' },
              yaxis: 'y2',
              showlegend: true,
              legendgroup: 'main'
            },
            // Subplot - Action Indicator
            {
              x: plotData.map(d => d.time),
              y: plotData.map(d => d.action),
              type: 'bar',
              name: 'Action',
              marker: {
                color: plotData.map(d => {
                  switch (d.action) {
                    case 0: return '#ef4444'; // STOP
                    case 1: return '#3b82f6'; // CONTINUE
                    case 2: return '#10b981'; // INCREASE RISK
                    default: return '#6b7280';
                  }
                }),
                line: { width: 0 }
              },
              xaxis: 'x2',
              yaxis: 'y3',
              showlegend: true,
              legendgroup: 'actions',
              legendgrouptitle: { text: 'Action Recommendations' }
            }
          ]}
          layout={{
            ...commonLayout,
            title: {
              text: 'Session Performance & Action Recommendations',
              font: { size: 20, color: '#f9fafb' },
              x: 0.5,
              xanchor: 'center',
              y: 0.98
            },
            // Main plot area (top)
            xaxis: {
              title: { text: 'Time', font: { size: 14, color: '#e5e7eb' } },
              color: '#e5e7eb',
              gridcolor: 'rgba(0,0,0,0)', // No grid lines
              zerolinecolor: '#27272a',
              domain: [0, 1],
              tickangle: -45,
              tickfont: { size: 12 }
            },
            yaxis: {
              title: { text: 'Cumulative PnL ($)', font: { size: 14, color: '#e5e7eb' } },
              color: '#e5e7eb',
              gridcolor: 'rgba(0,0,0,0)', // No grid lines
              zerolinecolor: '#27272a',
              side: 'left',
              domain: [0.35, 1] // Main plot takes 65% of height, more gap
            },
            yaxis2: {
              title: { text: 'Performance Score', font: { size: 14, color: '#e5e7eb' } },
              color: '#e5e7eb',
              gridcolor: 'rgba(0,0,0,0)', // No grid lines
              zerolinecolor: '#27272a',
              side: 'right',
              overlaying: 'y',
              range: [minPerformance - performancePadding, maxPerformance + performancePadding],
              tickfont: { size: 12 }
            },
            // Subplot area (bottom) - Action indicator
            xaxis2: {
              color: '#e5e7eb',
              gridcolor: '#27272a',
              zerolinecolor: '#27272a',
              domain: [0, 1],
              showticklabels: false // Hide x-axis labels for subplot
            },
            yaxis3: {
              title: { text: '', font: { size: 13, color: '#e5e7eb' } },
              color: '#e5e7eb',
              gridcolor: '#27272a',
              zerolinecolor: '#27272a',
              showticklabels: false,
              range: [-0.5, 2.5],
              domain: [0.02, 0.15] // Subplot takes 13% of height, positioned much closer to legend
            }
          }}
          style={plotStyle}
          config={responsiveConfig}
        />
      </div>
      
      {/* Action Legend */}
      <div className="flex justify-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-loss rounded"></div>
          <span className="text-sm">STOP</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-primary rounded"></div>
          <span className="text-sm">CONTINUE</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-profit rounded"></div>
          <span className="text-sm">INCREASE RISK</span>
        </div>
      </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}