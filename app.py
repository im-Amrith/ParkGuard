import streamlit as st
import pandas as pd
import json
import folium
from streamlit_folium import st_folium
import plotly.express as px

# ==========================================
# PAGE CONFIGURATION
# ==========================================
st.set_page_config(page_title="ParkGuard AI Command Center", layout="wide", initial_sidebar_state="expanded")
st.title("🚓 ParkGuard AI: Traffic Command Center")
st.markdown("Predictive Parking Intelligence for Bengaluru Traffic Police")

# ==========================================
# LOAD DATA
# ==========================================
@st.cache_data
def load_data():
    df_cis = pd.read_csv("final_cis_rankings.csv")
    df_forecast = pd.read_csv("hotspot_forecasts.csv")
    with open("bengaluru_hotspots.geojson", "r") as f:
        geojson_data = json.load(f)
    return df_cis, df_forecast, geojson_data

df_cis, df_forecast, geojson_data = load_data()

# Create a dictionary for fast color lookups on the map
cis_dict = df_cis.set_index('cluster_id')['CIS_Score_100'].to_dict()

# ==========================================
# MAP STYLING LOGIC
# ==========================================
def get_color(score):
    if score >= 80: return "#8B0000" # Dark Red (Code Red)
    if score >= 15: return "#FF4500" # Orange/Red
    if score >= 10: return "#FFA500" # Orange
    return "#32CD32" # Green

def style_function(feature):
    cluster_id = int(feature['properties']['cluster_id'])
    score = cis_dict.get(cluster_id, 0)
    color = get_color(score)
    return {
        'fillColor': color,
        'color': 'black',
        'weight': 1,
        'fillOpacity': 0.7 if score > 15 else 0.4
    }

# ==========================================
# LAYOUT: METRICS
# ==========================================
col1, col2, col3, col4 = st.columns(4)
top_cluster = df_cis.iloc[0]
col1.metric("Highest Risk Zone", f"Cluster {int(top_cluster['cluster_id'])}", "Code Red")
col2.metric("Predicted 12H Violations", f"{int(top_cluster['predicted_volume_V'])}", "Severe Bottleneck")
col3.metric("Monitored Hotspots", f"{len(df_cis)}")
col4.metric("Patrol Efficiency Gain", "35%+", "Estimated")

st.divider()

# ==========================================
# LAYOUT: MAP & RANKINGS
# ==========================================
map_col, data_col = st.columns([2, 1])

with map_col:
    st.subheader("Live Priority Heatmap (Next 12 Hours)")
    m = folium.Map(location=[12.9716, 77.5946], zoom_start=11, tiles="CartoDB positron")
    
    # FIX: Filter out empty geometries so Leaflet doesn't crash
    valid_features = [
        feature for feature in geojson_data['features'] 
        if len(feature['geometry']['coordinates']) > 0
    ]
    geojson_data['features'] = valid_features

    # Add GeoJSON polygons
    folium.GeoJson(
        geojson_data,
        style_function=style_function,
        tooltip=folium.GeoJsonTooltip(
            fields=['cluster_id', 'violation_count'],
            aliases=['Cluster ID:', 'Historical Violations:'],
            localize=True
        )
    ).add_to(m)
    
    # FIX: Add a unique key to prevent the initialization error
    st_folium(m, width=800, height=500, key="priority_map")

with data_col:
    st.subheader("Top Priority Deployment")
    # Clean up table for UI
    display_df = df_cis[['cluster_id', 'predicted_volume_V', 'CIS_Score_100']].head(10).copy()
    display_df.columns = ['Zone ID', 'Predicted Tickets (12H)', 'Severity Score']
    st.dataframe(display_df, use_container_width=True, hide_index=True)
    
    st.info("💡 **Insight:** Zone 1 requires immediate stationary enforcement. Mobile patrols should be routed to Zones 2, 7, and 17.")

# ==========================================
# LAYOUT: PREDICTIVE FORECASTING
# ==========================================
st.divider()
st.subheader("📈 48-Hour Predictive Surge Analysis")

selected_cluster = st.selectbox("Select Zone to View Forecast:", df_cis['cluster_id'].head(10))

# Filter forecast data
plot_data = df_forecast[df_forecast['cluster_id'] == selected_cluster].copy()
plot_data['predicted_timestamp'] = pd.to_datetime(plot_data['predicted_timestamp'])

# Create Plotly Chart
fig = px.line(
    plot_data, 
    x='predicted_timestamp', 
    y='predicted_volume_V',
    title=f"Expected Violation Surge Timeline for Zone {selected_cluster}",
    labels={'predicted_timestamp': 'Time', 'predicted_volume_V': 'Predicted Violations'}
)
fig.update_traces(line_color='#FF4500', line_width=3)
fig.update_layout(hovermode="x unified")

st.plotly_chart(fig, use_container_width=True)