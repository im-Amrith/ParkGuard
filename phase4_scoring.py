import pandas as pd
import numpy as np
import json

# ==========================================
# STEP 1: Load Geospatial & Forecast Data
# ==========================================
print("Starting Phase 4: Congestion Impact Scoring (CIS)...")

# Load the hotspots (for W and B parameters)
# We will extract this directly from the GeoJSON properties we made in Phase 2
with open("bengaluru_hotspots.geojson", "r") as f:
    geojson_data = json.load(f)

# Build a fast lookup dataframe from GeoJSON properties
cluster_props = []
for feature in geojson_data['features']:
    props = feature['properties']
    cluster_props.append({
        'cluster_id': int(props['cluster_id']),
        'historical_violations': props['violation_count'],
        'avg_severity_W': props['avg_severity_W'],
        'avg_bias_B': props['avg_bias_B']
    })
df_props = pd.DataFrame(cluster_props)

# Load the Prophet forecasts (for V parameter)
df_forecast = pd.read_csv("hotspot_forecasts.csv")

# ==========================================
# STEP 2: Calculate Next 12-Hour Priority
# ==========================================
print("Merging data and calculating Next 12-Hour Operational Risk...")

# For an operational dashboard, police officers usually care about the next shift (e.g., next 12 hours)
# We group the forecast data by cluster and sum the predicted volume for the first 6 periods (12 hours)
df_forecast['predicted_timestamp'] = pd.to_datetime(df_forecast['predicted_timestamp'])

# Sort by time to ensure we get the upcoming ones
df_forecast = df_forecast.sort_values(by=['cluster_id', 'predicted_timestamp'])

# Get the sum of predicted volume (V) for the next 12 hours (6 rows of 2-hours) per cluster
next_12_hours = df_forecast.groupby('cluster_id').head(6)
df_v = next_12_hours.groupby('cluster_id')['predicted_volume_V'].sum().reset_index()

# Merge everything together
df_scoring = pd.merge(df_props, df_v, on='cluster_id', how='inner')

# ==========================================
# STEP 3: The Congestion Impact Score (CIS)
# ==========================================
print("Running the CIS Algorithm...")

# Formula: CIS = (V * W) * B
# (We exclude 'P' proximity penalty here as it requires Map APIs, but W already includes junction/bus stop weights!)

# 1. Normalize the Predicted Volume (V) so massive clusters don't completely drown out smaller severe ones
# We use min-max scaling to put V on a scale of 0.1 to 1.0
min_v = df_scoring['predicted_volume_V'].min()
max_v = df_scoring['predicted_volume_V'].max()
if max_v > min_v:
    df_scoring['normalized_V'] = 0.1 + 0.9 * ((df_scoring['predicted_volume_V'] - min_v) / (max_v - min_v))
else:
    df_scoring['normalized_V'] = 0.5 

# 2. Calculate final CIS
df_scoring['CIS_Score'] = (df_scoring['normalized_V'] * df_scoring['avg_severity_W']) * df_scoring['avg_bias_B']

# Scale CIS to a user-friendly 0-100 score for the dashboard
max_cis = df_scoring['CIS_Score'].max()
df_scoring['CIS_Score_100'] = (df_scoring['CIS_Score'] / max_cis) * 100
df_scoring['CIS_Score_100'] = df_scoring['CIS_Score_100'].round(1)

# Sort from most critical to least critical
df_scoring = df_scoring.sort_values(by='CIS_Score_100', ascending=False).reset_index(drop=True)

# ==========================================
# STEP 4: Rank & Export for the Dashboard
# ==========================================
print("\n=== TOP 5 PRIORITY DEPLOYMENT ZONES (NEXT 12 HOURS) ===")
print(df_scoring[['cluster_id', 'predicted_volume_V', 'avg_severity_W', 'CIS_Score_100']].head(5).to_string(index=False))

# Export the scoring matrix so the Phase 5 Dashboard can read it
df_scoring.to_csv("final_cis_rankings.csv", index=False)

print("\n✔️ Phase 4 Complete! 'final_cis_rankings.csv' generated.")