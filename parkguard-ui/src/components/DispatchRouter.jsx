import { useState } from 'react';
import { ShieldAlert, Truck, MapPin, XOctagon } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DispatchRouter() {
  const [dispatchStatus, setDispatchStatus] = useState('idle'); 
  const [unitData, setUnitData] = useState(null);

  // === CANCEL FUNCTION (Now sweeps the extra markers too!) ===
  // === NUCLEAR CANCEL FUNCTION ===
  const cancelDispatch = () => {
    setDispatchStatus('idle');
    setUnitData(null);

    // 1. Standard Mappls Plugin Cleanup (Polite Request)
    if (window.currentTacticalRoute && window.mapplsMap) {
      try { window.mappls.remove({ map: window.mapplsMap, layer: window.currentTacticalRoute }); } catch (e) {}
      try { window.currentTacticalRoute.remove(); } catch (e) {}
      window.currentTacticalRoute = null;
    }

    // 2. Clear all brown standby police markers
    if (window.secondaryPoliceMarkers && window.mapplsMap) {
      window.secondaryPoliceMarkers.forEach(marker => {
        try { window.mappls.remove({ map: window.mapplsMap, layer: marker }); } catch (e) {}
      });
      window.secondaryPoliceMarkers = [];
    }

    // 3. NUCLEAR DOM SCRUB: Force-delete any stranded Mappls HTML markers
    try {
      const allDivs = document.querySelectorAll('div');
      allDivs.forEach(div => {
        // Target our exact custom HTML badges and annihilate them
        if (div.innerHTML.includes('🚓') || div.innerHTML.includes('⚠️') || div.innerHTML.includes('Standby Unit Ready')) {
          div.remove();
        }
      });
    } catch (e) {
      console.warn("DOM Scrub failed", e);
    }

    // 4. NUCLEAR GPU LAYER SWEEP: Force Mapbox GL to delete the route lines
    if (window.mapplsMap && window.mapplsMap.getStyle) {
      try {
        const style = window.mapplsMap.getStyle();
        if (style && style.layers) {
          style.layers.forEach(layer => {
            // MapmyIndia hides their direction lines under IDs containing these words
            if (layer.id.includes('direction') || layer.id.includes('route') || layer.id.includes('path')) {
              window.mapplsMap.removeLayer(layer.id);
            }
          });
        }
      } catch (e) {
        console.warn("Layer Sweep failed", e);
      }
    }
  };

  const executeDynamicDispatch = async () => {
    setDispatchStatus('scanning');

    try {
      const geoRes = await fetch('https://im-amrith-parkguard-backend.hf.space/api/geojson');
      const geoData = await geoRes.json();

      const rankRes = await fetch('https://im-amrith-parkguard-backend.hf.space/api/rankings');
      const rankings = await rankRes.json();

      let worstClusterId = null;
      let maxCis = -1;

      rankings.forEach(r => {
        const currentScore = r.cis_score || r.CIS_Score || 0;
        if (currentScore > maxCis) {
          maxCis = currentScore;
          worstClusterId = r.cluster_id;
        }
      });

      const targetFeature = geoData.features.find(
        f => parseInt(f.properties.cluster_id) === parseInt(worstClusterId)
      );

      if (!targetFeature) {
        console.error(`Could not find Cluster ${worstClusterId} in GeoJSON data!`);
        setDispatchStatus('idle');
        return;
      }

      const targetCoords = targetFeature.geometry.coordinates[0][0];
      const targetLat = parseFloat(targetCoords[1]);
      const targetLng = parseFloat(targetCoords[0]);

      if (window.mappls && window.mapplsMap) {
        window.mappls.nearby(
          {
            keywords: "Police Station",
            refLocation: [targetLat, targetLng],
            radius: 5000,
            fitbounds: false
          },
          function (nearbyData) {

            let results = [];
            if (nearbyData?.data) results = nearbyData.data;
            else if (nearbyData?.suggestedLocations) results = nearbyData.suggestedLocations;
            else if (Array.isArray(nearbyData)) results = nearbyData;

            if (results.length > 0) {
              const closestStation = results[0];
              const stationName = closestStation.placeName || closestStation.poi || "Tactical Response Unit";

              const sLat = closestStation.latitude || closestStation.lat || closestStation.y;
              const sLng = closestStation.longitude || closestStation.lng || closestStation.x;
              
              const startLocation = closestStation.eLoc ? closestStation.eLoc : `${sLat},${sLng}`;

              setDispatchStatus('routing');

              // === 1. DRAW THE TACTICAL ROUTE ===
              window.currentTacticalRoute = window.mappls.direction({
                map: window.mapplsMap,
                start: startLocation,
                end: `${targetLat},${targetLng}`,
                profile: 'driving',
                routeColor: '#3b82f6',
                activeStrokeWidth: 7,
                fitbounds: true,
                // VISUAL FIX: Added !important to protect against CSS overwriting
                start_icon: {
                  html: `<div style="background-color: #2563eb !important; color: #ffffff !important; padding: 6px 12px; border-radius: 6px; font-weight: bold; border: 2px solid #ffffff !important; box-shadow: 0 4px 6px rgba(0,0,0,0.5); font-family: sans-serif; white-space: nowrap; transform: translate(-50%, -100%);">🚓 ${stationName}</div>`,
                  width: 150,
                  height: 40
                },
                end_icon: {
                  html: `<div style="background-color: #ef4444 !important; color: #ffffff !important; padding: 6px 12px; border-radius: 6px; font-weight: bold; border: 2px solid #ffffff !important; box-shadow: 0 4px 6px rgba(0,0,0,0.5); font-family: sans-serif; white-space: nowrap; transform: translate(-50%, -100%);">⚠️ Target: Zone ${worstClusterId}</div>`,
                  width: 150,
                  height: 40
                },
                callback: function (routeData) {
                  setUnitData({
                    station: stationName,
                    targetId: worstClusterId,
                    status: 'EN ROUTE'
                  });
                  setDispatchStatus('deployed');
                }
              });

              // === 2. DROP MARKERS FOR ALL OTHER STANDBY STATIONS ===
              // === 2. DROP MARKERS FOR ALL OTHER STANDBY STATIONS ===
              // === 2. DROP MARKERS FOR ALL OTHER STANDBY STATIONS ===
              window.secondaryPoliceMarkers = window.secondaryPoliceMarkers || [];
              
              console.log(`Found ${results.length - 1} standby stations.`); 
              
              results.forEach((station, index) => {
                if (index === 0) return; // Skip the one we are routing from!

                const stLat = station.latitude || station.lat || station.y;
                const stLng = station.longitude || station.lng || station.x;
                const name = station.placeName || station.poi || "Standby Station";

                let positionParam = null;
                  
                if (stLat && stLng) {
                    const parsedLat = parseFloat(stLat);
                    const parsedLng = parseFloat(stLng);
                    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                        positionParam = { lat: parsedLat, lng: parsedLng };
                    }
                } else if (station.eLoc) {
                    positionParam = station.eLoc;
                }

                if (positionParam) {
                  try {
                    let marker;
                    const markerOptions = {
                      map: window.mapplsMap,
                      width: 18,
                      height: 18,
                      offset: [0, 0],
                      icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
                      // FIX: Put HTML back! This bypasses the broken 'hasImage' crash!
                      html: `<div style="background-color: #92400e; width: 18px; height: 18px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.6); cursor: pointer;"></div>`,
                      popupHtml: `<div style="padding: 10px; color: black; font-family: sans-serif; min-width: 160px; line-height: 1.4;">
                                    <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: bold;">${name}</h4>
                                    <span style="font-size: 11px; color: #666; font-weight: bold; text-transform: uppercase;">Standby Unit Ready</span>
                                  </div>`
                    };

                    if (typeof positionParam === 'string') {
                      if (window.mappls.pinMarker) {
                        markerOptions.pin = positionParam;
                        marker = new window.mappls.pinMarker(markerOptions);
                      } else if (window.mappls.elocMarker) {
                        markerOptions.eloc = positionParam;
                        marker = new window.mappls.elocMarker(markerOptions);
                      } else {
                        throw new Error("mappls.pinMarker plugin is not loaded, cannot plot by eLoc string.");
                      }
                    } else {
                      markerOptions.position = positionParam;
                      marker = new window.mappls.Marker(markerOptions);
                    }
                    
                    window.secondaryPoliceMarkers.push(marker);
                  } catch (e) {
                    console.warn("Could not drop standby marker:", e);
                  }
                }
              });

            } else {
              console.warn("No police stations found within 5km.");
              setDispatchStatus('idle');
            }
          }
        );
      }

    } catch (error) {
      console.error("Dynamic Dispatch Failed:", error);
      setDispatchStatus('idle');
    }
  };

  return (
    <div className="mt-2 mb-6 p-5 bg-[#0a0f18]/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden">
      
      <style>{`
        /* 1. Main Header of the Route Box */
        .MMIrtNm { 
          background-color: #1f2937 !important; /* Dark Gray */
          color: #ffffff !important; /* Pure White Text */
          border-color: #374151 !important; 
        }
        
        /* 2. Main Route Summary Row */
        .mmirtRw { 
          background-color: rgba(17, 24, 39, 0.9) !important; /* Translucent Dark Background */
          border-color: #374151 !important; 
        }
        
        /* 3. Distance and ETA Text */
        .mmiRtTDLT, .mmiRtTDRT { 
          color: #10b981 !important; /* Bright Emerald Green for ETA */
          font-weight: bold !important;
        }
        
        /* 4. Turn-by-turn Navigation List */
        .mmirtInst ul li { 
          background-color: #111827 !important; 
        }
        .turn-tab-text { 
          border-color: #374151 !important; 
        }
        
        /* 5. Turn-by-turn Instructions Text */
        .turn-tab-text h2 { 
          color: #ffffff !important; /* White Street Names */
        }
        .turn-tab-text-mt { 
          color: #9ca3af !important; /* Light Gray sub-text */
        }

        /* 6. Push the box down so it stops overlapping the map controls! */
        .mappls-direction-container, .leaflet-routing-container {
            margin-top: 50px !important;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5) !important;
            border-radius: 8px !important;
            overflow: hidden !important;
        }
      `}</style>
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center justify-between mb-4 relative z-10">
        <h3 className="text-white font-semibold flex items-center gap-2 tracking-wide">
          <ShieldAlert size={20} className="text-blue-400" />
          Dynamic Tactical Dispatch
        </h3>
        
        {dispatchStatus === 'deployed' ? (
          <button
            onClick={cancelDispatch}
            className="px-4 py-2 text-sm font-bold rounded-lg shadow-lg transition-all duration-300 flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white"
          >
            <XOctagon size={16} />
            Stand Down Unit
          </button>
        ) : (
          <button
            onClick={executeDynamicDispatch}
            disabled={dispatchStatus !== 'idle'}
            className={`px-4 py-2 text-sm font-bold rounded-lg shadow-lg transition-all duration-300 flex items-center gap-2
              ${dispatchStatus === 'idle'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
          >
            {dispatchStatus === 'idle' && "Initialize Deployment"}
            {dispatchStatus === 'scanning' && "Scanning Vicinity..."}
            {dispatchStatus === 'routing' && "Plotting Trajectory..."}
          </button>
        )}
      </div>

      {/* === CSS BULLETPROOF DISPATCH INFO BOX === */}
      {dispatchStatus === 'deployed' && unitData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 relative z-10">
          
          {/* Origin Base Card */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="p-3 rounded-xl flex items-start gap-3 shadow-lg !bg-white/5 backdrop-blur-md !border !border-white/10"
          >
            <div className="p-2 rounded-lg !bg-cyan-500/20 border border-cyan-500/30">
              <MapPin size={20} className="!text-cyan-400" />
            </div>
            <div className="overflow-hidden w-full">
              <p className="!text-gray-400 !text-[10px] !uppercase !font-mono !font-bold !tracking-widest !m-0">
                Origin Base
              </p>
              <p 
                className="!text-white !text-sm !font-mono !font-semibold !mt-1 !mb-0 !truncate !leading-tight tracking-tight"
                title={unitData.station}
              >
                {unitData.station}
              </p>
            </div>
          </motion.div>

          {/* Target Zone Card */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            className="p-3 rounded-xl flex items-start gap-3 shadow-lg !bg-red-500/5 backdrop-blur-md !border !border-red-500/20"
          >
            <div className="p-2 rounded-lg !bg-red-500/20 border border-red-500/30">
              <Truck size={20} className="!text-red-400" />
            </div>
            <div className="overflow-hidden w-full">
              <p className="!text-red-400/70 !text-[10px] !uppercase !font-mono !font-bold !tracking-widest !m-0">
                Target Zone
              </p>
              <p className="!text-white !text-sm !font-mono !font-semibold !mt-1 !mb-0 !truncate !leading-tight tracking-tight">
                Cluster {unitData.targetId} [CODE RED]
              </p>
            </div>
          </motion.div>

        </div>
      )}
    </div>
  );
}
