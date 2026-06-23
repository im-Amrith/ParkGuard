import pandas as pd
import numpy as np
from prophet import Prophet
import warnings

# Suppress prophet's verbose logging for a clean terminal
warnings.filterwarnings('ignore')

# ==========================================
# STEP 1: Load the Clustered Matrix
# ==========================================
print("Starting Phase 3: Temporal Forecasting...")
print("Loading clustered data...")
df = pd.read_csv("clustered_hotspots_data.csv")

# Ensure datetime parsing
df['created_datetime'] = pd.to_datetime(df['created_datetime'], utc=True).dt.tz_localize(None)

# ==========================================
# STEP 2: Identify Top "Dense" Clusters
# ==========================================
# We only want to forecast for the worst choke points (e.g., top 10 clusters) 
# to save compute time and ensure data isn't too sparse.
top_n = 10
top_clusters = df['cluster_id'].value_counts().head(top_n).index.tolist()

print(f"Isolating the top {top_n} highest-density clusters for predictive modeling...")

all_forecasts = []

# ==========================================
# STEP 3: Train Prophet & Forecast
# ==========================================
# We will aggregate data into 2-hour windows to reduce sparsity 
# while maintaining actionable shift-level insights.

for cluster_id in top_clusters:
    print(f"\n--- Training Model for Cluster {cluster_id} ---")
    
    # Isolate cluster data
    cluster_df = df[df['cluster_id'] == cluster_id].copy()
    
    # Set datetime as index and resample to 2-Hour windows to get violation counts
    cluster_df.set_index('created_datetime', inplace=True)
    ts_data = cluster_df.resample('2h').size().reset_index(name='violations')
    
    # Prophet requires columns to be named 'ds' (datestamp) and 'y' (target variable)
    ts_data.rename(columns={'created_datetime': 'ds', 'violations': 'y'}, inplace=True)
    
    # Initialize Prophet (optimized for highly seasonal urban data)
    # We add daily and weekly seasonality. 
    m = Prophet(
        daily_seasonality=True, 
        weekly_seasonality=True, 
        yearly_seasonality=False,
        interval_width=0.80 # 80% confidence intervals
    )
    
    # Fit the model
    m.fit(ts_data)
    
    # Create a dataframe to predict the next 48 hours (24 periods of 2-hours)
    future = m.make_future_dataframe(periods=24, freq='2h')
    
    # Generate the prediction
    forecast = m.predict(future)
    
    # Extract only the future predictions (the last 24 rows)
    future_forecast = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(24).copy()
    future_forecast['cluster_id'] = cluster_id
    
    # Floor negative predictions to 0 (you can't have negative parking tickets)
    future_forecast['yhat'] = future_forecast['yhat'].clip(lower=0).round(2)
    future_forecast['yhat_lower'] = future_forecast['yhat_lower'].clip(lower=0).round(2)
    future_forecast['yhat_upper'] = future_forecast['yhat_upper'].clip(lower=0).round(2)
    
    all_forecasts.append(future_forecast)
    print(f"✔️ Forecast generated for next 48 hours.")

# ==========================================
# STEP 4: Export Forecasts for Scoring
# ==========================================
# Combine all individual forecasts into one master table
final_forecast_df = pd.concat(all_forecasts, ignore_index=True)

# Rename columns for clarity in our Phase 4 CIS scoring equation
final_forecast_df.rename(columns={
    'ds': 'predicted_timestamp',
    'yhat': 'predicted_volume_V'
}, inplace=True)

# Save to CSV
final_forecast_df.to_csv("hotspot_forecasts.csv", index=False)
print("\n=== PHASE 3 COMPLETE ===")
print("✔️ 'hotspot_forecasts.csv' successfully generated.")
print("This contains the predicted violation volume (V) needed for our CIS Impact Formula.")