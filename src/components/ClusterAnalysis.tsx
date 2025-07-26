import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Target,
  Activity,
  Calendar,
  Zap,
  Users
} from 'lucide-react';
// Radar chart dependencies
import Chart from 'chart.js/auto';
import { Chart as ChartJS, registerables } from 'chart.js';
import 'chartjs-chart-box-and-violin-plot/build/Chart.BoxPlot.js';
ChartJS.register(...registerables);

interface ClusterData {
  count: number;
  ratio: number;
  mean_pnl: number;
  std_pnl: number;
  mean_duration: number;
  mean_return_per_min: number;
  mean_pause: number;
  mean_hour: number;
  most_common_day: number;
  direction_ratio: Record<string, number>;
}

interface ClusterAnalysisProps {
  clusters: Record<string, ClusterData>;
  interpretations?: Record<string, string>;
}

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayShort = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const statLabels: Record<string, string> = {
  count: 'Trades',
  ratio: 'Share',
  mean_pnl: 'Ø PnL',
  std_pnl: 'Std PnL',
  mean_duration: 'Ø Duration',
  mean_return_per_min: 'Ø PnL/min',
  mean_pause: 'Ø Pause',
  mean_hour: 'Ø Time',
  win_rate: 'Win Rate',
};

const statFormat: Record<string, (v: number) => string> = {
  count: v => v.toFixed(0),
  ratio: v => (v * 100).toFixed(1) + '%',
  mean_pnl: v => v.toFixed(2),
  std_pnl: v => v.toFixed(2),
  mean_duration: v => {
    // v is seconds, convert to hh:mm:ss
    const totalSeconds = Math.round(v);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  },
  mean_return_per_min: v => v.toFixed(2),
  mean_pause: v => {
    // v is seconds, convert to hh:mm:ss
    const totalSeconds = Math.round(v);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  },
  mean_hour: v => {
    // v is a float, e.g., 16.75 means 16:45
    const hour = Math.floor(v);
    const minute = Math.round((v - hour) * 60);
    // Pad with leading zeros if needed
    const hourStr = hour.toString().padStart(2, '0');
    const minStr = minute.toString().padStart(2, '0');
    return `${hourStr}:${minStr}`;
  },
  win_rate: v => (v * 100).toFixed(1) + '%',
};

const statKeys = [
  'count',
  'ratio',
  'mean_pnl',
  'std_pnl',
  'mean_duration',
  'mean_return_per_min',
  'mean_pause',
  'mean_hour',
  'win_rate',
];

function parseTags(interpretation?: string): string[] {
  if (!interpretation) return [];
  return interpretation
    .split(',')
    .map(s => s.trim())
    .map(s => s.replace(/\b\w/g, c => c.toUpperCase()));
}

// Remove WeekdayAnalysis and all related code from this file.
// Remove byWeekday prop from ClusterAnalysis.
// Only keep cluster/radar chart logic here.

export const ClusterAnalysis: React.FC<ClusterAnalysisProps> = ({ clusters, interpretations }) => {
  // Convert clusters to array and sort by count descending
  const clusterArr = Object.entries(clusters)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count);

  // Compute min/max for each stat for normalization
  const statMinMax: Record<string, { min: number; max: number }> = {};
  statKeys.forEach(key => {
    const values = clusterArr.map(c => c[key as keyof ClusterData] as number);
    statMinMax[key] = {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  });

  // Helper to normalize value to [0,1]
  const normalize = (key: string, value: number) => {
    const { min, max } = statMinMax[key];
    if (max === min) return 0.5; // avoid div by zero
    return (value - min) / (max - min);
  };

  // Radar chart setup
  const radarRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!radarRef.current) return;
    const ctx = radarRef.current.getContext('2d');
    if (!ctx) return;
    // Clean up previous chart
    if ((window as any)._clusterRadarChart) {
      (window as any)._clusterRadarChart.destroy();
    }
    // Color palette for distinct cluster lines
    const palette = [
      '#34d399', // emerald
      '#3b82f6', // blue
      '#f59e42', // orange
      // '#eab308', // yellow
      '#a78bfa', // purple
      '#f472b6', // pink
      '#38bdf8', // sky
      '#f87171', // red
      '#10b981', // green
      '#6366f1', // indigo
    ];
    // Chart.js does not support per-axis max/min natively for radar charts.
    // So, normalize all radarStats to [0,1] for the radar chart.
    const radarStats = ['mean_pnl', 'std_pnl', 'mean_duration', 'mean_return_per_min', 'mean_pause', 'win_rate'];
    const labels = radarStats.map(key => statLabels[key] + ' (norm)');
    const statMin: Record<string, number> = {};
    const statMax: Record<string, number> = {};
    radarStats.forEach(key => {
      const values = clusterArr.map(c => Number(c[key as keyof ClusterData]) || 0);
      statMin[key] = Math.min(...values);
      statMax[key] = Math.max(...values);
    });
    const datasets = clusterArr.map((cluster, idx) => ({
      label: `Cluster ${String.fromCharCode(65 + Number(cluster.id))}`,
      data: radarStats.map(key => {
        const val = Number(cluster[key as keyof ClusterData]) || 0;
        const min = statMin[key];
        const max = statMax[key];
        if (max === min) return 0.5;
        return (val - min) / (max - min);
      }),
      fill: false,
      borderColor: palette[idx % palette.length],
      backgroundColor: 'rgba(59,130,246,0.08)',
      pointBackgroundColor: palette[idx % palette.length],
      pointBorderColor: '#fff',
      pointRadius: 3,
      tension: 0.2,
    }));
    (window as any)._clusterRadarChart = new Chart(ctx, {
      type: 'radar',
      data: { labels, datasets },
      options: {
        plugins: {
          legend: { display: true, position: 'top', labels: { color: '#fff' } },
          title: { display: false },
        },
        scales: {
          r: {
            angleLines: { color: '#334155' },
            grid: { color: '#334155' },
            pointLabels: { color: '#fff', font: { size: 13 } },
            ticks: { color: '#fff', backdropColor: 'transparent', stepSize: 0.2 },
            suggestedMin: 0,
            suggestedMax: 1,
          },
        },
        responsive: true,
        maintainAspectRatio: false,
      },
    });
    return () => {
      (window as any)._clusterRadarChart?.destroy();
    };
  }, [clusters]);

  return (
    <section className="my-10 space-y-8 animate-fade-in">

      {/* Radar Chart Card */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Cluster Comparison Radar
          </CardTitle>
        </CardHeader>
        <CardContent className="w-full flex flex-col items-center">
          <div className="w-full max-w-xl h-[340px] mx-auto">
            <canvas ref={radarRef} width={400} height={340} />
          </div>
        </CardContent>
      </Card>

      {/* Cluster Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {clusterArr.map(cluster => {
          const interp = interpretations?.[cluster.id] || '';
          const tags = parseTags(interp);
          const mostCommonDayIdx = cluster.most_common_day;
          const mostCommonDay = dayShort[mostCommonDayIdx];
          // Direction ratio bar
          const longRatio = cluster.direction_ratio.long || 0;
          const shortRatio = cluster.direction_ratio.short || 0;
          // Determine card background and shadow based on mean PnL
          const isProfit = cluster.mean_pnl > 0;
          
          return (
            <Card key={cluster.id} className="bg-gradient-card shadow-card hover-scale">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl font-bold">
                      Cluster {String.fromCharCode(65 + Number(cluster.id))}
                    </CardTitle>
                  </div>
                  {mostCommonDay && (
                    <Badge variant="outline" className="bg-primary/20 text-primary-background border-primary/30">
                      {mostCommonDay}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map(tag => (
                    <span key={tag} className="inline-block px-2 py-0.5 rounded font-semibold text-xs bg-muted/20 text-muted-foreground border border-muted/30">
                      {tag}
                    </span>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Activity className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Trades</span>
                      </div>
                      <p className="text-lg font-bold">
                        {statFormat.count(cluster.count)} 
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          ({statFormat.ratio(cluster.ratio)})
                        </span>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Avg Time</span>
                      </div>
                      <p className="text-sm font-semibold">{statFormat.mean_hour(cluster.mean_hour)}</p>
                    </div>
                  </div>

                  {/* Detailed Stats */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Performance Metrics</span>
                    </div>
                    <div className="space-y-2">
                      {['mean_pnl', 'mean_return_per_min', 'std_pnl', 'mean_duration', 'mean_pause', 'win_rate'].map(key => {
                        const value = cluster[key as keyof ClusterData] as number;
                        const isPnlMetric = key === 'mean_pnl' || key === 'mean_return_per_min';
                        
                        if (isPnlMetric) {
                          // Calculate zero point for bidirectional bars
                          const allValues = clusterArr.map(c => c[key as keyof ClusterData] as number);
                          const minValue = Math.min(...allValues);
                          const maxValue = Math.max(...allValues);
                          const range = maxValue - minValue;
                          const zeroPoint = range > 0 ? (0 - minValue) / range : 0.5;
                          const normalizedValue = range > 0 ? (value - minValue) / range : 0.5;
                          
                          const isPositive = value >= 0;
                          const barWidth = Math.abs(normalizedValue - zeroPoint);
                          const barPosition = isPositive ? zeroPoint : normalizedValue;
                          
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <span className="w-20 text-xs text-muted-foreground">{statLabels[key]}</span>
                              <span className={`min-w-[60px] text-right font-mono text-xs font-semibold ${isPositive ? 'text-profit' : 'text-loss'}`}>
                                {statFormat[key](value)}
                              </span>
                              <div className="flex-1 h-2 rounded overflow-hidden bg-muted/20 relative">
                                {/* Zero point indicator - white blob */}
                                <div 
                                  className="absolute top-1/2 left-0 w-2 h-2 bg-white rounded-full transform -translate-y-1/2 -translate-x-1 z-10"
                                  style={{ left: `${zeroPoint * 100}%` }}
                                />
                                {/* Bar */}
                                <div
                                  className="h-2 rounded absolute"
                                  style={{
                                    left: `${barPosition * 100}%`,
                                    width: `${barWidth * 100}%`,
                                    background: isPositive ? '#34d399' : '#f87171',
                                    transition: 'width 0.3s',
                                  }}
                                />
                              </div>
                            </div>
                          );
                        } else {
                          // Regular progress bar for non-PnL metrics
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <span className="w-20 text-xs text-muted-foreground">{statLabels[key]}</span>
                              <span className="min-w-[60px] text-right font-mono text-xs font-semibold">
                                {statFormat[key](value)}
                              </span>
                              <div className="flex-1 h-2 rounded overflow-hidden bg-muted/20">
                                <div
                                  className="h-2 rounded"
                                  style={{
                                    width: `${Math.round(normalize(key, value) * 100)}%`,
                                    background: '#3b82f6',
                                    transition: 'width 0.3s',
                                  }}
                                />
                              </div>
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>

                  {/* Direction Ratio Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Direction Ratio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-4 rounded overflow-hidden flex bg-muted/20">
                        <div
                          className="h-4"
                          style={{
                            width: `${longRatio * 100}%`,
                            background: '#d3d3d3', // emerald-400
                            borderTopLeftRadius: 6,
                            borderBottomLeftRadius: 6,
                          }}
                        />
                        <div
                          className="h-4"
                          style={{
                            width: `${shortRatio * 100}%`,
                            background: '#334155', // slate-700
                            borderTopRightRadius: 6,
                            borderBottomRightRadius: 6,
                          }}
                        />
                      </div>
                      <span className="w-14 text-right font-mono text-xs">
                        <span className="text-slate-300">{(longRatio * 100).toFixed(1)}%</span> / <span className="text-slate-500">{(shortRatio * 100).toFixed(1)}%</span>
                      </span>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}; 