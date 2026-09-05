import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Users, Lock, ShieldAlert, X } from 'lucide-react';
import bgImage from '../assets/homepageimage.jpg';

export default function Login() {
  const [teamName, setTeamName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showDisqualifiedModal, setShowDisqualifiedModal] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await axios.post('http://localhost:3000/api/login', { teamName, password });
      localStorage.setItem('teamID', response.data.teamID);
      localStorage.setItem('teamName', response.data.teamName);
      navigate('/playground');
    } catch (err) {
      if (err.response?.data?.isDisqualified || err.response?.status === 403) {
        setShowDisqualifiedModal(true);
      } else {
        setError(err.response?.data?.error || 'Login failed');
      }
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

      {/* Main Content Viewport */}
      <div className="relative z-20 h-full w-full flex flex-col justify-between p-8 xl:p-12 overflow-hidden">

        {/* Left Side Info Area */}
        <div className="max-w-xl xl:max-w-2xl h-full flex flex-col justify-between py-1">

          {/* Logo Header */}
          <div className="text-3xl xl:text-4xl font-black tracking-tight text-slate-900">
            CODE<span className="text-blue-600">SCORE</span>
          </div>

          {/* Main Copy & Guidelines */}
          <div className="my-auto space-y-4 pr-2">

            {/* Main Headline */}
            <h1 className="text-4xl xl:text-5xl font-extrabold text-blue-600 tracking-tight leading-tight">
              Future Developers
            </h1>

            {/* Description Paragraph */}
            <p className="text-slate-800 font-semibold text-base xl:text-lg leading-relaxed max-w-lg">
              CodeScore is a coding platform design to test problem-solving under pressure. Solve <span className="text-emerald-600 font-bold">low</span>, <span className="text-amber-500 font-bold">medium</span>, and <span className="text-rose-600 font-bold">hard</span> algorithmic challenges in real-time with an integrated execution engine
            </p>

            {/* Rules & Guidelines */}
            <div className="pt-2">
              <div className="flex items-center gap-1.5 mb-3">
                <h2 className="text-2xl xl:text-3xl font-bold text-rose-600 tracking-tight">Rules & Guidlines</h2>
                <div className="w-8 h-8 rounded-full bg-emerald-100/90 border border-emerald-300/80 flex items-center justify-center text-base shadow-xs">
                  👨‍💻
                </div>
              </div>

              <ul className="space-y-2 text-slate-800 text-xs xl:text-sm font-semibold leading-snug max-w-lg">
                <li className="flex items-start gap-2">
                  <span className="text-slate-100 font-bold">•</span>
                  <span><strong>Time Limit:</strong> You have exactly 1 hour (60 minutes) to complete the entire competition.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-100 font-bold">•</span>
                  <span><strong> 25 Total Challenges:</strong> Solve 10 Low, 10 Medium, and 5 Hard Challenges. </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-100 font-bold">•</span>
                  <span><strong>Hidden Scoring:</strong> All code is evaluated against secret test cases, and scores are tracked privately on the admin</span>
                </li>
              </ul>
            </div>

          </div>

          {/* Footer note */}
          <div className="text-[11px] text-slate-400 font-medium">
            © 2026 CodeScore • Real-time Competition Platform
          </div>

        </div>

        {/* Floating Login Box Positioned at Bottom Right (Matching Image 2) */}
        <div className="absolute bottom-6 right-6 xl:bottom-8 xl:right-14 z-30 w-[280px] xl:w-[300px] bg-[#071328]/95 backdrop-blur-md border border-blue-500/40 p-5 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] transition-all">

          <div className="flex flex-col items-center mb-4">
            <div className="bg-blue-600 p-2.5 rounded-full mb-2 shadow-md shadow-blue-600/40">
              <Users className="text-white" size={18} />
            </div>
            <h2 className="text-base xl:text-lg font-extrabold text-white tracking-wider uppercase flex items-center gap-1.5">
              <span>TEAM</span> <span className="text-blue-400">LOGIN</span>
            </h2>
            <p className="text-slate-300 mt-1 text-[11px] text-center font-medium">Enter your team credentials to continue</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-3 py-1.5 rounded-lg mb-3 text-xs flex items-center justify-center font-medium">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
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
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-2.5 px-4 rounded-lg shadow-md shadow-blue-600/30 transform transition-all duration-200 active:scale-[0.98] focus:outline-none text-xs tracking-wider uppercase"
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

      {/* Center Alert Modal for Team Disqualification */}
      {showDisqualifiedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-500/50 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center flex flex-col items-center gap-4 relative">
            <button
              onClick={() => setShowDisqualifiedModal(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X size={18} />
            </button>

            <div className="w-14 h-14 bg-rose-500/20 rounded-full flex items-center justify-center border border-rose-500/40 text-rose-400 shadow-lg shadow-rose-950/50">
              <ShieldAlert size={32} />
            </div>

            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-wide">
                Account Disqualified
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-medium">
                Your team has been disqualified from the competition due to inactivity or admin action. Please contact your administrator.
              </p>
            </div>

            <button
              onClick={() => setShowDisqualifiedModal(false)}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-rose-900/30 transition-all active:scale-[0.98]"
            >
              Understood
            </button>
          </div>
        </div>
      )}

    </div>
  );
}


