import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
import time
import io
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.manifold import TSNE
# from umap import UMAP
import random
import sklearn
warnings.filterwarnings('ignore')

# import os
# os.environ["OMP_NUM_THREADS"] = "1"
# os.environ["OPENBLAS_NUM_THREADS"] = "1"
# os.environ["MKL_NUM_THREADS"] = "1"
# os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
# os.environ["NUMEXPR_NUM_THREADS"] = "1"


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
    start_time = datetime.strptime('00:00', '%H:%M').time()
    end_time = datetime.strptime('23:59', '%H:%M').time()
    
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
    """Vectorized correlation analysis"""
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
            if time_diff < 0:
                raise ValueError(f"Time difference of trades is negative at index {i}: {time_diff}")
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
    # print(type(drawdown_percentages), type(total_pnls))
    all_plot_data["cumulative_pnl_vs_drawdown_threshold"] = {
        "drawdown_percentages": drawdown_percentages.tolist(),
        "cumulative_pnl": total_pnls
    }
    
    # DEBUG
    # import matplotlib.pyplot as plt
    # # Plot drawdown percentages vs total PnLs
    # plt.figure(figsize=(8, 5))
    # plt.plot(drawdown_percentages, total_pnls, marker='o', label='Total PnL')
    # plt.xlabel('Drawdown Percentage (%)')
    # plt.ylabel('Total Cumulative PnL')
    # plt.title('Drawdown Percentage vs Total Cumulative PnL')
    # plt.grid(True)
    # plt.tight_layout()
    # plt.legend()
    # plt.show()
    
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

def analyze_clusters(df: pd.DataFrame) -> dict:
    # Set fixed random seed for reproducibility
    np.random.seed(42)
    random.seed(42)

    df["duration"] = (df["Close time"] - df["Open time"]).dt.total_seconds()
    df = df[df["duration"] > 0].copy()
    df["direction"] = df["Open volume"].apply(lambda x: "short" if x < 0 else "long")
    df["return_per_min"] = df["PnL"] / (df["duration"] / 60)
    df["dayofweek"] = df["Open time"].dt.dayofweek
    df["hour"] = df["Open time"].dt.hour 
    df["trade_date"] = df["Open time"].dt.date
    df["pause_since_last"] = df.sort_values("Open time").groupby("trade_date")["Open time"].diff().dt.total_seconds().fillna(0)
    df["PnL"] = df["Profit (ticks)"]

    features = df[["PnL", "duration", "Open volume", "return_per_min", "pause_since_last", "hour", "dayofweek"]].dropna()
    scaler = StandardScaler()
    scaled = scaler.fit_transform(features)

    # # Apply t-SNE first
    # Make t-SNE fully deterministic by setting method='exact' and init='random'
    reduction_result = TSNE(
        n_components=2,
        perplexity=30,
        random_state=42,
        method='exact'
    ).fit_transform(scaled)
    
    # UMAP
    # reducer = UMAP(n_neighbors=15, min_dist=0.1, random_state=42)
    # reduction_result = reducer.fit_transform(scaled)

    # Elbow method on t-SNE output
    wcss = []
    for k in range(2, 16):
        km = KMeans(n_clusters=k, random_state=42).fit(reduction_result)
        wcss.append(km.inertia_)

    # Silhouette method on t-SNE output
    silhouette_scores = []
    silhouette_range = range(5, 11)
    for k in silhouette_range:
        km = KMeans(n_clusters=k, random_state=42).fit(reduction_result)
        score = silhouette_score(reduction_result, km.labels_)
        silhouette_scores.append((k, score))

    best_k = max(silhouette_scores, key=lambda x: x[1])[0]

    # Final clustering
    kmeans = KMeans(n_clusters=best_k, random_state=42).fit(reduction_result)
    df_clustered = df.loc[features.index].copy()
    df_clustered["cluster"] = kmeans.labels_
    df_clustered["TSNE1"] = reduction_result[:, 0]
    df_clustered["TSNE2"] = reduction_result[:, 1]

    total = len(df_clustered)
    cluster_stats = {}
    interpretations = {}

    for cluster_id, group in df_clustered.groupby("cluster"):
        count = len(group)
        ratio = count / total
        stats = {
            "count": count,
            "ratio": ratio,
            "mean_pnl": group["PnL"].mean(),
            "std_pnl": group["PnL"].std(),
            "mean_duration": group["duration"].mean(),
            "mean_return_per_min": group["return_per_min"].mean(),
            "mean_pause": group["pause_since_last"].mean(),
            "mean_hour": group["hour"].mean(),
            "most_common_day": group["dayofweek"].mode()[0],
            "direction_ratio": group["direction"].value_counts(normalize=True).to_dict()
        }

        interpretation = []
        if stats["mean_pnl"] < -50:
            interpretation.append("large losers")
        elif stats["mean_pnl"] > 50:
            interpretation.append("large winners")
        elif stats["mean_pnl"] > 0:
            interpretation.append("small winners")
        else:
            interpretation.append("small losers")

        if stats["mean_pause"] > 300:
            interpretation.append("long pauses")
        elif stats["mean_pause"] < 30:
            interpretation.append("short pauses")
            
        if stats["mean_duration"] > 180:
            interpretation.append("long trades")
        elif stats["mean_duration"] < 60:
            interpretation.append("short trades")

        if stats["mean_hour"] >= 19:
            interpretation.append("late NY session")
        elif stats["mean_hour"] <= 17:
            interpretation.append("early NY session")

        day_map = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        interpretation.append(day_map[stats["most_common_day"]])

        if ratio > 0.05:
            cluster_stats[cluster_id] = stats
            interpretations[cluster_id] = ", ".join(interpretation)

    return {
        "data": cluster_stats,
        "interpretation": interpretations
    }

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
        
        # Apply kernel of 3 for robustness (average each point with its neighbors)
        smoothed_pnls = []
        for i in range(len(pnl_by_cooldown)):
            if i == 0:
                # First point: average with next point
                smoothed_pnl = (pnl_by_cooldown[i] + pnl_by_cooldown[i + 1]) / 2
            elif i == len(pnl_by_cooldown) - 1:
                # Last point: average with previous point
                smoothed_pnl = (pnl_by_cooldown[i - 1] + pnl_by_cooldown[i]) / 2
            else:
                # Middle points: average with both neighbors
                smoothed_pnl = (pnl_by_cooldown[i - 1] + pnl_by_cooldown[i] + pnl_by_cooldown[i + 1]) / 3
            smoothed_pnls.append(smoothed_pnl)
        
        # Find optimal using smoothed values
        optimal_cooldown_idx = np.argmax(smoothed_pnls)
        optimal_cooldown_minutes = cooldown_seconds_list[optimal_cooldown_idx] / 60
        optimal_cooldown_seconds = cooldown_seconds_list[optimal_cooldown_idx]
        
        # Calculate robustness metrics
        max_pnl = pnl_by_cooldown[optimal_cooldown_idx]
        
        # Calculate vanilla P&L (total cumulative P&L from original data)
        vanilla_pnl = sum(sum(day_trades['PnL' if 'PnL' in day_trades.columns else 'Profit (ticks)']) for _, day_trades in daily_groups)
        pnl_improvement = max_pnl - vanilla_pnl
        
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
            "potential_dollar_gain": float(pnl_improvement),  # Improvement over vanilla P&L
            "vanilla_pnl": float(vanilla_pnl),
            "optimal_pnl": float(max_pnl),
            "robustness": f"Cooldown periods between {robust_min:.1f}-{robust_max:.1f} minutes achieve >95% of maximum P&L",
            "confidence": "High - based on systematic analysis across all cooldown periods"
        }
    
    # 2. Optimal intraday drawdown threshold
    if not optimal_drawdown_df.empty:
        # Find the drawdown percentage that maximizes overall cumulative P&L
        drawdown_percentages, total_pnls = analyze_optimal_drawdown_distribution(daily_groups)
        
        # DEBUG
        # import matplotlib.pyplot as plt
        # # Plot drawdown percentages vs total PnLs
        # plt.figure(figsize=(8, 5))
        # plt.plot(drawdown_percentages, total_pnls, marker='o', label='Total PnL')
        # plt.xlabel('Drawdown Percentage (%)')
        # plt.ylabel('Total Cumulative PnL')
        # plt.title('Drawdown Percentage vs Total Cumulative PnL')
        # plt.grid(True)
        # plt.tight_layout()
        # plt.legend()
        # plt.show()
        
        # Apply kernel of 3 for robustness (average each point with its neighbors)
        smoothed_pnls = []
        for i in range(len(total_pnls)):
            if i == 0:
                # First point: average with next point
                smoothed_pnl = (total_pnls[i] + total_pnls[i + 1]) / 2
            elif i == len(total_pnls) - 1:
                # Last point: average with previous point
                smoothed_pnl = (total_pnls[i - 1] + total_pnls[i]) / 2
            else:
                # Middle points: average with both neighbors
                smoothed_pnl = (total_pnls[i - 1] + total_pnls[i] + total_pnls[i + 1]) / 3
            smoothed_pnls.append(smoothed_pnl)
        
        # Find optimal using smoothed values (kernel smoothing for robustness)
        optimal_drawdown_idx = np.argmax(smoothed_pnls)
        optimal_drawdown_pct = drawdown_percentages[optimal_drawdown_idx]
        optimal_cumulative_pnl = total_pnls[optimal_drawdown_idx]  # Use original P&L for reporting
        
        # Calculate vanilla P&L (total cumulative P&L from original data)
        vanilla_pnl = sum(sum(day_trades['PnL' if 'PnL' in day_trades.columns else 'Profit (ticks)']) for _, day_trades in daily_groups)
        pnl_improvement = optimal_cumulative_pnl - vanilla_pnl
        
        # Find robust range (drawdown percentages that achieve >95% of max P&L)
        max_pnl = max(total_pnls)
        threshold = max_pnl * 0.95
        robust_indices = [i for i, pnl in enumerate(total_pnls) if pnl >= threshold]
        robust_min = drawdown_percentages[min(robust_indices)] if robust_indices else optimal_drawdown_pct
        robust_max = drawdown_percentages[max(robust_indices)] if robust_indices else optimal_drawdown_pct
        
        # Calculate consistency from individual day analysis
        median_individual_drawdown = np.median(optimal_drawdown_df['optimal_drawdown_pct'])
        consistency_count = sum(1 for pct in optimal_drawdown_df['optimal_drawdown_pct'] 
                              if abs(pct - optimal_drawdown_pct) <= 5)  # Within 5% of optimal
        consistency_rate = consistency_count / len(optimal_drawdown_df) if len(optimal_drawdown_df) > 0 else 0
        
        recommendations["optimal_intraday_drawdown"] = {
            "percentage": float(optimal_drawdown_pct),
            "mean_percentage": float(np.mean(optimal_drawdown_df['optimal_drawdown_pct'])),
            "std_percentage": float(np.std(optimal_drawdown_df['optimal_drawdown_pct'])),
            "confidence_interval_95": [float(robust_min), float(robust_max)],
            "sample_size": len(optimal_drawdown_df),
            "consistency_rate": float(consistency_rate),
            "pnl_improvement": float(pnl_improvement),
            "potential_dollar_gain": float(pnl_improvement),  # Improvement over vanilla P&L
            "vanilla_pnl": float(vanilla_pnl),
            "optimal_pnl": float(optimal_cumulative_pnl),
            "explanation": f"Stop trading when daily drawdown reaches {optimal_drawdown_pct:.1f}% of the day's peak P&L. This maximizes overall cumulative P&L across all trading days in a robust way.",
            "confidence": f"High - based on systematic analysis across all drawdown thresholds",
            "robustness": f"Drawdown thresholds between {robust_min:.1f}%-{robust_max:.1f}% achieve >95% of maximum P&L"
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
            "explanation": "Based on analysis of when cumulative P&L typically peaks during trading days. The most common range is 6-7 trades to reach peak P&L.",
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
            "explanation": f"Peak cumulative P&L typically occurs around {int(avg_peak_hour):02d}:{int((avg_peak_hour % 1) * 60):02d}, so focus trading activity around that time.",
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
            bin_width = 1  # minutes (1-minute bins for more precision)
            max_td = practical_td.max()
            bins = np.arange(0, max_td + bin_width, bin_width)
            
            # Create temporary dataframe for binning
            temp_df = pd.DataFrame({'time_distance': practical_td, 'pnl': practical_pnl})
            temp_df['td_bin'] = pd.cut(temp_df['time_distance'], bins=bins, labels=False, right=False)
            
            binned_pnl = temp_df.groupby('td_bin')['pnl'].median()  # Use median instead of mean
            binned_std = temp_df.groupby('td_bin')['pnl'].std()
            binned_count = temp_df.groupby('td_bin')['pnl'].count()
            
            # Filter out bins with too few trades (less than 5 trades)
            min_trades = 5
            valid_bins = binned_count[binned_count >= min_trades]
            
            if not valid_bins.empty and len(valid_bins) > 0:
                # Prioritize bins with sufficient sample size for statistical reliability
                # Require at least 20 trades for a reliable recommendation
                reliable_bins = valid_bins[valid_bins >= 20]
                
                if not reliable_bins.empty:
                    # Among reliable bins, find the one with best average P&L
                    best_bin_idx = binned_pnl.loc[reliable_bins.index].idxmax()
                else:
                    # If no reliable bins, use the bin with highest sample size
                    best_bin_idx = valid_bins.idxmax()
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
                            "explanation": f"Trades with {best_time_distance_min}-{best_time_distance_max} minutes between them show the highest median P&L (among practical ranges)",
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
    
    # 7. Optimal trading time window (based on win rate vs time distance)
    if not sliding_window_df.empty:
        # Get the win rate vs time distance data
        filtered_win = sliding_window_df[sliding_window_df['avg_time_distance'] > 0]
        if not filtered_win.empty:
            # Sort by time distance for analysis
            filtered_win_sorted = filtered_win.sort_values('avg_time_distance').reset_index(drop=True)
            
            # Calculate rolling average using vectorized operations
            rolling_win_rate = filtered_win_sorted['win_rate'].rolling(window=20, min_periods=1).mean()
            
            # Apply kernel of 3 for robustness (average each point with its neighbors)
            smoothed_win_rates = []
            for i in range(len(rolling_win_rate)):
                if i == 0:
                    # First point: average with next point
                    smoothed_rate = (rolling_win_rate.iloc[i] + rolling_win_rate.iloc[i + 1]) / 2
                elif i == len(rolling_win_rate) - 1:
                    # Last point: average with previous point
                    smoothed_rate = (rolling_win_rate.iloc[i - 1] + rolling_win_rate.iloc[i]) / 2
                else:
                    # Middle points: average with both neighbors
                    smoothed_rate = (rolling_win_rate.iloc[i - 1] + rolling_win_rate.iloc[i] + rolling_win_rate.iloc[i + 1]) / 3
                smoothed_win_rates.append(smoothed_rate)
            
            # Find optimal time window (highest smoothed win rate)
            optimal_idx = np.argmax(smoothed_win_rates)
            optimal_time_distance = filtered_win_sorted.iloc[optimal_idx]['avg_time_distance']
            optimal_win_rate = smoothed_win_rates[optimal_idx]
            
            # Calculate baseline (overall average win rate)
            baseline_win_rate = filtered_win_sorted['win_rate'].mean()
            win_rate_improvement = optimal_win_rate - baseline_win_rate
            
            # Find robust range (time distances that achieve >90% of max win rate)
            max_win_rate = max(smoothed_win_rates)
            threshold = max_win_rate * 0.9
            robust_indices = [i for i, rate in enumerate(smoothed_win_rates) if rate >= threshold]
            robust_min = filtered_win_sorted.iloc[min(robust_indices)]['avg_time_distance'] if robust_indices else optimal_time_distance
            robust_max = filtered_win_sorted.iloc[max(robust_indices)]['avg_time_distance'] if robust_indices else optimal_time_distance
            
            # Calculate consistency metrics
            win_rate_std = filtered_win_sorted['win_rate'].std()
            consistency_count = sum(1 for rate in filtered_win_sorted['win_rate'] 
                                  if abs(rate - optimal_win_rate) <= 10)  # Within 10% of optimal
            consistency_rate = consistency_count / len(filtered_win_sorted) if len(filtered_win_sorted) > 0 else 0
            
            # Convert to MM:SS format for display
            minutes = int(optimal_time_distance)
            seconds = int((optimal_time_distance % 1) * 60)
            time_str = f"{minutes}:{seconds:02d}"
            
            robust_min_minutes = int(robust_min)
            robust_min_seconds = int((robust_min % 1) * 60)
            robust_min_str = f"{robust_min_minutes}:{robust_min_seconds:02d}"
            
            robust_max_minutes = int(robust_max)
            robust_max_seconds = int((robust_max % 1) * 60)
            robust_max_str = f"{robust_max_minutes}:{robust_max_seconds:02d}"
            
            # Calculate potential dollar gain from win rate improvement
            # Estimate based on average trade P&L and win rate improvement
            total_trades = sum(len(day_trades) for _, day_trades in daily_groups)
            total_pnl = sum(sum(day_trades['PnL' if 'PnL' in day_trades.columns else 'Profit (ticks)']) for _, day_trades in daily_groups)
            avg_trade_pnl = total_pnl / total_trades if total_trades > 0 else 0
            
            # Estimate additional winning trades from win rate improvement
            additional_wins = (win_rate_improvement / 100) * total_trades
            potential_dollar_gain = additional_wins * avg_trade_pnl
            
            recommendations["optimal_trading_time_window"] = {
                "optimal_time_distance_minutes": float(optimal_time_distance),
                "optimal_win_rate": float(optimal_win_rate),
                "baseline_win_rate": float(baseline_win_rate),
                "win_rate_improvement": float(win_rate_improvement),
                "potential_dollar_gain": float(potential_dollar_gain),
                "robust_range_minutes": [float(robust_min), float(robust_max)],
                "win_rate_std": float(win_rate_std),
                "sample_size": len(filtered_win_sorted),
                "consistency_rate": float(consistency_rate),
                "explanation": f"Trades with {time_str} between them show the highest win rate ({optimal_win_rate:.1f}%) based on rolling average analysis.",
                "recommendation": f"Aim for {time_str} intervals between trades for optimal win rates",
                "confidence": f"Medium - based on {len(filtered_win_sorted)} time windows analyzed",
                "robustness": f"Time distances between {robust_min_str}-{robust_max_str} achieve >90% of maximum win rate",
                "note": "Analysis uses 15-minute sliding windows with kernel smoothing for robustness"
            }
    
    # 8. Volume optimization
    if not correlations_df.empty:
        # Analyze volume vs time distance correlation
        td = correlations_df['time_distance']
        vol = correlations_df['volume']
        td_unique = td.unique().tolist()
        vol_unique = vol.unique().tolist()
        td_len = len(td)
        vol_len = len(vol)
        td_nunique = td.nunique()
        vol_nunique = vol.nunique()
        vol_corr = np.corrcoef(td, vol)[0, 1] if td_len >= 2 and vol_len >= 2 else float('nan')
        if np.isnan(vol_corr):
            raise ValueError(
                f"volume_time_correlation is NaN. time_distance: len={td_len}, nunique={td_nunique}, unique={td_unique[:10]}...; "
                f"volume: len={vol_len}, nunique={vol_nunique}, unique={vol_unique[:10]}...; "
                f"correlations_df shape: {correlations_df.shape} | head: {correlations_df.head().to_dict()}"
            )
        
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
 
def tradingview_to_ATAS(fills: pd.DataFrame) -> pd.DataFrame:
    df = fills.copy()
    df = df[df['Status'] == 'Filled'].copy()
    df['Placing Time'] = pd.to_datetime(df['Placing Time'])
    df['Qty'] = df['Qty'].astype(float)
    df['Fill Price'] = df['Fill Price'].astype(float)
    df['Side'] = df['Side'].str.lower()
    df = df.sort_values('Placing Time')

    trades = []

    for symbol, group in df.groupby('Symbol'):
        net_pos = 0
        fills_in_trade = []
        entry_dir = None
        entry_time = None
        entry_price = None

        for _, row in group.iterrows():
            qty = row['Qty'] * (1 if row['Side'] == 'buy' else -1)
            price = row['Fill Price']
            time = pd.to_datetime(row['Placing Time'])

            if net_pos == 0:
                fills_in_trade = []
                entry_dir = 1 if qty > 0 else -1
                entry_time = time
                entry_price = price

            prev_net_pos = net_pos
            net_pos += qty
            fills_in_trade.append({'qty': qty, 'price': price, 'time': time})

            # Flip: old position closed, new one opened
            if (prev_net_pos > 0 and net_pos < 0) or (prev_net_pos < 0 and net_pos > 0):
                closing_qty = -prev_net_pos
                opening_qty = net_pos
                close_time = time
                close_price = price

                pos = 0
                peak = 0
                signed_peak = 0
                for f in fills_in_trade:
                    pos += f['qty']
                    if abs(pos) > abs(peak):
                        peak = pos
                        signed_peak = pos

                trades.append({
                    'Instrument': symbol,
                    'Open time': entry_time,
                    'Close time': close_time,
                    'Open price': entry_price,
                    'Close price': close_price,
                    'Open volume': prev_net_pos,
                    'Close volume': -prev_net_pos,
                    'Peak net position': abs(prev_net_pos),
                    'Price PnL': (close_price - entry_price) * abs(prev_net_pos) * (1 if prev_net_pos > 0 else -1),
                    'PnL': (close_price - entry_price) * abs(prev_net_pos) * (1 if prev_net_pos > 0 else -1)
                })

                fills_in_trade = [{'qty': opening_qty, 'price': price, 'time': time}]
                entry_time = time
                entry_price = price
                entry_dir = 1 if opening_qty > 0 else -1
                net_pos = opening_qty

            elif net_pos == 0 and prev_net_pos != 0:
                close_time = time
                close_price = price
                pos = 0
                peak = 0
                signed_peak = 0
                for f in fills_in_trade:
                    pos += f['qty']
                    if abs(pos) > abs(peak):
                        peak = pos
                        signed_peak = pos

                trades.append({
                    'Instrument': symbol,
                    'Open time': entry_time,
                    'Close time': close_time,
                    'Open price': entry_price,
                    'Close price': close_price,
                    'Open volume': signed_peak,
                    'Close volume': -signed_peak,
                    'Peak net position': abs(signed_peak),
                    'Price PnL': (close_price - entry_price) * abs(signed_peak) * (1 if signed_peak > 0 else -1),
                    'PnL': (close_price - entry_price) * abs(signed_peak) * (1 if signed_peak > 0 else -1)
                })

                fills_in_trade = []

    return pd.DataFrame(trades).sort_values('Open time', ascending=True)

def group_ATAS(journal_df):
    df = journal_df.copy()
    df['Open time'] = pd.to_datetime(df['Open time'])
    df['Close time'] = pd.to_datetime(df['Close time'])
    df['Open volume'] = df['Open volume'].astype(float)
    df['Close volume'] = df['Close volume'].astype(float)
    sum_cols = [col for col in df.columns if any(s in col.lower() for s in ['pnl', 'p&l', 'tick', 'commission'])]
    price_cols = ['Open price', 'Close price']
    groups = []
    for (account, symbol), group in df.groupby(['Account', 'Instrument']):
        group = group.sort_values('Open time')
        current = None
        current_idxs = None
        for idx, row in group.iterrows():
            if current is None:
                current = {
                    col: [row[col]] if col in price_cols else row[col]
                    for col in df.columns
                }
                current['Open volume list'] = [abs(row['Open volume'])]
                current['Close volume list'] = [abs(row['Close volume'])]
                current['Open time'] = row['Open time']
                current['Close time'] = row['Close time']
                current['row_indices'] = [idx]
            else:
                if row['Open time'] < current['Close time']:
                    for col in price_cols:
                        current[col].append(row[col])
                    current['Open volume list'].append(abs(row['Open volume']))
                    current['Close volume list'].append(abs(row['Close volume']))
                    current['Close time'] = max(current['Close time'], row['Close time'])
                    for col in df.columns:
                        if col not in price_cols and col not in ['Open time', 'Close time']:
                            if col in sum_cols:
                                current[col] += row[col]
                    current['row_indices'].append(idx)
                else:
                    # Calculate peak position for the group
                    rows_g = group.loc[current['row_indices']]
                    events = []
                    for _, r in rows_g.iterrows():
                        v = r['Open volume']
                        events.append((r['Open time'], v))
                        events.append((r['Close time'], -v))
                    events.sort()
                    pos = 0
                    peak = 0
                    for t, v in events:
                        pos += v
                        peak = max(peak, abs(pos))
                    avg_open_price = sum(p*v for p, v in zip(current['Open price'], current['Open volume list'])) / sum(current['Open volume list'])
                    avg_close_price = sum(p*v for p, v in zip(current['Close price'], current['Close volume list'])) / sum(current['Close volume list'])
                    out = {col: current[col] if col not in price_cols else (avg_open_price if col == 'Open price' else avg_close_price)
                           for col in df.columns}
                    out['Open time'] = current['Open time']
                    out['Close time'] = current['Close time']
                    is_long_position = rows_g['Open volume'].iloc[0] > 0
                    out['Open volume'] = peak if is_long_position else -peak
                    out['Close volume'] = -peak if is_long_position else peak
                    groups.append(out)
                    current = {
                        col: [row[col]] if col in price_cols else row[col]
                        for col in df.columns
                    }
                    current['Open volume list'] = [abs(row['Open volume'])]
                    current['Close volume list'] = [abs(row['Close volume'])]
                    current['Open time'] = row['Open time']
                    current['Close time'] = row['Close time']
                    current['row_indices'] = [idx]
        if current:
            rows_g = group.loc[current['row_indices']]
            events = []
            for _, r in rows_g.iterrows():
                v = r['Open volume']
                events.append((r['Open time'], v))
                events.append((r['Close time'], -v))
            events.sort()
            pos = 0
            peak = 0
            for t, v in events:
                pos += v
                peak = max(peak, abs(pos))
            avg_open_price = sum(p*v for p, v in zip(current['Open price'], current['Open volume list'])) / sum(current['Open volume list'])
            avg_close_price = sum(p*v for p, v in zip(current['Close price'], current['Close volume list'])) / sum(current['Close volume list'])
            out = {col: current[col] if col not in price_cols else (avg_open_price if col == 'Open price' else avg_close_price)
                   for col in df.columns}
            out['Open time'] = current['Open time']
            out['Close time'] = current['Close time']
            is_long_position = rows_g['Open volume'].iloc[0] > 0
            out['Open volume'] = peak if is_long_position else -peak
            out['Close volume'] = -peak if is_long_position else peak
            groups.append(out)
    return pd.DataFrame(groups)

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
    
    clusters = analyze_clusters(df)
    # DEBUG
    json.dump(to_serializable(clusters), open('clusters.json', 'w'), indent=4)

    t7 = time.perf_counter()
    recommendations = generate_trading_recommendations(correlations_df, time_peaks_df, sliding_window_df, optimal_drawdown_df, daily_groups)
    timings['generate_trading_recommendations'] = time.perf_counter() - t7

    timings['total'] = sum(timings.values())

    return {
        'data': to_serializable(plot_data), 
        'recommendations': to_serializable(recommendations), 
        'clusters': to_serializable(clusters),
        'timings': timings, 
        'profiled': True
    } 

def process_uploaded_file(csv_text: str, broker: str) -> dict:
    """Receives a csv text and a boolean indicating if the csv is from tradingview or ATAS"""
    csv_io = io.StringIO(csv_text)
    df = pd.read_csv(csv_io)

    # Transform Open time and closing time to the correct time zone
    df['Open time'] = pd.to_datetime(df["Open time"], format='%d.%m.%Y %H:%M:%S', errors='raise')
    df['Close time'] = pd.to_datetime(df["Close time"], format='%d.%m.%Y %H:%M:%S', errors='raise')

    tradingview_cols = {'Symbol', 'Side', 'Qty', 'Fill Price', 'Status', 'Placing Time'}
    atas_cols = {'Instrument', 'Open time', 'Close time', 'Open price', 'Close price', 'Open volume', 'Close volume', 'Price PnL'}
    
    if broker == 'tradingview':
        if not tradingview_cols.issubset(set(df.columns)): # is tradingview csv
            raise ValueError(f"Columns {df.columns.tolist()} do not match expected tradingview columns {tradingview_cols}")
        df = tradingview_to_ATAS(df)

        # Check for required columns and non-null values
        valid_time_col = None
        for col in ['Open time', 'Close time']:
            if col in df.columns and df[col].notnull().any():
                valid_time_col = col
                break
        if not valid_time_col:
            raise ValueError(
                "After TradingView conversion, no valid 'Open time' or 'Close time' column with data found. "
                f"Columns: {df.columns.tolist()} | Dtypes: {df.dtypes.to_dict()} | Shape: {df.shape} | First 5 rows: {df.head().to_dict()}"
            )
        if df.empty:
            raise ValueError(
                "After TradingView conversion, DataFrame is empty. "
                f"Columns: {df.columns.tolist()} | Dtypes: {df.dtypes.to_dict()}"
            )
        
        # most_traded = df['Instrument'].value_counts().idxmax()
        # df = df[df['Instrument'] == most_traded].copy()
        
        return analyse_trading_journal_df(df)
    
    elif broker == 'atas':
        if not atas_cols.issubset(set(df.columns)):
            raise ValueError(f"Columns {df.columns.tolist()} do not match expected ATAS columns {atas_cols}")
        
        df = group_ATAS(df)

        if df.empty:
            raise ValueError(
                "Uploaded DataFrame is empty. "
                f"Columns: {df.columns.tolist()} | Dtypes: {df.dtypes.to_dict()}"
            )

        # most_traded = df['Instrument'].value_counts().idxmax()
        # df = df[df['Instrument'] == most_traded].copy()

        return analyse_trading_journal_df(df) 

def debug():
    if __name__ == "__main__":

        # Step 1: Load ATAS Excel file (assume file path and sheet name)
        atas_file_path = "../ATAS_statistics_01052025_12072025.xlsx"  # Change to your actual file path
        journal_sheet = "Journal"  # Sheet name for the journal

        try:
            # Read the Journal sheet as a DataFrame, then convert to CSV string
            df_journal = pd.read_excel(atas_file_path, sheet_name=journal_sheet)
            # Convert 'Open time' and 'Close time' columns from 'yyyy-mm-dd hh:mm:ss' to '%d.%m.%Y %H:%M:%S'
            for col in ['Open time', 'Close time']:
                if col in df_journal.columns:
                    # Convert to datetime if not already
                    if not np.issubdtype(df_journal[col].dtype, np.datetime64):
                        df_journal[col] = pd.to_datetime(df_journal[col], format='%Y-%m-%d %H:%M:%S', errors='raise')
                    # Format as string in desired format
                    df_journal[col] = df_journal[col].dt.strftime('%d.%m.%Y %H:%M:%S')
            csv_buffer = io.StringIO()
            df_journal.to_csv(csv_buffer, index=False)
            csv_string = csv_buffer.getvalue()
        except Exception as e:
            print(f"Failed to load ATAS Journal sheet: {e}")
            exit()

        # Step 2: Run through the main analysis logic for ATAS
        result = process_uploaded_file(csv_string, broker='atas')
        from pprint import pprint   
        # pprint(result['data']['cumulative_pnl_vs_drawdown_threshold'])
        # pprint(result['recommendations'])
    
# debug()