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
    average_peak_time: "17:18",
    confidence_interval_95: ["16:40", "17:56"],
    explanation: "Peak cumulative P&L typically occurs around 17:18",
    recommendation: "Focus trading activity in the hours leading up to the typical peak time",
    consistency_rate: 0.26666666666666666
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
    return 'bg-primary/20 text-primary-foreground border-primary/30';
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
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
          Trading Optimization Analysis
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Comprehensive AI analysis of trading patterns with actionable optimization recommendations
        </p>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-card shadow-card hover-scale">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">P&L Improvement</p>
                <p className="text-2xl font-bold text-profit">+${demoData.optimal_break_between_trades.pnl_improvement.toLocaleString()}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-profit" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card hover-scale">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Optimal Break Time</p>
                <p className="text-2xl font-bold">{demoData.optimal_break_between_trades.minutes} min</p>
              </div>
              <Clock className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card hover-scale">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Max Drawdown</p>
                <p className="text-2xl font-bold text-loss">{demoData.optimal_intraday_drawdown.percentage}%</p>
              </div>
              <TrendingDown className="h-8 w-8 text-loss" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card hover-scale">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Peak Win Rate</p>
                <p className="text-2xl font-bold text-profit">{demoData.optimal_win_rate_window.win_rate}%</p>
              </div>
              <Award className="h-8 w-8 text-profit" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trade Timing Optimization */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Trade Timing Optimization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Optimal Break Between Trades</span>
                <Badge variant="outline" className={getConfidenceColor(demoData.optimal_break_between_trades.confidence)}>
                  High Confidence
                </Badge>
              </div>
              <div className="bg-muted/10 rounded-lg p-4">
                <p className="text-2xl font-bold mb-2">{demoData.optimal_break_between_trades.minutes} minutes</p>
                <p className="text-sm text-muted-foreground">{demoData.optimal_break_between_trades.explanation}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Optimal Time Distance Range</span>
                <Badge variant="outline" className={getConfidenceColor(demoData.optimal_time_distance_range.confidence)}>
                  Medium Confidence
                </Badge>
              </div>
              <div className="bg-muted/10 rounded-lg p-4">
                <p className="text-2xl font-bold mb-2">
                  {demoData.optimal_time_distance_range.min_minutes}-{demoData.optimal_time_distance_range.max_minutes} minutes
                </p>
                <p className="text-sm text-muted-foreground">{demoData.optimal_time_distance_range.explanation}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Avg P&L in range:</span>
                  <span className="text-sm font-semibold text-profit">${demoData.optimal_time_distance_range.avg_pnl_in_range}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Management */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-loss" />
              Risk Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Optimal Intraday Drawdown</span>
                <Badge variant="outline" className={getConfidenceColor(demoData.optimal_intraday_drawdown.confidence)}>
                  Medium Confidence
                </Badge>
              </div>
              <div className="bg-gradient-loss rounded-lg p-4">
                <p className="text-2xl font-bold mb-2 text-loss">{demoData.optimal_intraday_drawdown.percentage}%</p>
                <p className="text-sm text-muted-foreground">{demoData.optimal_intraday_drawdown.explanation}</p>
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Consistency Rate</span>
                    <span>{(demoData.optimal_intraday_drawdown.consistency_rate * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={demoData.optimal_intraday_drawdown.consistency_rate * 100} className="h-2" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-medium">Confidence Interval (95%)</span>
              <div className="bg-muted/10 rounded-lg p-4">
                <p className="text-lg font-semibold">
                  {demoData.optimal_intraday_drawdown.confidence_interval_95[0].toFixed(1)}% - {demoData.optimal_intraday_drawdown.confidence_interval_95[1].toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Range of optimal drawdown levels</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trading Frequency */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Trading Frequency
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Optimal Max Trades Per Day</span>
                <Badge variant="outline" className={getConfidenceColor(demoData.optimal_max_trades_per_day.confidence)}>
                  Medium Confidence
                </Badge>
              </div>
              <div className="bg-muted/10 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-2xl font-bold">{Math.round(demoData.optimal_max_trades_per_day.median_trades_to_peak)} trades</p>
                    <p className="text-xs text-muted-foreground">Recommended daily limit</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-loss">{Math.round(demoData.optimal_max_trades_per_day.current_avg_trades_per_day)} trades</p>
                    <p className="text-xs text-muted-foreground">Current average</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{demoData.optimal_max_trades_per_day.recommendation}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Optimal Trading Hours */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Optimal Trading Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Peak Performance Time</span>
                <Badge variant="outline" className={getConfidenceColor("Medium")}>
                  Medium Confidence
                </Badge>
              </div>
              <div className="bg-gradient-profit rounded-lg p-4">
                <p className="text-2xl font-bold mb-2 text-profit">{demoData.optimal_trading_hours.average_peak_time}</p>
                <p className="text-sm text-muted-foreground">{demoData.optimal_trading_hours.explanation}</p>
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">95% Confidence Interval:</p>
                  <p className="text-sm font-semibold">
                    {demoData.optimal_trading_hours.confidence_interval_95[0]} - {demoData.optimal_trading_hours.confidence_interval_95[1]}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-medium">High Win Rate Window</span>
              <div className="bg-muted/10 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-lg font-bold">{demoData.optimal_win_rate_window.time_window}</p>
                  <Badge className="bg-profit/20 text-profit-foreground">{demoData.optimal_win_rate_window.win_rate}% Win Rate</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{demoData.optimal_win_rate_window.explanation}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Volume Analysis */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            Volume Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Volume-Time Correlation</span>
                <Badge variant="outline" className={getConfidenceColor(demoData.volume_optimization.confidence)}>
                  Low Confidence
                </Badge>
              </div>
              <div className="bg-muted/10 rounded-lg p-4">
                <p className="text-2xl font-bold mb-2">{demoData.volume_optimization.volume_time_correlation.toFixed(4)}</p>
                <p className="text-sm text-muted-foreground">{demoData.volume_optimization.explanation}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <span className="text-sm font-medium">Statistical Significance</span>
              <div className="bg-muted/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">Not Significant</span>
                </div>
                <p className="text-sm text-muted-foreground">{demoData.volume_optimization.recommendation}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Recommendations */}
      <Card className="bg-gradient-primary shadow-glow">
        <CardHeader>
          <CardTitle className="text-primary-foreground flex items-center gap-2">
            <Target className="h-5 w-5" />
            Key Recommendations Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-background/10 rounded-lg p-4">
              <h4 className="font-semibold text-primary-foreground mb-2">Timing Optimization</h4>
              <ul className="text-sm text-primary-foreground/80 space-y-1">
                <li>• Wait {demoData.optimal_break_between_trades.minutes} minutes between trades</li>
                <li>• Focus activity around {demoData.optimal_trading_hours.average_peak_time}</li>
                <li>• Aim for 6-8 minute intervals for best P&L</li>
              </ul>
            </div>
            
            <div className="bg-background/10 rounded-lg p-4">
              <h4 className="font-semibold text-primary-foreground mb-2">Risk & Frequency</h4>
              <ul className="text-sm text-primary-foreground/80 space-y-1">
                <li>• Stop at {demoData.optimal_intraday_drawdown.percentage}% daily drawdown</li>
                <li>• Limit to ~{Math.round(demoData.optimal_max_trades_per_day.median_trades_to_peak)} trades per day</li>
                <li>• Potential P&L improvement: +${demoData.optimal_break_between_trades.pnl_improvement.toLocaleString()}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}