import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// Radar chart dependencies
import Chart from 'chart.js/auto';

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
  mean_duration: 'Ø Duration (s)',
  mean_return_per_min: 'Ø PnL/min',
  mean_pause: 'Ø Pause',
  mean_hour: 'Ø Time',
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
];

function parseTags(interpretation?: string): string[] {
  if (!interpretation) return [];
  return interpretation
    .split(',')
    .map(s => s.trim())
    .map(s => s.replace(/\b\w/g, c => c.toUpperCase()));
}

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
    const radarStats = ['mean_pnl', 'std_pnl', 'mean_duration', 'mean_return_per_min', 'mean_pause'];
    const labels = radarStats.map(key => statLabels[key] + ' (norm)');
    const statMin: Record<string, number> = {};
    const statMax: Record<string, number> = {};
    radarStats.forEach(key => {
      const values = clusterArr.map(c => Number(c[key as keyof ClusterData]) || 0);
      statMin[key] = Math.min(...values);
      statMax[key] = Math.max(...values);
    });
    const datasets = clusterArr.map((cluster, idx) => ({
      label: `Cluster #${cluster.id}`,
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
    <section className="my-10">
      <h2 className="text-2xl font-bold mb-6 text-primary">Trade Cluster Analysis</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Radar Chart Card */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-3 bg-slate-900/90 border border-blue-900 shadow-lg shadow-blue-900/20 rounded-xl flex flex-col items-center justify-center">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white drop-shadow mb-2">Cluster Comparison</CardTitle>
          </CardHeader>
          <CardContent className="w-full flex flex-col items-center">
            <div className="w-full max-w-xl h-[340px] mx-auto">
              <canvas ref={radarRef} width={400} height={340} />
            </div>
          </CardContent>
        </Card>
        {/* Cluster Cards */}
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
          const cardBg = isProfit
            ? 'bg-[#0e2e1a]/90 shadow-lg shadow-green-900/30 border border-emerald-800'
            : 'bg-[#23263a]/90 shadow-lg shadow-blue-900/30 border border-blue-900';
          return (
            <Card key={cluster.id} className={`relative ${cardBg} rounded-xl transition-all duration-300`}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-white drop-shadow">Cluster #{cluster.id}</CardTitle>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map(tag => (
                      <span key={tag} className={`inline-block px-2 py-0.5 rounded font-semibold text-xs ${isProfit ? 'bg-emerald-900/60 text-[#7fffd4]' : 'bg-blue-900/60 text-blue-200'}`}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="absolute right-4 top-4">
                  <span className={`inline-block px-2 py-0.5 rounded font-bold tracking-wide shadow text-xs ${isProfit ? 'bg-emerald-700/90 text-white' : 'bg-blue-700/90 text-white'}`}>{mostCommonDay}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Direction Ratio Bar */}
                  <div className="flex items-center gap-2">
                    <span className="w-36 text-sm text-slate-300">Direction Ratio</span>
                    <div className="flex-1 h-4 rounded overflow-hidden flex bg-slate-800/60">
                      <div
                        className="h-4"
                        style={{
                          width: `${longRatio * 100}%`,
                          background: '#34d399', // emerald-400
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
                      <span className="text-emerald-300">{(longRatio * 100).toFixed(1)}%</span> / <span className="text-slate-300">{(shortRatio * 100).toFixed(1)}%</span>
                    </span>
                  </div>
                  {/* Stats */}
                  {statKeys.map(key => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-36 text-sm text-slate-300">{statLabels[key]}</span>
                      <span className="min-w-[70px] text-right font-mono text-white">{statFormat[key](cluster[key as keyof ClusterData] as number)}</span>
                      <div className="flex-1 h-3 rounded overflow-hidden bg-slate-800/60 ml-4">
                        <div
                          className="h-3 rounded"
                          style={{
                            width: `${Math.round(normalize(key, cluster[key as keyof ClusterData] as number) * 100)}%`,
                            background: key === 'mean_pnl'
                              ? (isProfit ? '#34d399' : '#ba5f72') // emerald-400 or blue-500
                              : (key === 'count' || key === 'ratio' ? '#ccc' : '#3b82f6'), // blue-500
                            transition: 'width 0.3s',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}; 