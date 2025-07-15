// Supabase Edge Function: Trade Analysis Daily (Deno runtime)
import * as XLSX from "npm:xlsx";

console.info('Supabase Edge Function started');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return new Response('Expected multipart/form-data', { status: 400, headers: corsHeaders });
  }

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return new Response('No file uploaded', { status: 400, headers: corsHeaders });
  }

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  const bufferLength = arrayBuffer.byteLength;
  const hexDump = Array.from(new Uint8Array(arrayBuffer).slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ');

  if (!bufferLength) {
    return new Response(
      JSON.stringify({
        error: 'File upload failed or file is empty',
        bufferLength,
        hexDump
      }),
      { headers: { 'Content-Type': 'application/json', 'Connection': 'keep-alive', ...corsHeaders } }
    );
  }
  // Parse Excel file using SheetJS
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const sheetName = 'Journal';
  if (!workbook.Sheets[sheetName]) {
    return new Response('Sheet "Journal" not found in Excel file', { status: 400, headers: corsHeaders });
  }
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

  // --- Begin analysis logic port ---
  function excelDateToJSDate(serial: number) {
    return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }

  function filterTradingHours(trades: any[]) {
    return trades.filter((trade) => {
      const openTimeRaw = trade["Open time"];
      if (typeof openTimeRaw !== "number") return false;
      const openTime = excelDateToJSDate(openTimeRaw);
      const hour = openTime.getHours();
      const minute = openTime.getMinutes();
      const timeMinutes = hour * 60 + minute;
      return timeMinutes >= 930 && timeMinutes <= 1320;
    });
  }

  function groupByDay(trades: any[]) {
    const groups: Record<string, any[]> = {};
    for (const trade of trades) {
      const openTimeRaw = trade["Open time"];
      if (typeof openTimeRaw !== "number") continue;
      const openTime = excelDateToJSDate(openTimeRaw);
      const dateStr = openTime.toISOString().slice(0, 10);
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(trade);
    }
    return groups;
  }

  const filtered = filterTradingHours(data);
  const grouped = groupByDay(filtered);
  const numDays = Object.keys(grouped).length;
  const totalTrades = filtered.length;
  const dateRange = filtered.length > 0
    ? `${excelDateToJSDate(filtered[0]["Open time"]).toISOString().slice(0,10)} to ${excelDateToJSDate(filtered[filtered.length-1]["Open time"]).toISOString().slice(0,10)}`
    : "N/A";

  function calculateTimeDistances(trades: any[]) {
    if (trades.length < 2) return [];
    const sorted = trades.slice().sort((a, b) => a["Open time"] - b["Open time"]);
    const distances: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const t1 = excelDateToJSDate(sorted[i]["Open time"]);
      const t0 = excelDateToJSDate(sorted[i - 1]["Open time"]);
      const diff = (t1.getTime() - t0.getTime()) / 60000;
      distances.push(diff);
    }
    return distances;
  }

  const timeDistances = calculateTimeDistances(filtered);

  function analyzeSlidingWindowMetrics(dailyGroups: Record<string, any[]>, windowMinutes = 15) {
    const slidingWindowData: any[] = [];
    for (const date in dailyGroups) {
      const dayTrades = dailyGroups[date];
      if (dayTrades.length < 2) continue;
      const sorted = dayTrades.slice().sort((a, b) => a["Open time"] - b["Open time"]);
      const dayStart = excelDateToJSDate(sorted[0]["Open time"]);
      const dayEnd = excelDateToJSDate(sorted[sorted.length - 1]["Open time"]);
      let currentTime = new Date(dayStart);
      let windowEnd = new Date(currentTime.getTime() + windowMinutes * 60000);
      while (windowEnd <= dayEnd) {
        const windowTrades = sorted.filter(trade => {
          const t = excelDateToJSDate(trade["Open time"]);
          return t >= currentTime && t < windowEnd;
        });
        if (windowTrades.length > 0) {
          const pnlCol = "PnL" in windowTrades[0] ? "PnL" : "Profit (ticks)";
          const pnlValues = windowTrades.map(trade => trade[pnlCol]);
          const wins = pnlValues.filter((v: number) => v > 0).length;
          const totalTrades = pnlValues.length;
          const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
          const avgPnl = pnlValues.length > 0 ? pnlValues.reduce((a: number, b: number) => a + b, 0) / pnlValues.length : 0;
          const volumeCol = "Open volume" in windowTrades[0] ? "Open volume" : null;
          const totalVolume = volumeCol ? windowTrades.reduce((sum: number, t: any) => sum + Math.abs(t[volumeCol]), 0) : windowTrades.length;
          let avgTimeDistance = 0;
          if (windowTrades.length > 1) {
            const timeDistances: number[] = [];
            for (let i = 1; i < windowTrades.length; i++) {
              const t1 = excelDateToJSDate(windowTrades[i]["Open time"]);
              const t0 = excelDateToJSDate(windowTrades[i - 1]["Open time"]);
              timeDistances.push((t1.getTime() - t0.getTime()) / 60000);
            }
            avgTimeDistance = timeDistances.reduce((a, b) => a + b, 0) / timeDistances.length;
          }
          slidingWindowData.push({
            date,
            window_start: currentTime.toISOString(),
            window_end: windowEnd.toISOString(),
            window_center: new Date(currentTime.getTime() + (windowMinutes * 60000) / 2).toISOString(),
            trades_in_window: totalTrades,
            win_rate: winRate,
            avg_pnl: avgPnl,
            total_volume: totalVolume,
            avg_time_distance: avgTimeDistance
          });
        }
        currentTime = new Date(currentTime.getTime() + 60000);
        windowEnd = new Date(currentTime.getTime() + windowMinutes * 60000);
      }
    }
    return slidingWindowData;
  }

  const slidingWindowMetrics = analyzeSlidingWindowMetrics(grouped, 15);

  function analyzeCorrelations(dailyGroups: Record<string, any[]>) {
    const allCorrelations: any[] = [];
    for (const date in dailyGroups) {
      const dayTrades = dailyGroups[date];
      if (dayTrades.length < 2) continue;
      const sorted = dayTrades.slice().sort((a, b) => {
        const tA = typeof a["Close time"] === "number" ? a["Close time"] : a["Open time"];
        const tB = typeof b["Close time"] === "number" ? b["Close time"] : b["Open time"];
        return tA - tB;
      });
      for (let i = 1; i < sorted.length; i++) {
        const prevClose = typeof sorted[i-1]["Close time"] === "number" ? excelDateToJSDate(sorted[i-1]["Close time"]) : excelDateToJSDate(sorted[i-1]["Open time"]);
        const currOpen = excelDateToJSDate(sorted[i]["Open time"]);
        const timeDist = (currOpen.getTime() - prevClose.getTime()) / 60000;
        if (timeDist > 0) {
          const pnlCol = "PnL" in sorted[i] ? "PnL" : "Profit (ticks)";
          const pnl = sorted[i][pnlCol];
          const volumeCol = "Open volume" in sorted[i] ? "Open volume" : null;
          const volume = volumeCol ? Math.abs(sorted[i][volumeCol]) : 1;
          const win = pnl > 0 ? 1 : 0;
          allCorrelations.push({
            date,
            time_distance: timeDist,
            pnl,
            volume,
            win
          });
        }
      }
    }
    return allCorrelations;
  }

  const correlations = analyzeCorrelations(grouped);

  function analyzeCumulativePnlByTime(dailyGroups: Record<string, any[]>) {
    const timePeaks: any[] = [];
    for (const date in dailyGroups) {
      const dayTrades = dailyGroups[date];
      if (dayTrades.length < 2) continue;
      const sorted = dayTrades.slice().sort((a, b) => a["Open time"] - b["Open time"]);
      const pnlCol = "PnL" in sorted[0] ? "PnL" : "Profit (ticks)";
      let cumulativePnl = 0;
      let peakPnl = -Infinity;
      let peakIdx = -1;
      for (let i = 0; i < sorted.length; i++) {
        cumulativePnl += sorted[i][pnlCol];
        if (cumulativePnl > peakPnl) {
          peakPnl = cumulativePnl;
          peakIdx = i;
        }
      }
      if (peakIdx >= 0) {
        timePeaks.push({
          date,
          peak_time: excelDateToJSDate(sorted[peakIdx]["Open time"]).toISOString(),
          peak_pnl: peakPnl,
          trades_to_peak: peakIdx + 1
        });
      }
    }
    return timePeaks;
  }

  const timePeaks = analyzeCumulativePnlByTime(grouped);

  return new Response(
    JSON.stringify({
      message: 'File parsed and filtered successfully',
      rows: data.length,
      filtered_trades: totalTrades,
      num_days: numDays,
      date_range: dateRange,
      grouped_days: Object.keys(grouped).slice(0, 5),
      preview: filtered.slice(0, 5),
      timeDistances: timeDistances.slice(0, 20),
      slidingWindowMetrics: slidingWindowMetrics.slice(0, 10),
      correlations: correlations.slice(0, 20),
      timePeaks: timePeaks.slice(0, 10)
    }),
    { headers: { 'Content-Type': 'application/json', 'Connection': 'keep-alive', ...corsHeaders } }
  );
});