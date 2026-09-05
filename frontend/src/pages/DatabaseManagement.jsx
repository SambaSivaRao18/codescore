import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Code, Plus, Trash2, Edit2, Save, X, PlusCircle, MinusCircle } from 'lucide-react';

export default function DatabaseManagement() {
  const [activeTab, setActiveTab] = useState('teams');
  
  // Teams State
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamPassword, setNewTeamPassword] = useState('');
  
  // Challenges State
  const [challenges, setChallenges] = useState([]);
  const [editingChallenge, setEditingChallenge] = useState(null);
  
  // Challenge Form State
  const [cLevel, setCLevel] = useState('low');
  const [cTitle, setCTitle] = useState('');
  const [cDescription, setCDescription] = useState('');
  const [cMarks, setCMarks] = useState(10);
  const [cTestCases, setCTestCases] = useState([{ input: '', expectedOutput: '' }]);

  useEffect(() => {
    if (activeTab === 'teams') fetchTeams();
    if (activeTab === 'challenges') fetchChallenges();
  }, [activeTab]);

  const fetchTeams = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/admin/leaderboard');
      setTeams(res.data);
    } catch (e) { console.error(e); }
  };

  const fetchChallenges = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/admin/challenges');
      setChallenges(res.data);
    } catch (e) { console.error(e); }
  };

  // --- Teams Actions ---
  const handleAddTeam = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/admin/team', { teamName: newTeamName, password: newTeamPassword });
      setNewTeamName('');
      setNewTeamPassword('');
      fetchTeams();
    } catch (e) { alert("Failed to add team"); }
  };

  const handleDeleteTeam = async (id) => {
    if (!window.confirm("Are you sure you want to delete this team?")) return;
    try {
      await axios.delete(`http://localhost:3000/api/admin/team/${id}`);
      fetchTeams();
    } catch (e) { alert("Failed to delete team"); }
  };

  // --- Challenge Actions ---
  const handleAddTestCase = () => {
    setCTestCases([...cTestCases, { input: '', expectedOutput: '', isHidden: false }]);
  };

  const handleRemoveTestCase = (index) => {
    const newTC = [...cTestCases];
    newTC.splice(index, 1);
    setCTestCases(newTC);
  };

  const handleTestCaseChange = (index, field, value) => {
    const newTC = [...cTestCases];
    newTC[index][field] = value;
    setCTestCases(newTC);
  };

  const resetChallengeForm = () => {
    setEditingChallenge(null);
    setCLevel('low');
    setCTitle('');
    setCDescription('');
    setCMarks(10);
    setCTestCases([{ input: '', expectedOutput: '', isHidden: false }]);
  };

  const handleEditChallengeClick = (c) => {
    setEditingChallenge(c.challengeID);
    setCLevel(c.level);
    setCTitle(c.title);
    setCDescription(c.description);
    setCMarks(c.marks);
    try {
      const parsed = JSON.parse(c.testCases);
      setCTestCases(parsed.map(tc => ({ input: tc.input || '', expectedOutput: tc.expectedOutput || '', isHidden: Boolean(tc.isHidden) })));
    } catch (e) {
      setCTestCases([{ input: '', expectedOutput: '', isHidden: false }]);
    }
  };

  const handleSaveChallenge = async (e) => {
    e.preventDefault();
    const payload = {
      level: cLevel,
      title: cTitle,
      description: cDescription,
      marks: cMarks,
      testCases: JSON.stringify(cTestCases)
    };

    try {
      if (editingChallenge) {
        await axios.put(`http://localhost:3000/api/admin/challenge/${editingChallenge}`, payload);
      } else {
        await axios.post('http://localhost:3000/api/admin/challenge', payload);
      }
      resetChallengeForm();
      fetchChallenges();
    } catch (e) {
      alert("Failed to save challenge");
    }
  };

  const handleDeleteChallenge = async (id) => {
    if (!window.confirm("Are you sure you want to delete this challenge?")) return;
    try {
      await axios.delete(`http://localhost:3000/api/admin/challenge/${id}`);
      fetchChallenges();
    } catch (e) { alert("Failed to delete challenge"); }
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Database Management</h1>
        
        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button 
            onClick={() => setActiveTab('teams')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'teams' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Users size={18} /> Teams
          </button>
          <button 
            onClick={() => setActiveTab('challenges')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'challenges' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Code size={18} /> Coding Challenges
          </button>
        </div>

        {/* Teams Section */}
        {activeTab === 'teams' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Plus size={20} /> Add New Team</h2>
                <form onSubmit={handleAddTeam} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Team Name</label>
                    <input 
                      type="text" 
                      value={newTeamName} 
                      onChange={(e) => setNewTeamName(e.target.value)} 
                      required 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
                    <input 
                      type="password" 
                      value={newTeamPassword} 
                      onChange={(e) => setNewTeamPassword(e.target.value)} 
                      required 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded-lg font-medium transition-colors">
                    Create Team
                  </button>
                </form>
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-400 text-sm uppercase">
                      <th className="px-6 py-4 font-medium">ID</th>
                      <th className="px-6 py-4 font-medium">Team Name</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {teams.map(t => (
                      <tr key={t.teamID} className="hover:bg-slate-700/30">
                        <td className="px-6 py-4 text-slate-400">{t.teamID}</td>
                        <td className="px-6 py-4 font-medium">{t.teamName}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleDeleteTeam(t.teamID)} className="text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Challenges Section */}
        {activeTab === 'challenges' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* List */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden flex flex-col max-h-[800px]">
              <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center">
                <h2 className="text-xl font-bold">Challenges Database</h2>
                <button onClick={resetChallengeForm} className="text-indigo-400 text-sm flex items-center gap-1 hover:text-indigo-300">
                  <Plus size={16} /> New
                </button>
              </div>
              <div className="overflow-y-auto p-4 space-y-4">
                {challenges.map(c => (
                  <div key={c.challengeID} className="bg-slate-900 border border-slate-700 p-4 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${
                          c.level === 'low' ? 'bg-emerald-500/10 text-emerald-400' :
                          c.level === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {c.level}
                        </span>
                        <h3 className="text-lg font-bold mt-2">{c.title}</h3>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditChallengeClick(c)} className="text-indigo-400 hover:bg-indigo-500/10 p-2 rounded-lg">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteChallenge(c.challengeID)} className="text-red-400 hover:bg-red-500/10 p-2 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-400 text-sm line-clamp-2">{c.description}</p>
                    <div className="mt-4 text-xs font-medium text-slate-500">
                      Marks: {c.marks} | Test Cases: {(() => { try { return JSON.parse(c.testCases).length; } catch(e) { return 0; } })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 h-fit sticky top-24">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">{editingChallenge ? 'Edit Challenge' : 'Create Challenge'}</h2>
                {editingChallenge && (
                  <button onClick={resetChallengeForm} className="text-slate-400 hover:text-white p-1">
                    <X size={20} />
                  </button>
                )}
              </div>
              
              <form onSubmit={handleSaveChallenge} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Level</label>
                    <select 
                      value={cLevel} 
                      onChange={(e) => setCLevel(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none"
                    >
                      <option value="low">Low (Easy)</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Marks</label>
                    <input 
                      type="number" 
                      value={cMarks} 
                      onChange={(e) => setCMarks(parseInt(e.target.value))} 
                      required 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
                  <input 
                    type="text" 
                    value={cTitle} 
                    onChange={(e) => setCTitle(e.target.value)} 
                    required 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                  <textarea 
                    value={cDescription} 
                    onChange={(e) => setCDescription(e.target.value)} 
                    required 
                    rows={4}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none resize-none"
                  />
                </div>

                {/* Test Cases Builder */}
                <div className="pt-4 border-t border-slate-700">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-medium text-slate-300">Test Cases</label>
                    <button type="button" onClick={handleAddTestCase} className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1">
                      <PlusCircle size={16} /> Add Test Case
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {cTestCases.map((tc, idx) => (
                      <div key={idx} className="bg-slate-900 border border-slate-700 rounded-xl p-3 relative group">
                        {cTestCases.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => handleRemoveTestCase(idx)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <MinusCircle size={14} />
                          </button>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Input (stdin)</label>
                            <textarea 
                              value={tc.input} 
                              onChange={(e) => handleTestCaseChange(idx, 'input', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:border-indigo-500 outline-none h-16 font-mono"
                              placeholder="e.g. 5 10"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Expected Output (stdout)</label>
                            <textarea 
                              value={tc.expectedOutput} 
                              onChange={(e) => handleTestCaseChange(idx, 'expectedOutput', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:border-indigo-500 outline-none h-16 font-mono"
                              placeholder="e.g. 15"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/80">
                          <input 
                            type="checkbox"
                            id={`tc-hidden-${idx}`}
                            checked={Boolean(tc.isHidden)}
                            onChange={(e) => handleTestCaseChange(idx, 'isHidden', e.target.checked)}
                            className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <label htmlFor={`tc-hidden-${idx}`} className="text-xs text-slate-400 font-medium cursor-pointer select-none">
                            Hidden Test Case (Conceal input/expected output from students on submission failure)
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                    <Save size={18} />
                    {editingChallenge ? 'Update Challenge' : 'Create Challenge'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
