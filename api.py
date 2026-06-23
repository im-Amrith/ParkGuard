from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import json
import requests

app = FastAPI()

# Allow React to fetch data
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For hackathon local dev
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/rankings")
def get_rankings():
    df = pd.read_csv("final_cis_rankings.csv")
    return df.to_dict(orient="records")

@app.get("/api/forecasts/{cluster_id}")
def get_forecasts(cluster_id: int):
    df = pd.read_csv("hotspot_forecasts.csv")
    cluster_df = df[df['cluster_id'] == cluster_id]
    return cluster_df.to_dict(orient="records")

@app.get("/api/geojson")
def get_geojson():
    with open("bengaluru_hotspots.geojson", "r") as f:
        data = json.load(f)
    
    valid_features = []
    for f in data['features']:
        coords = f['geometry']['coordinates']
        
        # Only process if coordinates exist
        if len(coords) > 0:
            # FIX: Leaflet requires Polygons to be an array of linear rings.
            # If our coordinate array is missing that outer layer, wrap it.
            if f['geometry']['type'] == 'Polygon' and isinstance(coords[0][0], (int, float)):
                f['geometry']['coordinates'] = [coords]
            
            valid_features.append(f)
            
    data['features'] = valid_features
    return data

@app.get("/api/route")
def get_route(start_lng: float, start_lat: float, end_lng: float, end_lat: float):
    # Put your EXACT, correct MapmyIndia API key here
    API_KEY = "qxootglfpaxeapgsquhgnegxxdutjpmymnez" 
    
    # MapmyIndia REST URL
    mmi_url = f"https://apis.mappls.com/advancedmaps/v1/{API_KEY}/route_adv/driving/{start_lng},{start_lat};{end_lng},{end_lat}?steps=true&geometries=geojson"
    
    # Python makes the request (No CORS restrictions!)
    response = requests.get(mmi_url)
    
    # Send the data back to your React app
    return response.json()

@app.get("/api/analytics/causal-graph")
def get_causal_graph():
    # Mock data demonstrating the causal link for the pitch
    # "when illegal parking volume crosses 15 vehicles at 4:00 PM, intersection speed collapses from 40km/h to 12km/h."
    return [
        {"time": "08:00 AM", "parking_volume": 2, "speed": 42},
        {"time": "10:00 AM", "parking_volume": 5, "speed": 38},
        {"time": "12:00 PM", "parking_volume": 8, "speed": 35},
        {"time": "02:00 PM", "parking_volume": 12, "speed": 28},
        {"time": "03:00 PM", "parking_volume": 14, "speed": 25},
        {"time": "04:00 PM", "parking_volume": 18, "speed": 12}, # The collapse
        {"time": "05:00 PM", "parking_volume": 22, "speed": 8},
        {"time": "06:00 PM", "parking_volume": 19, "speed": 10},
        {"time": "08:00 PM", "parking_volume": 9, "speed": 30},
    ]

@app.get("/api/analytics/roi")
def get_roi():
    # Mock data for Enforcement ROI
    return [
        {"action": "Warning Issued", "delay_prevented_hours": 1.5},
        {"action": "Early Tow Dispatch", "delay_prevented_hours": 4.2},
        {"action": "Late Tow Dispatch", "delay_prevented_hours": 0.8},
        {"action": "Manual Re-routing", "delay_prevented_hours": 2.1},
    ]