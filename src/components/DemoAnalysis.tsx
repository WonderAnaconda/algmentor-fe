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

interface AnalysisData {
  optimal_break_between_trades: {
    minutes: number;
    explanation: string;
    pnl_improvement: number;
    confidence: string;
    robustness: string;
  };
  optimal_intraday_drawdown: {
    percentage: number;
    explanation: string;
    confidence: string;
    consistency_rate: number;
    confidence_interval_95: [number, number];
  };
  optimal_max_trades_per_day: {
    median_trades_to_peak: number;
    current_avg_trades_per_day: number;
    recommendation: string;
    confidence: string;
    optimal_rate: number;
  };
  optimal_trading_hours: {
    average_peak_time: string;
    confidence_interval_95: [string, string];
    explanation: string;
    recommendation: string;
    consistency_rate: number;
    confidence: string;
  };
  optimal_time_distance_range: {
    min_minutes: number;
    max_minutes: number;
    avg_pnl_in_range: number;
    explanation: string;
    recommendation: string;
    confidence: string;
  };
  optimal_win_rate_window: {
    time_window: string;
    win_rate: number;
    explanation: string;
    recommendation: string;
    confidence: string;
  };
  volume_optimization: {
    volume_time_correlation: number;
    correlation_significant: string;
    explanation: string;
    recommendation: string;
    confidence: string;
  };
}

const demoData: AnalysisData = {
  optimal_break_between_trades: {
    minutes: 10.75,
    explanation: "Based on cooldown analysis, waiting 10.8 minutes between trades maximizes cumulative P&L",
    pnl_improvement: 20945,
    confidence: "High - based on systematic analysis across all cooldown periods",
    robustness: "Cooldown periods between 10.8-10.8 minutes achieve >95% of maximum P&L"
  },
  optimal_intraday_drawdown: {
    percentage: 5.0,
    explanation: "Stop trading when daily drawdown reaches 5.0% of the day's peak P&L",
    confidence: "Medium - 86.7% of days had optimal drawdown within 5% of recommendation",
    consistency_rate: 0.8666666666666667,
    confidence_interval_95: [4.871793245032827, 14.461540088300506]
  },
  optimal_max_trades_per_day: {
    median_trades_to_peak: 6.5,
    current_avg_trades_per_day: 39.34375,
    recommendation: "Consider limiting to 6 trades per day, as this is the median number of trades needed to reach peak P&L",
    confidence: "Medium - 26.7% of days had optimal trades within 2 of recommendation",
    optimal_rate: 0.26666666666666666
  },
  optimal_trading_hours: {
    average_peak_time: "15:30",
    confidence_interval_95: ["15:00", "16:00"],
    explanation: "Most profitable trades occur between 15:00 and 16:00.",
    recommendation: "Focus trading during this window for best results.",
    consistency_rate: 0.85,
    confidence: "Medium"
  },
  optimal_time_distance_range: {
    min_minutes: 6.0,
    max_minutes: 8.0,
    avg_pnl_in_range: 120.5,
    explanation: "Trades with 6.0-8.0 minutes between them show the highest average P&L (among practical ranges)",
    recommendation: "Aim for 6.0-8.0 minute intervals between trades",
    confidence: "Medium - based on 10 trades in optimal range"
  },
  optimal_win_rate_window: {
    time_window: "18:28",
    win_rate: 100.0,
    explanation: "15-minute window centered at 18:28 shows the highest win rate",
    recommendation: "Focus trading activity during this time window for better win rates",
    confidence: "Low - based on single window analysis, 110 windows show >90% of best win rate"
  },
  volume_optimization: {
    volume_time_correlation: 0.03626646587564526,
    correlation_significant: "False",
    explanation: "Volume and time distance correlation: 0.0363",
    recommendation: "Volume shows minimal correlation with time distance",
    confidence: "Low - correlation is not statistically significant (p=0.3436)"
  }
};

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
  return (
    <AnalysisResults analysis={demoData} />
  );
}