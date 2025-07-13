import React from 'react';
import { TrendingUp, TrendingDown, Target, DollarSign, BarChart3, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Suggestion {
  id: string;
  type: 'risk' | 'opportunity' | 'strategy';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
}

interface TradingMetrics {
  totalTrades: number;
  winRate: number;
  profitLoss: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

interface TradingDashboardProps {
  metrics?: TradingMetrics;
  suggestions?: Suggestion[];
  isLoading?: boolean;
}

export function TradingDashboard({ metrics, suggestions, isLoading }: TradingDashboardProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse bg-gradient-card">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics || !suggestions) {
    return (
      <Card className="bg-gradient-card">
        <CardContent className="p-12 text-center">
          <BarChart3 className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Analysis Available</h3>
          <p className="text-muted-foreground">
            Upload your trading records to see detailed performance analysis and improvement suggestions.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-loss/20 text-loss-foreground border-loss/30';
      case 'medium': return 'bg-primary/20 text-primary-foreground border-primary/30';
      case 'low': return 'bg-profit/20 text-profit-foreground border-profit/30';
      default: return 'bg-muted/20 text-muted-foreground border-muted/30';
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'risk': return AlertTriangle;
      case 'opportunity': return TrendingUp;
      case 'strategy': return Target;
      default: return BarChart3;
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total P&L</p>
                <p className={`text-2xl font-bold ${metrics.profitLoss >= 0 ? 'text-profit' : 'text-loss'}`}>
                  ${metrics.profitLoss.toLocaleString()}
                </p>
              </div>
              <DollarSign className={`h-8 w-8 ${metrics.profitLoss >= 0 ? 'text-profit' : 'text-loss'}`} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">{metrics.winRate.toFixed(1)}%</p>
              </div>
              <Target className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Trades</p>
                <p className="text-2xl font-bold">{metrics.totalTrades}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sharpe Ratio</p>
                <p className="text-2xl font-bold">{metrics.sharpeRatio.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-profit shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Win</p>
                <p className="text-xl font-bold text-profit">${metrics.avgWin.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-6 w-6 text-profit" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-loss shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Loss</p>
                <p className="text-xl font-bold text-loss">-${metrics.avgLoss.toLocaleString()}</p>
              </div>
              <TrendingDown className="h-6 w-6 text-loss" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Max Drawdown</p>
                <p className="text-xl font-bold text-loss">-{metrics.maxDrawdown.toFixed(1)}%</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-loss" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Improvement Suggestions */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Improvement Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {suggestions.map((suggestion) => {
            const Icon = getSuggestionIcon(suggestion.type);
            return (
              <div key={suggestion.id} className="border border-border rounded-lg p-4 bg-muted/5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <Icon className="h-5 w-5 text-primary mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{suggestion.title}</h4>
                        <Badge variant="outline" className={getImpactColor(suggestion.impact)}>
                          {suggestion.impact} impact
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {suggestion.description}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {suggestion.category}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}