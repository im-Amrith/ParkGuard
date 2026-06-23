import pandas as pd
import numpy as np
import h3

# ==========================================
# STEP 1: Load Data & Quality Filtering
# ==========================================

print("Loading dataset...")
# Replace with your actual file path
df = pd.read_csv("jan_to_may_police_violation_anonymized.csv")

# Capture the original size for our Bias Audit
original_size = len(df)

# Filter out missing coordinates immediately (useless for spatial mapping)
df = df.dropna(subset=['latitude', 'longitude'])

# ==========================================
# STEP 2: The Bias Audit (Calculating 'B')
# ==========================================
# We want to know if certain police stations reject tickets at an unusually high rate.
# This prevents our model from thinking a zone is "safe" just because a station is slow.

station_stats = df.groupby('police_station')['validation_status'].value_counts(normalize=True).unstack().fillna(0)
if 'approved' in station_stats.columns:
    # If a station has a low approval rate, we give its approved tickets a slightly higher weight (Bias correction)
    station_stats['bias_weight'] = 1.0 + (1.0 - station_stats['approved'])
else:
    station_stats['bias_weight'] = 1.0

# Now, filter down to ONLY approved tickets for the core ML pipeline
df = df[df['validation_status'] == 'approved'].copy()
print(f"Filtered to approved records. Retained {len(df)} out of {original_size} rows.")

# Map the bias weight back to the main dataframe
df = df.merge(station_stats[['bias_weight']], left_on='police_station', right_index=True, how='left')

# ==========================================
# STEP 3: Temporal Feature Engineering
# ==========================================
print("Engineering temporal features...")

# Parse datetimes
df['created_datetime'] = pd.to_datetime(df['created_datetime'], errors='coerce')
df['modified_datetime'] = pd.to_datetime(df['modified_datetime'], errors='coerce')

# Drop rows where created_datetime couldn't be parsed
df = df.dropna(subset=['created_datetime'])

# Extract time components
df['hour_of_day'] = df['created_datetime'].dt.hour
df['day_of_week'] = df['created_datetime'].dt.dayofweek # 0=Monday, 6=Sunday
df['is_weekend'] = df['day_of_week'].apply(lambda x: 1 if x >= 5 else 0)

# Peak Hour Flag: Morning (7-10) and Evening (18-22)
df['is_peak_hour'] = df['hour_of_day'].apply(lambda x: 1 if (7 <= x <= 10) or (18 <= x <= 22) else 0)

# Dwell Time Calculation (Mitigating the Dwell Time Fallacy)
# We calculate duration in minutes, but cap it at 480 mins (8 hours) to ignore administrative edge cases
df['duration_mins'] = (df['modified_datetime'] - df['created_datetime']).dt.total_seconds() / 60
df['duration_mins'] = df['duration_mins'].apply(lambda x: min(max(x, 0), 480) if pd.notnull(x) else 30) # Default to 30 mins if null

# ==========================================
# STEP 4: Violation Severity Scoring (W)
# ==========================================
print("Applying severity weights...")

def calculate_severity(violation_text):
    if pd.isnull(violation_text):
        return 1.0
    
    text = str(violation_text).upper()
    weight = 1.0
    
    # Context-aware modifiers
    if "ROAD CROSSING" in text or "JUNCTION" in text:
        weight += 0.7
    if "BUS STOP" in text:
        weight += 0.5
    if "DOUBLE" in text or "WRONG" in text:
        weight += 0.3
    
    # Cap maximum weight to prevent extreme outliers
    return min(weight, 2.5)

df['severity_weight'] = df['violation_type'].apply(calculate_severity)

# ==========================================
# STEP 5: H3 Geospatial Indexing
# ==========================================
print("Generating H3 spatial indexes...")

# We use Resolution 8 (approx 0.7 sq km) for macro-clusters
# We use Resolution 9 (approx 0.1 sq km) for micro-clusters
def get_h3_index(lat, lon, res):
    try:
        return h3.latlng_to_cell(lat, lon, res) # Note: newer h3-py versions use latlng_to_cell instead of geo_to_h3
    except:
        return None

df['h3_res8'] = df.apply(lambda row: get_h3_index(row['latitude'], row['longitude'], 8), axis=1)
df['h3_res9'] = df.apply(lambda row: get_h3_index(row['latitude'], row['longitude'], 9), axis=1)

print("Phase 1 Complete! Dataframe is ready for clustering.")
# print(df.head())


# ==========================================
# PHASE 1 VERIFICATION & DIAGNOSTIC SCRIPT
# ==========================================

print("\n=== RUNNING DATA INTEGRITY AUDIT ===")

# 1. Shape Check
print(f"✔️ Active Dataframe Dimensions: {df.shape[0]} rows, {df.shape[1]} columns")

# 2. Check for unexpected Null/NaN values in newly created columns
null_checks = ['bias_weight', 'hour_of_day', 'day_of_week', 'is_peak_hour', 'duration_mins', 'severity_weight', 'h3_res8', 'h3_res9']
print("\n--- Missing Value Check ---")
for col in null_checks:
    missing_count = df[col].isnull().sum()
    print(f"• {col}: {missing_count} null rows")

# 3. Temporal Boundary Validation
print("\n--- Temporal Logic Validation ---")
print(f"• Unique hours detected: {sorted(df['hour_of_day'].unique())} (Should be 0-23)")
print(f"• Unique days of week: {sorted(df['day_of_week'].unique())} (Should be 0-6)")
print(f"• Peak hour distribution:\n{df['is_peak_hour'].value_counts(normalize=True) * 100}")

# 4. Dwell Time Sanity Check (Capping Verification)
print("\n--- Dwell Time (Duration) Analytics ---")
print(f"• Min Duration: {df['duration_mins'].min()} mins")
print(f"• Max Duration: {df['duration_mins'].max()} mins (Should be capped at 480.0)")
print(f"• Average Duration: {df['duration_mins'].mean():.2f} mins")

# 5. Severity Weights (W) Verification
print("\n--- Severity Weights (W) Value Counts ---")
print(df['severity_weight'].value_counts().sort_index())

# 6. Bias Weights (B) Verification
print("\n--- Bias Weights (B) Range ---")
print(f"• Min Bias Weight applied: {df['bias_weight'].min():.4f}")
print(f"• Max Bias Weight applied: {df['bias_weight'].max():.4f}")

# 7. Spatial H3 Clustering Density Check
print("\n--- Geospatial Index Volumetrics ---")
print(f"• Total Unique Macro Hotspots (H3 Res 8): {df['h3_res8'].nunique()}")
print(f"• Total Unique Micro Hotspots (H3 Res 9): {df['h3_res9'].nunique()}")
print("\nTop 5 Most Congested H3 Res 9 Hexagons:")
print(df['h3_res9'].value_counts().head(5))

# 8. Visual Sample Check
print("\n--- Row Sample Head ---")
print(df[['police_station', 'violation_type', 'is_peak_hour', 'severity_weight', 'h3_res9', 'bias_weight']].head(5))

# ==========================================
# STEP 6: Save Cleaned Data for Phase 2
# ==========================================
print("\nSaving cleaned dataset for Phase 2...")
df.to_csv("cleaned_violations.csv", index=False)
print("✔️ Successfully saved to 'cleaned_violations.csv'. You can now run Phase 2.")