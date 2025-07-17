import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

export function AnalysisResults({ analysis }: AnalysisResultsProps) {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
          Your Trading Optimization Analysis
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          AI-powered analysis of your trading patterns with actionable optimization recommendations
        </p>
      </div>

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
                    {analysis.optimal_break_between_trades.minutes} min
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
                      {analysis.optimal_break_between_trades.minutes} minutes
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {analysis.optimal_break_between_trades.explanation}
                    </p>
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
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Avg P&L in range:</span>
                      <span className="text-sm font-semibold text-profit">
                        ${analysis.optimal_time_distance_range.avg_pnl_in_range}
                      </span>
                    </div>
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
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-loss-foreground/60">Consistency:</span>
                      <span className="text-sm font-semibold text-loss-foreground">
                        {(analysis.optimal_intraday_drawdown.consistency_rate * 100).toFixed(1)}%
                      </span>
                    </div>
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
                      {analysis.optimal_max_trades_per_day.median_trades_to_peak} trades
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {analysis.optimal_max_trades_per_day.recommendation}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Current avg:</span>
                      <span className="text-sm font-semibold">
                        {analysis.optimal_max_trades_per_day.current_avg_trades_per_day} trades/day
                      </span>
                    </div>
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
                  <p className="text-sm text-muted-foreground mt-2">
                    {analysis.optimal_trading_hours.recommendation}
                  </p>
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
                  <p className="text-sm text-muted-foreground mt-2">
                    {analysis.volume_optimization.recommendation}
                  </p>
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
                  <p className="font-medium">Wait {analysis.optimal_break_between_trades.minutes} minutes between trades</p>
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
                  <p className="font-medium">Limit to {analysis.optimal_max_trades_per_day.median_trades_to_peak} trades per day</p>
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