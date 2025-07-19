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

// Helper function to parse European date format (DD.MM.YYYY)
function parseEuropeanDate(dateTimeStr: string): Date {
  // Extract date part (before space)
  const datePart = dateTimeStr.split(' ')[0];
  const timePart = dateTimeStr.split(' ')[1] || '00:00:00';
  
  // Parse DD.MM.YYYY format
  const [day, month, year] = datePart.split('.');
  
  // Create date string in YYYY-MM-DD format
  const isoDateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}`;
  
  return new Date(isoDateStr);
}

// Group trades by trading day (YYYY-MM-DD)
function groupByDay(trades: TradeData[]): Map<string, TradeData[]> {
  const groups = new Map<string, TradeData[]>();
  
  trades.forEach(trade => {
    try {
      const parsedDate = parseEuropeanDate(trade['Open time']);
      const dateStr = parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      if (!groups.has(dateStr)) {
        groups.set(dateStr, []);
      }
      groups.get(dateStr)!.push(trade);
    } catch (error) {
      console.error(`Failed to parse date: ${trade['Open time']}`, error);
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
    dayTrades.sort((a, b) => parseEuropeanDate(a['Open time']).getTime() - parseEuropeanDate(b['Open time']).getTime());
    
    for (let i = 1; i < dayTrades.length; i++) {
      const prevTrade = dayTrades[i - 1];
      const currTrade = dayTrades[i];
      
      const prevTime = parseEuropeanDate(prevTrade['Open time']).getTime();
      const currTime = parseEuropeanDate(currTrade['Open time']).getTime();
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
    dayTrades.sort((a, b) => parseEuropeanDate(a['Open time']).getTime() - parseEuropeanDate(b['Open time']).getTime());
    
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
function analyzeOptimalDrawdown(dailyGroups: Map<string, TradeData[]>, debug_logs?: any): any[] {
  const results: any[] = [];
  if (debug_logs) debug_logs.drawdown_simulation = [];
  dailyGroups.forEach((dayTrades, date) => {
    if (dayTrades.length < 2) return;
    dayTrades.sort((a, b) => parseEuropeanDate(a['Open time']).getTime() - parseEuropeanDate(b['Open time']).getTime());
    let cumulativePnl = 0;
    let peakPnl = 0;
    dayTrades.forEach(trade => {
      const pnl = trade['PnL'] || trade['Profit (ticks)'] || 0;
      cumulativePnl += pnl;
      peakPnl = Math.max(peakPnl, cumulativePnl);
    });
    const drawdownPercentages = Array.from({length: 20}, (_, i) => (i + 1) * 5); // 5% to 100%
    let bestDrawdown = 50; // default
    let bestFinalPnl = -Infinity;
    let perDrawdown: Array<{drawdownPct: number, finalPnl: number}> = [];
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
      perDrawdown.push({drawdownPct, finalPnl: runningPnl});
    });
    // Find the minimum drawdownPct with the maximum finalPnl (Python tie-breaking)
    const maxPnl = Math.max(...perDrawdown.map(x => x.finalPnl));
    const minDrawdownWithMaxPnl = Math.min(...perDrawdown.filter(x => x.finalPnl === maxPnl).map(x => x.drawdownPct));
    bestDrawdown = minDrawdownWithMaxPnl;
    bestFinalPnl = maxPnl;
    if (debug_logs) debug_logs.drawdown_simulation.push({date, perDrawdown, bestDrawdown, bestFinalPnl});
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

// Sliding window analysis (15-minute windows)
function analyzeSlidingWindowMetrics(dailyGroups: Map<string, TradeData[]>, windowMinutes = 15) {
  const slidingWindowData: any[] = [];
  dailyGroups.forEach((dayTrades, date) => {
    if (dayTrades.length < 2) return;
    // Sort by open time
    const sortedTrades = [...dayTrades].sort((a, b) => parseEuropeanDate(a['Open time']).getTime() - parseEuropeanDate(b['Open time']).getTime());
    const openTimes = sortedTrades.map(trade => parseEuropeanDate(trade['Open time']));
    const dayStart = openTimes[0];
    const dayEnd = openTimes[openTimes.length - 1];
    let currentTime = new Date(dayStart.getTime());
    let windowEnd = new Date(currentTime.getTime() + windowMinutes * 60 * 1000);
    while (windowEnd <= dayEnd) {
      // Get trades in this window
      const windowTrades = sortedTrades.filter(trade => {
        const t = parseEuropeanDate(trade['Open time']);
        return t >= currentTime && t < windowEnd;
      });
      if (windowTrades.length > 0) {
        // Calculate metrics for this window
        const pnlValues = windowTrades.map(trade => trade['PnL'] ?? trade['Profit (ticks)'] ?? 0);
        const wins = pnlValues.filter(pnl => pnl > 0).length;
        const totalTrades = pnlValues.length;
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
        const avgPnl = pnlValues.length > 0 ? pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length : 0;
        const volumeValues = windowTrades.map(trade => Math.abs(trade['Open volume'] ?? 1));
        const totalVolume = volumeValues.reduce((a, b) => a + b, 0);
        // Time distance between trades in window
        let avgTimeDistance = 0;
        if (windowTrades.length > 1) {
          const times = windowTrades.map(trade => parseEuropeanDate(trade['Open time']).getTime());
          const timeDiffs: number[] = [];
          for (let i = 1; i < times.length; i++) {
            timeDiffs.push((times[i] - times[i - 1]) / (1000 * 60));
          }
          avgTimeDistance = timeDiffs.length > 0 ? timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length : 0;
        }
        slidingWindowData.push({
          date,
          window_start: new Date(currentTime.getTime()),
          window_end: new Date(windowEnd.getTime()),
          window_center: new Date(currentTime.getTime() + (windowMinutes * 60 * 1000) / 2),
          trades_in_window: totalTrades,
          win_rate: winRate,
          avg_pnl: avgPnl,
          total_volume: totalVolume,
          avg_time_distance: avgTimeDistance
        });
      }
      // Move window forward by 1 minute
      currentTime = new Date(currentTime.getTime() + 60 * 1000);
      windowEnd = new Date(currentTime.getTime() + windowMinutes * 60 * 1000);
    }
  });
  return slidingWindowData;
}

// Generate trading recommendations and advanced metrics for all analysis sections
function generateRecommendations(correlations: any[], timePeaks: any[], dailyGroups: Map<string, TradeData[]>, debug_logs?: any): any {
  const recommendations: any = {};

  // 1. Optimal break between trades (cooldown analysis)
  if (dailyGroups.size > 0) {
    let bestCooldown = 0;
    let bestPnl = -Infinity;
    let robustRange = [0, 0];
    const step = 0.25;
    const minCooldown = 0.25;
    const maxCooldown = 30; // 30 minutes, as in Python
    const cooldownPnls: Array<{cooldown: number, pnl: number}> = [];
    for (let cooldown = minCooldown; cooldown <= maxCooldown; cooldown += step) {
      let totalPnl = 0;
      dailyGroups.forEach(dayTrades => {
        if (dayTrades.length < 2) return;
        // Sort by open time
        dayTrades.sort((a, b) => parseEuropeanDate(a['Open time']).getTime() - parseEuropeanDate(b['Open time']).getTime());
        let lastTradeEnd: number | null = null;
        let dayPnl = 0;
        for (let i = 0; i < dayTrades.length; i++) {
          const trade = dayTrades[i];
          const openTime = parseEuropeanDate(trade['Open time']).getTime();
          let closeTime = openTime;
          if (trade['Close time']) {
            closeTime = parseEuropeanDate(trade['Close time']).getTime();
          }
          if (lastTradeEnd === null || openTime - lastTradeEnd >= cooldown * 60 * 1000) {
            const pnl = trade['PnL'] || trade['Profit (ticks)'] || 0;
            dayPnl += pnl;
            lastTradeEnd = closeTime;
          }
        }
        totalPnl += dayPnl;
      });
      cooldownPnls.push({cooldown, pnl: totalPnl});
      if (totalPnl > bestPnl) {
        bestPnl = totalPnl;
        bestCooldown = cooldown;
      }
    }
    // Find robust range (within 95% of max P&L)
    const threshold = bestPnl * 0.95;
    const robust = cooldownPnls.filter(x => x.pnl >= threshold);
    if (robust.length > 0) {
      robustRange = [robust[0].cooldown, robust[robust.length-1].cooldown];
    } else {
      robustRange = [bestCooldown, bestCooldown];
    }
    recommendations.optimal_break_between_trades = {
      minutes: bestCooldown,
      seconds: String(Math.round(bestCooldown * 60)),
      robust_range_minutes: robustRange,
      explanation: `Based on cooldown analysis, waiting ${bestCooldown} minutes between trades maximizes cumulative P&L`,
      pnl_improvement: bestPnl,
      robustness: `Cooldown periods between ${robustRange[0]}-${robustRange[1]} minutes achieve >95% of maximum P&L`,
      confidence: "Auto-generated from data"
    };
  }

  // 2. Optimal trading hours (peak P&L time analysis)
  if (timePeaks.length > 0) {
    const peakTimes = timePeaks.map(p => parseEuropeanDate(p.peak_time));
    const hours = peakTimes.map(t => t.getHours() + t.getMinutes() / 60);
    const { mean, std } = calculateStats(hours);
    recommendations.optimal_trading_hours = {
      average_peak_time: `${String(Math.floor(mean)).padStart(2, '0')}:${String(Math.round((mean % 1) * 60)).padStart(2, '0')}`,
      std_peak_hour: std,
      confidence_interval_95: [
        `${String(Math.floor(mean - 2*std)).padStart(2, '0')}:${String(Math.round((((mean - 2*std) % 1) * 60))).padStart(2, '0')}`,
        `${String(Math.floor(mean + 2*std)).padStart(2, '0')}:${String(Math.round((((mean + 2*std) % 1) * 60))).padStart(2, '0')}`
      ],
      most_common_peak_time: `${String(Math.floor(mean)).padStart(2, '0')}:${String(Math.round((mean % 1) * 60)).padStart(2, '0')}`,
      sample_size: timePeaks.length,
      consistency_rate: 0, // Could be computed as % of days within 1 hour of mean
      explanation: `Peak cumulative P&L typically occurs around ${String(Math.floor(mean)).padStart(2, '0')}:${String(Math.round((mean % 1) * 60)).padStart(2, '0')}`,
      recommendation: "Focus trading activity in the hours leading up to the typical peak time",
      confidence: "Auto-generated from data",
      robustness: "Auto-generated from data"
    };
  }

  // 3. Volume optimization (correlation, revenge trading, significance)
  if (correlations.length > 0) {
    const timeDistances = correlations.map(c => c.time_distance);
    const volumes = correlations.map(c => c.volume);
    const pnls = correlations.map(c => c.pnl);
    const volCorr = calculateCorrelation(timeDistances, volumes);
    recommendations.volume_optimization = {
      volume_time_correlation: volCorr,
      correlation_p_value: 0, // Placeholder, could compute p-value
      correlation_significant: false,
      sample_size: correlations.length,
      revenge_trading_analysis: {}, // Could implement
      explanation: `Volume and time distance correlation: ${volCorr.toFixed(4)}`,
      recommendation: "Auto-generated from data",
      confidence: "Auto-generated from data",
      robustness: "Auto-generated from data",
      action_items: []
    };
  }

  // 4. Optimal intraday drawdown (risk management)
  const drawdownResults = analyzeOptimalDrawdown(dailyGroups, debug_logs);
  if (drawdownResults.length > 0) {
    const drawdownPcts = drawdownResults.map(r => r.optimal_drawdown_pct);
    const { mean, median, std } = calculateStats(drawdownPcts);
    // 95% confidence interval using percentiles (Python style)
    const sorted = [...drawdownPcts].sort((a, b) => a - b);
    const ciLow = quantile(sorted, 0.025);
    const ciHigh = quantile(sorted, 0.975);
    const ci95 = [ciLow, ciHigh];
    const sampleSize = drawdownPcts.length;
    // Consistency rate: % of days within 5% of the median
    const consistency = drawdownPcts.filter(p => Math.abs(p - median) <= 5).length / sampleSize;
    recommendations.optimal_intraday_drawdown = {
      percentage: Number(median.toFixed(1)),
      mean_percentage: Number(mean.toFixed(15)),
      std_percentage: Number(std.toFixed(15)),
      confidence_interval_95: [Number(ciLow.toFixed(15)), Number(ciHigh.toFixed(15))],
      sample_size: sampleSize,
      consistency_rate: Number(consistency.toFixed(15)),
      explanation: `Stop trading when daily drawdown reaches ${median.toFixed(1)}% of the day's peak P&L`,
      confidence: `Medium - ${(consistency*100).toFixed(1)}% of days had optimal drawdown within 5% of recommendation`,
      robustness: `95% confidence interval: ${ciLow.toFixed(1)}-${ciHigh.toFixed(1)}%`
    };
  }

  // 5. Optimal max trades per day (trades to peak)
  if (timePeaks.length > 0 && dailyGroups.size > 0) {
    const tradesToPeak = timePeaks.map(p => p.trades_to_peak);
    const { mean, median, std } = calculateStats(tradesToPeak);
    const n = tradesToPeak.length;
    let ci95 = [mean, mean];
    if (n > 1) {
      const se = std / Math.sqrt(n);
      const t = 2.045;
      ci95 = [mean - t*se, mean + t*se];
    }
    let totalTrades = 0;
    dailyGroups.forEach(dayTrades => { totalTrades += dayTrades.length; });
    const avgTradesPerDay = totalTrades / dailyGroups.size;
    const optimalRate = tradesToPeak.filter(t => Math.abs(t - median) <= 2).length / n;
    if (debug_logs) debug_logs.optimal_max_trades_per_day = {
      tradesToPeak,
      totalTrades,
      numDays: dailyGroups.size,
      avgTradesPerDay,
      optimalRate
    };
    recommendations.optimal_max_trades_per_day = {
      median_trades_to_peak: Number(median.toFixed(1)),
      mean_trades_to_peak: Number(mean.toFixed(5)),
      std_trades_to_peak: Number(std.toFixed(5)),
      confidence_interval_95: [Number(ci95[0].toFixed(5)), Number(ci95[1].toFixed(5))],
      current_avg_trades_per_day: Number(avgTradesPerDay.toFixed(5)),
      sample_size: n,
      optimal_rate: Number(optimalRate.toFixed(5)),
      recommendation: `Consider limiting to ${Math.round(median)} trades per day, as this is the median number of trades needed to reach peak P&L`,
      explanation: "Based on analysis of when cumulative P&L typically peaks during trading days",
      confidence: `Medium - ${(optimalRate*100).toFixed(1)}% of days had optimal trades within 2 of recommendation`,
      robustness: `95% confidence interval: ${ci95[0].toFixed(1)}-${ci95[1].toFixed(1)} trades`
    };
  }

  // 6. Optimal time distance range (binning analysis)
  // Could implement from correlations

  // 7. Optimal win rate window (sliding window analysis)
  // Could implement from correlations

  return recommendations;
}

const handler = async (req: Request): Promise<Response> => {
  let debug_logs = {};
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
    const drawdownResults = analyzeOptimalDrawdown(dailyGroups, debug_logs);
    const slidingWindowData = analyzeSlidingWindowMetrics(dailyGroups, 15);

    // Prepare data for frontend
    const plotData: any = {};

    // Win rate vs time distance (sliding window)
    if (slidingWindowData.length > 0) {
      // Filter out zero or negative avg_time_distance values
      const filteredWin = slidingWindowData.filter(d => d.avg_time_distance > 0);
      // Sort by avg_time_distance for rolling average
      const filteredWinSorted = [...filteredWin].sort((a, b) => a.avg_time_distance - b.avg_time_distance);
      // Calculate rolling average (window=20)
      const rollingWinRate: number[] = [];
      for (let i = 0; i < filteredWinSorted.length; i++) {
        const start = Math.max(0, i - 19);
        const window = filteredWinSorted.slice(start, i + 1);
        const avg = window.reduce((sum, d) => sum + d.win_rate, 0) / window.length;
        rollingWinRate.push(avg);
      }
      plotData.win_rate_vs_avg_time_distance_over_15m_window = {
        time_distance: filteredWin.map(d => d.avg_time_distance),
        win_rate: filteredWin.map(d => d.win_rate),
        time_distance_sorted: filteredWinSorted.map(d => d.avg_time_distance),
        rolling_win_rate: rollingWinRate
      };
    }

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
        time: timePeaks.map(p => parseEuropeanDate(p.peak_time).toTimeString().slice(0, 5)),
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

    // Cumulative P&L vs cooldown period (0 to 30 min in 15-sec steps)
    {
      const cooldownSecondsList: number[] = [];
      for (let s = 0; s <= 1800; s += 15) cooldownSecondsList.push(s);
      const pnlByCooldown: number[] = [];
      cooldownSecondsList.forEach(cooldown => {
        let totalPnl = 0;
        dailyGroups.forEach(dayTrades => {
          if (dayTrades.length < 2) return;
          const sorted = [...dayTrades].sort((a, b) => parseEuropeanDate(a['Open time']).getTime() - parseEuropeanDate(b['Open time']).getTime());
          let lastTradeEnd: number | null = null;
          let dayPnl = 0;
          for (let i = 0; i < sorted.length; i++) {
            const trade = sorted[i];
            const openTime = parseEuropeanDate(trade['Open time']).getTime();
            let closeTime = openTime;
            if (trade['Close time']) {
              closeTime = parseEuropeanDate(trade['Close time']).getTime();
            }
            if (lastTradeEnd === null || openTime - lastTradeEnd >= cooldown * 1000) {
              const pnl = trade['PnL'] ?? trade['Profit (ticks)'] ?? 0;
              dayPnl += pnl;
              lastTradeEnd = closeTime;
            }
          }
          totalPnl += dayPnl;
        });
        pnlByCooldown.push(totalPnl);
      });
      plotData.cumulative_pnl_vs_cooldown_period = {
        cooldown_minutes: cooldownSecondsList.map(s => s / 60),
        cumulative_pnl: pnlByCooldown
      };
    }

    // Total P&L by time distance bin (15-second bins)
    if (correlations.length > 0) {
      // Remove any previous area plot or fill_between for axes[0, 3] (if present)
      // Bin time distances into 15-second bins
      const binWidth = 15; // seconds
      const timeDistances = correlations.map(c => c.time_distance);
      const maxTd = Math.max(...timeDistances);
      const bins: number[] = [];
      for (let b = 0; b <= maxTd; b += binWidth / 60) bins.push(b); // bin edges in minutes
      // Assign each trade to a bin
      const binEdgesSec = bins.map(b => b * 60); // bin edges in seconds
      const binTotals: { [bin: number]: number } = {};
      for (let i = 0; i < correlations.length; i++) {
        const tdSec = correlations[i].time_distance * 60;
        let binIdx = binEdgesSec.findIndex((edge, idx) => tdSec >= edge && (idx === binEdgesSec.length - 1 || tdSec < binEdgesSec[idx + 1]));
        if (binIdx === -1) binIdx = binEdgesSec.length - 2;
        const binStart = binEdgesSec[binIdx];
        if (!(binStart in binTotals)) binTotals[binStart] = 0;
        binTotals[binStart] += correlations[i].pnl;
      }
      // Prepare output arrays
      const x: number[] = [];
      const y: number[] = [];
      for (const binStart of Object.keys(binTotals).map(Number).sort((a, b) => a - b)) {
        x.push(binStart);
        y.push(binTotals[binStart]);
      }
      plotData.total_pnl_by_time_distance_bin = {
        time_distance_seconds: x,
        total_pnl: y
      };
    }

    // Generate recommendations
    const recommendations = generateRecommendations(correlations, timePeaks, dailyGroups, debug_logs);

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
        analysis: recommendations
      };

      const { error: insertError } = await supabase
        .from('analysis_results')
        .insert(resultData);

      if (insertError) {
        console.error("Failed to store results:", insertError);
        // Don't throw error here, just log it - the analysis was successful
      }
    }

    // Restore: set data to plotData as computed
    const data = plotData;
    // Ensure recommendations and debug_logs are always defined
    const safeRecommendations = typeof recommendations !== 'undefined' ? recommendations : {};
    const safeDebugLogs = debug_logs;
    return new Response(JSON.stringify({
      data,
      analysis: safeRecommendations,
      debug_logs: safeDebugLogs
    }), {
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