import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, Database, LayoutDashboard, LogOut } from 'lucide-react';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('adminAuth') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'admin123') {
      localStorage.setItem('adminAuth', 'true');
      setIsAuthenticated(true);
      setError('');
      navigate('/admin/dashboard');
    } else {
      setError('Invalid admin credentials');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    setIsAuthenticated(false);
    navigate('/admin');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="w-full max-w-sm bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-700">
          <div className="flex flex-col items-center mb-6">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-full mb-4">
              <Lock size={28} />
            </div>
            <h2 className="text-2xl font-bold text-white">Admin Access</h2>
            <p className="text-xs text-slate-400 mt-1">CodeScore Competition Management</p>
          </div>
          
          {error && <div className="text-red-400 bg-red-400/10 p-3 rounded-lg text-sm mb-4 text-center">{error}</div>}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-sm"
              required
            />
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors text-sm shadow-md"
            >
              Login
            </button>
          </form>

          {/* Quick Navigation Back to Student Login */}
          <div className="mt-6 pt-4 border-t border-slate-700/80 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center justify-center gap-1.5 mx-auto"
            >
              <span>← Back to Student Login</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex text-white font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 p-6 hidden md:flex flex-col h-screen sticky top-0">
        <div className="flex items-center gap-3 mb-8 text-indigo-400">
          <ShieldAlert size={28} />
          <div>
            <h1 className="text-xl font-bold text-white leading-none">Admin Panel</h1>
            <span className="text-[10px] text-slate-400">CodeScore System</span>
          </div>
        </div>
        
        <nav className="flex-1 space-y-2">
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) => 
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`
            }
          >
            <LayoutDashboard size={19} />
            Dashboard
          </NavLink>
          <NavLink
            to="/admin/database"
            className={({ isActive }) => 
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`
            }
          >
            <Database size={19} />
            Database
          </NavLink>
        </nav>

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-slate-700/80">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-700 hover:text-red-400 transition-colors w-full text-left"
          >
            <LogOut size={16} />
            Admin Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto min-h-screen relative">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
           <div className="flex items-center gap-2 text-indigo-400">
             <ShieldAlert size={24} />
             <span className="font-bold text-white">Admin</span>
           </div>
           <div className="flex gap-2">
              <button onClick={() => navigate('/')} className="px-2.5 py-1.5 text-xs bg-slate-700 text-indigo-300 rounded font-semibold">Student Portal</button>
              <NavLink to="/admin/dashboard" className={({isActive}) => `p-2 rounded ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}><LayoutDashboard size={18} /></NavLink>
              <NavLink to="/admin/database" className={({isActive}) => `p-2 rounded ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}><Database size={18} /></NavLink>
              <button onClick={handleLogout} className="p-2 bg-slate-700 rounded text-red-400"><LogOut size={18} /></button>
           </div>
        </div>
        
        <Outlet />
      </main>
    </div>
  );
}
