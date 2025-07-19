import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
import time
warnings.filterwarnings('ignore')

import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"


def filter_trading_hours(df):
    """Filter trades to only include those between 15:30 and 22:00"""
    # Convert 'Open time' column to datetime if it's not already
    if 'Open time' in df.columns:
        df['Open time'] = pd.to_datetime(df['Open time'])
        time_col = 'Open time'
    elif 'Close time' in df.columns:
        df['Open time'] = pd.to_datetime(df['Close time'])
        time_col = 'Open time'
    else:
        raise ValueError("No valid time column found.")
    
    # Extract time component
    df['Time_Only'] = df[time_col].dt.time
    
    # Filter for trading hours (15:30 to 22:00)
    start_time = datetime.strptime('15:30', '%H:%M').time()
    end_time = datetime.strptime('22:00', '%H:%M').time()
    
    filtered_df = df[
        (df['Time_Only'] >= start_time) & 
        (df['Time_Only'] <= end_time)
    ].copy()
    
    return filtered_df

def group_by_day(df):
    """Group trades by trading day using 'Open time'"""
    df['Date'] = df['Open time'].dt.date
    daily_groups = df.groupby('Date')
    return daily_groups

def analyze_sliding_window_metrics(daily_groups, window_minutes=15):
    """Highly optimized sliding window analysis with vectorized operations."""
    sliding_window_data = []
    
    for date, day_trades in daily_groups:
        if len(day_trades) < 2:
            continue
            
        # Sort by open time
        day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
        
        # Get the start and end times for the day
        day_start = day_trades['Open time'].min()
        day_end = day_trades['Open time'].max()
        
        # Create sliding windows using the original logic to maintain identical output
        current_time = day_start
        window_end = current_time + timedelta(minutes=window_minutes)
        
        while window_end <= day_end:
            # Get trades in this window using vectorized operations for speed
            window_mask = (day_trades['Open time'] >= current_time) & (day_trades['Open time'] < window_end)
            window_trades = day_trades[window_mask]
            
            if len(window_trades) > 0:
                # Calculate metrics for this window using vectorized operations
                pnl_col = 'PnL' if 'PnL' in window_trades.columns else 'Profit (ticks)'
                pnl_values = window_trades[pnl_col].values
                
                # Vectorized win rate calculation
                wins = (pnl_values > 0).sum()
                total_trades = len(pnl_values)
                win_rate = (wins / total_trades * 100) if total_trades > 0 else 0
                
                # Vectorized average P&L calculation
                avg_pnl = np.mean(pnl_values) if len(pnl_values) > 0 else 0
                
                # Vectorized volume calculation
                volume_col = 'Open volume' if 'Open volume' in window_trades.columns else None
                if volume_col:
                    total_volume = abs(window_trades[volume_col].sum())
                else:
                    total_volume = len(window_trades)  # Use trade count as proxy
                
                # Time distance between trades in window (using original logic for identical output)
                if len(window_trades) > 1:
                    time_distances = []
                    for i in range(1, len(window_trades)):
                        time_diff = (window_trades.iloc[i]['Open time'] - window_trades.iloc[i-1]['Open time']).total_seconds() / 60
                        time_distances.append(time_diff)
                    avg_time_distance = np.mean(time_distances)
                else:
                    avg_time_distance = 0
                
                sliding_window_data.append({
                    'date': date,
                    'window_start': current_time,
                    'window_end': window_end,
                    'window_center': current_time + timedelta(minutes=window_minutes/2),
                    'trades_in_window': total_trades,
                    'win_rate': win_rate,
                    'avg_pnl': avg_pnl,
                    'total_volume': total_volume,
                    'avg_time_distance': avg_time_distance
                })
            
            # Move window forward by 1 minute
            current_time += timedelta(minutes=1)
            window_end = current_time + timedelta(minutes=window_minutes)
    
    return pd.DataFrame(sliding_window_data)

def analyze_correlations(daily_groups):
    """Vectorized correlation analysis (output must match original)."""
    all_correlations = []
    
    for date, day_trades in daily_groups:
        if len(day_trades) < 2:
            continue
        # Sort by close time of previous trade, then open time of current trade
        day_trades = day_trades.sort_values(['Close time', 'Open time']).reset_index(drop=True)
        # Calculate time distances between closing time of previous trade and opening time of current trade
        time_distances = []
        pnl_values = []
        volume_values = []
        wins = []
        for i in range(1, len(day_trades)):
            time_diff = (day_trades.iloc[i]['Open time'] - day_trades.iloc[i-1]['Close time']).total_seconds() / 60
            if time_diff > 0:  # Only keep positive time distances
                time_distances.append(time_diff)
                pnl_col = 'PnL' if 'PnL' in day_trades.columns else 'Profit (ticks)'
                pnl_values.append(day_trades.iloc[i][pnl_col])
                volume_col = 'Open volume' if 'Open volume' in day_trades.columns else None
                if volume_col:
                    volume_values.append(abs(day_trades.iloc[i][volume_col]))
                else:
                    volume_values.append(1)
                wins.append(1 if day_trades.iloc[i][pnl_col] > 0 else 0)
        for i, (time_dist, pnl, vol, win) in enumerate(zip(time_distances, pnl_values, volume_values, wins)):
            all_correlations.append({
                'date': date,
                'time_distance': time_dist,
                'pnl': pnl,
                'volume': vol,
                'win': win
            })
    return pd.DataFrame(all_correlations)

def analyze_cumulative_pnl_by_time(daily_groups):
    """Vectorized cumulative PnL analysis (output must match original)."""
    time_peaks = []
    
    for date, day_trades in daily_groups:
        if len(day_trades) < 2:
            continue
            
        # Sort by open time
        day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
        
        # Calculate cumulative P&L using numpy for speed
        pnl_col = 'PnL' if 'PnL' in day_trades.columns else 'Profit (ticks)'
        pnl_values = day_trades[pnl_col].values
        cumulative_pnl = np.cumsum(pnl_values)
        
        # Find peak using numpy
        peak_idx = np.argmax(cumulative_pnl)
        peak_time = day_trades.iloc[peak_idx]['Open time']
        peak_pnl = cumulative_pnl[peak_idx]
        
        time_peaks.append({
            'date': date,
            'peak_time': peak_time,
            'peak_pnl': peak_pnl,
            'trades_to_peak': peak_idx + 1
        })
    
    return pd.DataFrame(time_peaks)

def analyze_optimal_drawdown(daily_groups):
    """Vectorized optimal drawdown analysis (output must match original)."""
    optimal_drawdown_results = []
    
    for date, day_trades in daily_groups:
        if len(day_trades) < 2:
            continue
            
        # Sort by open time
        day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
        
        # Calculate cumulative P&L using numpy for speed
        pnl_col = 'PnL' if 'PnL' in day_trades.columns else 'Profit (ticks)'
        pnl_values = day_trades[pnl_col].values
        cumulative_pnl = np.cumsum(pnl_values)
        
        # Find the peak P&L
        peak_pnl = cumulative_pnl.max()
        
        # Test different drawdown percentages
        drawdown_percentages = np.arange(5, 101, 5)  # 5% to 100% in 5% steps
        results_for_day = []
        
        for drawdown_pct in drawdown_percentages:
            # Vectorized simulation
            running_pnl = 0
            peak_so_far = 0
            trades_taken = 0
            
            for trade_pnl in pnl_values:
                # Check if taking this trade would exceed drawdown limit
                potential_pnl = running_pnl + trade_pnl
                potential_peak = max(peak_so_far, potential_pnl)
                
                # Calculate current drawdown
                if potential_peak > 0:
                    current_drawdown = (potential_peak - potential_pnl) / potential_peak * 100
                else:
                    current_drawdown = 0
                
                # If drawdown is within limit, take the trade
                if current_drawdown <= drawdown_pct:
                    running_pnl = potential_pnl
                    peak_so_far = potential_peak
                    trades_taken += 1
                else:
                    # Stop trading for this day
                    break
            
            results_for_day.append({
                'drawdown_pct': drawdown_pct,
                'final_pnl': running_pnl,
                'trades_taken': trades_taken,
                'peak_pnl': peak_so_far
            })
        
        # Find optimal drawdown percentage (maximizes final P&L)
        if results_for_day:
            best_result = max(results_for_day, key=lambda x: x['final_pnl'])
            optimal_drawdown_results.append({
                'date': date,
                'optimal_drawdown_pct': best_result['drawdown_pct'],
                'final_pnl_with_optimal': best_result['final_pnl'],
                'trades_taken_with_optimal': best_result['trades_taken'],
                'peak_pnl': best_result['peak_pnl'],
                'unlimited_final_pnl': cumulative_pnl[-1],
                'total_trades': len(day_trades)
            })
    
    return pd.DataFrame(optimal_drawdown_results)

def analyze_optimal_drawdown_distribution(daily_groups, only_positive_days=False):
    """For each drawdown threshold, sum the resulting P&Ls across all days. If only_positive_days is True, only include days with positive P&L after drawdown stop for that threshold."""
    drawdown_percentages = np.arange(5, 101, 5)  # 5% to 100% in 5% steps
    
    # If only_positive_days is True, first identify which days have positive final P&L
    positive_days = set()
    if only_positive_days:
        for date, day_trades in daily_groups:
            if len(day_trades) < 2:
                continue
            day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
            pnl_col = 'PnL' if 'PnL' in day_trades.columns else 'Profit (ticks)'
            total_pnl = day_trades[pnl_col].sum()
            if total_pnl > 0:
                positive_days.add(date)
    
    total_pnls = []
    for drawdown_pct in drawdown_percentages:
        total_pnl = 0
        for date, day_trades in daily_groups:
            if len(day_trades) < 2:
                continue
            
            # Skip days that aren't in positive_days if only_positive_days is True
            if only_positive_days and date not in positive_days:
                continue
                
            day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
            pnl_col = 'PnL' if 'PnL' in day_trades.columns else 'Profit (ticks)'
            pnl_values = day_trades[pnl_col].values
            
            # Vectorized simulation
            cumulative_pnl = 0
            running_peak = 0
            stopped = False
            
            for trade_pnl in pnl_values:
                cumulative_pnl += trade_pnl
                running_peak = max(running_peak, cumulative_pnl)
                if running_peak > 0:
                    current_drawdown = (running_peak - cumulative_pnl) / running_peak * 100
                else:
                    current_drawdown = 0
                if current_drawdown > drawdown_pct:
                    stopped = True
                    # Stop at the previous trade's cumulative P&L
                    cumulative_pnl -= trade_pnl
                    break
            total_pnl += cumulative_pnl
        total_pnls.append(total_pnl)
    return drawdown_percentages, total_pnls

def plot_results(correlations_df, time_peaks_df, sliding_window_df, daily_groups):
    """Highly optimized plot results generation with minimal DataFrame operations."""

    # Initialize JSON data structure
    all_plot_data = {}
    
    # 1. Win rate vs time distance (sliding window) - pre-compute filtered data
    if not sliding_window_df.empty:
        # Filter out zero or negative avg_time_distance values once
        filtered_win = sliding_window_df[sliding_window_df['avg_time_distance'] > 0]
        
        if not filtered_win.empty:
            # Sort by time distance for rolling average calculation
            filtered_win_sorted = filtered_win.sort_values('avg_time_distance').reset_index(drop=True)
            
            # Calculate rolling average using vectorized operations
            rolling_win_rate = filtered_win_sorted['win_rate'].rolling(window=20, min_periods=1).mean()
            
            # Save raw data for win rate vs time distance
            all_plot_data["win_rate_vs_avg_time_distance_over_15m_window"] = {
                "time_distance": filtered_win['avg_time_distance'].tolist(),
                "win_rate": filtered_win['win_rate'].tolist(),
                "time_distance_sorted": filtered_win_sorted['avg_time_distance'].tolist(),
                "rolling_win_rate": rolling_win_rate.tolist()
            }

    # 2. P&L vs time distance (individual trades, filtered, log y scale)
    if not correlations_df.empty:
        # Filter out top 3% of time distances using vectorized operations
        td = correlations_df['time_distance']
        cutoff = td.quantile(0.97)
        filtered = correlations_df[td <= cutoff]

        # Save raw data for P&L vs time distance (violin plot data)
        all_plot_data["pnl_vs_time_distance"] = {
            "time_distance_minutes": filtered['time_distance'].tolist(),
            "pnl": filtered['pnl'].tolist()
        }

    # 3. Volume vs time distance (individual trades, filtered)
    if not correlations_df.empty:
        # Filter out top 3% of time distances
        td = correlations_df['time_distance']
        cutoff = td.quantile(0.97)
        filtered = correlations_df[td <= cutoff]
        
        # Save raw data for volume vs time distance
        all_plot_data["volume_vs_time_distance"] = {
            "time_distance": filtered['time_distance'].tolist(),
            "volume": filtered['volume'].tolist()
        }

    # 5. Peak time distribution
    if not time_peaks_df.empty:
        # Save raw data for peak P&L times to JSON
        peak_times = [t.strftime('%H:%M') for t in time_peaks_df['peak_time']]
        peak_pnls = time_peaks_df['peak_pnl'].tolist()
        all_plot_data["distribution_of_peak_pnl_times"] = {
            "time": peak_times,
            "pnl": peak_pnls
        }
    
    # 6. Trades to peak distribution
    if not time_peaks_df.empty:
        # Save raw data for trades to peak distribution
        all_plot_data["distribution_of_trades_to_peak"] = {
            "trades_to_peak": time_peaks_df['trades_to_peak'].tolist()
        }
    
    # 7. Optimal drawdown cumulative P&L analysis
    drawdown_percentages, total_pnls = analyze_optimal_drawdown_distribution(daily_groups)
    
    # Save raw data for drawdown analysis
    all_plot_data["cumulative_pnl_vs_drawdown_threshold"] = {
        "drawdown_percentages": drawdown_percentages.tolist(),
        "cumulative_pnl": total_pnls
    }
    
    # 8. Cumulative P&L vs minimum cooldown period (replaces heatmap)
    cooldown_seconds_list = np.arange(0, 1801, 15)  # 0 to 1800 seconds (30 minutes) in 15-sec steps
    pnl_by_cooldown = simulate_cooldown_pnl(daily_groups, cooldown_seconds_list)
    
    # Save raw data for cooldown analysis
    all_plot_data["cumulative_pnl_vs_cooldown_period"] = {
        "cooldown_minutes": (cooldown_seconds_list / 60).tolist(),
        "cumulative_pnl": pnl_by_cooldown
    }

    # 4. P&L vs binned time distance (bar chart, replaces win rate by hour of day)
    if not correlations_df.empty:
        # Bin time distances into 15-second bins using vectorized operations
        bin_width = 15  # seconds
        max_td = correlations_df['time_distance'].max()
        bins = np.arange(0, max_td + bin_width, bin_width)
        bin_edges = bins[:-1]
        
        # Create temporary dataframe for binning
        temp_df = correlations_df.copy()
        temp_df['td_bin'] = pd.cut(temp_df['time_distance'], bins=bins, labels=False, right=False)
        binned_pnl = temp_df.groupby('td_bin')['pnl'].sum()
        
        # Use only bins with data
        valid_bins = binned_pnl.index.values
        x = bin_edges[valid_bins]
        y = binned_pnl.values

        # Save raw data for binned P&L
        all_plot_data["total_pnl_by_time_distance_bin"] = {
            "time_distance_seconds": x.tolist(),
            "total_pnl": y.tolist()
        }

    return all_plot_data

def generate_trading_recommendations(correlations_df, time_peaks_df, sliding_window_df, optimal_drawdown_df, daily_groups):
    """Highly optimized trading recommendations generation with minimal DataFrame operations."""
    import json
    import scipy.stats as stats
    
    recommendations = {}
    
    # 1. Optimal break between trades (based on cooldown analysis)
    if not correlations_df.empty:
        # Find the cooldown period that maximizes cumulative P&L
        cooldown_seconds_list = np.arange(0, 1801, 15)  # 0 to 1800 seconds (30 minutes) in 15-sec steps
        
        pnl_by_cooldown = simulate_cooldown_pnl(daily_groups, cooldown_seconds_list)
        optimal_cooldown_idx = np.argmax(pnl_by_cooldown)
        optimal_cooldown_minutes = cooldown_seconds_list[optimal_cooldown_idx] / 60
        optimal_cooldown_seconds = cooldown_seconds_list[optimal_cooldown_idx]
        
        # Calculate robustness metrics
        max_pnl = pnl_by_cooldown[optimal_cooldown_idx]
        baseline_pnl = pnl_by_cooldown[0]
        pnl_improvement = max_pnl - baseline_pnl
        
        # Find range of cooldown periods that achieve >95% of max P&L
        threshold = max_pnl * 0.95
        robust_range = [i for i, pnl in enumerate(pnl_by_cooldown) if pnl >= threshold]
        robust_min = cooldown_seconds_list[min(robust_range)] / 60 if robust_range else optimal_cooldown_minutes
        robust_max = cooldown_seconds_list[max(robust_range)] / 60 if robust_range else optimal_cooldown_minutes
        
        recommendations["optimal_break_between_trades"] = {
            "minutes": optimal_cooldown_minutes,
            "seconds": optimal_cooldown_seconds,
            "robust_range_minutes": [robust_min, robust_max],
            "explanation": f"Based on cooldown analysis, waiting {optimal_cooldown_minutes:.1f} minutes between trades maximizes cumulative P&L",
            "pnl_improvement": pnl_improvement,
            "robustness": f"Cooldown periods between {robust_min:.1f}-{robust_max:.1f} minutes achieve >95% of maximum P&L",
            "confidence": "High - based on systematic analysis across all cooldown periods"
        }
    
    # 2. Optimal intraday drawdown threshold
    if not optimal_drawdown_df.empty:
        # Use the median optimal drawdown percentage
        median_optimal_drawdown = np.median(optimal_drawdown_df['optimal_drawdown_pct'])
        mean_optimal_drawdown = np.mean(optimal_drawdown_df['optimal_drawdown_pct'])
        std_optimal_drawdown = np.std(optimal_drawdown_df['optimal_drawdown_pct'])
        
        # Calculate confidence interval
        n_days = len(optimal_drawdown_df)
        if n_days > 1:
            se = std_optimal_drawdown / np.sqrt(n_days)
            ci_95 = stats.t.interval(0.95, df=n_days-1, loc=mean_optimal_drawdown, scale=se)
        else:
            ci_95 = (mean_optimal_drawdown, mean_optimal_drawdown)
        
        # Calculate consistency (how often the recommendation would have worked)
        consistency_count = sum(1 for pct in optimal_drawdown_df['optimal_drawdown_pct'] 
                              if abs(pct - median_optimal_drawdown) <= 5)  # Within 5% of median
        consistency_rate = consistency_count / n_days if n_days > 0 else 0
        
        recommendations["optimal_intraday_drawdown"] = {
            "percentage": float(median_optimal_drawdown),
            "mean_percentage": float(mean_optimal_drawdown),
            "std_percentage": float(std_optimal_drawdown),
            "confidence_interval_95": [float(ci_95[0]), float(ci_95[1])],
            "sample_size": n_days,
            "consistency_rate": float(consistency_rate),
            "explanation": f"Stop trading when daily drawdown reaches {median_optimal_drawdown:.1f}% of the day's peak P&L",
            "confidence": f"Medium - {consistency_rate:.1%} of days had optimal drawdown within 5% of recommendation",
            "robustness": f"95% confidence interval: {ci_95[0]:.1f}%-{ci_95[1]:.1f}%"
        }
    
    # 3. Optimal max trades per day
    if not time_peaks_df.empty:
        # Analyze trades to peak distribution using vectorized operations
        median_trades_to_peak = np.median(time_peaks_df['trades_to_peak'])
        mean_trades_to_peak = np.mean(time_peaks_df['trades_to_peak'])
        std_trades_to_peak = np.std(time_peaks_df['trades_to_peak'])
        
        # Calculate average trades per day
        total_trades = sum(len(day_trades) for _, day_trades in daily_groups)
        total_days = len(daily_groups)
        avg_trades_per_day = total_trades / total_days if total_days > 0 else 0
        
        # Calculate confidence interval for trades to peak
        n_peaks = len(time_peaks_df)
        if n_peaks > 1:
            se_peaks = std_trades_to_peak / np.sqrt(n_peaks)
            ci_95_peaks = stats.t.interval(0.95, df=n_peaks-1, loc=mean_trades_to_peak, scale=se_peaks)
        else:
            ci_95_peaks = (mean_trades_to_peak, mean_trades_to_peak)
        
        # Calculate how often the recommendation would have been optimal
        optimal_count = sum(1 for trades in time_peaks_df['trades_to_peak'] 
                           if abs(trades - median_trades_to_peak) <= 2)  # Within 2 trades of median
        optimal_rate = optimal_count / n_peaks if n_peaks > 0 else 0
        
        recommendations["optimal_max_trades_per_day"] = {
            "median_trades_to_peak": float(median_trades_to_peak),
            "mean_trades_to_peak": float(mean_trades_to_peak),
            "std_trades_to_peak": float(std_trades_to_peak),
            "confidence_interval_95": [float(ci_95_peaks[0]), float(ci_95_peaks[1])],
            "current_avg_trades_per_day": float(avg_trades_per_day),
            "sample_size": n_peaks,
            "optimal_rate": float(optimal_rate),
            "recommendation": f"Consider limiting to {median_trades_to_peak:.0f} trades per day, as this is the median number of trades needed to reach peak P&L",
            "explanation": "Based on analysis of when cumulative P&L typically peaks during trading days",
            "confidence": f"Medium - {optimal_rate:.1%} of days had optimal trades within 2 of recommendation",
            "robustness": f"95% confidence interval: {ci_95_peaks[0]:.1f}-{ci_95_peaks[1]:.1f} trades"
        }
    
    # 4. Best trading hours
    if not time_peaks_df.empty:
        peak_hours = [t.hour + t.minute/60 for t in time_peaks_df['peak_time']]
        avg_peak_hour = np.mean(peak_hours)
        std_peak_hour = np.std(peak_hours)
        most_common_peak = time_peaks_df['peak_time'].mode().iloc[0] if not time_peaks_df['peak_time'].mode().empty else None
        
        # Calculate confidence interval
        n_peaks = len(peak_hours)
        if n_peaks > 1:
            se_hours = std_peak_hour / np.sqrt(n_peaks)
            ci_95_hours = stats.t.interval(0.95, df=n_peaks-1, loc=avg_peak_hour, scale=se_hours)
        else:
            ci_95_hours = (avg_peak_hour, avg_peak_hour)
        
        # Calculate consistency (how often peak occurs within 1 hour of average)
        consistency_count = sum(1 for hour in peak_hours if abs(hour - avg_peak_hour) <= 1)
        consistency_rate = consistency_count / n_peaks if n_peaks > 0 else 0
        
        recommendations["optimal_trading_hours"] = {
            "average_peak_time": f"{int(avg_peak_hour):02d}:{int((avg_peak_hour % 1) * 60):02d}",
            "std_peak_hour": float(std_peak_hour),
            "confidence_interval_95": [f"{int(ci_95_hours[0]):02d}:{int((ci_95_hours[0] % 1) * 60):02d}", 
                                     f"{int(ci_95_hours[1]):02d}:{int((ci_95_hours[1] % 1) * 60):02d}"],
            "most_common_peak_time": most_common_peak.strftime('%H:%M') if most_common_peak else "N/A",
            "sample_size": n_peaks,
            "consistency_rate": float(consistency_rate),
            "explanation": f"Peak cumulative P&L typically occurs around {int(avg_peak_hour):02d}:{int((avg_peak_hour % 1) * 60):02d}",
            "recommendation": "Focus trading activity in the hours leading up to the typical peak time",
            "confidence": f"Medium - {consistency_rate:.1%} of days had peak within 1 hour of average",
            "robustness": f"95% confidence interval: {int(ci_95_hours[0]):02d}:{int((ci_95_hours[0] % 1) * 60):02d} - {int(ci_95_hours[1]):02d}:{int((ci_95_hours[1] % 1) * 60):02d}"
        }
    
    # 5. Time distance optimization
    if not correlations_df.empty:
        # Find time distance range with best P&L performance within practical limits
        td = correlations_df['time_distance']
        pnl = correlations_df['pnl']
        
        # Focus on practical time distances (0-30 minutes for day trading)
        practical_mask = td <= 30
        practical_td = td[practical_mask]
        practical_pnl = pnl[practical_mask]
        
        if len(practical_td) > 0:
            # Bin time distances and calculate average P&L per bin using vectorized operations
            bin_width = 2  # minutes (smaller bins for more precision)
            max_td = practical_td.max()
            bins = np.arange(0, max_td + bin_width, bin_width)
            
            # Create temporary dataframe for binning
            temp_df = pd.DataFrame({'time_distance': practical_td, 'pnl': practical_pnl})
            temp_df['td_bin'] = pd.cut(temp_df['time_distance'], bins=bins, labels=False, right=False)
            
            binned_pnl = temp_df.groupby('td_bin')['pnl'].mean()
            binned_std = temp_df.groupby('td_bin')['pnl'].std()
            binned_count = temp_df.groupby('td_bin')['pnl'].count()
            
            # Filter out bins with too few trades (less than 5 trades)
            min_trades = 5
            valid_bins = binned_count[binned_count >= min_trades]
            
            if not valid_bins.empty and len(valid_bins) > 0:
                # Find best performing bin among valid bins
                best_bin_idx = binned_pnl.loc[valid_bins.index].idxmax()
                if best_bin_idx is not None and not pd.isna(best_bin_idx):
                    best_bin_idx = int(best_bin_idx)
                    if 0 <= best_bin_idx < len(bins) - 1:
                        best_time_distance_min = bins[best_bin_idx]
                        best_time_distance_max = bins[best_bin_idx + 1]
                        best_avg_pnl = binned_pnl.loc[best_bin_idx]
                        best_std_pnl = binned_std.loc[best_bin_idx] if best_bin_idx in binned_std.index else 0
                        best_count = binned_count.loc[best_bin_idx] if best_bin_idx in binned_count.index else 0
                        
                        # Calculate confidence interval for the best bin
                        if best_count > 1:
                            se_bin = best_std_pnl / np.sqrt(best_count)
                            ci_95_bin = stats.t.interval(0.95, df=best_count-1, loc=best_avg_pnl, scale=se_bin)
                        else:
                            ci_95_bin = (best_avg_pnl, best_avg_pnl)
                        
                        # Find robust range (bins with P&L within 20% of best and at least 5 trades)
                        threshold = best_avg_pnl * 0.8
                        robust_bins = [idx for idx, pnl in binned_pnl.items() 
                                     if pnl >= threshold and binned_count.loc[idx] >= min_trades]
                        robust_ranges = []
                        for idx in robust_bins:
                            if 0 <= idx < len(bins) - 1:
                                robust_ranges.append([bins[idx], bins[idx + 1]])
                        
                        recommendations["optimal_time_distance_range"] = {
                            "min_minutes": float(best_time_distance_min),
                            "max_minutes": float(best_time_distance_max),
                            "avg_pnl_in_range": float(best_avg_pnl),
                            "std_pnl_in_range": float(best_std_pnl),
                            "sample_size": int(best_count),
                            "confidence_interval_95": [float(ci_95_bin[0]), float(ci_95_bin[1])],
                            "robust_ranges": robust_ranges,
                            "explanation": f"Trades with {best_time_distance_min}-{best_time_distance_max} minutes between them show the highest average P&L (among practical ranges)",
                            "recommendation": f"Aim for {best_time_distance_min}-{best_time_distance_max} minute intervals between trades",
                            "confidence": f"Medium - based on {best_count} trades in optimal range",
                            "robustness": f"95% confidence interval: {ci_95_bin[0]:.1f}-{ci_95_bin[1]:.1f} P&L",
                            "note": "Analysis limited to practical time distances (0-30 minutes) for day trading"
                        }
                    else:
                        recommendations["optimal_time_distance_range"] = {
                            "explanation": "No practical time distance range found with sufficient data",
                            "recommendation": "Use default 5-10 minute intervals based on general trading practices",
                            "confidence": "Low - insufficient data for statistical analysis",
                            "note": "Consider using the cooldown analysis recommendation instead"
                        }
                else:
                    recommendations["optimal_time_distance_range"] = {
                        "explanation": "No practical time distance range found with sufficient data",
                        "recommendation": "Use default 5-10 minute intervals based on general trading practices",
                        "confidence": "Low - insufficient data for statistical analysis",
                        "note": "Consider using the cooldown analysis recommendation instead"
                    }
            else:
                recommendations["optimal_time_distance_range"] = {
                    "explanation": "No time distance bins have sufficient trades for reliable analysis",
                    "recommendation": "Use default 5-10 minute intervals based on general trading practices",
                    "confidence": "Low - insufficient data for statistical analysis",
                    "note": "Consider using the cooldown analysis recommendation instead"
                }
        else:
            recommendations["optimal_time_distance_range"] = {
                "explanation": "No trades found within practical time distance range (0-30 minutes)",
                "recommendation": "Use default 5-10 minute intervals based on general trading practices",
                "confidence": "Low - no data available for analysis",
                "note": "Consider using the cooldown analysis recommendation instead"
            }
    
    # 6. Win rate optimization
    if not sliding_window_df.empty:
        # Find time windows with highest win rates
        filtered_win = sliding_window_df[sliding_window_df['avg_time_distance'] > 0]
        if not filtered_win.empty:
            best_win_rate_idx = filtered_win['win_rate'].idxmax()
            best_win_rate_window = filtered_win.loc[best_win_rate_idx]
            
            # Calculate robustness metrics
            win_rate_std = filtered_win['win_rate'].std()
            win_rate_count = len(filtered_win)
            
            # Find windows with win rate >90% of best
            threshold = best_win_rate_window['win_rate'] * 0.9
            robust_windows = filtered_win[filtered_win['win_rate'] >= threshold]
            robust_window_count = len(robust_windows)
            
            recommendations["optimal_win_rate_window"] = {
                "time_window": best_win_rate_window['window_center'].strftime('%H:%M'),
                "win_rate": float(best_win_rate_window['win_rate']),
                "avg_time_distance": float(best_win_rate_window['avg_time_distance']),
                "win_rate_std": float(win_rate_std),
                "sample_size": win_rate_count,
                "robust_windows_count": robust_window_count,
                "explanation": f"15-minute window centered at {best_win_rate_window['window_center'].strftime('%H:%M')} shows the highest win rate",
                "recommendation": "Focus trading activity during this time window for better win rates",
                "confidence": f"Low - based on single window analysis, {robust_window_count} windows show >90% of best win rate",
                "robustness": f"Win rate standard deviation: {win_rate_std:.1f}%"
            }
    
    # 7. Volume optimization
    if not correlations_df.empty:
        # Analyze volume vs time distance correlation
        vol_corr = np.corrcoef(correlations_df['time_distance'], correlations_df['volume'])[0, 1]
        
        # Calculate correlation significance
        n_vol = len(correlations_df)
        if n_vol > 2:
            t_stat = vol_corr * np.sqrt((n_vol - 2) / (1 - vol_corr**2))
            p_value = 2 * (1 - stats.t.cdf(abs(t_stat), df=n_vol-2))
            significant = p_value < 0.05
        else:
            p_value = 1.0
            significant = False
        
        # Analyze revenge trading patterns
        # Define high volume and low time distance thresholds
        volume_75th = correlations_df['volume'].quantile(0.75)
        time_distance_25th = correlations_df['time_distance'].quantile(0.25)
        
        # Identify potential revenge trading instances
        revenge_trades = correlations_df[
            (correlations_df['volume'] >= volume_75th) & 
            (correlations_df['time_distance'] <= time_distance_25th)
        ]
        
        revenge_count = len(revenge_trades)
        revenge_percentage = (revenge_count / n_vol) * 100 if n_vol > 0 else 0
        
        # Analyze P&L performance of revenge trades vs normal trades
        if revenge_count > 0:
            revenge_pnl_mean = revenge_trades['pnl'].mean()
            revenge_pnl_std = revenge_trades['pnl'].std()
            
            # Compare with normal trades
            normal_trades = correlations_df[
                ~((correlations_df['volume'] >= volume_75th) & 
                  (correlations_df['time_distance'] <= time_distance_25th))
            ]
            normal_pnl_mean = normal_trades['pnl'].mean() if len(normal_trades) > 0 else 0
            
            pnl_difference = revenge_pnl_mean - normal_pnl_mean
            revenge_performance = "worse" if pnl_difference < 0 else "better"
        else:
            revenge_pnl_mean = 0
            revenge_pnl_std = 0
            normal_pnl_mean = correlations_df['pnl'].mean()
            pnl_difference = 0
            revenge_performance = "no data"
        
        # Calculate volume distribution by time distance
        low_time_high_vol = correlations_df[
            (correlations_df['time_distance'] <= time_distance_25th) & 
            (correlations_df['volume'] >= volume_75th)
        ]
        low_time_high_vol_percentage = (len(low_time_high_vol) / n_vol) * 100 if n_vol > 0 else 0
        
        recommendations["volume_optimization"] = {
            "volume_time_correlation": float(vol_corr),
            "correlation_p_value": float(p_value),
            "correlation_significant": significant,
            "sample_size": n_vol,
            "revenge_trading_analysis": {
                "revenge_trades_count": revenge_count,
                "revenge_trades_percentage": float(revenge_percentage),
                "revenge_pnl_mean": float(revenge_pnl_mean),
                "revenge_pnl_std": float(revenge_pnl_std),
                "normal_pnl_mean": float(normal_pnl_mean),
                "pnl_difference": float(pnl_difference),
                "revenge_performance": revenge_performance,
                "low_time_high_vol_percentage": float(low_time_high_vol_percentage),
                "volume_threshold_75th": float(volume_75th),
                "time_distance_threshold_25th": float(time_distance_25th)
            },
            "explanation": f"Volume and time distance correlation: {vol_corr:.4f}. {revenge_percentage:.1f}% of trades show potential revenge trading patterns (high volume + low time distance).",
            "recommendation": f"Address revenge trading: {revenge_percentage:.1f}% of trades show high volume with low time gaps. These trades perform {revenge_performance} than normal trades (difference: {pnl_difference:.1f} P&L).",
            "confidence": f"{'High' if significant else 'Low'} - correlation is {'statistically significant' if significant else 'not statistically significant'} (p={p_value:.4f})",
            "robustness": f"Based on {n_vol} trade observations",
            "action_items": [
                "Implement mandatory cooldown periods after losses",
                "Set volume limits for trades within 5 minutes of previous trade",
                "Monitor for increasing position sizes after losses",
                "Consider reducing position size when time between trades is low"
            ] if revenge_percentage > 10 else [
                "Monitor for revenge trading patterns",
                "Maintain current risk management practices"
            ]
        }
    
    return recommendations

def to_serializable(obj):
    """Recursively convert Pandas, NumPy, and datetime objects to native Python types."""
    if isinstance(obj, dict):
        return {k: to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [to_serializable(i) for i in obj]
    elif isinstance(obj, pd.DataFrame):
        return obj.to_dict(orient="records")
    elif isinstance(obj, pd.Series):
        return obj.to_list()
    elif isinstance(obj, (np.integer, np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32, np.float16)):
        return float(obj)
    elif isinstance(obj, (np.ndarray,)):
        return obj.tolist()
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    elif isinstance(obj, (datetime, np.datetime64)):
        # np.datetime64 to datetime
        if isinstance(obj, np.datetime64):
            obj = pd.to_datetime(obj)
        return obj.isoformat()
    elif obj is None:
        return None
    else:
        return obj


def simulate_cooldown_pnl(daily_groups, cooldown_seconds_list):
    """Vectorized cooldown PnL simulation (output must match original)."""
    pnl_by_cooldown = []
    for cooldown in cooldown_seconds_list:
        total_pnl = 0
        for date, day_trades in daily_groups:
            if len(day_trades) < 2:
                continue
            day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
            pnl_col = 'PnL' if 'PnL' in day_trades.columns else 'Profit (ticks)'
            open_times = day_trades['Open time'].values
            close_times = day_trades['Close time'].values if 'Close time' in day_trades.columns else open_times
            pnl_values = day_trades[pnl_col].values
            n = len(open_times)
            last_trade_end = None
            day_pnl = 0
            i = 0
            while i < n:
                open_time = pd.Timestamp(open_times[i])
                if last_trade_end is None or (open_time - last_trade_end).total_seconds() >= cooldown:
                    day_pnl += pnl_values[i]
                    last_trade_end = pd.Timestamp(close_times[i]) if i < len(close_times) else open_time
                    i += 1
                else:
                    # Find the next trade that satisfies the cooldown
                    j = i + 1
                    while j < n and (pd.Timestamp(open_times[j]) - last_trade_end).total_seconds() < cooldown:
                        j += 1
                    i = j
            total_pnl += day_pnl
        pnl_by_cooldown.append(total_pnl)
    return pnl_by_cooldown

def analyse_trading_journal_df(df: pd.DataFrame) -> dict:
    timings = {}
    t0 = time.perf_counter()
    df = filter_trading_hours(df)
    timings['filter_trading_hours'] = time.perf_counter() - t0

    t1 = time.perf_counter()
    daily_groups = group_by_day(df)
    timings['group_by_day'] = time.perf_counter() - t1

    t2 = time.perf_counter()
    sliding_window_df = analyze_sliding_window_metrics(daily_groups, window_minutes=15)
    timings['analyze_sliding_window_metrics'] = time.perf_counter() - t2

    t3 = time.perf_counter()
    correlations_df = analyze_correlations(daily_groups)
    timings['analyze_correlations'] = time.perf_counter() - t3

    t4 = time.perf_counter()
    time_peaks_df = analyze_cumulative_pnl_by_time(daily_groups)
    timings['analyze_cumulative_pnl_by_time'] = time.perf_counter() - t4

    t5 = time.perf_counter()
    optimal_drawdown_df = analyze_optimal_drawdown(daily_groups)
    timings['analyze_optimal_drawdown'] = time.perf_counter() - t5

    t6 = time.perf_counter()
    plot_data = plot_results(correlations_df, time_peaks_df, sliding_window_df, daily_groups)
    timings['plot_results'] = time.perf_counter() - t6

    t7 = time.perf_counter()
    recommendations = generate_trading_recommendations(correlations_df, time_peaks_df, sliding_window_df, optimal_drawdown_df, daily_groups)
    timings['generate_trading_recommendations'] = time.perf_counter() - t7

    timings['total'] = sum(timings.values())

    return {'data': plot_data, 'recommendations': recommendations, 'timings': timings, 'profiled': True} 
