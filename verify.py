import pandas as pd

# Load your clustered data
df = pd.read_csv("clustered_hotspots_data.csv")

# We want to look at Cluster 1 (the one with 22,771 tickets)
cluster_1 = df[df['cluster_id'] == 1]

print("=== VERIFYING CLUSTER 1 (CODE RED ZONE) ===")
print("\nMost Common Street Addresses in this Cluster:")
print(cluster_1['location'].value_counts().head(3))

print("\nMost Common Junction Names in this Cluster:")
print(cluster_1['junction_name'].value_counts().head(3))

print("\nAverage Coordinate Center:")
print(f"Google Maps Link: https://www.google.com/maps/search/?api=1&query={cluster_1['latitude'].mean()},{cluster_1['longitude'].mean()}")