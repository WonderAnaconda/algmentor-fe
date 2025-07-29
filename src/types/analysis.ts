export interface AnalysisData {
  break_time_pareto?: {
    pareto_front: Array<{
      break_time: number;
      PnL: number;
      win_rate: number;
      pnl_std?: number;
      sample_size?: number;
    }>;
    best_per_metric: {
      PnL: number;
      win_rate: number;
      pnl_std?: number;
      sample_size?: number;
    };
    best_balanced_point?: {
      break_time: number;
      PnL: number;
      win_rate: number;
      pnl_std?: number;
      sample_size?: number;
    };
    potential_dollar_gain: number;
    all_results: Array<{
      break_time: number;
      PnL: number;
      win_rate: number;
      pnl_std?: number;
      sample_size?: number;
    }>;
    metrics: string[];
  };
  optimal_intraday_drawdown?: {
    percentage: number;
    explanation: string;
    confidence: string;
    consistency_rate?: number;
    confidence_interval_95: [number, number];
    potential_dollar_gain: number;
    vanilla_pnl: number;
    optimal_pnl: number;
    robustness: string;
    ego_trading_avg?: number;
    ego_trading_median?: number;
    ego_trading_ratios?: number[];
    ego_trading_summary?: string;
  };
  optimal_max_trades_per_day?: {
    median_trades_to_peak: number;
    mean_trades_to_peak: number;
    std_trades_to_peak: number;
    confidence_interval_95: [number, number];
    current_avg_trades_per_day: number;
    sample_size: number;
    optimal_rate: number;
    recommendation: string;
    explanation: string;
    confidence: string;
    robustness: string;
    overtrading_avg?: number;
    overtrading_median?: number;
    overtrading_ratios?: number[];
    overtrading_summary?: string;
  };
  optimal_trading_hours?: {
    average_peak_time: string;
    std_peak_hour: number;
    confidence_interval_95: [string, string];
    most_common_peak_time: string;
    sample_size: number;
    consistency_rate: number;
    explanation: string;
    recommendation: string;
    confidence: string;
    robustness: string;
    peak_clusters?: Array<{
      start_time: string;
      end_time: string;
      total_pnl: number;
      count: number;
      percentage: number;
      details: Array<{
        time: string;
        pnl: number;
      }>;
    }>;
    trough_clusters?: Array<{
      start_time: string;
      end_time: string;
      total_pnl: number;
      count: number;
      percentage: number;
      details: Array<{
        time: string;
        pnl: number;
      }>;
    }>;
    trough_explanation?: string;
  };
  optimal_win_rate_window?: {
    time_window: string;
    win_rate: number;
    avg_time_distance: number;
    win_rate_std: number;
    sample_size: number;
    robust_windows_count: number;
    explanation: string;
    recommendation: string;
    confidence: string;
    robustness: string;
  };
  optimal_break_between_trades?: {
    minutes: number;
    pnl_improvement: number;
    potential_dollar_gain: number;
    explanation: string;
    confidence: string;
    robustness: string;
  };
  optimal_time_distance_range?: {
    min_minutes: number;
    max_minutes: number;
    explanation: string;
    confidence: string;
    robustness: string;
  };
  optimal_trading_time_window?: {
    optimal_time_distance_minutes: number;
    optimal_win_rate: number;
    win_rate_improvement: number;
    explanation: string;
    confidence: string;
    robustness: string;
  };
  volume_optimization?: {
    volume_time_correlation: number;
    explanation: string;
    confidence: string;
    robustness: string;
  };
}

export interface ClusterScatterPoint {
  x: number;
  y: number;
  cluster: number;
  pnl: number;
  duration: number;
  return_per_min: number;
}

export interface ClusterData {
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

export interface ClusterAnalysis {
  data: Record<string, ClusterData>;
  interpretation: Record<string, string>;
  scatter_data: ClusterScatterPoint[];
  method: string;
}

export interface PlotData {
  [key: string]: any;
}

export interface AnalysisResultsProps {
  analysis: AnalysisData;
  onExportPDF?: () => void;
  analysisResult?: any;
  elementRef?: React.RefObject<HTMLDivElement>;
  onReset?: () => void;
  plotData: PlotData;
} 