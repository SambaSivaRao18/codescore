import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { Play, Send, AlertTriangle, CheckCircle2, XCircle, LogOut, Trash2, Check, X, ChevronRight, ChevronLeft, Lock, Unlock, RotateCcw, Info, Trophy, Clock } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function Playground() {
  const { width, height } = useWindowSize();
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState('');
  const [questions, setQuestions] = useState([]);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');

  // Test case tabs state for playground testing
  const [activeTestCaseTab, setActiveTestCaseTab] = useState(0);

  // Execution & Submission status states
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMovingNext, setIsMovingNext] = useState(false);
  const [statusText, setStatusText] = useState('Ready');
  const [runResult, setRunResult] = useState(null); // Single test case run result
  const [submissionResult, setSubmissionResult] = useState(null); // Full submit result

  // Timer & Disqualification states
  const [timerSecondsRemaining, setTimerSecondsRemaining] = useState(3600);
  const [showTimeExpiredModal, setShowTimeExpiredModal] = useState(false);
  const blurTimerRef = useRef(null);

  // Success and completion modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDisqualifiedModal, setShowDisqualifiedModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const editorRef = useRef(null);
  const levelTabsRef = useRef(null);

  const teamID = localStorage.getItem('teamID');

  // Format seconds to MM:SS
  const formatTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Competition Countdown Timer Interval (1 second step)
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setTimerSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          setShowTimeExpiredModal(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  // Heartbeat & Anti-Cheat 10-Second Blur/Minimize Disqualification Effect
  useEffect(() => {
    if (!teamID) {
      navigate('/');
      return;
    }
    setTeamName(localStorage.getItem('teamName') || 'Team');
    fetchQuestionsAndChallenge();

    // Pre-warm the Java executor Docker service on page load.
    // Render free-tier services sleep after inactivity. By pinging /api/runtimes
    // immediately when the page loads, we wake the java-executor early so
    // Java code doesn't have a long cold-start delay when students submit.
    fetch(`${API_BASE}/runtimes`).catch(() => {});

    const heartbeat = setInterval(async () => {
      try {
        const hbRes = await axios.post(`${API_BASE}/heartbeat`, { teamID });
        if (hbRes.data?.timerSecondsRemaining !== undefined) {
          setTimerSecondsRemaining(hbRes.data.timerSecondsRemaining);
          if (hbRes.data.isExpired) {
            setShowTimeExpiredModal(true);
          }
        }
        setShowDisqualifiedModal(false); // Auto-resume if requalified by admin
      } catch (err) {
        if (err.response?.status === 403) {
          setShowDisqualifiedModal(true);
        }
      }
    }, 5000);

    // Trigger disqualification API call
    const triggerDisqualification = async () => {
      try {
        await axios.post(`${API_BASE}/disqualify`, { teamID, reason: 'Window closed or minimized > 15s' });
      } catch (err) {}
      setShowDisqualifiedModal(true);
    };

    // 15-second window minimize / tab hidden detection
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!blurTimerRef.current) {
          blurTimerRef.current = setTimeout(() => {
            triggerDisqualification();
          }, 15000);
        }
      } else if (document.visibilityState === 'visible') {
        if (blurTimerRef.current) {
          clearTimeout(blurTimerRef.current);
          blurTimerRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, [teamID]);

  // Fetch full list of questions (sequential status source of truth from backend)
  const fetchQuestionsAndChallenge = async (selectQuestionId = null) => {
    try {
      const qRes = await axios.get(`${API_BASE}/questions?teamID=${teamID}`);
      const fetchedQs = qRes.data;
      setQuestions(fetchedQs);

      let targetQId = selectQuestionId;
      if (!targetQId) {
        // Find current unlocked or first unsolved question
        const unlockedOrCurrent = fetchedQs.find(q => q.status === 'unlocked') || fetchedQs[0];
        targetQId = unlockedOrCurrent ? unlockedOrCurrent.questionId : null;
      }

      if (targetQId) {
        await loadChallenge(targetQId);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        alert('You have been disqualified.');
        handleLogout();
      }
    }
  };

  const loadChallenge = async (qId) => {
    try {
      const response = await axios.get(`${API_BASE}/challenge?teamID=${teamID}&questionId=${qId}`);
      setChallenge(response.data);
      setActiveQuestionId(qId);
      setCode(getDefaultCode(language));
      setRunResult(null);
      setSubmissionResult(null);
      setStatusText('Ready');
      setActiveTestCaseTab(0);
    } catch (err) {
      if (err.response?.status === 403) {
        alert('This question is locked. Please solve preceding questions first.');
      } else {
        console.error('Failed to load challenge:', err);
      }
    }
  };

  const getDefaultCode = (lang) => {
    switch (lang) {
      case 'python':
        return `# Write your Python 3 solution here\n\n# Read input\n\n# Write your code below\n`;
      case 'java':
        return `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner s = new Scanner(System.in);\n        // Read input and write your solution below\n        \n    }\n}`;
      case 'c':
        return `#include <stdio.h>\n\nint main() {\n    // Read input and write your solution below\n    \n    return 0;\n}`;
      default:
        return '';
    }
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setCode(getDefaultCode(newLang));
  };

  // Run code against a single public test case
  const handleRun = async () => {
    if (!challenge?.questionId) return;
    setIsRunning(true);
    setStatusText('Running Test Case...');
    setRunResult(null);
    setSubmissionResult(null);

    try {
      const res = await axios.post(`${API_BASE}/run-testcase`, {
        teamID,
        language,
        code,
        questionId: challenge.questionId,
        testCaseIndex: activeTestCaseTab,
      });

      const result = res.data;
      setRunResult(result);

      if (result.compile && result.compile.code !== 0) {
        setStatusText('Compilation Error');
      } else if (result.run && result.run.code !== 0) {
        setStatusText('Runtime Error');
      } else if (result.passed) {
        setStatusText('Test Case Passed');
      } else {
        setStatusText('Wrong Answer');
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message;
      setRunResult({ error: errMsg });
      setStatusText('Error');
    } finally {
      setIsRunning(false);
    }
  };

  // Submit code for full server-side test case validation
  const handleSubmit = async () => {
    if (!challenge?.questionId) return;
    setIsSubmitting(true);
    setStatusText('Evaluating all test cases on server...');
    setRunResult(null);
    setSubmissionResult(null);

    try {
      const res = await axios.post(`${API_BASE}/submissions`, {
        teamID,
        questionId: challenge.questionId,
        language,
        code,
      });

      const data = res.data;
      setSubmissionResult(data);

      if (data.allTestsPassed) {
        setStatusText('Accepted');
        setShowSuccessModal(true);
        // Refresh question progression status from backend
        const qRes = await axios.get(`${API_BASE}/questions?teamID=${teamID}`);
        const updatedQs = qRes.data;
        setQuestions(updatedQs);

        const currentIdx = updatedQs.findIndex(q => q.questionId === challenge.questionId);
        const isLastQuestion = currentIdx !== -1 && currentIdx === updatedQs.length - 1;

        setTimeout(async () => {
          setShowSuccessModal(false);

          if (isLastQuestion) {
            setShowCompletionModal(true);
          } else {
            // Automatically advance to the next level question after 1 second
            const nextQ = updatedQs[currentIdx + 1];
            if (nextQ && nextQ.status !== 'locked') {
              await loadChallenge(nextQ.questionId);
            }
          }
        }, 1000);
      } else {
        setStatusText('Wrong Answer');
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message;
      setSubmissionResult({ error: errMsg });
      setStatusText('Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextQuestion = async () => {
    setIsMovingNext(true);
    try {
      const qRes = await axios.get(`${API_BASE}/questions?teamID=${teamID}`);
      const fetchedQs = qRes.data;
      setQuestions(fetchedQs);

      const currentIdx = fetchedQs.findIndex(q => q.questionId === activeQuestionId);
      if (currentIdx !== -1 && currentIdx + 1 < fetchedQs.length) {
        const nextQ = fetchedQs[currentIdx + 1];
        if (nextQ.status !== 'locked') {
          await loadChallenge(nextQ.questionId);
        } else {
          alert('Next question is locked. Complete the current question first.');
        }
      } else {
        setShowCompletionModal(true);
      }
    } catch (err) {
      console.error('Failed to move next:', err);
    } finally {
      setIsMovingNext(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const getDifficultyBadge = (level) => {
    if (level === 'low') return <span className="text-xs font-bold px-2.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/30">Easy</span>;
    if (level === 'medium') return <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-500/15 text-amber-400 rounded-full border border-amber-500/30">Medium</span>;
    if (level === 'hard') return <span className="text-xs font-bold px-2.5 py-0.5 bg-rose-500/15 text-rose-400 rounded-full border border-rose-500/30">Hard</span>;
    return null;
  };

  const currentQObj = questions.find(q => q.questionId === activeQuestionId);
  const isCurrentSolved = currentQObj?.status === 'solved' || submissionResult?.allTestsPassed;

  // Level Progression Detection:
  // Show ONLY current level questions. If all 'low' level questions are solved, automatically show 'medium'.
  // If all 'medium' questions are solved, show 'hard'.
  const lowQuestions = questions.filter(q => (q.level || 'low').toLowerCase() === 'low');
  const mediumQuestions = questions.filter(q => (q.level || 'low').toLowerCase() === 'medium');
  const hardQuestions = questions.filter(q => (q.level || 'low').toLowerCase() === 'hard');

  const allLowSolved = lowQuestions.length > 0 && lowQuestions.every(q => q.status === 'solved');
  const allMediumSolved = mediumQuestions.length > 0 && mediumQuestions.every(q => q.status === 'solved');

  let activeLevelName = 'low';
  if (allLowSolved && allMediumSolved) {
    activeLevelName = 'hard';
  } else if (allLowSolved) {
    activeLevelName = 'medium';
  }

  // Filter top navigation questions to display ONLY current active level questions
  const visibleLevelQuestions = questions.filter(q => (q.level || 'low').toLowerCase() === activeLevelName);

  return (
    <div className="h-screen w-full flex flex-col bg-[#0b1120] text-slate-200 font-['Plus_Jakarta_Sans',sans-serif] select-none overflow-hidden">

      {/* Top Navigation Bar */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-slate-800/80 bg-[#111827] flex-shrink-0 z-20 shadow-md gap-4 sticky top-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-extrabold text-white text-lg tracking-tight">CODE<span className="text-blue-500">SCORE</span></span>
        </div>

        {/* Current Active Level Badge & Level-Filtered Question Tabs */}
        <div className="flex items-center gap-3 overflow-x-auto py-1">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-bold uppercase tracking-wider text-amber-400 shrink-0">
            <span className="text-slate-400">Level:</span>
            <span className={
              activeLevelName === 'low' ? 'text-emerald-400 font-extrabold' :
              activeLevelName === 'medium' ? 'text-amber-400 font-extrabold' : 'text-rose-400 font-extrabold'
            }>
              {activeLevelName === 'low' ? 'Low' : activeLevelName === 'medium' ? 'Medium' : 'Hard'}
            </span>
          </div>

          {/* Left scroll arrow */}
          <button
            onClick={() => levelTabsRef.current?.scrollBy({ left: -120, behavior: 'smooth' })}
            className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700/60 shrink-0"
            title="Scroll left"
          >
            <ChevronLeft size={15} />
          </button>

          {/* Scrollable question tabs */}
          <div ref={levelTabsRef} className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {visibleLevelQuestions.map((q) => {
              const isSelected = q.questionId === activeQuestionId;
              const isSolved = q.status === 'solved';
              const isLocked = q.status === 'locked';

              return (
                <button
                  key={q.questionId}
                  disabled={isLocked}
                  onClick={() => loadChallenge(q.questionId)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all border shrink-0 ${isSelected
                      ? 'bg-blue-600/25 border-blue-500 text-white shadow-sm'
                      : isSolved
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                        : isLocked
                          ? 'bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  title={isLocked ? 'Locked - Solve previous questions first' : `Question ${q.questionNumber}: ${q.title}`}
                >
                  {isSolved ? (
                    <CheckCircle2 size={13} className="text-emerald-400" />
                  ) : isLocked ? (
                    <Lock size={12} className="text-slate-600" />
                  ) : (
                    <Unlock size={12} className="text-blue-400" />
                  )}
                  <span>Q{q.questionNumber}</span>
                  {isSolved && <span className="text-[10px] uppercase font-bold text-emerald-400">✓</span>}
                  {isLocked && <span className="text-[10px] uppercase font-bold text-slate-600">🔒</span>}
                </button>
              );
            })}
          </div>

          {/* Right scroll arrow */}
          <button
            onClick={() => levelTabsRef.current?.scrollBy({ left: 120, behavior: 'smooth' })}
            className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700/60 shrink-0"
            title="Scroll right"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Right Corner: Countdown Timer, Team Info & Logout */}
        <div className="flex items-center gap-3 shrink-0">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-extrabold text-xs shadow-inner ${
            timerSecondsRemaining < 300
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse'
              : 'bg-slate-800/90 text-amber-400 border-amber-500/30'
          }`}
            title="Remaining competition time"
          >
            <Clock size={15} className={timerSecondsRemaining < 300 ? 'text-rose-400' : 'text-amber-400'} />
            <span>{formatTime(timerSecondsRemaining)}</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/90 px-3.5 py-1.5 rounded-full border border-slate-700/80 text-xs">
            <span className="text-slate-400 font-medium">Team:</span>
            <span className="text-blue-300 font-bold tracking-wide">{teamName}</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Area (Natural flex layout with bottom padding) */}
      <div className="flex-1 flex flex-col lg:flex-row p-3 gap-3 overflow-hidden min-h-0">

        {/* Left Column: Question Description */}
        <div className="w-full lg:w-[32%] bg-[#111827] border border-slate-800/80 flex flex-col rounded-xl shadow-lg shrink-0 h-full overflow-hidden">

          <div className="flex justify-between items-center px-4 py-3 border-b border-slate-800/80 bg-slate-900/60 flex-shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 border-b-2 border-blue-500 pb-0.5">Description</span>
            {currentQObj && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${currentQObj.status === 'solved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  currentQObj.status === 'unlocked' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-slate-500'
                }`}>
                {currentQObj.status === 'solved' ? '✓ Solved' : currentQObj.status === 'unlocked' ? '→ Active' : '🔒 Locked'}
              </span>
            )}
          </div>

          <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
            {challenge && challenge.questionId ? (
              <div className="w-full space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight leading-snug">
                    Question {challenge.questionNumber}: {challenge.title}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  {getDifficultyBadge(challenge.level)}
                  <span className="text-xs text-slate-400 font-medium">Points: {challenge.marks}</span>
                  <span className="text-xs text-slate-400 font-medium">Question {challenge.questionNumber} of {challenge.totalQuestions}</span>
                </div>

                <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed text-sm whitespace-pre-wrap font-normal border-t border-slate-800/60 pt-4">
                  {challenge.description}
                </div>

                {/* Sample Public Examples */}
                {challenge.sampleTestCases && challenge.sampleTestCases.length > 0 && (
                  <div className="pt-3 space-y-3 border-t border-slate-800/60">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sample Test Cases (Public)</h3>
                    {challenge.sampleTestCases.map((tc, idx) => (
                      <div key={idx} className="bg-slate-900/80 rounded-lg p-3 border border-slate-800 text-xs">
                        <p className="font-semibold text-blue-400 mb-1.5">Sample Case {idx + 1}:</p>
                        <div className="font-mono space-y-1.5 text-slate-300">
                          <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-sans uppercase font-medium">Input:</span>
                            <span className="text-slate-200 bg-slate-950/80 p-1.5 rounded mt-0.5 border border-slate-800/60">{tc.input || '(empty)'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-sans uppercase font-medium">Expected Output:</span>
                            <span className="text-emerald-400 bg-slate-950/80 p-1.5 rounded mt-0.5 border border-slate-800/60">{tc.expectedOutput}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs font-medium">Loading question details...</div>
            )}
          </div>
        </div>

        {/* Right Column: Code Editor & Execution Terminal */}
        <div className="w-full lg:w-[68%] flex flex-col gap-2 h-full min-h-0">

          {/* Monaco Code Editor Container — 65vh */}
          <div className="bg-[#0d1322] border border-slate-800/80 rounded-xl overflow-hidden shadow-lg flex flex-col min-h-0" style={{ flex: '65 1 0' }}>

            {/* Editor Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#111827] border-b border-slate-800/80 flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Language:</span>
                <select
                  value={language}
                  onChange={handleLanguageChange}
                  className="bg-slate-900 text-slate-200 text-xs font-semibold rounded-lg px-3 py-1.5 outline-none border border-slate-700/80 cursor-pointer hover:border-slate-500 transition-colors"
                >
                  <option value="python">Python 3</option>
                  <option value="java">Java (public class Main)</option>
                  <option value="c">C (GCC)</option>
                </select>

                {language === 'java' && (
                  <div className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 font-medium">
                    <Info size={13} />
                    <span>Must use <strong>public class Main</strong></span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCode(getDefaultCode(language))}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors border border-slate-700/50"
                  title="Reset template code"
                >
                  <RotateCcw size={13} /> Reset
                </button>
                <button
                  onClick={() => { setRunResult(null); setSubmissionResult(null); setStatusText('Ready'); }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors border border-slate-700/50"
                >
                  <Trash2 size={13} /> Clear Output
                </button>
              </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 w-full relative">
              <Editor
                height="100%"
                language={language === 'c' ? 'cpp' : language}
                theme="vs-dark"
                value={code}
                onMount={(editor, monaco) => {
                  editorRef.current = editor;
                  // Fix cursor misalignment: remeasure fonts after JetBrains Mono loads.
                  // Monaco calculates cursor position on init — if the font isn't fully
                  // loaded yet, cursor appears offset from the actual character position.
                  document.fonts.ready.then(() => {
                    monaco.editor.remeasureFonts();
                  });
                }}
                onChange={(val) => {
                  if (val !== undefined && val !== code) {
                    setCode(val);
                  }
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontLigatures: true,
                  scrollBeyondLastLine: false,
                  roundedSelection: true,
                  padding: { top: 12, bottom: 12 },
                  automaticLayout: true,
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  cursorStyle: 'line',
                  cursorSurroundingLines: 0,
                  autoClosingBrackets: 'always',
                  autoClosingQuotes: 'always',
                  renderLineHighlight: 'all',
                  tabSize: 4,
                  insertSpaces: true,
                  formatOnType: false,
                  formatOnPaste: false,
                }}
              />
            </div>
          </div>

          {/* Action Buttons Bar — between Editor and Test Cases */}
          <div className="bg-[#0d1322] border border-slate-800/80 rounded-xl px-3 py-2 flex items-center justify-between shadow-inner shrink-0">
            <div className="flex items-center gap-2">
              {/* Submit Solution Button */}
              <button
                onClick={handleSubmit}
                disabled={isRunning || isSubmitting || !challenge?.questionId}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold rounded-lg shadow-md shadow-emerald-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                <Send size={13} />
                <span>{isSubmitting ? 'Evaluating...' : 'Submit'}</span>
              </button>

              {/* Execute Code Button */}
              <button
                onClick={handleRun}
                disabled={isRunning || isSubmitting || !challenge?.questionId}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700/80 active:scale-[0.98]"
              >
                <Play size={13} className="fill-blue-400 text-blue-400" />
                <span>{isRunning ? 'Running...' : 'Run Sample'}</span>
              </button>
            </div>

            {/* Next Question Button */}
            <button
              onClick={handleNextQuestion}
              disabled={isMovingNext || !isCurrentSolved}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-extrabold shadow-md transition-all tracking-wide uppercase ${isCurrentSolved
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white cursor-pointer active:scale-[0.98] shadow-blue-900/40'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
                }`}
              title={isCurrentSolved ? 'Advance to next question' : 'Solve all test cases to unlock next question'}
            >
              <span>{isMovingNext ? 'Moving...' : 'Next Question'}</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Test Cases & Output Results Section — flex 30% */}
          <div className="bg-[#111827] border border-slate-800/80 rounded-xl flex flex-col shadow-lg overflow-hidden min-h-0" style={{ flex: '30 1 0' }}>

            {/* Header Bar with Tabs & Status */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-900/80 flex-shrink-0">
              <div className="flex gap-3 items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Test Cases</span>
                {challenge?.testCases && (
                  <div className="flex gap-1.5">
                    {challenge.testCases.map((tc, idx) => {
                      // Tab color: green only if ALL tests passed, red if submitted and any failed, blue if active
                      const allPassed = submissionResult?.allTestsPassed === true;
                      const anyFailed = submissionResult && !submissionResult.allTestsPassed;
                      const tcResult = submissionResult?.results?.find(r => r.testCase === idx + 1);
                      const tabColor = activeTestCaseTab === idx
                        ? allPassed
                          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 font-semibold'
                          : anyFailed
                            ? 'bg-rose-600/20 text-rose-400 border border-rose-500/50 font-semibold'
                            : 'bg-blue-600/20 text-blue-400 border border-blue-500/40 font-semibold'
                        : allPassed
                          ? 'text-emerald-500/70 hover:bg-emerald-900/20 border border-transparent'
                          : anyFailed
                            ? 'text-rose-500/70 hover:bg-rose-900/20 border border-transparent'
                            : 'text-slate-400 hover:bg-slate-800 border border-transparent';
                      return (
                        <button
                          key={idx}
                          onClick={() => setActiveTestCaseTab(idx)}
                          className={`text-xs px-3 py-1 rounded-md transition-all font-medium ${tabColor}`}
                        >
                          {allPassed ? '\u2713 ' : anyFailed && tcResult && !tcResult.passed ? '\u2717 ' : ''}Case {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Status Indicator — green only when ALL tests pass */}
              <div className="flex items-center">
                <span className={`text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1.5 ${submissionResult?.allTestsPassed === true || statusText === 'Test Case Passed'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : submissionResult && !submissionResult.allTestsPassed
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      : statusText.includes('Error') || statusText === 'Wrong Answer'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                  {submissionResult?.allTestsPassed === true || statusText === 'Test Case Passed' ? <CheckCircle2 size={13} /> :
                    (submissionResult && !submissionResult.allTestsPassed) || statusText.includes('Error') || statusText === 'Wrong Answer' ? <XCircle size={13} /> : null}
                  {statusText}
                </span>
              </div>
            </div>

            {/* Output Body */}
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 font-mono text-xs">

              {/* Full Submission Validation Result Panel */}
              {submissionResult && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 space-y-3 font-sans">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">Submission Result</h4>
                    <span className="text-xs font-bold text-slate-400">
                      {submissionResult.results?.filter(r => r.passed).length || 0} / {submissionResult.results?.length || 0} test cases passed
                    </span>
                  </div>

                  {submissionResult.error ? (
                    <div className="text-rose-400 bg-rose-950/30 p-3 rounded-lg border border-rose-900/40 text-xs font-mono">
                      {submissionResult.error}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Test Case Breakdown List */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {submissionResult.results?.map((res) => (
                          <div
                            key={res.testCase}
                            className={`p-2.5 rounded-lg border flex items-center justify-between text-xs font-medium ${res.passed
                                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
                                : 'bg-rose-950/20 border-rose-500/30 text-rose-400'
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              {res.passed ? <Check size={16} className="text-emerald-400" /> : <X size={16} className="text-rose-400" />}
                              <span>Test Case {res.testCase}</span>
                            </div>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-900">
                              {res.passed ? 'Passed' : 'Failed'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Summary Message */}
                      <div className="pt-2">
                        {submissionResult.allTestsPassed ? (
                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-bold flex items-center gap-2">
                            <CheckCircle2 size={18} />
                            <span>All test cases passed! 🎉 Question solved. You can now proceed to the next question.</span>
                          </div>
                        ) : (
                          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs font-bold flex items-center gap-2">
                            <XCircle size={18} />
                            <span>Not all test cases passed. Fix your solution and try again.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Single Test Case Playground Run Output */}
              {runResult && !submissionResult && challenge?.testCases?.[activeTestCaseTab] && (
                <div className="flex flex-col gap-2.5 max-w-3xl">
                  <div>
                    {runResult.passed ? (
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm font-sans">
                        <Check size={18} /> Sample Test Case Passed!
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-rose-400 font-bold text-sm font-sans">
                        <X size={18} /> Test Case Failed
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 font-sans uppercase tracking-wider">Input</span>
                      <div className="bg-slate-950 p-2.5 rounded-lg text-slate-300 border border-slate-800/80 whitespace-pre-wrap">
                        {challenge.testCases[activeTestCaseTab].input || <span className="opacity-50 italic">(empty string)</span>}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 font-sans uppercase tracking-wider">Expected Output</span>
                      <div className="bg-slate-950 p-2.5 rounded-lg text-slate-300 border border-slate-800/80 whitespace-pre-wrap">
                        {challenge.testCases[activeTestCaseTab].expectedOutput}
                      </div>
                    </div>
                  </div>

                  {runResult.run && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 font-sans uppercase tracking-wider">Actual Output</span>
                      <div className={`bg-slate-950 p-2.5 rounded-lg border whitespace-pre-wrap ${runResult.passed ? 'border-emerald-500/40 text-emerald-400' : 'border-rose-500/40 text-rose-400'}`}>
                        {runResult.run.stdout || runResult.run.stderr || <span className="opacity-50 italic">(no output)</span>}
                      </div>
                    </div>
                  )}

                  {runResult.compile && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 font-sans uppercase tracking-wider">Compilation Error</span>
                      <div className="bg-rose-950/30 p-2.5 rounded-lg text-rose-400 border border-rose-800/50 whitespace-pre-wrap">
                        {runResult.compile.stderr || runResult.compile.output}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>

        </div>

      </div>

      {/* Disqualified Center Modal */}
      {showDisqualifiedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-500/50 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-rose-500/20 rounded-full flex items-center justify-center border border-rose-500/40 text-rose-400 shadow-lg shadow-rose-950/50">
              <AlertTriangle size={32} />
            </div>

            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-wide">
                Account Disqualified
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-medium">
                Your team has been disqualified from the competition due to close the window.
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-rose-900/30 transition-all active:scale-[0.98]"
            >
              Exit to Login
            </button>
          </div>
        </div>
      )}

      {/* All Questions Completed Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-slate-900 border border-amber-500/50 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-500/40 text-amber-400 shadow-lg shadow-amber-950/50">
              <Trophy size={36} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                🏆 Competition Completed!
              </h2>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-medium">
                Congratulations! You have completed all questions in the competition. Your answers have been recorded.
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-blue-900/40 transition-all active:scale-[0.98] mt-2"
            >
              Back to Login Page
            </button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/50 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center flex flex-col items-center gap-4 relative overflow-hidden z-10">
            <div className="absolute inset-0 pointer-events-none">
              <Confetti width={384} height={300} recycle={false} numberOfPieces={250} />
            </div>
            <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-950/50 relative z-10">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-wide">
                Congratulations!
              </h3>
              <p className="text-xs text-emerald-300 mt-2 leading-relaxed font-medium">
                Your code is correct and all test cases passed!
              </p>
            </div>

            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-emerald-900/30 transition-all active:scale-[0.98] mt-2"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* 1-Hour Time Expired Modal */}
      {showTimeExpiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-500/50 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-500/40 text-amber-400 shadow-lg shadow-amber-950/50">
              <Clock size={32} />
            </div>

            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-wide">
                Time Expired
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-medium">
                The 1-hour competition time limit has ended. Your score has been automatically saved.
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-amber-900/30 transition-all active:scale-[0.98]"
            >
              Close & Exit
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
