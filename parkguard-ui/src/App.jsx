import { useEffect, useState } from 'react';
import { AlertTriangle, Shield, Map, Activity, BarChart2, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CommandMap from './components/CommandMap';
import DispatchRouter from './components/DispatchRouter';
import AnalyticsDashboard from './components/AnalyticsDashboard';
function App() {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('command'); // 'command' | 'analytics'

  // Fetch the CIS rankings from our FastAPI backend
  useEffect(() => {
    fetch('https://im-amrith-parkguard-backend.hf.space/api/rankings')
      .then(res => res.json())
      .then(data => {
        setRankings(data);
        setLoading(false);
      })
      .catch(err => console.error("Error fetching rankings:", err));
  }, []);

  const topZone = rankings.length > 0 ? rankings[0] : null;

  return (
    <div className="min-h-screen bg-[#05080c] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0a1120] via-[#05080c] to-black text-gray-100 p-6 font-sans">
      
      {/* HEADER */}
      <header className="mb-8 border-b border-white/5 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 tracking-tight">
            <Shield className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" size={32} />
            ParkGuard <span className="font-light text-cyan-400">AI</span>
            <span className="text-gray-600 font-light text-2xl ml-2">| Tactical Command</span>
          </h1>
          <p className="text-gray-400 mt-2 font-mono text-xs uppercase tracking-widest">Bengaluru Traffic Police [SECURE UPLINK]</p>
        </div>
        
        {/* TABS & LIVE STATUS */}
        <div className="flex items-center gap-6">
          <div className="flex bg-[#0a0f18]/80 backdrop-blur-md p-1 rounded-lg border border-white/5 shadow-inner">
            <button 
              onClick={() => setActiveTab('command')}
              className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'command' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Radio size={16} /> LIVE OPS
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'analytics' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <BarChart2 size={16} /> IMPACT QUANTIFICATION
            </button>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg flex items-center gap-2 font-bold animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.2)] font-mono text-sm tracking-wide">
            <AlertTriangle size={18} />
            DEFCON: CODE RED
          </div>
        </div>
      </header>

      {/* KPI METRICS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <MetricCard 
          title="Critical Zone" 
          value={loading ? "..." : `C-${topZone?.cluster_id}`} 
          subtitle="Immediate Action" 
          icon={<AlertTriangle className="text-red-500" />} 
          borderColor="border-red-500/50"
          glowClass="shadow-[0_0_20px_rgba(239,68,68,0.15)]"
        />
        <MetricCard 
          title="Predicted Violations" 
          value={loading ? "..." : Math.round(topZone?.predicted_volume_V || 0)} 
          subtitle="12H Forecast" 
          icon={<Activity className="text-orange-400" />} 
          borderColor="border-orange-500/30"
        />
        <MetricCard 
          title="Active Hotspots" 
          value={loading ? "..." : rankings.length} 
          subtitle="City-Wide Radar" 
          icon={<Map className="text-cyan-400" />} 
          borderColor="border-cyan-500/30"
        />
        <MetricCard 
          title="A.I. Efficiency Gain" 
          value="35.4%" 
          subtitle="Patrol Lift" 
          icon={<Shield className="text-emerald-400" />} 
          borderColor="border-emerald-500/30"
        />
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'command' ? (
          <motion.div 
            key="command"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* LEFT: INTERACTIVE MAP */}
            <div className="lg:col-span-2 bg-[#0a0f18]/60 backdrop-blur-2xl border border-white/5 rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
              <h2 className="text-lg font-mono font-bold mb-4 text-white flex items-center gap-3 uppercase tracking-widest">
                <Map size={18} className="text-cyan-400"/>
                Tactical Map Overlay
              </h2>
              <CommandMap />
            </div>

            {/* RIGHT: DISPATCH HUD */}
            <div className="bg-[#0a0f18]/60 backdrop-blur-2xl border border-white/5 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
              {topZone && (
                <DispatchRouter 
                  targetLat={12.9716 + (topZone.cluster_id * 0.001)} 
                  targetLng={77.5946 + (topZone.cluster_id * 0.001)} 
                />
              )}
              
              <h2 className="text-lg font-mono font-bold mt-6 mb-4 text-white flex items-center gap-3 uppercase tracking-widest border-t border-white/5 pt-6">
                <Activity size={18} className="text-orange-400"/>
                Threat Vector
              </h2>
              <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-500 font-mono text-xs uppercase tracking-wider">
                      <th className="pb-3 font-semibold">Zone</th>
                      <th className="pb-3 font-semibold text-right">Vol (12H)</th>
                      <th className="pb-3 font-semibold text-right">CIS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="3" className="py-8 text-center text-gray-600 font-mono text-sm animate-pulse">Establishing uplink...</td></tr>
                    ) : (
                      rankings.slice(0, 10).map((row, idx) => (
                        <tr key={row.cluster_id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                          <td className="py-4 font-mono font-bold text-gray-300">
                            <span className={`inline-block w-2 h-2 rounded-full mr-3 shadow-[0_0_8px_currentColor] ${idx === 0 ? 'bg-red-500 text-red-500 animate-pulse' : 'bg-orange-500/50 text-orange-500/50'}`}></span>
                            C-{row.cluster_id}
                          </td>
                          <td className="py-4 text-right text-gray-400 font-mono">
                            {Math.round(row.predicted_volume_V)}
                          </td>
                          <td className="py-4 text-right">
                            <span className={`px-2 py-1 rounded text-xs font-mono font-bold border ${idx === 0 ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                              {row.CIS_Score_100.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className="h-[800px]"
          >
            <AnalyticsDashboard />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Reusable UI Component for the top metrics
function MetricCard({ title, value, subtitle, icon, borderColor = "border-white/5", glowClass = "" }) {
  return (
    <div className={`bg-[#0a0f18]/60 backdrop-blur-xl border-t border-l ${borderColor} rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-start justify-between relative overflow-hidden group hover:bg-[#0f1725]/80 transition-all ${glowClass}`}>
      <div className="absolute -inset-1 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur-lg pointer-events-none"></div>
      <div className="relative z-10">
        <p className="text-gray-500 font-mono text-[10px] uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-white mb-1 font-mono tracking-tight">{value}</h3>
        <p className="text-cyan-400/70 font-mono text-[10px] uppercase tracking-widest">{subtitle}</p>
      </div>
      <div className="bg-black/40 border border-white/5 p-3 rounded-xl relative z-10">
        {icon}
      </div>
    </div>
  );
}

export default App;
