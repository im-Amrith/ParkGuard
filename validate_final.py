import pandas as pd
import numpy as np
from prophet import Prophet
from sklearn.metrics import mean_absolute_error
import warnings

warnings.filterwarnings('ignore')

print("=== RUTHLESS MULTI-ZONE VALIDATION ===")

# 1. Load Data
df = pd.read_csv("clustered_hotspots_data.csv")
df['created_datetime'] = pd.to_datetime(df['created_datetime'], utc=True).dt.tz_localize(None)

# Get the Top 5 most congested clusters
top_5_clusters = df['cluster_id'].value_counts().head(5).index.tolist()
print(f"Testing across Top 5 Zones: {top_5_clusters}\n")

results_summary = []

for cluster_id in top_5_clusters:
    # Isolate data
    cluster_df = df[df['cluster_id'] == cluster_id].copy()
    cluster_df.set_index('created_datetime', inplace=True)

    # Resample to 4-Hour blocks
    ts_data = cluster_df.resample('4h').size().reset_index(name='y_actual')
    ts_data.rename(columns={'created_datetime': 'ds'}, inplace=True)

    # Log Transformation
    ts_data['y'] = ts_data['y_actual']  # Feed the raw data directly

    # Split Data: Hide the last 7 DAYS (42 periods of 4-hours)
    cutoff_date = ts_data['ds'].max() - pd.Timedelta(days=7)
    train_data = ts_data[ts_data['ds'] < cutoff_date]
    test_data = ts_data[ts_data['ds'] >= cutoff_date]

    # Skip if not enough testing data
    if len(test_data) < 10:
        continue

    # Train Model
    m = Prophet(daily_seasonality=True, weekly_seasonality=True, yearly_seasonality=False, changepoint_prior_scale=0.1, seasonality_prior_scale=10.0)
    m.fit(train_data)

    # Predict
    forecast = m.predict(test_data[['ds']])
    forecast['yhat_real'] = forecast['yhat'].clip(lower=0).round(2)

    # Merge
    results = pd.merge(test_data, forecast[['ds', 'yhat_real']], on='ds')
    
    # Calculate Metrics
    mae = mean_absolute_error(results['y_actual'], results['yhat_real'])
    max_actual = results['y_actual'].max()
    max_predicted = results['yhat_real'].max()
    
    results_summary.append({
        'Zone': f"Cluster {cluster_id}",
        'MAE (+/- Tickets)': round(mae, 2),
        'Highest Actual Spike': max_actual,
        'Highest Predicted Spike': round(max_predicted, 2)
    })

# Print the final truth table
summary_df = pd.DataFrame(results_summary)
print(summary_df.to_string(index=False))

print("\n=== HOW TO READ THIS ===")
print("1. MAE: The average number of tickets the AI gets wrong per 4-hour shift.")
print("2. Spikes: Did the 'Highest Predicted' get close to the 'Highest Actual'? If yes, your AI successfully predicts major traffic jams.")