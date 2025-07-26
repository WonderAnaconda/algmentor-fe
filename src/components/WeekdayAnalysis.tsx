import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Calendar, 
  BarChart3, 
  Clock, 
  TrendingUp,
  Activity,
  Target,
  PieChart
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { Chart as ChartJS, registerables } from 'chart.js';
ChartJS.register(...registerables);
import Plot from 'react-plotly.js';

const weekdayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const seriesKeys = [
  { key: 'holding_time', label: 'Holding Time', icon: Clock },
  { key: 'pnl', label: 'PnL', icon: TrendingUp },
  { key: 'time_distance', label: 'Time Distance', icon: Target },
  { key: 'volume', label: 'Volume', icon: Activity },
];

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

const WeekdayAnalysis: React.FC<{ byWeekday: any }> = ({ byWeekday }) => {
  const barRef = useRef<HTMLCanvasElement>(null);

  // Grouped Bar Chart for scalar metrics (Chart.js)
  useEffect(() => {
    if (!barRef.current) return;
    const ctx = barRef.current.getContext('2d');
    if (!ctx) return;
    if ((window as any)._weekdayBarChart) {
      (window as any)._weekdayBarChart.destroy();
    }
    
    // Filter to only include weekdays that have data
    const availableWeekdays = weekdayLabels.filter((_, idx) => byWeekday[idx] && (byWeekday[idx].scalar?.count > 0 || byWeekday[idx].scalar?.win_rate > 0));
    const availableIndices = weekdayLabels.map((_, idx) => idx).filter(idx => byWeekday[idx] && (byWeekday[idx].scalar?.count > 0 || byWeekday[idx].scalar?.win_rate > 0));
    
    const tradeData = availableIndices.map(idx => byWeekday[idx]?.scalar?.count ?? 0);
    const winRateData = availableIndices.map(idx => (byWeekday[idx]?.scalar?.win_rate ?? 0) * 100);
    
    (window as any)._weekdayBarChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: availableWeekdays,
        datasets: [
          {
            label: 'Ø Trades',
            data: tradeData,
            backgroundColor: palette[0],
            yAxisID: 'y',
            order: 2,
          },
          {
            label: 'Win Rate (%)',
            data: winRateData,
            backgroundColor: palette[1],
            yAxisID: 'y1',
            order: 1,
          }
        ],
      },
      options: {
        plugins: {
          legend: { display: true, labels: { color: '#fff' } },
        },
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { 
            ticks: { color: '#fff' }, 
            grid: { color: '#334155' } 
          },
          y: { 
            type: 'linear',
            display: true,
            position: 'left',
            ticks: { color: '#fff' }, 
            grid: { color: '#334155' },
            title: {
              display: true,
              text: 'Number of Trades',
              color: '#fff'
            }
          },
          y1: { 
            type: 'linear',
            display: true,
            position: 'right',
            ticks: { 
              color: '#fff',
              callback: function(value) {
                return value + '%';
              }
            }, 
            grid: { drawOnChartArea: false },
            title: {
              display: true,
              text: 'Win Rate (%)',
              color: '#fff'
            }
          }
        },
      },
    });
    return () => {
      (window as any)._weekdayBarChart?.destroy();
    };
  }, [byWeekday]);

  // Prepare data for Plotly box plots
  const getBoxPlotData = (seriesKey: string, color: string) => {
    const data: any[] = [];
    weekdayLabels.forEach((weekday, idx) => {
      const values = byWeekday[idx]?.series?.[seriesKey] ?? [];
      if (values.length > 0) {
        data.push({
          type: 'box',
          y: values,
          x: weekday,
          name: weekday,
          boxpoints: false,
          line: { color: color, width: 1.5 },
          fillcolor: color + '30',
          opacity: 0.8,
          whiskerwidth: 0.8,
          boxmean: true,
        });
      }
    });
    return data;
  };

  return (
    <section className="my-10 space-y-8 animate-fade-in">
      
      {/* Scalar Metrics Section */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Trading Metrics by Weekday
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[400px]">
            <canvas ref={barRef} width={800} height={400} />
          </div>
        </CardContent>
      </Card>
      
      {/* Distribution Section */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            Distribution Analysis by Weekday
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-8">
            {seriesKeys.map((s, i) => {
              const IconComponent = s.icon;
              return (
                <Card key={s.key} className="bg-muted/10 border border-muted/20">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <IconComponent className="h-5 w-5 text-primary" />
                      {s.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[350px] w-full">
                      <Plot
                        data={getBoxPlotData(s.key, palette[i % palette.length])}
                        layout={{
                          width: undefined,
                          height: 330,
                          autosize: true,
                          paper_bgcolor: 'rgba(15,23,42,0)',
                          plot_bgcolor: 'rgba(15,23,42,0)',
                          font: { color: '#fff' },
                          margin: { t: 20, l: 60, r: 20, b: 60 },
                          xaxis: { 
                            title: { text: 'Weekday', font: { color: '#fff', size: 14 } },
                            tickvals: weekdayLabels, 
                            tickfont: { color: '#fff', size: 12 }, 
                            gridcolor: '#334155',
                            showgrid: true,
                            zeroline: false
                          },
                          yaxis: { 
                            title: { text: s.label, font: { color: '#fff', size: 14 } },
                            tickfont: { color: '#fff', size: 12 }, 
                            gridcolor: '#334155',
                            showgrid: true,
                            zeroline: false
                          },
                          showlegend: false,
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        useResizeHandler={true}
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

export default WeekdayAnalysis; 