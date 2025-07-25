import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Info
} from 'lucide-react';
import { AnalysisResults } from './AnalysisResults';
import latestDemoOutput from '../../latest_demo_output.json';

interface AnalysisData {
  optimal_break_between_trades?: {
    minutes: number;
    explanation: string;
    pnl_improvement: number;
    potential_dollar_gain: number;
    confidence: string;
    robustness: string;
  };
  optimal_intraday_drawdown?: {
    percentage: number;
    explanation: string;
    confidence: string;
    consistency_rate: number;
    confidence_interval_95: [number, number];
    potential_dollar_gain: number;
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

const getConfidenceColor = (confidence: string) => {
  if (confidence.toLowerCase().includes('high')) {
    return 'bg-profit/20 text-profit-foreground border-profit/30';
  } else if (confidence.toLowerCase().includes('medium')) {
    return 'bg-primary/20 text-primary-foreground !text-white border-primary/30'; // Force white text
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

export function DemoAnalysis() {
  // Use recommendations or analysis from latest_demo_output.json
  const output = latestDemoOutput as unknown as Record<string, unknown>;
  const analysis = (output.recommendations ?? output.analysis ?? output.data) as AnalysisData;
  const plotData = (output.data ?? {}) as Record<string, unknown>;
  return (
    <AnalysisResults analysis={analysis} plotData={plotData} />
  );
}