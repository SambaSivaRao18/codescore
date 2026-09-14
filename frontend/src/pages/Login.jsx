import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Users, Lock, ShieldAlert, X } from 'lucide-react';
import bgImage from '../assets/homepageimage.jpg';

export default function Login() {
  const [teamName, setTeamName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post(
        `${API_URL}/api/login`,
        { teamName, password }
      );

      localStorage.setItem('teamID', response.data.teamID);
      localStorage.setItem('teamName', response.data.teamName);
      if (response.data.timerSecondsRemaining !== undefined) {
        localStorage.setItem('timerSecondsRemaining', response.data.timerSecondsRemaining);
      }

      navigate('/playground');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-white font-['Plus_Jakarta_Sans',sans-serif] select-none">

      {/* Developer Background Image (Positioned on the Right) */}
      <div
        className="absolute inset-0 z-0 bg-no-repeat bg-right"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'auto 100%',
        }}
      />

      {/* Merging White Gradient Shape (Blends left text area into right developer image seamlessly) */}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-white via-white/90 via-40% to-transparent pointer-events-none" />

      {/* Logo Header - Absolute Top Left */}
      <div className="absolute top-6 left-8 xl:top-5 xl:left-12 z-30 text-2xl xl:text-3xl font-black tracking-tight text-slate-900">
        CODE<span className="text-blue-600">SCORE</span>
      </div>

      {/* Main Content Viewport */}
      <div className="relative z-20 h-full w-full flex flex-col justify-center p-8 xl:p-12 overflow-hidden">

        {/* Left Side Info Area */}
        <div className="max-w-xl xl:max-w-2xl flex flex-col justify-center mt-12 py-1">

          {/* Main Copy & Guidelines */}
          <div className="space-y-4 pr-2">

            {/* Main Headline */}
            <h1 className="text-2xl xl:text-3xl font-extrabold text-blue-600 tracking-tight leading-tight">
              Future Developers
            </h1>

            {/* Description Paragraph */}
            <p className="text-slate-800 font-semibold text-xs xl:text-sm leading-relaxed max-w-lg">
              CodeScore is a coding platform design to test coding skills and problem solving under pressure. Solve <span className="text-emerald-600 font-bold">low</span>, <span className="text-amber-500 font-bold">medium</span>, and <span className="text-rose-600 font-bold">hard</span> algorithmic challenges in real-time with an integrated execution engine
            </p>

            {/* Rules & Guidelines */}
            <div className="pt-2">
              <div className="flex items-center gap-1.5 mb-3">
                <h2 className="text-2xl xl:text-2xl font-bold text-rose-600 tracking-tight">Rules & Guidelines</h2>
              </div>

              <ul className="space-y-2 text-slate-800 text-xs xl:text-sm font-semibold leading-snug max-w-lg">
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 font-bold">•</span>
                  <span><strong>Time Limit:</strong> You have exactly 1 hour (60 minutes) to complete the competition.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 font-bold">•</span>
                  <span><strong>Difficulty Levels:</strong> The competition consists of 3 different levels, and each level carries a different set of marks.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 font-bold">•</span>
                  <span><strong>Tie-Breaker:</strong> If two or more teams have the same total score, the team with the lowest average completion time will be declared the winner.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 font-bold">•</span>
                  <span><strong>Read Carefully:</strong> Read each question carefully and completely before submitting your answer.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 font-bold">•</span>
                  <span><strong>No Copying or Pasting:</strong> Copying and pasting are strictly prohibited and actively monitored.</span>
                </li>
              </ul>

              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-xs xl:text-sm font-semibold flex items-start gap-2 max-w-lg">
                <span className="text-base leading-none">⚠️</span>
                <span><strong>Important:</strong> If you close or minimize window, you will be automatically disqualified from the competition.</span>
              </div>
            </div>

          </div>

          {/* Footer note */}
          <div className="text-[11px] text-slate-400 font-medium">
            All The Best to all participants...!!
          </div>

        </div>

        {/* Floating Login Box Positioned at Bottom Right (Matching Image 2) */}
        <div className="absolute bottom-6 right-[234px] xl:bottom-8 xl:right-[266px] z-30 w-[300px] xl:w-[320px] bg-[#071328]/95 backdrop-blur-md border border-blue-500/40 p-3 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] transition-all">

          <div className="flex flex-col items-center mb-2">
            <div className="bg-blue-600 p-2.5 rounded-full mb-2 shadow-md shadow-blue-600/40">
              <Users className="text-white" size={18} />
            </div>
            <h2 className="text-base xl:text-lg font-extrabold text-white tracking-wider uppercase flex items-center gap-1.5">
              <span>TEAM</span> <span className="text-blue-400">LOGIN</span>
            </h2>
            <p className="text-slate-300 mt-1 text-[11px] text-center font-medium">Enter your team credentials to continue</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-3 py-1.5 rounded-lg mb-2 text-xs flex items-center justify-center font-medium">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Users size={15} />
              </div>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#0f213e] border border-slate-700/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-slate-400 text-xs transition-all font-medium"
                placeholder="Enter team name"
                required
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock size={15} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#0f213e] border border-slate-700/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-slate-400 text-xs transition-all font-medium"
                placeholder="Enter password"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full mt-1 bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-2 px-4 rounded-lg shadow-md shadow-blue-600/30 transform transition-all duration-200 active:scale-[0.98] focus:outline-none text-xs tracking-wider uppercase"
            >
              LOGIN
            </button>

            <div className="text-center pt-2">
              <Link to="/admin" className="text-blue-300/80 hover:text-blue-300 text-[11px] font-medium transition-colors underline decoration-blue-300/30 underline-offset-4">
                Admin Login
              </Link>
            </div>
          </form>

        </div>

      </div>



    </div>
  );
}


