import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronUp, Search, ShieldAlert, CheckCircle, RefreshCw } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export default function AdminDashboard() {
  const API_URL = import.meta.env.VITE_API_URL;

  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/admin/leaderboard`
      );
      setLeaderboard(response.data);
    } catch (error) {
      console.error("Failed to fetch leaderboard", error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (teamID) => {
    setExpandedTeamId(prev => prev === teamID ? null : teamID);
  };

  const filteredLeaderboard = leaderboard.filter(team =>
    team.teamName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen overflow-y-auto bg-[#0d121d] text-slate-100 p-6 md:p-10 font-['Plus_Jakarta_Sans',sans-serif] select-none">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Dashboard Title & Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider text-slate-100">
            ADMIN TEAM MANAGEMENT
          </h1>

          <button 
            onClick={fetchLeaderboard}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-xl text-xs font-bold transition-all text-slate-300 active:scale-[0.98]"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-xl">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Teams"
            className="w-full bg-[#131b2c] border border-slate-800/90 rounded-xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition-all font-medium shadow-inner"
          />
        </div>

        {/* Teams Table Container */}
        <div className="bg-[#111726] border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl">
          
          {/* Table Header */}
          <div className="grid grid-cols-12 px-6 py-4 bg-[#141d2f]/90 border-b border-slate-800 text-cyan-400 font-bold text-xs uppercase tracking-wider items-center">
            <div className="col-span-2 sm:col-span-1 text-slate-400">Rank</div>
            <div className="col-span-4 sm:col-span-4 text-cyan-400">Team Name</div>
            <div className="col-span-3 sm:col-span-3 text-cyan-400">Level</div>
            <div className="col-span-2 sm:col-span-2 text-cyan-400 text-right sm:text-left">Total Points</div>
            <div className="hidden sm:block sm:col-span-2 text-cyan-400 text-right">Ave. Time (min)</div>
          </div>

          {/* Table Rows & Accordion Panels */}
          <div className="divide-y divide-slate-800/60">
            {loading && leaderboard.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-semibold">Loading team statistics...</div>
            ) : filteredLeaderboard.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-semibold">No matching teams found.</div>
            ) : (
              filteredLeaderboard.map((team) => {
                const isExpanded = expandedTeamId === team.teamID;

                return (
                  <div key={team.teamID} className="transition-all">
                    
                    {/* Main Team Row */}
                    <div 
                      onClick={() => toggleExpand(team.teamID)}
                      className={`grid grid-cols-12 px-6 py-4 items-center cursor-pointer transition-all ${
                        isExpanded 
                          ? 'bg-[#1b253b] text-white shadow-xl ring-1 ring-cyan-500/40 rounded-xl my-1' 
                          : 'hover:bg-slate-800/40 text-slate-300'
                      }`}
                    >
                      {/* Rank */}
                      <div className="col-span-2 sm:col-span-1 font-bold text-sm text-slate-300">
                        {team.rank}
                      </div>

                      {/* Team Name */}
                      <div className="col-span-4 sm:col-span-4 flex items-center gap-3">
                        <span className="font-extrabold text-sm text-white">{team.teamName}</span>
                      </div>

                      {/* Level (Flag emoji removed per instructions) */}
                      <div className="col-span-3 sm:col-span-3 flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200 capitalize">{team.currentLevel || 'Low'}</span>
                      </div>

                      {/* Total Points */}
                      <div className="col-span-2 sm:col-span-2 text-right sm:text-left font-mono font-bold text-sm text-white">
                        {team.teamScore.toLocaleString()}
                      </div>

                      {/* Ave Time & Expand Icon */}
                      <div className="hidden sm:flex col-span-2 items-center justify-end gap-3 font-mono font-bold text-sm text-slate-200">
                        <span>{team.avgTime !== undefined ? team.avgTime : 0}</span>
                        <button 
                          className={`p-1.5 rounded-full transition-all ${
                            isExpanded ? 'bg-slate-700 text-cyan-400' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Team Skills Accordion Panel */}
                    {isExpanded && (
                      <div className="bg-[#0b101b] border-x border-b border-slate-800/90 p-5 rounded-b-xl mx-2 mb-3 space-y-4 animate-in fade-in duration-200">
                        
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                            TEAM SKILLS VALIDATION
                          </h4>
                        </div>

                        {/* Skill Bars for Python, Java, C */}
                        <div className="space-y-4 pt-1">
                          {team.skills?.map((skill, idx) => {
                            const fillColors = {
                              Python: '#00cfff',
                              Java:   '#f59e0b',
                              C:      '#6366f1',
                            };
                            const fillColor = fillColors[skill.language] || '#00cfff';
                            const pct = Math.min(100, Math.max(0, skill.percentage || 0));

                            return (
                              <div key={idx} className="space-y-1.5">
                                <div className="flex justify-between items-center text-xs font-medium">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-white">{skill.language}</span>
                                    <span className="text-slate-400 text-[11px]">
                                      - {skill.solved} solved out of {skill.total} questions ({skill.percentage}%)
                                    </span>
                                  </div>
                                  <span className="font-mono text-cyan-400 text-xs font-bold">{skill.percentage}%</span>
                                </div>

                                {/* Progress track — always 100% wide */}
                                <div
                                  style={{
                                    width: '100%',
                                    height: '14px',
                                    borderRadius: '7px',
                                    background: '#111a2d',
                                    border: '1px solid #1e2d47',
                                    overflow: 'hidden',
                                    position: 'relative',
                                  }}
                                >
                                  {/* Filled portion — width driven by percentage */}
                                  <div
                                    style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      borderRadius: '7px',
                                      background: fillColor,
                                      transition: 'width 0.5s ease',
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

