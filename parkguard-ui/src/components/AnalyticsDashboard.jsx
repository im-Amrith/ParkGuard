import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { Activity, Zap, BarChart2 } from 'lucide-react';

export default function AnalyticsDashboard() {
  const [causalData, setCausalData] = useState([]);
  const [roiData, setRoiData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('https://im-amrith-parkguard-backend.hf.space/api/analytics/causal-graph').then(res => res.json()),
      fetch('https://im-amrith-parkguard-backend.hf.space/api/analytics/roi').then(res => res.json())
    ]).then(([causal, roi]) => {
      setCausalData(causal);
      setRoiData(roi);
      setLoading(false);
    }).catch(err => console.error("Error fetching analytics data:", err));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-cyan-400 font-mono animate-pulse">
        [INITIALIZING TELEMETRY...]
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full"
    >
      
      {/* Chart 1: The Congestion Causal Graph */}
      <div className="bg-[#0a0f18]/60 backdrop-blur-2xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="text-cyan-400" size={24} />
          <h2 className="text-2xl font-bold text-white tracking-wide">Congestion Causal Graph</h2>
        </div>
        <p className="text-gray-400 text-sm mb-6 max-w-lg">
          Analyzes the tipping point where illegal parking volume catastrophically collapses intersection speed.
          <br/><span className="text-emerald-400 font-mono mt-2 block">» Critical Threshold: 15 vehicles</span>
        </p>

        <div className="flex-1 min-h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={causalData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              
              <XAxis 
                dataKey="time" 
                stroke="#6b7280" 
                tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'JetBrains Mono' }} 
                tickMargin={15}
              />
              
              {/* Left Y-Axis for Volume (Red) */}
              <YAxis 
                yAxisId="left" 
                stroke="#ef4444" 
                tick={{ fill: '#ef4444', fontSize: 12, fontFamily: 'JetBrains Mono' }} 
                label={{ value: 'Parking Violations', angle: -90, position: 'insideLeft', fill: '#ef4444', style: { textAnchor: 'middle' } }}
              />
              
              {/* Right Y-Axis for Speed (Blue) */}
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#3b82f6" 
                tick={{ fill: '#3b82f6', fontSize: 12, fontFamily: 'JetBrains Mono' }} 
                label={{ value: 'Avg Speed (km/h)', angle: -90, position: 'insideRight', fill: '#3b82f6', style: { textAnchor: 'middle' } }}
              />

              <RechartsTooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontFamily: 'JetBrains Mono' }}
                itemStyle={{ fontWeight: 'bold' }}
              />
              
              <Legend wrapperStyle={{ paddingTop: '20px', fontFamily: 'JetBrains Mono', fontSize: '12px' }} />

              <Line 
                yAxisId="left" 
                type="monotone" 
                dataKey="parking_volume" 
                name="Violations Vol." 
                stroke="#ef4444" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#111827' }} 
                activeDot={{ r: 8, stroke: '#ef4444', strokeWidth: 2, fill: '#111827' }}
              />
              
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="speed" 
                name="Speed (km/h)" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#111827' }}
                activeDot={{ r: 8, stroke: '#3b82f6', strokeWidth: 2, fill: '#111827' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Enforcement ROI */}
      <div className="bg-[#0a0f18]/60 backdrop-blur-2xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <Zap className="text-emerald-400" size={24} />
          <h2 className="text-2xl font-bold text-white tracking-wide">Enforcement R.O.I.</h2>
        </div>
        <p className="text-gray-400 text-sm mb-6 max-w-lg">
          Quantifying the direct impact of predictive dispatch. Compares the hours of gridlock delay prevented based on the type of intervention.
        </p>

        <div className="flex-1 min-h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={roiData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
              
              <XAxis 
                type="number" 
                stroke="#6b7280" 
                tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'JetBrains Mono' }} 
                tickMargin={10}
              />
              
              <YAxis 
                type="category" 
                dataKey="action" 
                stroke="#6b7280" 
                width={150} 
                tick={{ fill: '#e5e7eb', fontSize: 13, fontWeight: '500' }} 
              />
              
              <RechartsTooltip 
                cursor={{ fill: '#ffffff05' }}
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontFamily: 'JetBrains Mono' }}
                itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                formatter={(value) => [`${value} Hours Saved`, 'Impact']}
              />

              <Bar 
                dataKey="delay_prevented_hours" 
                name="Delay Prevented (Hours)" 
                radius={[0, 4, 4, 0]}
                barSize={40}
              >
                {roiData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.action.includes('Early Tow') ? '#10b981' : '#3b82f6'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </motion.div>
  );
}
