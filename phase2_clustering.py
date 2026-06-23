import pandas as pd
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.metrics import silhouette_score
import geopandas as gpd
from shapely.geometry import MultiPoint
import json

# ==========================================
# STEP 1: Load the Spatial Matrix
# ==========================================
print("Starting Phase 2: Spatial Hotspot Detection...")

print("Loading cleaned dataset from Phase 1...")
# Load the dataframe saved by main.py
df = pd.read_csv("cleaned_violations.csv")

# DBSCAN with Haversine metric requires coordinates in radians
coords = df[['latitude', 'longitude']].dropna().values
coords_radians = np.radians(coords)

# ==========================================
# STEP 2: Execute DBSCAN Clustering
# ==========================================
# Earth radius in kilometers
earth_radius = 6371.0 
# We set eps to 50 meters (0.05 km) to catch tight, highly localized bottlenecks
eps_in_radians = 0.05 / earth_radius 
# Minimum 15 tickets within 50 meters to be considered a true "hotspot"
min_samples = 15 

print(f"Running DBSCAN (eps=50m, min_samples={min_samples}). This may take a moment...")
# ball_tree is optimized for haversine distance
dbscan = DBSCAN(eps=eps_in_radians, min_samples=min_samples, metric='haversine', algorithm='ball_tree')
df['cluster_id'] = dbscan.fit_predict(coords_radians)

# ==========================================
# STEP 3: Filter Noise & Calculate Metrics
# ==========================================
# Cluster -1 represents "noise" (isolated tickets that don't form a bottleneck)
hotspots_df = df[df['cluster_id'] != -1].copy()
noise_df = df[df['cluster_id'] == -1]

num_clusters = hotspots_df['cluster_id'].nunique()
coverage_pct = (len(hotspots_df) / len(df)) * 100

print(f"\n=== CLUSTERING RESULTS ===")
print(f"✔️ Found {num_clusters} distinct congestion hotspots.")
print(f"✔️ Filtered out {len(noise_df)} isolated violations (noise).")
print(f"✔️ Hotspots account for {coverage_pct:.1f}% of total validated violations.")

# ==========================================
# STEP 4: Generate Geospatial Polygons (Convex Hulls)
# ==========================================
print("\nGenerating geospatial boundaries (GeoJSON) for dashboard...")

cluster_polygons = []

# Group by the newly found clusters
for cluster_id, group in hotspots_df.groupby('cluster_id'):
    # Extract coordinates for this cluster
    cluster_coords = group[['longitude', 'latitude']].values
    
    # Calculate aggregated metrics for Phase 4 (Scoring)
    total_violations = len(group)
    avg_severity = group['severity_weight'].mean()
    avg_bias = group['bias_weight'].mean()
    
    # Create a Polygon around the points. 
    # Buffer slightly for clusters that form a straight line (like a road)
    if len(cluster_coords) >= 3:
        poly = MultiPoint(cluster_coords).convex_hull
        # If the convex hull is a flat line, add a tiny buffer
        if poly.geom_type == 'LineString':
             poly = poly.buffer(0.0002) 
    else:
        poly = MultiPoint(cluster_coords).buffer(0.0005) # roughly 50m buffer
    
    cluster_polygons.append({
        "type": "Feature",
        "properties": {
            "cluster_id": str(cluster_id),
            "violation_count": int(total_violations),
            "avg_severity_W": float(avg_severity),
            "avg_bias_B": float(avg_bias)
        },
        "geometry": {
            "type": poly.geom_type,
            "coordinates": list(poly.exterior.coords) if poly.geom_type == 'Polygon' else []
        }
    })

# Construct the final GeoJSON object
geojson_output = {
    "type": "FeatureCollection",
    "features": cluster_polygons
}

# Save to file for Phase 5 (Streamlit/Folium map rendering)
with open("bengaluru_hotspots.geojson", "w") as f:
    json.dump(geojson_output, f)

# Save the clustered dataframe for Phase 3 (Forecasting)
hotspots_df.to_csv("clustered_hotspots_data.csv", index=False)

print("✔️ Phase 2 Complete! Generated 'bengaluru_hotspots.geojson' and 'clustered_hotspots_data.csv'.")