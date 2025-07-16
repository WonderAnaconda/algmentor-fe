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

// Helper function to calculate correlation
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

// Helper function to calculate statistics
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

// Parse Excel-like data (simplified for Edge Function)
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

// Filter trading hours (15:30 to 22:00)
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

// Group trades by day
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

// Analyze correlations between trades
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

// Analyze cumulative P&L by time
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

// Analyze optimal drawdown
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

// Generate trading recommendations
function generateRecommendations(correlations: any[], timePeaks: any[], dailyGroups: Map<string, TradeData[]>): any {
  const recommendations: any = {};
  
  // Optimal break between trades
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
  
  // Optimal trading hours
  if (timePeaks.length > 0) {
    const peakHours = timePeaks.map(peak => {
      const time = new Date(peak.peak_time);
      return time.getHours() + time.getMinutes() / 60;
    });
    
    const { mean: avgPeakHour } = calculateStats(peakHours);
    
    recommendations.optimal_trading_hours = {
      average_peak_time: `${Math.floor(avgPeakHour).toString().padStart(2, '0')}:${Math.floor((avgPeakHour % 1) * 60).toString().padStart(2, '0')}`,
      explanation: `Peak cumulative P&L typically occurs around ${Math.floor(avgPeakHour).toString().padStart(2, '0')}:${Math.floor((avgPeakHour % 1) * 60).toString().padStart(2, '0')}`,
      recommendation: "Focus trading activity in the hours leading up to the typical peak time",
      confidence: "Medium - based on peak time analysis"
    };
  }
  
  // Volume optimization
  if (correlations.length > 0) {
    const timeDistances = correlations.map(c => c.time_distance);
    const volumes = correlations.map(c => c.volume);
    const volCorr = calculateCorrelation(timeDistances, volumes);
    
    recommendations.volume_optimization = {
      volume_time_correlation: volCorr,
      explanation: `Volume and time distance correlation: ${volCorr.toFixed(4)}`,
      recommendation: volCorr > 0.3 ? "Consider longer breaks between trades to reduce volume spikes" : "Volume patterns appear independent of time distance",
      confidence: "Medium - based on correlation analysis"
    };
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