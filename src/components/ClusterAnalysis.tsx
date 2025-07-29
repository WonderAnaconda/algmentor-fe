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
  win_rate: number;
}

interface ClusterScatterPoint {
  x: number;
  y: number;
  cluster: number;
  pnl: number;
  duration: number;
  return_per_min: number;
}

interface ClusterAnalysisProps {
  clusters: Record<string, ClusterData>;
  interpretations?: Record<string, string>;
  scatterData?: ClusterScatterPoint[];
  method?: string;
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

export const ClusterAnalysis: React.FC<ClusterAnalysisProps> = ({ clusters, interpretations, scatterData, method }) => {
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
    if (!radarRef.current || !scatterData || scatterData.length === 0) return;
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
      '#a78bfa', // purple
      '#f472b6', // pink
      '#38bdf8', // sky
      '#f87171', // red
      '#10b981', // green
      '#6366f1', // indigo
    ];
    
    // Get all unique cluster IDs from scatter data (excluding noise -1)
    const allClusterIds = [...new Set(scatterData.map(point => point.cluster).filter(id => id !== -1))].sort();
    
    // Chart.js does not support per-axis max/min natively for radar charts.
    // So, normalize all radarStats to [0,1] for the radar chart.
    const radarStats = ['mean_pnl', 'std_pnl', 'mean_duration', 'mean_return_per_min', 'mean_pause', 'win_rate'];
    const labels = radarStats.map(key => statLabels[key] + ' (norm)');
    
    // Calculate stats for each cluster from scatter data
    const clusterStats: Record<number, any> = {};
    
    allClusterIds.forEach(clusterId => {
      const clusterPoints = scatterData.filter(point => point.cluster === clusterId);
      if (clusterPoints.length === 0) return;
      
      // Calculate basic stats from scatter data
      const pnls = clusterPoints.map(p => p.pnl);
      const durations = clusterPoints.map(p => p.duration);
      const returnsPerMin = clusterPoints.map(p => p.return_per_min);
      
      clusterStats[clusterId] = {
        id: clusterId,
        count: clusterPoints.length,
        mean_pnl: pnls.reduce((a, b) => a + b, 0) / pnls.length,
        std_pnl: Math.sqrt(pnls.reduce((sq, n) => sq + Math.pow(n - pnls.reduce((a, b) => a + b, 0) / pnls.length, 2), 0) / pnls.length),
        mean_duration: durations.reduce((a, b) => a + b, 0) / durations.length,
        mean_return_per_min: returnsPerMin.reduce((a, b) => a + b, 0) / returnsPerMin.length,
        mean_pause: 0, // Not available in scatter data, use 0
        win_rate: pnls.filter(p => p > 0).length / pnls.length, // Calculate win rate from PnL
      };
    });
    
    // Get min/max values for normalization
    const statMin: Record<string, number> = {};
    const statMax: Record<string, number> = {};
    radarStats.forEach(key => {
      const values = Object.values(clusterStats).map(c => Number(c[key]) || 0);
      if (values.length > 0) {
        statMin[key] = Math.min(...values);
        statMax[key] = Math.max(...values);
      } else {
        statMin[key] = 0;
        statMax[key] = 1;
      }
    });
    
    const datasets = allClusterIds.map((clusterId, idx) => {
      const cluster = clusterStats[clusterId];
      if (!cluster) return null;
      
      return {
        label: `Cluster ${String.fromCharCode(65 + clusterId)}`,
        data: radarStats.map(key => {
          const val = Number(cluster[key]) || 0;
          const min = statMin[key];
          const max = statMax[key];
          if (max === min) return 0.5;
          return (val - min) / (max - min);
        }),
        fill: false,
        borderColor: palette[clusterId % palette.length],
        backgroundColor: 'rgba(59,130,246,0.08)',
        pointBackgroundColor: palette[clusterId % palette.length],
        pointBorderColor: '#fff',
        pointRadius: 3,
        tension: 0.2,
      };
    }).filter(Boolean);
    
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
  }, [scatterData]);

  // Scatter plot setup
  const scatterRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!scatterRef.current || !scatterData || scatterData.length === 0) return;
    const ctx = scatterRef.current.getContext('2d');
    if (!ctx) return;
    // Clean up previous chart
    if ((window as any)._clusterScatterChart) {
      (window as any)._clusterScatterChart.destroy();
    }

    // Color palette for clusters (same as scatter plot)
    const palette = [
      '#34d399', // emerald
      '#3b82f6', // blue
      '#f59e42', // orange
      '#a78bfa', // purple
      '#f472b6', // pink
      '#38bdf8', // sky
      '#f87171', // red
      '#10b981', // green
      '#6366f1', // indigo
    ];

    // Group data by cluster
    const clusterGroups: Record<number, ClusterScatterPoint[]> = {};
    scatterData.forEach(point => {
      if (!clusterGroups[point.cluster]) {
        clusterGroups[point.cluster] = [];
      }
      clusterGroups[point.cluster].push(point);
    });

    // Create datasets for each cluster
    const datasets = Object.entries(clusterGroups).map(([clusterId, points]) => {
      const clusterNum = Number(clusterId);
      const isNoise = clusterNum === -1;
      
      let label, backgroundColor, borderColor;
      
      if (isNoise) {
        label = 'Noise Points';
        backgroundColor = '#6b7280'; // grey
        borderColor = '#4b5563';
      } else {
        // Simple consistent naming: Cluster 0=A, 1=B, 2=C, etc.
        const clusterLetter = String.fromCharCode(65 + clusterNum);
        label = `Cluster ${clusterLetter}`;
        backgroundColor = palette[clusterNum % palette.length] + '80'; // Add transparency
        borderColor = palette[clusterNum % palette.length];
      }

      return {
        label,
        data: points.map(point => ({
          x: point.x,
          y: point.y,
          pnl: point.pnl,
          duration: point.duration,
          return_per_min: point.return_per_min
        })),
        backgroundColor,
        borderColor,
        borderWidth: 1,
        pointRadius: isNoise ? 2 : 4, // Smaller points for noise
        pointHoverRadius: isNoise ? 4 : 6,
      };
    });

    (window as any)._clusterScatterChart = new Chart(ctx, {
      type: 'scatter',
      data: { datasets },
      options: {
        plugins: {
          legend: { display: true, position: 'top', labels: { color: '#fff' } },
          title: { 
            display: true, 
            text: `${method?.toUpperCase() || 'DIMENSIONALITY REDUCTION'} - Trade Clusters`,
            color: '#fff',
            font: { size: 16 }
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const point = context.raw;
                return [
                  `Cluster: ${context.dataset.label}`,
                  `PnL: ${point.pnl.toFixed(2)}`,
                  `Duration: ${(point.duration / 60).toFixed(1)} min`,
                  `Return/min: ${point.return_per_min.toFixed(2)}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: `${method?.toUpperCase() || 'X'} Component`,
              color: '#fff'
            },
            grid: { color: '#334155' },
            ticks: { color: '#fff' }
          },
          y: {
            title: {
              display: true,
              text: `${method?.toUpperCase() || 'Y'} Component`,
              color: '#fff'
            },
            grid: { color: '#334155' },
            ticks: { color: '#fff' }
          }
        },
        responsive: true,
        maintainAspectRatio: false,
      },
    });
    return () => {
      (window as any)._clusterScatterChart?.destroy();
    };
  }, [scatterData, method, clusters]);

  // Color palette for clusters (same as scatter plot)
  const palette = [
    '#34d399', // emerald
    '#3b82f6', // blue
    '#f59e42', // orange
    '#a78bfa', // purple
    '#f472b6', // pink
    '#38bdf8', // sky
    '#f87171', // red
    '#10b981', // green
    '#6366f1', // indigo
  ];

  return (
    <section className="my-10 space-y-8 animate-fade-in">

      {/* Combined Radar Chart and Scatter Plot Card */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Cluster Analysis Visualizations
          </CardTitle>
        </CardHeader>
        <CardContent className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar Chart */}
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-semibold mb-4 text-center">Cluster Comparison Radar</h3>
              <div className="w-full max-w-md h-[340px]">
                <canvas ref={radarRef} width={400} height={340} />
              </div>
            </div>
            
            {/* 2D Scatter Plot */}
            {scatterData && scatterData.length > 0 && (
              <div className="flex flex-col items-center">
                <h3 className="text-lg font-semibold mb-4 text-center">2D Cluster Visualization</h3>
                <div className="w-full max-w-md h-[340px]">
                  <canvas ref={scatterRef} width={400} height={340} />
                </div>
              </div>
            )}
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
            // <Card key={cluster.id} className={`bg-gradient-card hover-scale ${isProfit ? 'shadow-green-pnl' : 'shadow-red-pnl'}`}>
            <Card key={cluster.id} className="bg-gradient-card hover-scale shadow-green-pnl">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <CardTitle 
                      className="text-xl font-bold"
                      style={{ 
                        color: palette[(Number(cluster.id) - 1) % palette.length] 
                      }}
                    >
                      Cluster {String.fromCharCode(65 + Number(cluster.id) - 1)}
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

// Add the following CSS to your global styles (e.g., App.css or a relevant CSS/SCSS file):
// .shadow-green-pnl { box-shadow: 0 4px 24px 0 rgba(52, 211, 153, 0.12) !important; }
// .shadow-red-pnl { box-shadow: 0 4px 24px 0 rgba(248, 113, 113, 0.12) !important; }