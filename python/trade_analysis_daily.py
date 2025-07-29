import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
import time
import io
import sys
from scipy import stats
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import silhouette_score
from sklearn.manifold import TSNE
from sklearn.decomposition import PCA
import scipy.stats as stats

# from umap import UMAP
import random
warnings.filterwarnings('ignore')
from dataclasses import dataclass
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.preprocessing import MinMaxScaler


LOCAL_RUN = False
DEBUG = False
DEBUG = True

@dataclass
class TradeAnalysisResults:
    df: pd.DataFrame
    daily_groups: any
    enriched_df: pd.DataFrame
    sliding_window_df: pd.DataFrame
    time_peaks_df: pd.DataFrame
    time_troughs_df: pd.DataFrame
    drawdown_analysis: tuple
    cooldown_seconds_list: np.ndarray
    pnl_by_cooldown: list
    # Add more fields as needed for other heavy metrics

# =====================
# Data Preparation
# =====================
class TradeDataPreparer:
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.daily_groups = None

    def filter_trading_hours(self):
        if 'Open time' in self.df.columns:
            self.df['Open time'] = pd.to_datetime(self.df['Open time'])
            time_col = 'Open time'
        elif 'Close time' in self.df.columns:
            self.df['Open time'] = pd.to_datetime(self.df['Close time'])
            time_col = 'Open time'
        else:
            raise ValueError("No valid time column found.")
        self.df['Time_Only'] = self.df[time_col].dt.time
        start_time = datetime.strptime('00:00', '%H:%M').time()
        end_time = datetime.strptime('23:59', '%H:%M').time()
        self.df = self.df[(self.df['Time_Only'] >= start_time) & (self.df['Time_Only'] <= end_time)].copy()
        self.df = self.df.sort_values('Open time')
        return self

    def group_by_day(self):
        self.df['Date'] = self.df['Open time'].dt.date
        self.daily_groups = self.df.groupby('Date')
        return self

# =====================
# Heavy Computation
# =====================
class TradeAnalysisEngine:
    def __init__(self, preparer: TradeDataPreparer):
        self.df = preparer.df
        self.daily_groups = preparer.daily_groups
        self.enriched_df = None
        self.sliding_window_df = None
        self.time_peaks_df = None
        self.drawdown_analysis = None
        self.cooldown_seconds_list = None
        self.pnl_by_cooldown = None

    def run_all(self):
        self._enrich_data()
        self._analyze_sliding_window_metrics()
        self._peak_and_trough_pnl_by_time_of_day()
        self._analyze_optimal_drawdown_distribution()
        self._compute_cooldown_metrics()
        return self

    def _enrich_data(self):
        """Adds columns to daily groups:
        - time distance in seconds
        - pnl in ticks
        - volume
        - win (1 for win, 0 for loss)
        - holding time in seconds
        """
        all_correlations = []
        for date, day_trades in self.daily_groups:
            if len(day_trades) < 2:
                continue
            # Sort by close time of previous trade, then open time of current trade
            day_trades = day_trades.sort_values(['Close time', 'Open time']).reset_index(drop=True)
            # Calculate time distances between closing time of previous trade and opening time of current trade
            time_distances = []
            pnl_values = []
            volume_values = []
            wins = []
            holding_times = []
            for i in range(1, len(day_trades)):
                
                time_diff = (day_trades.iloc[i]['Open time'] - day_trades.iloc[i-1]['Close time']).total_seconds()
                if time_diff < 0:
                    raise ValueError(f"Time difference of trades is negative at index {i}: {time_diff}")
                time_distances.append(time_diff)
                
                pnl_col = 'Profit (ticks)'
                pnl_values.append(day_trades.iloc[i][pnl_col])
                
                volume_col = 'Open volume'
                volume_values.append(abs(day_trades.iloc[i][volume_col]))
                
                wins.append(1 if day_trades.iloc[i][pnl_col] > 0 else 0)
                
                holding_time = (day_trades.iloc[i]['Close time'] - day_trades.iloc[i]['Open time']).total_seconds()
                holding_times.append(holding_time)
                
            for i, (time_dist, pnl, vol, win, holding_time) in enumerate(zip(time_distances, pnl_values, volume_values, wins, holding_times)):
                all_correlations.append({
                    'date': date,
                    'time_distance': time_dist,
                    'holding_time': holding_time,
                    'pnl': pnl,
                    'volume': vol,
                    'win': win
                })
        self.enriched_df = pd.DataFrame(all_correlations)
        # Compute session assistant features
        self.compute_session_assistant_features()

    def compute_session_assistant_features(self):
        """
        Computes features for real-time session assistant for each trade/session point.
        Features:
        - time_of_day (minutes since midnight)
        - day_of_week (0=Monday)
        - cumulative_pnl (running sum for the day)
        - trade_count (running count for the day)
        - win_rate_so_far (running win rate for the day)
        - avg_trade_duration (running mean for the day)
        - avg_trade_volume (running mean for the day)
        - pnl_std_dev (running std for the day)
        - yesterday_pnl (previous session PnL)
        - pause_since_last_trade (seconds since last trade)
        - minutes_since_session_start (minutes since first trade of the day)
        """
        feature_rows = []
        prev_day_pnl = None
        prev_day = None
        for date, day_trades in self.daily_groups:
            day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
            cumulative_pnl = 0
            trade_count = 0
            win_count = 0
            durations = []
            volumes = []
            pnls = []
            session_start = day_trades.iloc[0]['Open time']
            last_trade_time = None
            for i, row in day_trades.iterrows():
                open_time = row['Open time']
                close_time = row['Close time']
                pnl = row['PnL'] if 'PnL' in row else row.get('Profit (ticks)', 0)
                volume = abs(row['Open volume']) if 'Open volume' in row else 0
                duration = (close_time - open_time).total_seconds() / 60.0  # in minutes
                win = 1 if pnl > 0 else 0
                cumulative_pnl += pnl
                trade_count += 1
                win_count += win
                durations.append(duration)
                volumes.append(volume)
                pnls.append(pnl)
                time_of_day = open_time.hour * 60 + open_time.minute + open_time.second / 60.0
                day_of_week = open_time.weekday()
                win_rate_so_far = win_count / trade_count if trade_count > 0 else 0
                avg_trade_duration = np.mean(durations)
                avg_trade_volume = np.mean(volumes)
                pnl_std_dev = np.std(pnls) if len(pnls) > 1 else 0
                yesterday_pnl = prev_day_pnl if prev_day is not None else 0
                pause_since_last_trade = (open_time - last_trade_time).total_seconds() if last_trade_time is not None else 0
                minutes_since_session_start = (open_time - session_start).total_seconds() / 60.0
                feature_rows.append({
                    'date': date,
                    'index_in_day': i,
                    'time_of_day': time_of_day,
                    'day_of_week': day_of_week,
                    'cumulative_pnl': cumulative_pnl,
                    'trade_count': trade_count,
                    'win_rate_so_far': win_rate_so_far,
                    'avg_trade_duration': avg_trade_duration,
                    'avg_trade_volume': avg_trade_volume,
                    'pnl_std_dev': pnl_std_dev,
                    'yesterday_pnl': yesterday_pnl,
                    'pause_since_last_trade': pause_since_last_trade,
                    'minutes_since_session_start': minutes_since_session_start,
                    'pnl': pnl,  # for label engineering
                    'win': win,  # for label engineering
                    'Open time': open_time,
                    'Close time': close_time
                })
                last_trade_time = open_time
            prev_day_pnl = cumulative_pnl
            prev_day = date
        self.session_assistant_features_df = pd.DataFrame(feature_rows)

    def _analyze_sliding_window_metrics(self, window_minutes=30):
        """Sliding window analysis with vectorized operations.
        Uses adaptive window sizing based on trade density to ensure meaningful statistical samples.
        """
        sliding_window_data = []
        for date, day_trades in self.daily_groups:
            if len(day_trades) < 2:
                continue
            # Sort by open time
            day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
            # Get the start and end times for the day
            day_start = day_trades['Open time'].min()
            day_end = day_trades['Open time'].max()
            
            # Calculate adaptive step size based on trade density
            total_trades_in_day = len(day_trades)
            day_duration_hours = (day_end - day_start).total_seconds() / 3600
            trades_per_hour = total_trades_in_day / day_duration_hours if day_duration_hours > 0 else 0
            
            # Adaptive step size: more trades = smaller steps for finer granularity
            if trades_per_hour >= 10:  # High frequency trading
                step_minutes = 2
            elif trades_per_hour >= 5:  # Medium frequency
                step_minutes = 3
            else:  # Low frequency
                step_minutes = 5
            
            current_time = day_start
            window_end = current_time + timedelta(minutes=window_minutes)
            
            while window_end <= day_end:
                window_mask = (day_trades['Open time'] >= current_time) & (day_trades['Open time'] < window_end)
                window_trades = day_trades[window_mask]
                if len(window_trades) > 0:
                    pnl_col = 'Profit (ticks)' if 'Profit (ticks)' in window_trades.columns else 'PnL'
                    pnl_values = window_trades[pnl_col].values
                    
                    # Check for NaN or infinite values in PnL - this should not happen
                    if np.any(np.isnan(pnl_values)) or np.any(np.isinf(pnl_values)):
                        print(f"ERROR: Found NaN or infinite PnL values in window trades:")
                        print(f"  Window: {current_time} to {window_end}")
                        print(f"  PnL values: {pnl_values}")
                        print(f"  Window trades columns: {window_trades.columns.tolist()}")
                        print(f"  Window trades shape: {window_trades.shape}")
                        raise ValueError(f"NaN or infinite PnL values found in window trades. This indicates a data processing error.")
                    
                    wins = (pnl_values > 0).sum()
                    total_trades = len(pnl_values)
                    win_rate = (wins / total_trades * 100) if total_trades > 0 else 0
                    avg_pnl = np.mean(pnl_values) if len(pnl_values) > 0 else 0
                    
                    volume_col = 'Open volume' if 'Open volume' in window_trades.columns else None
                    if volume_col:
                        volume_values = window_trades[volume_col].values
                        valid_volume_mask = ~np.isnan(volume_values) & ~np.isinf(volume_values)
                        valid_volume_values = volume_values[valid_volume_mask]
                        total_volume = abs(np.sum(valid_volume_values)) if len(valid_volume_values) > 0 else 0
                    else:
                        total_volume = 0
                    
                    # Time distance between trades in window
                    window_inter_trade_times = []
                    if len(window_trades) > 1:
                        for i in range(1, len(window_trades)):
                            time_diff = (window_trades.iloc[i]['Open time'] - window_trades.iloc[i-1]['Open time']).total_seconds()
                            window_inter_trade_times.append(time_diff)
                        avg_time_distance = np.mean(window_inter_trade_times)
                    else:
                        avg_time_distance = 0
                    
                    # Calculate statistical significance of the win rate
                    # Use Wilson score interval for small sample sizes
                    if total_trades > 0:
                        p_hat = wins / total_trades
                        z = 1.96  # 95% confidence interval
                        denominator = 1 + z**2 / total_trades
                        centre_adjusted_probability = (p_hat + z * z / (2 * total_trades)) / denominator
                        adjusted_interval = z * np.sqrt((p_hat * (1 - p_hat) + z * z / (4 * total_trades)) / total_trades) / denominator
                        confidence_interval_width = 2 * adjusted_interval
                        # Lower confidence interval width = higher statistical significance
                        statistical_significance = 1 - min(confidence_interval_width, 1)
                    else:
                        statistical_significance = 0
                    
                    sliding_window_data.append({
                        'date': date,
                        'window_start': current_time,
                        'window_end': window_end,
                        'window_center': current_time + timedelta(minutes=window_minutes/2),
                        'trades_in_window': total_trades,
                        'win_rate': win_rate,
                        'avg_pnl': avg_pnl,
                        'total_volume': total_volume,
                        'avg_time_distance': avg_time_distance,
                        'window_inter_trade_times': window_inter_trade_times,
                        'statistical_significance': statistical_significance
                    })
                current_time += timedelta(minutes=step_minutes)
                window_end = current_time + timedelta(minutes=window_minutes)
            self.sliding_window_df = pd.DataFrame(sliding_window_data)

    def _peak_and_trough_pnl_by_time_of_day(self):
        """Vectorized cumulative PnL analysis for both peaks and troughs."""
        time_peaks = []
        time_troughs = []
        for date, day_trades in self.daily_groups:
            if len(day_trades) < 2:
                continue
            # Sort by open time
            day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
            # Calculate cumulative P&L using numpy for speed
            pnl_col = 'PnL'
            pnl_values = day_trades[pnl_col].values
            cumulative_pnl = np.cumsum(pnl_values)
            
            # Find peak (best cumulative PnL)
            peak_idx = np.argmax(cumulative_pnl)
            peak_time = day_trades.iloc[peak_idx]['Open time']
            peak_pnl = max(0, cumulative_pnl[peak_idx])
            time_peaks.append({
                'date': date,
                'peak_time': peak_time,
                'peak_pnl': peak_pnl,
                'trades_to_peak': peak_idx + 1
            })
            
            # Find trough (worst cumulative PnL)
            trough_idx = np.argmin(cumulative_pnl)
            trough_time = day_trades.iloc[trough_idx]['Open time']
            trough_pnl = min(0, cumulative_pnl[trough_idx])
            time_troughs.append({
                'date': date,
                'trough_time': trough_time,
                'trough_pnl': trough_pnl,
                'trades_to_trough': trough_idx + 1
            })
            
        self.time_peaks_df = pd.DataFrame(time_peaks)
        self.time_troughs_df = pd.DataFrame(time_troughs)

    def _analyze_optimal_drawdown_distribution(self, only_positive_days=False):
        """For each drawdown threshold, sum the resulting P&Ls across all days."""
        drawdown_percentages = np.arange(5, 101, 5)  # 5% to 100% in 5% steps
        # If only_positive_days is True, first identify which days have positive final P&L
        positive_days = set()
        if only_positive_days:
            for date, day_trades in self.daily_groups:
                if len(day_trades) < 2:
                    continue
                day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
                pnl_col = 'PnL'
                total_pnl = day_trades[pnl_col].sum()
                if total_pnl > 0:
                    positive_days.add(date)
        total_pnls = []
        for drawdown_pct in drawdown_percentages:
            total_pnl = 0
            for date, day_trades in self.daily_groups:
                if len(day_trades) < 2:
                    continue
                # Skip days that aren't in positive_days if only_positive_days is True
                if only_positive_days and date not in positive_days:
                    continue
                day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
                pnl_col = 'PnL'
                pnl_values = day_trades[pnl_col].values
                # Vectorized simulation
                cumulative_pnl = 0
                running_peak = 0
                for trade_pnl in pnl_values:
                    cumulative_pnl += trade_pnl
                    running_peak = max(running_peak, cumulative_pnl)
                    if running_peak > 0:
                        current_drawdown = (running_peak - cumulative_pnl) / running_peak * 100
                    else:
                        current_drawdown = 0
                    if current_drawdown >= drawdown_pct:
                        break
                total_pnl += cumulative_pnl
            total_pnls.append(total_pnl)
        self.drawdown_analysis = (drawdown_percentages, total_pnls)

    def _compute_cooldown_metrics(self):
        """Compute cooldown PnL series."""
        # Find the maximum time distance in the data to set a reasonable upper limit
        max_time_distance = self.sliding_window_df['avg_time_distance'].max() if not self.sliding_window_df.empty else 600
        # Use 80% of max time distance as upper limit, with minimum of 600 seconds (10 minutes)
        upper_limit = max(600, int(max_time_distance * 0.8))
        self.cooldown_seconds_list = np.arange(0, upper_limit + 1, 15)  # 0 to upper_limit in 15-sec steps
        self.pnl_by_cooldown = self._simulate_cooldown_metric(self.cooldown_seconds_list, metric_col='PnL', agg='sum')

    def _simulate_cooldown_metric(self, cooldown_seconds_list, metric_col='PnL', agg='sum'):
        """Vectorized cooldown simulation for any metric using walk-forward analysis."""
        results = []
        for cooldown in cooldown_seconds_list:
            if metric_col == 'win_rate':
                # Special handling for win rate - compute from filtered trades
                total_wins = 0
                total_trades = 0
                for _, day_trades in self.daily_groups:
                    if len(day_trades) < 2:
                        continue
                    day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
                    # Walk-forward analysis for cooldown simulation
                    selected_indices = []
                    last_trade_close_time = None
                    for i in range(len(day_trades)):
                        curr_open = day_trades.loc[i, 'Open time']
                        if last_trade_close_time is None or (curr_open - last_trade_close_time).total_seconds() >= cooldown:
                            selected_indices.append(i)
                            last_trade_close_time = day_trades.loc[i, 'Close time']
                    filtered = day_trades.loc[selected_indices]
                    
                    if len(filtered) > 0:
                        # Use 'Profit (ticks)' column for win/loss determination
                        pnl_col = 'Profit (ticks)' if 'Profit (ticks)' in filtered.columns else 'PnL'
                        pnl_values = filtered[pnl_col].values
                        
                        # Check for NaN or infinite values
                        if np.any(np.isnan(pnl_values)) or np.any(np.isinf(pnl_values)):
                            print(f"ERROR: Found NaN or infinite values in PnL during win rate calculation:")
                            print(f"  Cooldown: {cooldown} seconds")
                            print(f"  Values: {pnl_values}")
                            raise ValueError(f"NaN or infinite values found in PnL during win rate calculation.")
                        
                        wins = (pnl_values > 0).sum()
                        total_wins += wins
                        total_trades += len(pnl_values)
                
                win_rate = (total_wins / total_trades * 100) if total_trades > 0 else 0
                results.append(win_rate)
            elif metric_col == 'pnl_std':
                # Special handling for PnL standard deviation - compute from filtered trades
                all_pnl_values = []
                for _, day_trades in self.daily_groups:
                    if len(day_trades) < 2:
                        continue
                    day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
                    # Walk-forward analysis for cooldown simulation
                    selected_indices = []
                    last_trade_close_time = None
                    for i in range(len(day_trades)):
                        curr_open = day_trades.loc[i, 'Open time']
                        if last_trade_close_time is None or (curr_open - last_trade_close_time).total_seconds() >= cooldown:
                            selected_indices.append(i)
                            last_trade_close_time = day_trades.loc[i, 'Close time']
                    filtered = day_trades.loc[selected_indices]
                    
                    if len(filtered) > 0:
                        # Use 'Profit (ticks)' column for PnL values
                        pnl_col = 'Profit (ticks)' if 'Profit (ticks)' in filtered.columns else 'PnL'
                        pnl_values = filtered[pnl_col].values
                        
                        # Check for NaN or infinite values
                        if np.any(np.isnan(pnl_values)) or np.any(np.isinf(pnl_values)):
                            print(f"ERROR: Found NaN or infinite values in PnL during standard deviation calculation:")
                            print(f"  Cooldown: {cooldown} seconds")
                            print(f"  Values: {pnl_values}")
                            raise ValueError(f"NaN or infinite values found in PnL during standard deviation calculation.")
                        
                        all_pnl_values.extend(pnl_values)
                
                # Calculate standard deviation across all filtered trades
                pnl_std = np.std(all_pnl_values) if len(all_pnl_values) > 1 else 0
                results.append(pnl_std)
            elif metric_col == 'sample_size':
                # Special handling for sample size - count total number of filtered trades
                total_trades = 0
                for _, day_trades in self.daily_groups:
                    if len(day_trades) < 2:
                        continue
                    day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
                    # Walk-forward analysis for cooldown simulation
                    selected_indices = []
                    last_trade_close_time = None
                    for i in range(len(day_trades)):
                        curr_open = day_trades.loc[i, 'Open time']
                        if last_trade_close_time is None or (curr_open - last_trade_close_time).total_seconds() >= cooldown:
                            selected_indices.append(i)
                            last_trade_close_time = day_trades.loc[i, 'Close time']
                    filtered = day_trades.loc[selected_indices]
                    total_trades += len(filtered)
                
                results.append(total_trades)
            else:
                # Standard metric calculation
                total_metric = 0
                for _, day_trades in self.daily_groups:
                    if len(day_trades) < 2:
                        continue
                    day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
                    # Walk-forward analysis for cooldown simulation
                    selected_indices = []
                    last_trade_close_time = None
                    for i in range(len(day_trades)):
                        curr_open = day_trades.loc[i, 'Open time']
                        if last_trade_close_time is None or (curr_open - last_trade_close_time).total_seconds() >= cooldown:
                            selected_indices.append(i)
                            last_trade_close_time = day_trades.loc[i, 'Close time']
                    filtered = day_trades.loc[selected_indices]
                    vals = filtered[metric_col].values
                    
                    # Check for NaN or infinite values in the metric column
                    if np.any(np.isnan(vals)) or np.any(np.isinf(vals)):
                        print(f"ERROR: Found NaN or infinite values in metric '{metric_col}' during cooldown simulation:")
                        print(f"  Cooldown: {cooldown} seconds")
                        print(f"  Values: {vals}")
                        print(f"  Filtered trades shape: {filtered.shape}")
                        print(f"  Filtered trades columns: {filtered.columns.tolist()}")
                        raise ValueError(f"NaN or infinite values found in metric '{metric_col}' during cooldown simulation. This indicates a data processing error.")
                    
                    if agg == 'sum':
                        total_metric += np.sum(vals)
                    elif agg == 'mean':
                        total_metric += np.mean(vals) if len(vals) > 0 else 0
                    elif agg == 'count':
                        total_metric += len(vals)
                    elif agg == 'std':
                        # Calculate standard deviation for the current day's trades
                        day_std = np.std(vals) if len(vals) > 1 else 0
                        total_metric += day_std
                    else:
                        raise ValueError(f"Unknown aggregation: {agg}")
                results.append(total_metric)
        return results

    # Keep static methods only for utility functions that don't operate on instance state
    @staticmethod
    def pareto_front(points, maximize=None):
        """Compute the Pareto front for a set of N-dimensional points."""
        if maximize is None:
            maximize = {k: True for k in points[0].keys() if k != 'break_time'}
                
        pareto = []
        for i, p in enumerate(points):
            dominated = False
            for j, q in enumerate(points):
                if i == j:
                    continue
                
                # Check if q dominates p
                q_dominates_p = True
                q_strictly_better = False
                
                for k in maximize:
                    if maximize[k]:
                        # For maximization: q dominates p if q[k] >= p[k] for all k, and q[k] > p[k] for at least one k
                        if q[k] < p[k]:
                            q_dominates_p = False
                            break
                        elif q[k] > p[k]:
                            q_strictly_better = True
                    else:
                        # For minimization: q dominates p if q[k] <= p[k] for all k, and q[k] < p[k] for at least one k
                        if q[k] > p[k]:
                            q_dominates_p = False
                            break
                        elif q[k] < p[k]:
                            q_strictly_better = True
                
                if q_dominates_p and q_strictly_better:
                    dominated = True
                    break
            
            if not dominated:
                pareto.append(i)
        
        return pareto

    def recommend_break_time_multi(self, metrics=None, cooldown_seconds_list=None) -> dict:
        """For each possible break duration, compute metrics using walk-forward analysis."""
        if cooldown_seconds_list is None:
            cooldown_seconds_list = np.arange(0, 1801, 15)  # 0 to 1800 seconds (30 min)
        if metrics is None:
            metrics = [
                {'name': 'PnL', 'agg': 'sum', 'maximize': True},
            ]
        
        # Compute all metrics using walk-forward analysis
        metric_results = {}
        for metric in metrics:
            metric_name = metric['name']
            agg = metric.get('agg', 'sum')
            metric_results[metric_name] = self._simulate_cooldown_metric(cooldown_seconds_list, metric_col=metric_name, agg=agg)
        
        # Combine results into the expected format
        all_results = []
        for idx, cooldown in enumerate(cooldown_seconds_list):
            result = {'break_time': cooldown}
            for metric_name, values in metric_results.items():
                result[metric_name] = values[idx]
            all_results.append(result)
        
        # Filter out results with NaN or infinite values
        valid_results = []
        for result in all_results:
            is_valid = True
            for metric_name in metric_results.keys():
                if pd.isna(result[metric_name]) or np.isinf(result[metric_name]):
                    is_valid = False
                    break
            if is_valid:
                valid_results.append(result)
        
        # Log how many results were filtered out
        if len(valid_results) < len(all_results):
            print(f"INFO: Filtered out {len(all_results) - len(valid_results)} results with NaN/infinite values from Pareto front calculation")
            print(f"INFO: {len(valid_results)} valid results remaining for Pareto front analysis")
        
        # Compute Pareto front with proper optimization direction for each metric
        if len(valid_results) > 0:
            # Define which metrics should be maximized vs minimized from the metrics configuration
            maximize = {}
            for metric in metrics:
                metric_name = metric['name']
                maximize[metric_name] = metric.get('maximize', True)  # Default to maximize if not specified
            pareto_idx = self.pareto_front(valid_results, maximize)
            pareto_points = [valid_results[i] for i in pareto_idx]
        else:
            pareto_points = []
        
        # Best break time per metric
        best_per_metric = {}
        for metric in metrics:
            metric_name = metric['name']
            vals = [r[metric_name] for r in valid_results if not pd.isna(r[metric_name]) and not np.isinf(r[metric_name])]
            if vals:
                if maximize[metric_name]:
                    best_idx = np.argmax(vals)
                else:
                    best_idx = np.argmin(vals)
                # Find the corresponding break time for this best value
                for result in valid_results:
                    if result[metric_name] == vals[best_idx]:
                        best_per_metric[metric_name] = result['break_time']
                        break
            else:
                best_per_metric[metric_name] = 0  # Default if no valid values
        
        # Find the Pareto front point closest to global optima across all dimensions
        best_balanced_point = None
        if pareto_points and len(pareto_points) > 0:
            # Calculate global optima for each metric
            global_optima = {}
            for metric in metrics:
                metric_name = metric['name']
                vals = [r[metric_name] for r in valid_results if not pd.isna(r[metric_name]) and not np.isinf(r[metric_name])]
                if vals:
                    if maximize[metric_name]:
                        global_optima[metric_name] = max(vals)
                    else:
                        global_optima[metric_name] = min(vals)
            
            # Calculate normalized distance to global optima for each Pareto front point
            best_score = float('inf')
            for pareto_point in pareto_points:
                total_normalized_distance = 0
                valid_metrics = 0
                
                for metric in metrics:
                    metric_name = metric['name']
                    if metric_name in pareto_point and metric_name in global_optima:
                        # Calculate normalized distance (0 = at global optimum, 1 = worst possible)
                        current_val = pareto_point[metric_name]
                        global_opt = global_optima[metric_name]
                        
                        # Get the range of values for this metric to normalize
                        all_vals = [r[metric_name] for r in valid_results if not pd.isna(r[metric_name]) and not np.isinf(r[metric_name])]
                        if all_vals:
                            metric_range = max(all_vals) - min(all_vals)
                            if metric_range > 0:
                                # Normalized distance: how far from global optimum as fraction of total range
                                distance = abs(current_val - global_opt) / metric_range
                                total_normalized_distance += distance
                                valid_metrics += 1
                
                # Average normalized distance across all metrics
                if valid_metrics > 0:
                    avg_normalized_distance = total_normalized_distance / valid_metrics
                    if avg_normalized_distance < best_score:
                        best_score = avg_normalized_distance
                        best_balanced_point = pareto_point
        
        vanilla_pnl = sum(sum(day_trades['PnL']) for _, day_trades in self.daily_groups)
        
        metric_to_name = {
            'PnL': 'P&L',
            'win_rate': 'Win Rate',
            'pnl_std': 'P&L Std Dev',
            'sample_size': 'Sample Size'
        }
        
        return {
            'pareto_front': pareto_points,
            'best_per_metric': best_per_metric,
            'best_balanced_point': best_balanced_point,
            'potential_dollar_gain': best_balanced_point['PnL'] - vanilla_pnl if best_balanced_point else 0,
            'all_results': all_results,
            'metrics': [metric_to_name[metric['name']] for metric in metrics]
        }

    def recommend_drawdown_percentage(self):
        """Find the drawdown percentage that maximizes overall cumulative P&L, and check for ego trading (excessive drawdown)."""
        drawdown_percentages, total_pnls = self.drawdown_analysis
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
        vanilla_pnl = sum(sum(day_trades['PnL']) for _, day_trades in self.daily_groups)
        pnl_improvement = optimal_cumulative_pnl - vanilla_pnl
        # Find robust range (drawdown percentages that achieve >95% of max P&L)
        max_pnl = max(total_pnls)
        threshold = max_pnl * 0.95
        robust_indices = [i for i, pnl in enumerate(total_pnls) if pnl >= threshold]
        robust_min = drawdown_percentages[min(robust_indices)] if robust_indices else optimal_drawdown_pct
        robust_max = drawdown_percentages[max(robust_indices)] if robust_indices else optimal_drawdown_pct
        # Ego trading analysis: for each day, compute actual max drawdown as % of peak, compare to optimal
        # First, compute the 25th percentile of all daily peak PnLs
        daily_peaks = []
        for date, day_trades in self.daily_groups:
            if len(day_trades) < 2:
                continue
            day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
            pnl_col = 'PnL'
            pnl_values = day_trades[pnl_col].values
            cumulative_pnl = np.cumsum(pnl_values)
            peak_pnl = np.max(cumulative_pnl)
            daily_peaks.append(peak_pnl)
        if daily_peaks:
            profit_threshold = np.percentile(daily_peaks, 50)
        else:
            profit_threshold = 0
        ego_trading_ratios = []
        for date, day_trades in self.daily_groups:
            if len(day_trades) < 2:
                continue
            day_trades = day_trades.sort_values('Open time').reset_index(drop=True)
            pnl_col = 'PnL'
            pnl_values = day_trades[pnl_col].values
            cumulative_pnl = np.cumsum(pnl_values)
            peak_pnl = np.max(cumulative_pnl)
            if peak_pnl < profit_threshold or peak_pnl <= 0:
                continue  # Only count days where a significant profit was reached
            # Compute running peak and max drawdown
            running_peak = 0
            max_drawdown = 0
            cumulative = 0
            for trade_pnl in pnl_values:
                cumulative += trade_pnl
                running_peak = max(running_peak, cumulative)
                if running_peak > 0:
                    current_drawdown = (running_peak - cumulative) / running_peak * 100
                else:
                    current_drawdown = 0
                max_drawdown = max(max_drawdown, current_drawdown)
            ego_trading_ratios.append(max_drawdown / optimal_drawdown_pct if optimal_drawdown_pct > 0 else 0)
        ego_trading_avg = float(np.mean(ego_trading_ratios)) if ego_trading_ratios else 0.0
        ego_trading_median = float(np.median(ego_trading_ratios)) if ego_trading_ratios else 0.0
        # User-facing summary
        if ego_trading_avg > 1.5:
            ego_trading_summary = f"Ego trading detected: On average, you accepted drawdowns {round(ego_trading_avg*100)}% of the optimal limit. This means you often let losses run far beyond the recommended stop. Consider stopping earlier to protect your capital. (Only counting days where you first reached at least ${profit_threshold:,.0f} in profit.)"
        elif ego_trading_avg > 1.1:
            ego_trading_summary = f"Mild ego trading: On average, your drawdowns were {round(ego_trading_avg*100)}% of the optimal. Try to respect your stop more strictly. (Only counting days where you first reached at least ${profit_threshold:,.0f} in profit.)"
        else:
            ego_trading_summary = f"No significant ego trading detected: Most days, you respected the optimal drawdown limit. (Only counting days where you first reached at least ${profit_threshold:,.0f} in profit.)"
        return {
            "percentage": float(optimal_drawdown_pct),
            "mean_percentage": np.nan,
            "std_percentage": np.nan,
            "confidence_interval_95": [float(robust_min), float(robust_max)],
            "sample_size": len(self.daily_groups),
            "consistency_rate": np.nan,
            "potential_dollar_gain": float(pnl_improvement),  # Improvement over vanilla P&L
            "vanilla_pnl": float(vanilla_pnl),
            "optimal_pnl": float(optimal_cumulative_pnl),
            "explanation": f"Stop trading when daily drawdown reaches {optimal_drawdown_pct:.1f}% of the day's peak P&L. This maximizes overall cumulative P&L across all trading days in a robust way.",
            "confidence": f"?",
            "robustness": f"Drawdown thresholds between {robust_min:.1f}%-{robust_max:.1f}% achieve >95% of maximum P&L",
            "ego_trading_avg": ego_trading_avg,
            "ego_trading_median": ego_trading_median,
            "ego_trading_ratios": ego_trading_ratios,
            "ego_trading_summary": ego_trading_summary
        }
    
    def recommend_max_trades_per_day(self):
        """Analyze trades to peak distribution using vectorized operations, and check for overtrading."""
        median_trades_to_peak = np.median(self.time_peaks_df['trades_to_peak'])
        mean_trades_to_peak = np.mean(self.time_peaks_df['trades_to_peak'])
        std_trades_to_peak = np.std(self.time_peaks_df['trades_to_peak'])
        # Calculate average trades per day
        total_trades = sum(len(day_trades) for _, day_trades in self.daily_groups)
        total_days = len(self.daily_groups)
        avg_trades_per_day = total_trades / total_days if total_days > 0 else 0
        # Calculate confidence interval for trades to peak
        n_peaks = len(self.time_peaks_df)
        if n_peaks > 1:
            se_peaks = std_trades_to_peak / np.sqrt(n_peaks)
            ci_95_peaks = stats.t.interval(0.95, df=n_peaks-1, loc=mean_trades_to_peak, scale=se_peaks)
        else:
            ci_95_peaks = (mean_trades_to_peak, mean_trades_to_peak)
        # Calculate how often the recommendation would have been optimal
        optimal_count = sum(1 for trades in self.time_peaks_df['trades_to_peak'] 
                    if abs(trades - median_trades_to_peak) <= 2)  # Within 2 trades of median
        optimal_rate = optimal_count / n_peaks if n_peaks > 0 else 0

        # --- Overtrading analysis ---
        overtrading_ratios = []
        for idx, row in self.time_peaks_df.iterrows():
            date = row['date']
            trades_to_peak = row['trades_to_peak']
            # Find total trades for this day
            if date in self.daily_groups.groups:
                total_trades_day = len(self.daily_groups.get_group(date))
            else:
                # fallback: try to count in df
                total_trades_day = len(self.df[self.df['Open time'].dt.date == date])
            if trades_to_peak > 0:
                overtrading = (total_trades_day - trades_to_peak) / trades_to_peak
                overtrading_ratios.append(overtrading)
        overtrading_avg = float(np.mean(overtrading_ratios)) if overtrading_ratios else 0.0
        overtrading_median = float(np.median(overtrading_ratios)) if overtrading_ratios else 0.0
        # User-facing summary
        if overtrading_avg > 0.1:
            overtrading_summary = f"Potential overtrading detected: On average, you placed {overtrading_avg*100:.1f}% more trades after reaching peak P&L. Consider reducing your trades to the suggested amount."
        elif overtrading_avg > 0.02:
            overtrading_summary = f"Mild overtrading: On average, you placed {overtrading_avg*100:.1f}% more trades after peak P&L."
        else:
            overtrading_summary = "No significant overtrading detected: Most days, you stopped trading soon after reaching your daily peak."
            
        return {
            "median_trades_to_peak": float(median_trades_to_peak),
            "mean_trades_to_peak": float(mean_trades_to_peak),
            "std_trades_to_peak": float(std_trades_to_peak),
            "confidence_interval_95": [float(ci_95_peaks[0]), float(ci_95_peaks[1])],
            "current_avg_trades_per_day": float(avg_trades_per_day),
            "sample_size": n_peaks,
            "optimal_rate": float(optimal_rate),
            "recommendation": f"Consider limiting to {median_trades_to_peak:.0f} trades per day, as this is the median number of trades needed to reach peak P&L.",
            "explanation": f"Based on analysis of when cumulative P&L typically peaks during trading days, the most common range is {int(ci_95_peaks[0])} - {int(np.ceil(ci_95_peaks[1]))} trades to reach peak P&L.",
            "confidence": f"?",
            "robustness": f"95% confidence interval: {ci_95_peaks[0]:.1f}-{ci_95_peaks[1]:.1f} trades",
            "overtrading_avg": overtrading_avg,
            "overtrading_median": overtrading_median,
            "overtrading_ratios": overtrading_ratios,
            "overtrading_summary": overtrading_summary
        }
    
    # todo optimise dbscan parameters like in analyze_clusters_tsne_kmeans
    def recommend_optimal_trading_hours(self):
        """Analyze both peak and trough time distributions using DBSCAN clustering to find optimal and avoidable trading windows."""
        # Analyze peak times (best cumulative PnL)
        peak_hours = [t.hour + t.minute/60 for t in self.time_peaks_df['peak_time']]
        peak_times = [t.strftime('%H:%M') for t in self.time_peaks_df['peak_time']]
        peak_pnls = self.time_peaks_df['peak_pnl'].tolist()
        
        # Analyze trough times (worst cumulative PnL)
        trough_hours = [t.hour + t.minute/60 for t in self.time_troughs_df['trough_time']]
        trough_times = [t.strftime('%H:%M') for t in self.time_troughs_df['trough_time']]
        trough_pnls = self.time_troughs_df['trough_pnl'].tolist()
        
        # Function to perform DBSCAN clustering on time data
        def cluster_times(hours, times, pnls, data_type):
            if len(hours) < 3:
                return [], None, f"Insufficient {data_type} data for clustering analysis."
            
            # Convert hours to minutes for clustering
            time_minutes = np.array(hours) * 60
            X = time_minutes.reshape(-1, 1)
            
            # Try different eps values to find good clustering
            best_labels = None
            best_n_clusters = 0
            best_eps = None
            
            for eps in [15, 30, 45, 60, 90, 120]:  # Try different time windows (15min to 2hours)
                dbscan = DBSCAN(eps=eps, min_samples=2)
                labels = dbscan.fit_predict(X)
                
                # Count clusters (excluding noise points labeled as -1)
                n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
                
                # Prefer clustering with 2-4 clusters and not too many noise points
                n_noise = list(labels).count(-1)
                noise_ratio = n_noise / len(labels)
                
                if 2 <= n_clusters <= 4 and noise_ratio < 0.3:  # Accept up to 30% noise
                    if best_labels is None or (n_clusters > best_n_clusters and noise_ratio < 0.2):
                        best_labels = labels.copy()
                        best_eps = eps
                        best_n_clusters = n_clusters
            
            # If no good clustering found, use the one with most clusters
            if best_labels is None:
                for eps in [15, 30, 45, 60, 90, 120]:
                    dbscan = DBSCAN(eps=eps, min_samples=2)
                    labels = dbscan.fit_predict(X)
                    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
                    if n_clusters > best_n_clusters:
                        best_labels = labels.copy()
                        best_eps = eps
                        best_n_clusters = n_clusters
            
            # Create cluster details from DBSCAN clustering
            cluster_details = []
            unique_labels = set(best_labels)
            
            for label in unique_labels:
                if label == -1:  # Skip noise points
                    continue
                    
                cluster_indices = np.where(best_labels == label)[0]
                if len(cluster_indices) > 0:
                    cluster_times = [times[j] for j in cluster_indices]
                    cluster_pnls = [pnls[j] for j in cluster_indices]
                    cluster_hours = [hours[j] for j in cluster_indices]
                    
                    # Calculate cluster boundaries (30-minute intervals)
                    min_hour = min(cluster_hours)
                    max_hour = max(cluster_hours)
                    
                    # Round to 5-minute intervals
                    start_minutes = int(min_hour * 60) // 5 * 5
                    end_minutes = int(max_hour * 60 + 5) // 5 * 5

                    start_hour = start_minutes // 60
                    start_minute = start_minutes % 60
                    end_hour = end_minutes // 60
                    end_minute = end_minutes % 60
                    
                    cluster_start = f"{start_hour:02d}:{start_minute:02d}"
                    cluster_end = f"{end_hour:02d}:{end_minute:02d}"
                    
                    total_pnl = sum(cluster_pnls)
                    details = [{"time": time_str, "pnl": pnl} for time_str, pnl in zip(cluster_times, cluster_pnls)]
                    
                    cluster_details.append({
                        "start_time": cluster_start,
                        "end_time": cluster_end,
                        "total_pnl": total_pnl,
                        "count": len(cluster_times),
                        "details": details
                    })
            
            # Sort clusters by absolute total PnL (for peaks: highest first, for troughs: lowest first)
            if data_type == "peak":
                cluster_details.sort(key=lambda x: x['total_pnl'], reverse=True)
            else:  # trough
                cluster_details.sort(key=lambda x: x['total_pnl'], reverse=False)
            
            # Calculate total PnL across all clusters for percentage calculation
            total_pnl_all_clusters = sum(cluster['total_pnl'] for cluster in cluster_details)
            
            # Add percentage to each cluster
            for cluster in cluster_details:
                cluster['percentage'] = round((cluster['total_pnl'] / total_pnl_all_clusters) * 100, 1)
            
            # Filter out clusters with less than 10% of data
            cluster_details = [cluster for cluster in cluster_details if abs(cluster['percentage']) >= 10.0]
            
            return cluster_details, best_eps, None
        
        # Perform clustering for both peaks and troughs
        peak_clusters, peak_eps, peak_error = cluster_times(peak_hours, peak_times, peak_pnls, "peak")
        trough_clusters, trough_eps, trough_error = cluster_times(trough_hours, trough_times, trough_pnls, "trough")
        
        # Get the biggest clusters
        biggest_peak_cluster = peak_clusters[0] if peak_clusters else None
        biggest_trough_cluster = trough_clusters[0] if trough_clusters else None
        
        # Create explanations
        if peak_error:
            peak_explanation = peak_error
        elif len(peak_clusters) >= 2:
            peak_explanation = f"Peak cumulative P&L is concentrated in {len(peak_clusters)} distinct trading sessions. The most significant window accounts for {biggest_peak_cluster['percentage']}% of total peak P&L. Focus trading activity during these identified time windows for optimal performance."
        elif len(peak_clusters) == 1:
            peak_explanation = f"Peak cumulative P&L is highly concentrated in a single trading session, accounting for {biggest_peak_cluster['percentage']}% of total peak P&L. Focus trading activity during this time window for optimal performance."
        else:
            peak_explanation = "No significant peak clusters found."
        
        if trough_error:
            trough_explanation = trough_error
        elif len(trough_clusters) >= 2:
            trough_explanation = f"Trough cumulative P&L is concentrated in {len(trough_clusters)} distinct trading sessions. The most significant window accounts for {biggest_trough_cluster['percentage']}% of total trough P&L. Avoid trading activity during these identified time windows."
        elif len(trough_clusters) == 1:
            trough_explanation = f"Trough cumulative P&L is highly concentrated in a single trading session, accounting for {biggest_trough_cluster['percentage']}% of total trough P&L. Avoid trading activity during this time window."
        else:
            trough_explanation = "No significant trough clusters found."
        
        # Calculate optimal range for peaks
        if peak_clusters:
            start_times = [cluster['start_time'] for cluster in peak_clusters]
            end_times = [cluster['end_time'] for cluster in peak_clusters]
            optimal_range = [min(start_times), max(end_times)]
        else:
            optimal_range = ["00:00", "00:00"]
        
        return {
            "average_peak_time": f"{biggest_peak_cluster['start_time']}-{biggest_peak_cluster['end_time']}" if biggest_peak_cluster else "N/A",
            "std_peak_hour": float(np.std(peak_hours)) if peak_hours else 0,
            "confidence_interval_95": optimal_range,
            "sample_size": len(peak_hours),
            "consistency_rate": float(len(peak_clusters) / len(peak_hours)) if peak_hours else 0,
            "explanation": peak_explanation,
            "recommendation": "Focus trading activity in the identified peak time windows and avoid the identified trough time windows",
            "confidence": f"?",
            "robustness": f"DBSCAN clustering (peak eps={peak_eps}min, trough eps={trough_eps}min) identified {len(peak_clusters)} optimal and {len(trough_clusters)} avoidable windows",
            "peak_clusters": peak_clusters,
            "trough_clusters": trough_clusters,
            "trough_explanation": trough_explanation
        }
    
    def recommend_optimal_win_rate_window(self):
        """Find time windows with highest win rates."""
        filtered_win = self.sliding_window_df[self.sliding_window_df['avg_time_distance'] > 0]
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
            return {
                "time_window": best_win_rate_window['window_center'].strftime('%H:%M'),
                "win_rate": float(best_win_rate_window['win_rate']),
                "avg_time_distance": float(best_win_rate_window['avg_time_distance']),
                "win_rate_std": float(win_rate_std),
                "sample_size": win_rate_count,
                "robust_windows_count": robust_window_count,
                "explanation": f"30-minute window centered at {best_win_rate_window['window_center'].strftime('%H:%M')} shows the highest win rate",
                "recommendation": "Focus trading activity during this time window for better win rates",
                "confidence": f"?",
                "robustness": f"Win rate standard deviation: {win_rate_std:.1f}%"
            }

    def run_session_assistant(self):
        """
        Trains and runs the real-time session assistant models.
        Returns a list of dicts for the last session day with:
        - timestamp (Open time)
        - performance_score (normalized)
        - action (STOP, CONTINUE, INCREASE_RISK)
        """
        df = self.session_assistant_features_df.copy()
        if df.empty or df['date'].nunique() < 2:
            return []  # Not enough data
        # Ensure date column is datetime.date
        df['date'] = pd.to_datetime(df['date']).dt.date
        # Split into train (all but last day) and test (last day)
        all_dates = sorted(df['date'].unique())
        train_dates = all_dates[:-1]
        test_date = all_dates[-1]
        train_df = df[df['date'].isin(train_dates)].copy()
        test_df = df[df['date'] == test_date].copy()
        # Debug: print test day selection
        if DEBUG:
            print(f"[SessionAssistant] All dates: {all_dates}")
            print(f"[SessionAssistant] Test date: {test_date}")
            print(f"[SessionAssistant] Test df shape: {test_df.shape}")
        # --- Label engineering ---
        N = 3
        train_df = train_df.reset_index(drop=True)
        test_df = test_df.reset_index(drop=True)
        train_df['future_pnl'] = train_df['pnl'].rolling(window=N, min_periods=1).sum().shift(-N+1).fillna(0)
        test_df['future_pnl'] = test_df['pnl'].rolling(window=N, min_periods=1).sum().shift(-N+1).fillna(0)
        # Action label: 0=STOP, 1=CONTINUE, 2=INCREASE_RISK
        # More sensitive threshold: 0.5 * std
        std = train_df['future_pnl'].std() if train_df['future_pnl'].std() > 0 else 1
        threshold = 0.5 * std
        train_df['action_label'] = train_df['future_pnl'].apply(lambda x: 0 if x < -threshold else (2 if x > threshold else 1))
        test_df['action_label'] = test_df['future_pnl'].apply(lambda x: 0 if x < -threshold else (2 if x > threshold else 1))
        # Debug: print action label distribution
        if DEBUG:
            print(f"[SessionAssistant] Test future_pnl: {test_df['future_pnl'].tolist()}")
            print(f"[SessionAssistant] std: {std}, threshold: {threshold}")
            print(f"[SessionAssistant] Test action_label: {test_df['action_label'].tolist()}")
        # --- Features ---
        feature_cols = [
            'time_of_day', 'day_of_week', 'cumulative_pnl', 'trade_count', 'win_rate_so_far',
            'avg_trade_duration', 'avg_trade_volume', 'pnl_std_dev', 'yesterday_pnl',
            'pause_since_last_trade', 'minutes_since_session_start'
        ]
        X_train = train_df[feature_cols].values
        y_train_reg = train_df['future_pnl'].values
        y_train_clf = train_df['action_label'].values
        X_test = test_df[feature_cols].values
        # --- Model training ---
        reg = RandomForestRegressor(n_estimators=30, random_state=42)
        reg.fit(X_train, y_train_reg)
        clf = RandomForestClassifier(n_estimators=30, random_state=42)
        clf.fit(X_train, y_train_clf)
        # --- Prediction ---
        y_pred_reg = reg.predict(X_test)
        y_pred_clf = clf.predict(X_test)
        # Normalize performance score to [0, 1] based on training set
        scaler = MinMaxScaler()
        scaler.fit(y_train_reg.reshape(-1, 1))
        y_pred_score = scaler.transform(y_pred_reg.reshape(-1, 1)).flatten()
        # Map action labels to strings
        action_map = {0: 'STOP', 1: 'CONTINUE', 2: 'INCREASE_RISK'}
        # Prepare output
        results = []
        for i, row in test_df.iterrows():
            results.append({
                'timestamp': row['Open time'].isoformat(),
                'performance_score': float(y_pred_score[i]),
                'action': action_map.get(int(y_pred_clf[i]), 'CONTINUE'),
                'cumulative_pnl': float(row['cumulative_pnl'])
            })
        return results

class TradePlotDataTransformer:
    def __init__(self, results: TradeAnalysisResults):
        self.results = results

    def transform(self) -> dict:
        """Transform analysis results into plotting data."""
        all_plot_data = {}
        # 1. Win rate vs time distance (sliding window) - pre-compute filtered data
        if not self.results.sliding_window_df.empty:
            # Filter out zero or negative avg_time_distance values once
            filtered_win = self.results.sliding_window_df[self.results.sliding_window_df['avg_time_distance'] >= 0]
            if not filtered_win.empty:
                # Sort by time distance for rolling average calculation
                filtered_win_sorted = filtered_win.sort_values('avg_time_distance').reset_index(drop=True)
                # Calculate rolling average using vectorized operations
                rolling_win_rate = filtered_win_sorted['win_rate'].rolling(window=20, min_periods=1).mean()
                # Save raw data for win rate vs time distance
                all_plot_data["win_rate_vs_avg_time_distance_over_30m_window"] = {
                    "time_distance": filtered_win['avg_time_distance'].tolist(),
                    "win_rate": filtered_win['win_rate'].tolist(),
                    "time_distance_sorted": filtered_win_sorted['avg_time_distance'].tolist(),
                    "rolling_win_rate": rolling_win_rate.tolist()
                }
        # 2. P&L vs time distance
        if not self.results.enriched_df.empty:
            # Save raw data for P&L vs time distance (violin plot data)
            all_plot_data["pnl_vs_time_distance"] = {
                    "time_distance_minutes": self.results.enriched_df['time_distance'].tolist(),
                    "pnl": self.results.enriched_df['pnl'].tolist()
            }
        # 3. Volume vs time distance (individual trades, filtered)
        if not self.results.enriched_df.empty:
            # Save raw data for volume vs time distance
            all_plot_data["volume_vs_time_distance"] = {
                    "time_distance": self.results.enriched_df['time_distance'].tolist(),
                    "volume": self.results.enriched_df['volume'].tolist()
            }
        # 4. P&L vs binned time distance (bar chart, replaces win rate by hour of day)
        if not self.results.enriched_df.empty:
            # Bin time distances into 15-second bins using vectorized operations
            bin_width = 15  # seconds
            max_td = self.results.enriched_df['time_distance'].max()
            bins = np.arange(0, max_td + bin_width, bin_width)
            bin_edges = bins[:-1]
            # Create temporary dataframe for binning
            temp_df = self.results.enriched_df.copy()
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
        # 5. Peak and trough time distribution
        if not self.results.time_peaks_df.empty:
            # Save raw data for peak P&L times to JSON
            peak_times = [t.strftime('%H:%M') for t in self.results.time_peaks_df['peak_time']]
            peak_pnls = self.results.time_peaks_df['peak_pnl'].tolist()
            all_plot_data["distribution_of_peak_pnl_times"] = {
                "time": peak_times,
                "pnl": peak_pnls
            }
        
        if not self.results.time_troughs_df.empty:
            # Save raw data for trough P&L times to JSON
            trough_times = [t.strftime('%H:%M') for t in self.results.time_troughs_df['trough_time']]
            trough_pnls = self.results.time_troughs_df['trough_pnl'].tolist()
            all_plot_data["distribution_of_trough_pnl_times"] = {
                "time": trough_times,
                "pnl": trough_pnls
            }
        # 6. Trades to peak distribution
        if not self.results.time_peaks_df.empty:
            # Save raw data for trades to peak distribution
            all_plot_data["distribution_of_trades_to_peak"] = {
                    "trades_to_peak": self.results.time_peaks_df['trades_to_peak'].tolist()
            }
        # 7. Optimal drawdown cumulative P&L analysis
            drawdown_percentages, total_pnls = self.results.drawdown_analysis
        all_plot_data["cumulative_pnl_vs_drawdown_threshold"] = {
            "drawdown_percentages": drawdown_percentages.tolist(),
            "cumulative_pnl": total_pnls
        }
        # 8. Cumulative P&L vs minimum cooldown period
        all_plot_data["cumulative_pnl_vs_cooldown_period"] = {
                "cooldown_minutes": (self.results.cooldown_seconds_list / 60).tolist(),
                "cumulative_pnl": self.results.pnl_by_cooldown
        }
        # 9. Metrics by weekday for grouped bar chart
        if not self.results.enriched_df.empty:
            # Compute metrics by weekday using correlations_df, which now contains all required metrics and the date
            by_weekday = {}
            if "date" in self.results.enriched_df.columns:
                #   Derive weekday from the 'date' column (which should be datetime.date or convertible)
                enriched_df = self.results.enriched_df.copy()
            if not np.issubdtype(enriched_df["date"].dtype, np.integer):
                # If not already datetime, convert
                enriched_df["weekday"] = pd.to_datetime(enriched_df["date"]).dt.dayofweek
            else:
                enriched_df["weekday"] = enriched_df["date"]
            weekday_groups = enriched_df.groupby("weekday")
            for weekday, group in weekday_groups:
                by_weekday[int(weekday)] = {
                    'scalar': {
                        # Number of trades on this weekday divided by number of unique dates in the data that are this weekday
                        "count": len(group) / enriched_df[pd.to_datetime(enriched_df["date"]).dt.dayofweek == int(weekday)]["date"].nunique() if enriched_df[pd.to_datetime(enriched_df["date"]).dt.dayofweek == int(weekday)]["date"].nunique() > 0 else 0,
                        "win_rate": group["win"].mean(),
                    },
                    'series': {
                        "pnl": group["pnl"].tolist(),
                        "volume": group["volume"].tolist(),
                        "time_distance": group["time_distance"].tolist(),
                        "holding_time": group["holding_time"].tolist(),
                    },
                }
        if by_weekday:
            all_plot_data["by_weekday"] = by_weekday
            
        return all_plot_data

class TradeRecommendationEngine:
    def __init__(self, analysis_engine: TradeAnalysisEngine):
        self.analysis_engine = analysis_engine

    def interpret(self) -> dict:
        """Interpret analysis results and generate recommendations."""
        # Focus only on the metrics we actually want for Pareto front analysis
        metrics = [
            {'name': 'PnL', 'agg': 'sum', 'maximize': True},
            {'name': 'win_rate', 'agg': 'win_rate', 'maximize': True},
            # {'name': 'pnl_std', 'agg': 'std', 'maximize': False},
            # {'name': 'sample_size', 'agg': 'count', 'maximize': True}
        ]
        recommendations = {}
        recommendations['break_time_pareto'] = self.analysis_engine.recommend_break_time_multi(metrics=metrics)
        recommendations["optimal_intraday_drawdown"] = self.analysis_engine.recommend_drawdown_percentage()
        recommendations["optimal_max_trades_per_day"] = self.analysis_engine.recommend_max_trades_per_day()
        recommendations["optimal_trading_hours"] = self.analysis_engine.recommend_optimal_trading_hours()
        recommendations["optimal_win_rate_window"] = self.analysis_engine.recommend_optimal_win_rate_window()
        return recommendations

def analyze_clusters_tsne_kmeans(df: pd.DataFrame, method: str = "pca", clustering_method: str = "dbscan") -> dict:
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

    if method == "pca":
        # Use PCA for dimensionality reduction instead of t-SNE
        pca = PCA(n_components=2, random_state=42)
        reduction_result = pca.fit_transform(scaled)
    elif method == "tsne":
        reduction_result = TSNE(
            n_components=2,
            perplexity=30,
            random_state=42,
            method='exact'
        ).fit_transform(scaled)

    # Apply clustering based on the specified method
    if clustering_method == "kmeans":
        # Elbow method on clustering output
        wcss = []
        elbow_ks = list(range(2, 16))
        kmeans_models = []
        for k in elbow_ks:
            km = KMeans(n_clusters=k, random_state=42).fit(reduction_result)
            wcss.append(km.inertia_)
            kmeans_models.append(km)

        # Find the "elbow" point: where the decrease in WCSS slows down
        # We'll use the "knee" method: find the point with the maximum distance to the line between first and last WCSS
        x = np.array(elbow_ks)
        y = np.array(wcss)
        line_vec = np.array([x[-1] - x[0], y[-1] - y[0]])
        line_vec_norm = line_vec / np.sqrt(np.sum(line_vec**2))
        vec_from_first = np.vstack([x - x[0], y - y[0]]).T
        scalar_product = np.dot(vec_from_first, line_vec_norm)
        proj = np.outer(scalar_product, line_vec_norm)
        vec_to_line = vec_from_first - proj
        distances = np.sqrt(np.sum(vec_to_line ** 2, axis=1))
        elbow_idx = np.argmax(distances)
        elbow_k = elbow_ks[elbow_idx]
        min_k = max(2, elbow_k - 2)
        max_k = min(15, elbow_k + 2)
        narrowed_ks = list(range(min_k, max_k + 1))

        # Silhouette method on t-SNE output, using the narrowed k values
        silhouette_scores = []
        for k in narrowed_ks:
            idx = elbow_ks.index(k)
            km = kmeans_models[idx]
            score = silhouette_score(reduction_result, km.labels_)
            silhouette_scores.append((k, score))

        best_k = max(silhouette_scores, key=lambda x: x[1])[0]


        # Final clustering
        cluster_model = KMeans(n_clusters=best_k, random_state=42).fit(reduction_result)
        cluster_labels = cluster_model.labels_
        
    elif clustering_method == "dbscan":
        from sklearn.cluster import DBSCAN
        from sklearn.neighbors import NearestNeighbors
        
        # Automated parameter selection using k-nearest neighbors
        # Find optimal eps using the "elbow" method on k-nearest neighbors distances
        k_values = [5, 10, 15, 20, 25, 30]
        eps_candidates = []
        
        for k in k_values:
            nbrs = NearestNeighbors(n_neighbors=k).fit(reduction_result)
            distances, indices = nbrs.kneighbors(reduction_result)
            # Use the k-th nearest neighbor distance (sorted, so k-1 index)
            k_distances = distances[:, k-1]
            eps_candidates.extend([np.percentile(k_distances, p) for p in [50, 75, 90]])
        
        # Remove duplicates and sort
        eps_candidates = sorted(list(set(eps_candidates)))
        
        # Determine min_samples based on data size
        n_samples = len(reduction_result)
        min_samples_candidates = [
            max(3, int(n_samples * 0.01)),  # 1% of data
            max(3, int(n_samples * 0.02)),  # 2% of data  
            max(3, int(n_samples * 0.05)),  # 5% of data
            max(3, int(n_samples * 0.1)),   # 10% of data
        ]
        
        best_score = -1
        best_eps = eps_candidates[len(eps_candidates)//2]  # Default to middle value
        best_min_samples = min_samples_candidates[1]  # Default to 2% of data
        best_labels = None
        
        print(f"Testing {len(eps_candidates)} eps values and {len(min_samples_candidates)} min_samples values...")
        
        for eps in eps_candidates:
            for min_samples in min_samples_candidates:
                dbscan = DBSCAN(eps=eps, min_samples=min_samples)
                labels = dbscan.fit_predict(reduction_result)
                
                # Count clusters (excluding noise)
                unique_labels = set(labels)
                n_clusters = len(unique_labels) - (1 if -1 in labels else 0)
                
                # Skip if no clusters found or too many clusters
                if n_clusters == 0 or n_clusters > 15:
                    continue
                    
                # Calculate silhouette score (excluding noise points)
                non_noise_mask = labels != -1
                if sum(non_noise_mask) < 10 or len(set(labels[non_noise_mask])) < 2:
                    continue
                    
                try:
                    score = silhouette_score(reduction_result[non_noise_mask], labels[non_noise_mask])
                    
                    # Calculate noise ratio
                    noise_ratio = (labels == -1).sum() / len(labels)
                    
                    # Prefer solutions with moderate noise and good silhouette
                    # Penalize too much noise (>50%) or too little clustering
                    if noise_ratio > 0.5:
                        continue
                    
                    # Adjusted score favors good silhouette, moderate clusters, low noise
                    adjusted_score = score * (1 - noise_ratio) * min(n_clusters, 8)
                    
                    if adjusted_score > best_score:
                        best_score = adjusted_score
                        best_eps = eps
                        best_min_samples = min_samples
                        best_labels = labels
                        print(f"New best: eps={eps:.3f}, min_samples={min_samples}, clusters={n_clusters}, noise_ratio={noise_ratio:.3f}, score={adjusted_score:.3f}")
                        
                except Exception as e:
                    continue
        
        # Use the best parameters found
        if best_labels is not None:
            dbscan = DBSCAN(eps=best_eps, min_samples=best_min_samples)
            best_labels = dbscan.fit_predict(reduction_result)
            print(f"Final DBSCAN: eps={best_eps:.3f}, min_samples={best_min_samples}")
        else:
            # Fallback to reasonable defaults
            dbscan = DBSCAN(eps=2.0, min_samples=10)
            best_labels = dbscan.fit_predict(reduction_result)
            print("Using fallback DBSCAN parameters")
        
        cluster_labels = best_labels
        
    else:
        raise ValueError(f"Unsupported clustering method: {clustering_method}. Use 'kmeans' or 'dbscan'.")

    df_clustered = df.loc[features.index].copy()
    df_clustered["cluster"] = cluster_labels
    
    # Set column names based on dimensionality reduction method
    if method == "pca":
        df_clustered["PCA1"] = reduction_result[:, 0]
        df_clustered["PCA2"] = reduction_result[:, 1]
        coord_cols = ["PCA1", "PCA2"]
    else:  # tsne
        df_clustered["TSNE1"] = reduction_result[:, 0]
        df_clustered["TSNE2"] = reduction_result[:, 1]
        coord_cols = ["TSNE1", "TSNE2"]

    total = len(df_clustered)
    cluster_stats = {}
    interpretations = {}

    # Iterate over clusters in order of descending count (largest cluster first)
    # For DBSCAN, noise points (cluster -1) are excluded from significant clusters
    if clustering_method == "dbscan":
        cluster_counts = df_clustered[df_clustered["cluster"] != -1]["cluster"].value_counts().sort_values(ascending=False)
    else:
        cluster_counts = df_clustered["cluster"].value_counts().sort_values(ascending=False)
        
    for cluster_id in cluster_counts.index:
        group = df_clustered[df_clustered["cluster"] == cluster_id]
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
            "win_rate": (group["PnL"] > 0).sum() / len(group),
            # Only assign most_common_day if it is significantly more frequent than others (e.g., at least 1.5x the next most common)
            "most_common_day": (
                group["dayofweek"].value_counts().index[0]
                if len(group["dayofweek"].value_counts()) > 1 and
                   group["dayofweek"].value_counts().iloc[0] >= 1.5 * group["dayofweek"].value_counts().iloc[1]
                else None
            ),
            "direction_ratio": group["direction"].value_counts(normalize=True).to_dict()
        }

        interpretation = []
        # Dynamically derive thresholds from the distribution of the actual data
        # Use percentiles for thresholds
        pnl_values = df_clustered["PnL"]
        mean_pnl_25 = np.percentile(pnl_values, 25)
        mean_pnl_75 = np.percentile(pnl_values, 75)
        mean_pnl_median = np.median(pnl_values)

        if stats["mean_pnl"] < mean_pnl_25:
            interpretation.append("large losers")
        elif stats["mean_pnl"] > mean_pnl_75:
            interpretation.append("large winners")
        elif stats["mean_pnl"] > mean_pnl_median:
            interpretation.append("small winners")
        else:
            interpretation.append("small losers")

        pause_values = df_clustered["pause_since_last"]
        pause_25 = np.percentile(pause_values, 25)
        pause_75 = np.percentile(pause_values, 75)

        if stats["mean_pause"] > pause_75:
            interpretation.append("long pauses")
        elif stats["mean_pause"] < pause_25:
            interpretation.append("short pauses")
            
        duration_values = df_clustered["duration"]
        duration_25 = np.percentile(duration_values, 25)
        duration_75 = np.percentile(duration_values, 75)

        if stats["mean_duration"] > duration_75:
            interpretation.append("long trades")
        elif stats["mean_duration"] < duration_25:
            interpretation.append("short trades")

        if stats["mean_hour"] >= 19:
            interpretation.append("late NY session")
        elif stats["mean_hour"] <= 17:
            interpretation.append("early NY session")
            
        if stats["win_rate"] > 0.60:
            interpretation.append("Good win rate")
        elif stats["win_rate"] > 0.70:
            interpretation.append("High win rate")
        elif stats["win_rate"] <= 0.50:
            interpretation.append("Poor win rate")
        else:
            interpretation.append("Medium win rate")

        day_map = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        if stats["most_common_day"] is not None:
            interpretation.append(day_map[stats["most_common_day"]])

        if ratio > 0.05:
            cluster_stats[1+cluster_id] = stats
            interpretations[1+cluster_id] = ", ".join(interpretation)

    # Prepare 2D coordinates data for visualization
    scatter_data = []
    for _, row in df_clustered.iterrows():
        scatter_data.append({
            "x": float(row[coord_cols[0]]),
            "y": float(row[coord_cols[1]]),
            "cluster": int(row["cluster"]),
            "pnl": float(row["PnL"]),
            "duration": float(row["duration"]),
            "return_per_min": float(row["return_per_min"])
        })

    return {
        "data": cluster_stats,
        "interpretation": interpretations,
        "scatter_data": scatter_data,
        "method": method
    }


def analyze_clusters_umap_hdbscan(df: pd.DataFrame) -> dict:
    from umap import UMAP
    from hdbscan import HDBSCAN
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

    # Apply UMAP
    reducer = UMAP(n_neighbors=10, min_dist=0.1, random_state=42)
    reduction_result = reducer.fit_transform(scaled)
    
    print(f"UMAP reduction result: {reduction_result.shape}")

    # Apply HDBSCAN with parameters to create fewer, larger clusters
    clusterer = HDBSCAN(min_cluster_size=30, cluster_selection_epsilon=0.0) # 30 is good
    labels = clusterer.fit_predict(reduction_result)
    
    print(f"HDBSCAN labels: {labels}")
    print(f"Unique cluster labels: {np.unique(labels)}")
    print(f"Number of noise points (label -1): {np.sum(labels == -1)}")
    print(f"Total points: {len(labels)}")

    df_clustered = df.loc[features.index].copy()
    df_clustered["cluster"] = labels
    df_clustered["UMAP1"] = reduction_result[:, 0]
    df_clustered["UMAP2"] = reduction_result[:, 1]

    total = len(df_clustered)
    cluster_stats = {}
    interpretations = {}

    cluster_counts = df_clustered["cluster"].value_counts().sort_values(ascending=False)
    print(f"Cluster counts: {cluster_counts}")
    
    for cluster_id in cluster_counts.index:
        if cluster_id == -1:
            continue
        group = df_clustered[df_clustered["cluster"] == cluster_id]
        count = len(group)
        ratio = count / total
        print(f"Cluster {cluster_id}: count={count}, ratio={ratio:.3f}")
        
        stats = {
            "count": count,
            "ratio": ratio,
            "mean_pnl": group["PnL"].mean(),
            "std_pnl": group["PnL"].std(),
            "mean_duration": group["duration"].mean(),
            "mean_return_per_min": group["return_per_min"].mean(),
            "mean_pause": group["pause_since_last"].mean(),
            "mean_hour": group["hour"].mean(),
            "win_rate": (group["PnL"] > 0).sum() / len(group),
            "most_common_day": (
                group["dayofweek"].value_counts().index[0]
                if len(group["dayofweek"].value_counts()) > 1 and
                   group["dayofweek"].value_counts().iloc[0] >= 1.5 * group["dayofweek"].value_counts().iloc[1]
                else None
            ),
            "direction_ratio": group["direction"].value_counts(normalize=True).to_dict()
        }

        interpretation = []
        pnl_values = df_clustered["PnL"]
        mean_pnl_25 = np.percentile(pnl_values, 25)
        mean_pnl_75 = np.percentile(pnl_values, 75)
        mean_pnl_median = np.median(pnl_values)

        if stats["mean_pnl"] < mean_pnl_25:
            interpretation.append("large losers")
        elif stats["mean_pnl"] > mean_pnl_75:
            interpretation.append("large winners")
        elif stats["mean_pnl"] > mean_pnl_median:
            interpretation.append("small winners")
        else:
            interpretation.append("small losers")

        pause_values = df_clustered["pause_since_last"]
        pause_25 = np.percentile(pause_values, 25)
        pause_75 = np.percentile(pause_values, 75)

        if stats["mean_pause"] > pause_75:
            interpretation.append("long pauses")
        elif stats["mean_pause"] < pause_25:
            interpretation.append("short pauses")

        duration_values = df_clustered["duration"]
        duration_25 = np.percentile(duration_values, 25)
        duration_75 = np.percentile(duration_values, 75)

        if stats["mean_duration"] > duration_75:
            interpretation.append("long trades")
        elif stats["mean_duration"] < duration_25:
            interpretation.append("short trades")

        if stats["mean_hour"] >= 19:
            interpretation.append("late NY session")
        elif stats["mean_hour"] <= 17:
            interpretation.append("early NY session")

        day_map = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        if stats["most_common_day"] is not None:
            interpretation.append(day_map[stats["most_common_day"]])

        # Lower threshold for HDBSCAN since it tends to create smaller, more focused clusters
        if ratio > 0.05:  # Changed from 0.10 to 0.05 (5% instead of 10%)
            cluster_stats[1 + cluster_id] = stats
            interpretations[1 + cluster_id] = ", ".join(interpretation)
            print(f"  -> Added cluster {1 + cluster_id} with ratio {ratio:.3f}")
        else:
            print(f"  -> Skipped cluster {cluster_id} with ratio {ratio:.3f} (below 5% threshold)")

    # Prepare 2D coordinates data for visualization
    scatter_data = []
    for _, row in df_clustered.iterrows():
        scatter_data.append({
            "x": float(row["UMAP1"]),
            "y": float(row["UMAP2"]),
            "cluster": int(row["cluster"]),
            "pnl": float(row["PnL"]),
            "duration": float(row["duration"]),
            "return_per_min": float(row["return_per_min"])
        })

    return {
        "data": cluster_stats,
        "interpretation": interpretations,
        "scatter_data": scatter_data,
        "method": "umap"
    }


def analyze_clusters(df: pd.DataFrame) -> dict:
    if LOCAL_RUN:
        return analyze_clusters_umap_hdbscan(df)
    else:
        return analyze_clusters_tsne_kmeans(df)
    

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
    elif isinstance(obj, (np.floating, np.float64, np.float32, np.float16, float)):
        # Handle NaN and infinite values
        if pd.isna(obj) or np.isinf(obj) or (isinstance(obj, float) and str(obj) == 'nan'):
            return None
        return float(obj)
    elif isinstance(obj, (np.ndarray,)):
        # Handle NaN and infinite values in arrays
        if isinstance(obj, np.ndarray):
            # Convert NaN and inf to None for JSON serialization
            obj = np.where(pd.isna(obj) | np.isinf(obj), None, obj)
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
    # Since ATAS does not include fees, we need to subtract the fees from the PnL
    # fees are 5 dollars per contract per round trip, which corresponds to 1 tick in NQ
    for g in groups:
        g['Profit (ticks)'] -= abs(g['Open volume'])
        g['Price PnL'] -= abs(g['Open volume']) * 5 
    return pd.DataFrame(groups)

def analyse_trading_journal_df(df: pd.DataFrame) -> dict:
    timings = {}
    t0 = time.perf_counter()
    preparer = TradeDataPreparer(df)
    preparer.filter_trading_hours().group_by_day()
    analysis = TradeAnalysisEngine(preparer).run_all()
    results = TradeAnalysisResults(
        df=analysis.df,
        daily_groups=analysis.daily_groups,
        enriched_df=analysis.enriched_df,
        sliding_window_df=analysis.sliding_window_df,
        time_peaks_df=analysis.time_peaks_df,
        time_troughs_df=analysis.time_troughs_df,
        drawdown_analysis=analysis.drawdown_analysis,
        cooldown_seconds_list=analysis.cooldown_seconds_list,
        pnl_by_cooldown=analysis.pnl_by_cooldown
    )
    timings['analysis'] = time.perf_counter() - t0
    t1 = time.perf_counter()
    plot_transformer = TradePlotDataTransformer(results)
    plot_data = plot_transformer.transform()
    timings['plot_results'] = time.perf_counter() - t1
    t2 = time.perf_counter()
    clusters = analyze_clusters(results.df)
    timings['analyze_clusters'] = time.perf_counter() - t2
    t3 = time.perf_counter()
    recommendation_engine = TradeRecommendationEngine(analysis)
    recommendations = recommendation_engine.interpret()
    timings['generate_trading_recommendations'] = time.perf_counter() - t3
    # --- Session Assistant ---
    session_assistant_results = analysis.run_session_assistant()
    timings['session_assistant'] = time.perf_counter() - t3
    timings['total'] = sum(timings.values())
    data_out = to_serializable(plot_data)
    data_out['session_assistant'] = to_serializable(session_assistant_results)
    return {
        'data': data_out, 
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

    # Step 1: Load ATAS Excel file (assume file path and sheet name)
    atas_file_path = "../ATAS_statistics_01012025_25072025.xlsx"  # Change to your actual file path
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

        # Save CSV to file as well
        csv_file_path = "atas_journal_converted.csv"
        try:
            df_journal.to_csv(csv_file_path, index=False)
            print(f"✅ CSV saved to {csv_file_path}")
        except Exception as e:
            print(f"❌ Failed to save CSV to file: {e}")
            exit()
    except Exception as e:
        print(f"Failed to load ATAS Journal sheet: {e}")
        exit()

    # Step 2: Run through the main analysis logic for ATAS
    result = process_uploaded_file(csv_string, broker='atas')
    from pprint import pprint   
    
    print("=" * 80)
    print("COMPLETE ANALYSIS RESULTS EVALUATION")
    print("=" * 80)
    
    # 1. Overall Structure
    print("\n1. OVERALL RESULT STRUCTURE:")
    print(f"Keys in result: {list(result.keys())}")
    print(f"Total keys: {len(result.keys())}")
    
    # 2. Data Section Analysis
    print("\n" + "=" * 50)
    print("2. DATA SECTION ANALYSIS:")
    print("=" * 50)
    data_keys = list(result['data'].keys())
    print(f"Data keys ({len(data_keys)}): {data_keys}")
    
    for key in data_keys:
        data_item = result['data'][key]
        print(f"\n--- {key} ---")
        if isinstance(data_item, dict):
            print(f"  Type: dict with {len(data_item)} keys")
            print(f"  Keys: {list(data_item.keys())}")
            # Show sample values for first few keys
            for i, (k, v) in enumerate(data_item.items()):
                if i < 3:  # Show first 3 items
                    if isinstance(v, list):
                        print(f"    {k}: list with {len(v)} items, first 3: {v[:3]}")
                    elif isinstance(v, (int, float)):
                        print(f"    {k}: {v}")
                    else:
                        print(f"    {k}: {type(v).__name__} - {str(v)[:100]}...")
        elif isinstance(data_item, list):
            print(f"  Type: list with {len(data_item)} items")
            if len(data_item) > 0:
                print(f"  First item type: {type(data_item[0]).__name__}")
                print(f"  Sample first 3 items: {data_item[:3]}")
        else:
            print(f"  Type: {type(data_item).__name__}")
            print(f"  Value: {str(data_item)[:200]}...")
    
    # 3. Recommendations Section Analysis
    print("\n" + "=" * 50)
    print("3. RECOMMENDATIONS SECTION ANALYSIS:")
    print("=" * 50)
    rec_keys = list(result['recommendations'].keys())
    print(f"Recommendation keys ({len(rec_keys)}): {rec_keys}")
    
    for key in rec_keys:
        rec_item = result['recommendations'][key]
        print(f"\n--- {key} ---")
        if isinstance(rec_item, dict):
            print(f"  Type: dict with {len(rec_item)} keys")
            print(f"  Keys: {list(rec_item.keys())}")
            # Show key insights
            for k, v in rec_item.items():
                if k in ['explanation', 'recommendation', 'confidence', 'robustness']:
                    print(f"    {k}: {str(v)[:150]}...")
                elif isinstance(v, (int, float)):
                    print(f"    {k}: {v}")
                elif isinstance(v, list) and len(v) <= 5:
                    print(f"    {k}: {v}")
                elif isinstance(v, dict):
                    print(f"    {k}: dict with {len(v)} items")
        else:
            print(f"  Type: {type(rec_item).__name__}")
            print(f"  Value: {str(rec_item)[:200]}...")
    
    # 4. Clusters Section Analysis
    print("\n" + "=" * 50)
    print("4. CLUSTERS SECTION ANALYSIS:")
    print("=" * 50)
    cluster_keys = list(result['clusters'].keys())
    print(f"Cluster keys ({len(cluster_keys)}): {cluster_keys}")
    
    for key in cluster_keys:
        cluster_item = result['clusters'][key]
        print(f"\n--- {key} ---")
        if isinstance(cluster_item, dict):
            print(f"  Type: dict with {len(cluster_item)} keys")
            print(f"  Keys: {list(cluster_item.keys())}")
            for k, v in cluster_item.items():
                if isinstance(v, list):
                    print(f"    {k}: list with {len(v)} items")
                    if len(v) > 0 and len(v) <= 3:
                        print(f"      Sample: {v}")
                elif isinstance(v, (int, float)):
                    print(f"    {k}: {v}")
                else:
                    print(f"    {k}: {type(v).__name__}")
        else:
            print(f"  Type: {type(cluster_item).__name__}")
            print(f"  Value: {str(cluster_item)[:200]}...")
    
    # 5. Performance Analysis
    print("\n" + "=" * 50)
    print("5. PERFORMANCE ANALYSIS:")
    print("=" * 50)
    timings = result['timings']
    total_time = timings['total']
    print(f"Total execution time: {total_time:.2f} seconds")
    
    for key, time_taken in timings.items():
        if key != 'total':
            percentage = (time_taken / total_time) * 100
            print(f"  {key}: {time_taken:.2f}s ({percentage:.1f}%)")
    
    # 6. Data Quality Assessment
    print("\n" + "=" * 50)
    print("6. DATA QUALITY ASSESSMENT:")
    print("=" * 50)
    
    # Check for empty or null data
    empty_data_keys = []
    for key, value in result['data'].items():
        if isinstance(value, list) and len(value) == 0:
            empty_data_keys.append(key)
        elif isinstance(value, dict) and len(value) == 0:
            empty_data_keys.append(key)
    
    if empty_data_keys:
        print(f"⚠️  Empty data sections: {empty_data_keys}")
    else:
        print("✅ All data sections contain content")
    
    # Check for NaN values in key metrics
    nan_found = False
    for key, value in result['data'].items():
        if isinstance(value, dict):
            for k, v in value.items():
                if isinstance(v, list) and any(isinstance(x, float) and np.isnan(x) for x in v):
                    print(f"⚠️  NaN values found in {key}.{k}")
                    nan_found = True
    
    if not nan_found:
        print("✅ No NaN values detected in key metrics")
    
    # 7. Summary
    print("\n" + "=" * 50)
    print("7. SUMMARY:")
    print("=" * 50)
    print(f"✅ Analysis completed successfully")
    print(f"✅ Generated {len(data_keys)} data sections for plotting")
    print(f"✅ Generated {len(rec_keys)} recommendation types")
    print(f"✅ Clustering analysis completed")
    print(f"✅ Total processing time: {total_time:.2f} seconds")
    print(f"✅ Output is JSON serializable: {result.get('profiled', False)}")
    
    print("\n" + "=" * 80)
    print("EVALUATION COMPLETE")
    print("=" * 80)
    
    # 8. Export full results as JSON
    print("\n" + "=" * 50)
    print("8. EXPORTING FULL RESULTS AS JSON:")
    print("=" * 50)
    
    import json
    from datetime import datetime
    
    # Create timestamp for filename
    # timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"../latest_demo_output.json"
    
    try:
        # Ensure the result is properly serializable
        serializable_result = to_serializable(result)
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(serializable_result, f, indent=2, ensure_ascii=False)
        print(f"✅ Full results exported to: {filename}")
        print(f"   File size: {len(json.dumps(serializable_result)) / 1024:.1f} KB")
    except Exception as e:
        print(f"❌ Failed to export JSON: {e}")
    
if DEBUG:
    debug()
