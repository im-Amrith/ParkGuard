import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function CommandMap() {
  const mapInstanceRef = useRef(null);
  const mapContainerId = useRef(`mappls-${Math.random().toString(36).substring(2, 9)}`);
  
  const [telemetry, setTelemetry] = useState({ pitch: 60, zoom: 13.5, bearing: -20 });

  useEffect(() => {
    if (!window.mappls) return;
    let isMounted = true;

    if (!mapInstanceRef.current) {
      const map = new window.mappls.Map(mapContainerId.current, {
        center: [12.9716, 77.5946],
        zoom: 12.5,
        pitch: 60, 
        bearing: -20, 
        theme: "dark", 
      });

      mapInstanceRef.current = map;
      window.mapplsMap = map;

      // GET MAP TILT & TELEMETRY
      map.on('move', () => {
          if (isMounted) {
              setTelemetry({
                  pitch: Math.round(map.getPitch()),
                  zoom: map.getZoom().toFixed(2),
                  bearing: Math.round(map.getBearing())
              });
          }
      });

      map.addListener('load', () => {
        if (!isMounted) return;

        // ==========================================
        // 2. PULSING RADAR (POLICE HQ)
        // ==========================================
        const size = 150;
        const pulsingDot = {
            width: size, height: size,
            data: new Uint8Array(size * size * 4),
            onAdd: function() {
                const canvas = document.createElement("canvas");
                canvas.width = this.width; canvas.height = this.height;
                this.context = canvas.getContext("2d");
            },
            render: function() {
                const duration = 1000;
                const t = (performance.now() % duration) / duration;
                const radius = (size / 2) * 0.3;
                const outerRadius = (size / 2) * 0.7 * t + radius;
                const ctx = this.context;

                ctx.clearRect(0, 0, this.width, this.height);
                ctx.beginPath();
                ctx.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(59, 130, 246, ${1 - t})`; 
                ctx.fill();

                ctx.beginPath();
                ctx.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(37, 99, 235, 1)";
                ctx.strokeStyle = "white";
                ctx.lineWidth = 2 + 4 * (1 - t);
                ctx.fill(); ctx.stroke();

                this.data = ctx.getImageData(0, 0, this.width, this.height).data;
                map.triggerRepaint();
                return true;
            }
        };

        map.addImage("pulsing-dot", pulsingDot, { pixelRatio: 2 });
        map.addSource("hq-point", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [77.5959, 12.9806] } }] }
        });
        map.addLayer({ id: "hq-radar", type: "symbol", source: "hq-point", layout: { "icon-image": "pulsing-dot" } });

        // ==========================================
        // 3. REAL AI DATA: 3D POLYGONS & CIS SCORE
        // ==========================================
        fetch('https://im-amrith-parkguard-backend.hf.space/api/geojson').then(res => res.json()).then(geoData => {
            fetch('https://im-amrith-parkguard-backend.hf.space/api/rankings').then(res => res.json()).then(rankings => {
                if (!isMounted) return;
                
                const cisDict = {};
                const volumeDict = {};
                let maxCis = 0;
                let worstClusterCoords = null;

                // FIX: Map strictly by CIS Score
                rankings.forEach(r => {
                    cisDict[r.cluster_id] = r.CIS_Score_100;
                    volumeDict[r.cluster_id] = r.predicted_volume_V;
                    if (r.CIS_Score_100 > maxCis) maxCis = r.CIS_Score_100;
                });

                const clusterPointFeatures = [];

                geoData.features.forEach((feature) => {
                  const clusterId = parseInt(feature.properties.cluster_id);
                  const cisScore = cisDict[clusterId] || 0;
                  const predictedVol = volumeDict[clusterId] || 0;
                  
                  let fillColor = '#22c55e'; 
                  if (cisScore >= 15) fillColor = '#ef4444'; 
                  else if (cisScore >= 11) fillColor = '#f97316'; 

                  const towerHeight = Math.max((cisScore * 15), 10); 

                  const paths = feature.geometry.coordinates[0].map(coord => ({ 
                      lat: parseFloat(coord[1]), 
                      lng: parseFloat(coord[0]) 
                  }));
                  const isCorrupt = paths.some(p => isNaN(p.lat) || isNaN(p.lng));
                  if (isCorrupt) return;
                  const centroid = { lat: paths[0].lat, lng: paths[0].lng };

                  // CRITICAL FIX 3: Stop broken coordinates from spamming the console with 'null'
                  if (isNaN(centroid.lat) || isNaN(centroid.lng)) return; 
                  
                  clusterPointFeatures.push({
                      "type": "Feature",
                      "properties": { "htmlPopup": `Cluster ${clusterId}` },
                      "geometry": { 
                          "type": "Point", 
                          "coordinates": [centroid.lng, centroid.lat] 
                      } 
                  });

                  if (cisScore === maxCis && !worstClusterCoords) {
                      worstClusterCoords = centroid;
                  }

                  new window.mappls.Polygon({
                    map: map, 
                    paths: paths, 
                    fillColor: fillColor, 
                    fillOpacity: 0.35, // CRITICAL FIX 2: Made hologram-transparent so you can see the route under it!
                    strokeColor: fillColor, // Match stroke to fill for a neon look
                    strokeOpacity: 0.9, 
                    extrude: true, 
                    extrudeHeight: towerHeight,
                    fitbounds: false,
                    popupHtml: `<div style="padding:10px; color:black;"><h4>Zone ${clusterId}</h4><p>CIS Score: <b>${cisScore.toFixed(1)}</b></p><p>Surge: <b>${Math.round(predictedVol)}</b></p></div>`
                  });
                });

                // ==========================================
                // 4. ADVANCED CLUSTER MARKER (Using Zone Centroids)
                // ==========================================
                // ==========================================
                // 4. ADVANCED CLUSTER MARKER (Native GPU Layers)
                // ==========================================
                
                // 1. Feed the GeoJSON directly to the Map Engine's Memory
                map.addSource('zone-clusters-source', {
                    type: 'geojson',
                    data: {
                        "type": "FeatureCollection",
                        "features": clusterPointFeatures
                    },
                    cluster: true,
                    clusterMaxZoom: 12, // At zoom 12, they break apart
                    clusterRadius: 50   // Grouping distance
                });

                // 2. Draw the Colored Cluster Bubbles
                map.addLayer({
                    id: 'clusters-layer',
                    type: 'circle',
                    source: 'zone-clusters-source',
                    filter: ['has', 'point_count'],
                    paint: {
                        // Color based on how many zones are inside
                        'circle-color': [
                            'step',
                            ['get', 'point_count'],
                            '#22c55e', // Tailwind Emerald for 1-4 zones
                            5, '#f97316', // Tailwind Orange for 5-9 zones
                            10, '#ef4444' // Tailwind Crimson for 10+ zones
                        ],
                        // Size based on how many zones are inside
                        'circle-radius': [
                            'step',
                            ['get', 'point_count'],
                            20, // 20px radius for < 5
                            5, 30, // 30px radius for 5-9
                            10, 40 // 40px radius for >= 10
                        ],
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff'
                    }
                });

                // 3. Draw the Numbers inside the Bubbles
                map.addLayer({
                    id: 'cluster-count-layer',
                    type: 'symbol',
                    source: 'zone-clusters-source',
                    filter: ['has', 'point_count'],
                    layout: {
                        'text-field': '{point_count_abbreviated}',
                        'text-size': 14,
                        'text-allow-overlap': true
                    },
                    paint: {
                        'text-color': '#ffffff'
                    }
                });

                // 4. The "Invisible Pin" Hack - Make broken-apart points size 0
                map.addLayer({
                    id: 'unclustered-point-layer',
                    type: 'circle',
                    source: 'zone-clusters-source',
                    filter: ['!', ['has', 'point_count']],
                    paint: {
                        'circle-radius': 0, // Literally zero pixels, so you only see your 3D Polygons!
                        'circle-opacity': 0
                    }
                });

                // ==========================================
                // 5. BOUNCING WARNING MARKER (Targets Highest CIS)
                // ==========================================
                if (worstClusterCoords) {
                    const style = document.createElement('style');
                    style.innerHTML = `@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-30px); } } .bounce { animation: bounce 0.7s infinite linear both; width: 40px; height: 40px; }`;
                    document.head.appendChild(style);

                    new window.mappls.Marker({
                        map: map,
                        position: worstClusterCoords,
                        html: '<div><img class="bounce" src="https://apis.mappls.com/map_v3/1.png" style="filter: hue-rotate(150deg);"></div>'
                    });
                }
            });
        });
      });
    }

    return () => {
      isMounted = false;
      window.mapplsMap = null;
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch (e) {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-[500px] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/5 relative bg-[#05080c]">
      <div id={mapContainerId.current} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
      
      <motion.div 
        initial={{ opacity: 0, x: -20, y: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.2 }}
        className="absolute bottom-6 left-4 bg-[#0a0f18]/80 text-cyan-400 font-mono text-xs px-4 py-3 rounded-xl border border-white/10 z-50 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.4)] pointer-events-none uppercase tracking-widest"
      >
        <div className="text-emerald-400 mb-1 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_currentColor]"></div>
          SAT-LINK: SECURE
        </div>
        <div className="text-gray-400 mt-2">TILT (PITCH): <span className="text-white">{telemetry.pitch}°</span></div>
        <div className="text-gray-400 mt-1">ZOOM LEVEL: <span className="text-white">{telemetry.zoom}x</span></div>
        <div className="text-gray-400 mt-1">BEARING: <span className="text-white">{telemetry.bearing}°</span></div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, x: 20, y: -20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.4 }}
        className="absolute top-4 right-4 bg-[#0a0f18]/80 text-white font-mono text-xs px-4 py-2 rounded-xl border border-white/10 z-50 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.4)] pointer-events-none tracking-tight uppercase"
      >
        <span className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_currentColor] animate-pulse"></div>
          Powered by <span className="text-cyan-400 font-bold ml-1">Mappls Digital Twin</span>
        </span>
      </motion.div>
    </div>
  );
}
