import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AnalysisRequest {
  file_url: string;
  user_id: string;
  csv_data?: string; // For testing purposes
}

interface TradeData {
  'Open time': string;
  'Close time'?: string;
  'PnL'?: number;
  'Profit (ticks)'?: number;
  'Open volume'?: number;
}

interface AnalysisResult {
  data: {
    win_rate_vs_avg_time_distance_over_15m_window?: {
      time_distance: number[];
      win_rate: number[];
      time_distance_sorted: number[];
      rolling_win_rate: number[];
    };
    pnl_vs_time_distance?: {
      time_distance_minutes: number[];
      pnl: number[];
    };
    volume_vs_time_distance?: {
      time_distance: number[];
      volume: number[];
    };
    distribution_of_peak_pnl_times?: {
      time: string[];
      pnl: number[];
    };
    distribution_of_trades_to_peak?: {
      trades_to_peak: number[];
    };
    cumulative_pnl_vs_drawdown_threshold?: {
      drawdown_percentages: number[];
      cumulative_pnl: number[];
    };
    cumulative_pnl_vs_cooldown_period?: {
      cooldown_minutes: number[];
      cumulative_pnl: number[];
    };
    total_pnl_by_time_distance_bin?: {
      time_distance_seconds: number[];
      total_pnl: number[];
    };
  };
  analysis: {
    optimal_break_between_trades?: any;
    optimal_intraday_drawdown?: any;
    optimal_max_trades_per_day?: any;
    optimal_trading_hours?: any;
    optimal_time_distance_range?: any;
    optimal_win_rate_window?: any;
    volume_optimization?: any;
  };
}

// Helper function to calculate correlation between two arrays
function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

// Helper function to calculate mean, median, and standard deviation
function calculateStats(values: number[]) {
  if (values.length === 0) return { mean: 0, median: 0, std: 0 };
  
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const median = sorted.length % 2 === 0 
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  
  return { mean, median, std };
}

// Helper function to calculate quantiles (e.g., 0.25, 0.75)
function quantile(arr: number[], q: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  } else {
    return sorted[base];
  }
}

// Parse CSV data into TradeData objects
function parseExcelData(csvData: string): TradeData[] {
  try {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      throw new Error("File must contain at least a header row and one data row");
    }
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log("Detected headers:", headers);
    
    // Validate required headers
    const requiredHeaders = ['Open time'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }
    
    const trades: TradeData[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      // Handle CSV with commas inside quotes
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim()); // Add the last value
      
      const trade: any = {};
      
      headers.forEach((header, index) => {
        if (values[index] && values[index] !== '') {
          if (header === 'Open time' || header === 'Close time') {
            trade[header] = values[index];
          } else {
            const num = parseFloat(values[index]);
            trade[header] = isNaN(num) ? values[index] : num;
          }
        }
      });
      
      if (trade['Open time']) {
        trades.push(trade);
      }
    }
    
    console.log(`Successfully parsed ${trades.length} trades`);
    return trades;
  } catch (error) {
    console.error("Error parsing file data:", error);
    throw new Error(`Failed to parse file: ${error.message}`);
  }
}

// Filter trades to only those within the main trading hours (15:30-22:00)
function filterTradingHours(trades: TradeData[]): TradeData[] {
  return trades.filter(trade => {
    const timeStr = trade['Open time'];
    if (!timeStr) return false;
    
    // Parse time (assuming format like "2025-01-05 15:30:00")
    const timeMatch = timeStr.match(/(\d{2}):(\d{2}):\d{2}/);
    if (!timeMatch) return false;
    
    const hour = parseInt(timeMatch[1]);
    const minute = parseInt(timeMatch[2]);
    const timeInMinutes = hour * 60 + minute;
    
    const startMinutes = 15 * 60 + 30; // 15:30
    const endMinutes = 22 * 60; // 22:00
    
    return timeInMinutes >= startMinutes && timeInMinutes <= endMinutes;
  });
}

// Group trades by trading day (YYYY-MM-DD)
function groupByDay(trades: TradeData[]): Map<string, TradeData[]> {
  const groups = new Map<string, TradeData[]>();
  
  trades.forEach(trade => {
    const dateStr = trade['Open time']?.split(' ')[0];
    if (dateStr) {
      if (!groups.has(dateStr)) {
        groups.set(dateStr, []);
      }
      groups.get(dateStr)!.push(trade);
    }
  });
  
  return groups;
}

// Analyze correlations between consecutive trades (time distance, PnL, volume, win)
function analyzeCorrelations(dailyGroups: Map<string, TradeData[]>): any[] {
  const correlations: any[] = [];
  
  dailyGroups.forEach((dayTrades, date) => {
    if (dayTrades.length < 2) return;
    
    // Sort by open time
    dayTrades.sort((a, b) => new Date(a['Open time']).getTime() - new Date(b['Open time']).getTime());
    
    for (let i = 1; i < dayTrades.length; i++) {
      const prevTrade = dayTrades[i - 1];
      const currTrade = dayTrades[i];
      
      const prevTime = new Date(prevTrade['Open time']).getTime();
      const currTime = new Date(currTrade['Open time']).getTime();
      const timeDistance = (currTime - prevTime) / (1000 * 60); // minutes
      
      if (timeDistance > 0) {
        const pnl = currTrade['PnL'] || currTrade['Profit (ticks)'] || 0;
        const volume = Math.abs(currTrade['Open volume'] || 1);
          const win = pnl > 0 ? 1 : 0;
        
        correlations.push({
            date,
          time_distance: timeDistance,
            pnl,
            volume,
            win
          });
        }
      }
  });
  
  return correlations;
}

// Analyze cumulative P&L by time to peak for each day
function analyzeCumulativePnlByTime(dailyGroups: Map<string, TradeData[]>): any[] {
  const timePeaks: any[] = [];
  
  dailyGroups.forEach((dayTrades, date) => {
    if (dayTrades.length < 2) return;
    
    // Sort by open time
    dayTrades.sort((a, b) => new Date(a['Open time']).getTime() - new Date(b['Open time']).getTime());
    
      let cumulativePnl = 0;
    let peakPnl = 0;
    let peakTime = '';
    let tradesToPeak = 0;
    
    dayTrades.forEach((trade, index) => {
      const pnl = trade['PnL'] || trade['Profit (ticks)'] || 0;
      cumulativePnl += pnl;
      
        if (cumulativePnl > peakPnl) {
          peakPnl = cumulativePnl;
        peakTime = trade['Open time'];
        tradesToPeak = index + 1;
      }
    });
    
    if (peakTime) {
      timePeaks.push({
        date,
        peak_time: peakTime,
        peak_pnl: peakPnl,
        trades_to_peak: tradesToPeak
      });
    }
  });
  
  return timePeaks;
}

// Analyze optimal drawdown for each day
function analyzeOptimalDrawdown(dailyGroups: Map<string, TradeData[]>): any[] {
  const results: any[] = [];
  
  dailyGroups.forEach((dayTrades, date) => {
    if (dayTrades.length < 2) return;
    
    // Sort by open time
    dayTrades.sort((a, b) => new Date(a['Open time']).getTime() - new Date(b['Open time']).getTime());
    
    let cumulativePnl = 0;
    let peakPnl = 0;
    
    dayTrades.forEach(trade => {
      const pnl = trade['PnL'] || trade['Profit (ticks)'] || 0;
      cumulativePnl += pnl;
      peakPnl = Math.max(peakPnl, cumulativePnl);
    });
    
    // Test different drawdown percentages
    const drawdownPercentages = Array.from({length: 20}, (_, i) => (i + 1) * 5); // 5% to 100%
    let bestDrawdown = 50; // default
    let bestFinalPnl = cumulativePnl;
    
    drawdownPercentages.forEach(drawdownPct => {
      let runningPnl = 0;
      let runningPeak = 0;
      let stopped = false;
      
      for (const trade of dayTrades) {
        const pnl = trade['PnL'] || trade['Profit (ticks)'] || 0;
        runningPnl += pnl;
        runningPeak = Math.max(runningPeak, runningPnl);
        
        if (runningPeak > 0) {
          const currentDrawdown = ((runningPeak - runningPnl) / runningPeak) * 100;
          if (currentDrawdown > drawdownPct) {
            stopped = true;
            runningPnl -= pnl; // Stop at previous trade
            break;
          }
        }
      }
      
      if (runningPnl > bestFinalPnl) {
        bestFinalPnl = runningPnl;
        bestDrawdown = drawdownPct;
      }
    });
    
    results.push({
          date,
      optimal_drawdown_pct: bestDrawdown,
      final_pnl_with_optimal: bestFinalPnl,
      unlimited_final_pnl: cumulativePnl,
      total_trades: dayTrades.length
    });
  });
  
  return results;
}

// Generate trading recommendations and advanced metrics for all analysis sections
function generateRecommendations(correlations: any[], timePeaks: any[], dailyGroups: Map<string, TradeData[]>): any {
  const recommendations: any = {};
  // 1. Optimal break between trades (cooldown analysis)
  if (correlations.length > 0) {
    const cooldownPeriods = Array.from({length: 121}, (_, i) => i * 15); // 0 to 1800 seconds
    let bestCooldown = 0;
    let bestPnl = 0;
    
    cooldownPeriods.forEach(cooldownSeconds => {
      let totalPnl = 0;
      
      dailyGroups.forEach((dayTrades) => {
        if (dayTrades.length < 2) return;
        
        dayTrades.sort((a, b) => new Date(a['Open time']).getTime() - new Date(b['Open time']).getTime());
        
        let lastTradeEnd: number | null = null;
        let dayPnl = 0;
        
        dayTrades.forEach(trade => {
          const openTime = new Date(trade['Open time']).getTime();
          if (lastTradeEnd === null || (openTime - lastTradeEnd) >= cooldownSeconds * 1000) {
            const pnl = trade['PnL'] || trade['Profit (ticks)'] || 0;
            dayPnl += pnl;
            lastTradeEnd = openTime;
          }
        });
        
        totalPnl += dayPnl;
      });
      
      if (totalPnl > bestPnl) {
        bestPnl = totalPnl;
        bestCooldown = cooldownSeconds;
      }
    });
    
    recommendations.optimal_break_between_trades = {
      minutes: bestCooldown / 60,
      seconds: bestCooldown,
      explanation: `Based on cooldown analysis, waiting ${(bestCooldown / 60).toFixed(1)} minutes between trades maximizes cumulative P&L`,
      pnl_improvement: bestPnl,
      confidence: "High - based on systematic analysis across all cooldown periods"
    };
  }
  
  // 2. Optimal trading hours (peak P&L time analysis)
  if (timePeaks.length > 0) {
    const peakHours = timePeaks.map(peak => {
      const time = new Date(peak.peak_time);
      return time.getHours() + time.getMinutes() / 60;
    });
    const { mean: avgPeakHour, std: stdPeakHour } = calculateStats(peakHours);
    const n = peakHours.length;
    // t-distribution 95% CI (approximate for n=30)
    const t = n > 1 ? 2.045 : 0;
    const se = n > 1 ? stdPeakHour / Math.sqrt(n) : 0;
    const ci95 = [avgPeakHour - t * se, avgPeakHour + t * se];
    // Most common peak time
    const hourCounts: Record<number, number> = {};
    peakHours.forEach(h => { hourCounts[Math.round(h * 100) / 100] = (hourCounts[Math.round(h * 100) / 100] || 0) + 1; });
    let mostCommonPeakHour: string | null = null;
    if (Object.keys(hourCounts).length > 0) {
      const entries = Object.entries(hourCounts);
      const maxEntry = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
      mostCommonPeakHour = maxEntry[0];
    }
    // Consistency: % of days within 1 hour of average
    const consistencyCount = peakHours.filter(h => Math.abs(h - avgPeakHour) <= 1).length;
    const consistencyRate = n > 0 ? consistencyCount / n : 0;
    // Format times
    function formatHour(hour: number) {
      return `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;
    }
    recommendations.optimal_trading_hours = {
      average_peak_time: formatHour(avgPeakHour),
      std_peak_hour: stdPeakHour,
      confidence_interval_95: [formatHour(ci95[0]), formatHour(ci95[1])],
      most_common_peak_time: mostCommonPeakHour ? formatHour(Number(mostCommonPeakHour)) : 'N/A',
      sample_size: n,
      consistency_rate: consistencyRate,
      explanation: `Peak cumulative P&L typically occurs around ${formatHour(avgPeakHour)}`,
      recommendation: 'Focus trading activity in the hours leading up to the typical peak time',
      confidence: `Medium - ${(consistencyRate * 100).toFixed(1)}% of days had peak within 1 hour of average`,
      robustness: `95% confidence interval: ${formatHour(ci95[0])} - ${formatHour(ci95[1])}`
    };
  }
  
  // 3. Volume optimization (correlation, revenge trading, significance)
  if (correlations.length > 0) {
    const timeDistances = correlations.map(c => c.time_distance);
    const volumes = correlations.map(c => c.volume);
    const pnls = correlations.map(c => c.pnl);
    const volCorr = calculateCorrelation(timeDistances, volumes);
    // Correlation significance (p-value)
    const n_vol = correlations.length;
    let p_value = 1.0, significant = false;
    if (n_vol > 2) {
      const t_stat = volCorr * Math.sqrt((n_vol - 2) / (1 - volCorr ** 2));
      // Two-tailed p-value from t-distribution (approximate)
      const tDist = (t: number, df: number) => {
        // CDF for t-distribution (approximate, for large n)
        const x = Math.abs(t) / Math.sqrt(df);
        return 1 - Math.exp(-2 * x * x);
      };
      p_value = 2 * (1 - tDist(Math.abs(t_stat), n_vol - 2));
      significant = p_value < 0.05;
    }
    // Revenge trading analysis
    const volume_75th = quantile(volumes, 0.75);
    const time_distance_25th = quantile(timeDistances, 0.25);
    const revenge_trades = correlations.filter(c => c.volume >= volume_75th && c.time_distance <= time_distance_25th);
    const revenge_count = revenge_trades.length;
    const revenge_percentage = n_vol > 0 ? (revenge_count / n_vol) * 100 : 0;
    const revenge_pnl_mean = revenge_trades.length > 0 ? revenge_trades.map(c => c.pnl).reduce((a, b) => a + b, 0) / revenge_trades.length : 0;
    const revenge_pnl_std = revenge_trades.length > 0 ? Math.sqrt(revenge_trades.map(c => Math.pow(c.pnl - revenge_pnl_mean, 2)).reduce((a, b) => a + b, 0) / revenge_trades.length) : 0;
    const normal_trades = correlations.filter(c => !(c.volume >= volume_75th && c.time_distance <= time_distance_25th));
    const normal_pnl_mean = normal_trades.length > 0 ? normal_trades.map(c => c.pnl).reduce((a, b) => a + b, 0) / normal_trades.length : 0;
    const pnl_difference = revenge_pnl_mean - normal_pnl_mean;
    const revenge_performance = pnl_difference < 0 ? 'worse' : (revenge_count > 0 ? 'better' : 'no data');
    const low_time_high_vol = correlations.filter(c => c.time_distance <= time_distance_25th && c.volume >= volume_75th);
    const low_time_high_vol_percentage = n_vol > 0 ? (low_time_high_vol.length / n_vol) * 100 : 0;
    // Action items
    const action_items = revenge_percentage > 10 ? [
      'Implement mandatory cooldown periods after losses',
      'Set volume limits for trades within 5 minutes of previous trade',
      'Monitor for increasing position sizes after losses',
      'Consider reducing position size when time between trades is low'
    ] : [
      'Monitor for revenge trading patterns',
      'Maintain current risk management practices'
    ];
    recommendations.volume_optimization = {
      volume_time_correlation: volCorr,
      correlation_p_value: p_value,
      correlation_significant: significant,
      sample_size: n_vol,
      revenge_trading_analysis: {
        revenge_trades_count: revenge_count,
        revenge_trades_percentage: revenge_percentage,
        revenge_pnl_mean,
        revenge_pnl_std,
        normal_pnl_mean,
        pnl_difference,
        revenge_performance,
        low_time_high_vol_percentage,
        volume_threshold_75th: volume_75th,
        time_distance_threshold_25th: time_distance_25th
      },
      explanation: `Volume and time distance correlation: ${volCorr.toFixed(4)}. ${revenge_percentage.toFixed(1)}% of trades show potential revenge trading patterns (high volume + low time distance).`,
      recommendation: `Address revenge trading: ${revenge_percentage.toFixed(1)}% of trades show high volume with low time gaps. These trades perform ${revenge_performance} than normal trades (difference: ${pnl_difference.toFixed(1)} P&L).`,
      confidence: `${significant ? 'High' : 'Low'} - correlation is ${significant ? 'statistically significant' : 'not statistically significant'} (p=${p_value.toFixed(4)})`,
      robustness: `Based on ${n_vol} trade observations`,
      action_items
    };
  }

  // 4. Optimal intraday drawdown (risk management)
  const optimalDrawdownResults = analyzeOptimalDrawdown(dailyGroups);
  if (optimalDrawdownResults.length > 0) {
    const drawdownPcts = optimalDrawdownResults.map(r => r.optimal_drawdown_pct);
    const mean = drawdownPcts.reduce((a, b) => a + b, 0) / drawdownPcts.length;
    const std = Math.sqrt(drawdownPcts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / drawdownPcts.length);
    const sorted = [...drawdownPcts].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
    const n = drawdownPcts.length;
    // t-distribution 95% CI (approximate for n=30)
    const t = n > 1 ? 2.045 : 0;
    const se = n > 1 ? std / Math.sqrt(n) : 0;
    const ci95 = [mean - t * se, mean + t * se];
    // Consistency: % of days within 5% of median
    const consistencyCount = drawdownPcts.filter(pct => Math.abs(pct - median) <= 5).length;
    const consistencyRate = n > 0 ? consistencyCount / n : 0;
    recommendations.optimal_intraday_drawdown = {
      percentage: median,
      mean_percentage: mean,
      std_percentage: std,
      confidence_interval_95: ci95,
      sample_size: n,
      consistency_rate: consistencyRate,
      explanation: `Stop trading when daily drawdown reaches ${median.toFixed(1)}% of the day's peak P&L`,
      confidence: `Medium - ${(consistencyRate * 100).toFixed(1)}% of days had optimal drawdown within 5% of recommendation`,
      robustness: `95% confidence interval: ${ci95[0].toFixed(1)}%-${ci95[1].toFixed(1)}%`
    };
  }

  // 5. Optimal max trades per day (trades to peak)
  if (timePeaks.length > 0 && dailyGroups.size > 0) {
    const tradesToPeak = timePeaks.map(p => p.trades_to_peak);
    const mean_trades_to_peak = tradesToPeak.reduce((a, b) => a + b, 0) / tradesToPeak.length;
    const sorted = [...tradesToPeak].sort((a, b) => a - b);
    const median_trades_to_peak = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
    const std_trades_to_peak = Math.sqrt(tradesToPeak.reduce((sum, val) => sum + Math.pow(val - mean_trades_to_peak, 2), 0) / tradesToPeak.length);
    const n = tradesToPeak.length;
    // t-distribution 95% CI (approximate for n=30)
    const t = n > 1 ? 2.045 : 0;
    const se = n > 1 ? std_trades_to_peak / Math.sqrt(n) : 0;
    const ci95 = [mean_trades_to_peak - t * se, mean_trades_to_peak + t * se];
    // Calculate current average trades per day
    let totalTrades = 0;
    dailyGroups.forEach(dayTrades => { totalTrades += dayTrades.length; });
    const current_avg_trades_per_day = dailyGroups.size > 0 ? totalTrades / dailyGroups.size : 0;
    // Calculate optimal rate (how often the recommendation would have been optimal)
    const optimal_count = tradesToPeak.filter(trades => Math.abs(trades - median_trades_to_peak) <= 2).length;
    const optimal_rate = n > 0 ? optimal_count / n : 0;
    recommendations.optimal_max_trades_per_day = {
      median_trades_to_peak,
      mean_trades_to_peak,
      std_trades_to_peak,
      confidence_interval_95: ci95,
      current_avg_trades_per_day,
      sample_size: n,
      optimal_rate,
      recommendation: `Consider limiting to ${Math.round(median_trades_to_peak)} trades per day, as this is the median number of trades needed to reach peak P&L`,
      explanation: "Based on analysis of when cumulative P&L typically peaks during trading days",
      confidence: `Medium - ${(optimal_rate * 100).toFixed(1)}% of days had optimal trades within 2 of recommendation`,
      robustness: `95% confidence interval: ${ci95[0].toFixed(1)}-${ci95[1].toFixed(1)} trades`
    };
  }
  
  // 6. Optimal time distance range (binning analysis)
  if (correlations.length > 0) {
    // Bin by time distance (0-30 min, 2-min bins)
    const minTime = 0, maxTime = 30, binSize = 2;
    const bins: number[] = [];
    for (let t = minTime; t <= maxTime; t += binSize) bins.push(t);
    const binStats: {sum: number, count: number, values: number[]}[] = Array(bins.length - 1).fill(0).map(() => ({sum: 0, count: 0, values: []}));
    correlations.forEach(c => {
      const td = c.time_distance;
      const pnl = c.pnl;
      for (let i = 0; i < bins.length - 1; i++) {
        if (td >= bins[i] && td < bins[i + 1]) {
          binStats[i].sum += pnl;
          binStats[i].count += 1;
          binStats[i].values.push(pnl);
          break;
        }
      }
    });
    // Find best bin (highest avg P&L, at least 5 trades)
    let bestBinIdx = -1, bestAvgPnl = -Infinity;
    for (let i = 0; i < binStats.length; i++) {
      if (binStats[i].count >= 5) {
        const avg = binStats[i].sum / binStats[i].count;
        if (avg > bestAvgPnl) {
          bestAvgPnl = avg;
          bestBinIdx = i;
        }
      }
    }
    if (bestBinIdx !== -1) {
      const bestBin = binStats[bestBinIdx];
      const min_minutes = bins[bestBinIdx];
      const max_minutes = bins[bestBinIdx + 1];
      const avg_pnl_in_range = bestBin.sum / bestBin.count;
      const std_pnl_in_range = Math.sqrt(bestBin.values.reduce((sum, v) => sum + Math.pow(v - avg_pnl_in_range, 2), 0) / bestBin.count);
      const sample_size = bestBin.count;
      // t-distribution 95% CI
      const t = sample_size > 1 ? 2.045 : 0;
      const se = sample_size > 1 ? std_pnl_in_range / Math.sqrt(sample_size) : 0;
      const ci95 = [avg_pnl_in_range - t * se, avg_pnl_in_range + t * se];
      // Robust ranges: bins with P&L within 20% of best and at least 5 trades
      const threshold = avg_pnl_in_range * 0.8;
      const robust_ranges: [number, number][] = [];
      for (let i = 0; i < binStats.length; i++) {
        if (binStats[i].count >= 5 && (binStats[i].sum / binStats[i].count) >= threshold) {
          robust_ranges.push([bins[i], bins[i + 1]]);
        }
      }
      recommendations.optimal_time_distance_range = {
        min_minutes,
        max_minutes,
        avg_pnl_in_range,
        std_pnl_in_range,
        sample_size,
        confidence_interval_95: ci95,
        robust_ranges,
        explanation: `Trades with ${min_minutes}-${max_minutes} minutes between them show the highest average P&L (among practical ranges)`,
        recommendation: `Aim for ${min_minutes}-${max_minutes} minute intervals between trades`,
        confidence: `Medium - based on ${sample_size} trades in optimal range`,
        robustness: `95% confidence interval: ${ci95[0].toFixed(1)}-${ci95[1].toFixed(1)} P&L`,
        note: "Analysis limited to practical time distances (0-30 minutes) for day trading"
      };
    } else {
      recommendations.optimal_time_distance_range = {
        explanation: "No practical time distance range found with sufficient data",
        recommendation: "Use default 5-10 minute intervals based on general trading practices",
        confidence: "Low - insufficient data for statistical analysis",
        note: "Consider using the cooldown analysis recommendation instead"
      };
    }
  }

  // 7. Optimal win rate window (sliding window analysis)
  if (correlations.length > 0) {
    // Prepare for sliding window analysis (15-minute windows)
    const windowMinutes = 15;
    // Group by day for windowing
    const dayMap: Map<string, any[]> = new Map();
    correlations.forEach(c => {
      if (!dayMap.has(c.date)) dayMap.set(c.date, []);
      dayMap.get(c.date)!.push(c);
    });
    const slidingWindows: {date: string, window_start: number, window_end: number, window_center: number, trades_in_window: number, win_rate: number, avg_time_distance: number}[] = [];
    dayMap.forEach((trades, date) => {
      // Sort by time_distance (proxy for time ordering)
      trades.sort((a, b) => a.time_distance - b.time_distance);
      const times = trades.map(t => t.time_distance);
      if (times.length === 0) return;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      for (let start = minTime; start <= maxTime - windowMinutes; start += 1) {
        const end = start + windowMinutes;
        const windowTrades = trades.filter(t => t.time_distance >= start && t.time_distance < end);
        if (windowTrades.length > 0) {
          const wins = windowTrades.filter(t => t.win > 0).length;
          const total = windowTrades.length;
          const win_rate = total > 0 ? (wins / total) * 100 : 0;
          const avg_time_distance = windowTrades.reduce((a, b) => a + b.time_distance, 0) / total;
          slidingWindows.push({date, window_start: start, window_end: end, window_center: start + windowMinutes / 2, trades_in_window: total, win_rate, avg_time_distance});
        }
      }
    });
    if (slidingWindows.length > 0) {
      // Find best win rate window
      const filtered = slidingWindows.filter(w => w.avg_time_distance > 0);
      if (filtered.length > 0) {
        filtered.sort((a, b) => b.win_rate - a.win_rate);
        const best = filtered[0];
        const win_rates = filtered.map(w => w.win_rate);
        const win_rate_std = Math.sqrt(win_rates.reduce((sum, v) => sum + Math.pow(v - best.win_rate, 2), 0) / win_rates.length);
        const sample_size = filtered.length;
        // Robust windows: win rate >90% of best
        const threshold = best.win_rate * 0.9;
        const robust_windows_count = filtered.filter(w => w.win_rate >= threshold).length;
        recommendations.optimal_win_rate_window = {
          time_window: `${String(Math.floor(best.window_center)).padStart(2, '0')}:${String(Math.floor((best.window_center % 1) * 60)).padStart(2, '0')}`,
          win_rate: best.win_rate,
          avg_time_distance: best.avg_time_distance,
          win_rate_std,
          sample_size,
          robust_windows_count,
          explanation: `15-minute window centered at ${String(Math.floor(best.window_center)).padStart(2, '0')}:${String(Math.floor((best.window_center % 1) * 60)).padStart(2, '0')} shows the highest win rate`,
          recommendation: 'Focus trading activity during this time window for better win rates',
          confidence: `Low - based on single window analysis, ${robust_windows_count} windows show >90% of best win rate`,
          robustness: `Win rate standard deviation: ${win_rate_std.toFixed(1)}%`
        };
      }
    }
  }

  return recommendations;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_url, user_id, csv_data }: AnalysisRequest = await req.json();
    
    if (!user_id) {
      throw new Error("Missing required parameter: user_id");
    }

    let fileText: string;

    if (csv_data) {
      // For testing - use direct CSV data
      console.log("Using direct CSV data for testing");
      fileText = csv_data;
    } else if (file_url) {
      // Normal flow - download file from storage
      console.log("Processing Excel file:", file_url);

      // Download the file from Supabase Storage
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('uploads')
        .download(file_url);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`);
      }

      // Convert file to text
      fileText = await fileData.text();
    } else {
      throw new Error("Either file_url or csv_data must be provided");
    }
    
    if (!fileText || fileText.trim().length === 0) {
      throw new Error("File is empty or could not be read");
    }
    
    // Parse the data
    const trades = parseExcelData(fileText);
    console.log(`Loaded ${trades.length} trades`);

    if (trades.length === 0) {
      throw new Error("No valid trades found in the file");
    }

    // Filter trading hours
    const filteredTrades = filterTradingHours(trades);
    console.log(`Filtered to ${filteredTrades.length} trades between 15:30-22:00`);

    if (filteredTrades.length === 0) {
      throw new Error("No trades found within the specified trading hours (15:30-22:00)");
    }

    // Group by day
    const dailyGroups = groupByDay(filteredTrades);
    console.log(`Found ${dailyGroups.size} trading days`);

    if (dailyGroups.size === 0) {
      throw new Error("No valid trading days found");
    }

    // Perform analyses
    const correlations = analyzeCorrelations(dailyGroups);
    const timePeaks = analyzeCumulativePnlByTime(dailyGroups);
    const drawdownResults = analyzeOptimalDrawdown(dailyGroups);

    // Prepare data for frontend
    const plotData: any = {};

    // Win rate vs time distance (simplified)
    if (correlations.length > 0) {
      const timeDistances = correlations.map(c => c.time_distance);
      const pnls = correlations.map(c => c.pnl);
      const volumes = correlations.map(c => c.volume);
      
      plotData.pnl_vs_time_distance = {
        time_distance_minutes: timeDistances,
        pnl: pnls
      };
      
      plotData.volume_vs_time_distance = {
        time_distance: timeDistances,
        volume: volumes
      };
    }

    // Peak P&L times
    if (timePeaks.length > 0) {
      plotData.distribution_of_peak_pnl_times = {
        time: timePeaks.map(p => new Date(p.peak_time).toTimeString().slice(0, 5)),
        pnl: timePeaks.map(p => p.peak_pnl)
      };
      
      plotData.distribution_of_trades_to_peak = {
        trades_to_peak: timePeaks.map(p => p.trades_to_peak)
      };
    }

    // Drawdown analysis
    if (drawdownResults.length > 0) {
      const drawdownPercentages = Array.from({length: 20}, (_, i) => (i + 1) * 5);
      const totalPnls = drawdownPercentages.map(dd => {
        return drawdownResults.reduce((sum, result) => {
          return sum + (result.optimal_drawdown_pct <= dd ? result.final_pnl_with_optimal : 0);
        }, 0);
      });
      
      plotData.cumulative_pnl_vs_drawdown_threshold = {
        drawdown_percentages: drawdownPercentages,
        cumulative_pnl: totalPnls
      };
    }

    // Generate recommendations
    const analysis = generateRecommendations(correlations, timePeaks, dailyGroups);

    // Store results in database (only if not testing)
    if (!csv_data && file_url) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );

      const resultData = {
        user_id,
        file_url,
        created_at: new Date().toISOString(),
        data: plotData,
        analysis
      };

      const { error: insertError } = await supabase
        .from('analysis_results')
        .insert(resultData);

      if (insertError) {
        console.error("Failed to store results:", insertError);
        // Don't throw error here, just log it - the analysis was successful
      }
    }

    const response: AnalysisResult = {
      data: plotData,
      analysis
    };

    console.log("Analysis completed successfully");
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in process-excel function:", error);
  return new Response(
    JSON.stringify({
        error: error.message,
        details: "Please ensure your file contains the required columns: 'Open time', and optionally 'PnL', 'Profit (ticks)', 'Open volume'"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);