'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import API from '@/lib/api';
import { io, Socket } from 'socket.io-client';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const STARTER: Record<string, string> = {
    python: '# Your code here\n',
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    // Your code here\n    return 0;\n}\n',
};

const LANG_LABELS: Record<string, string> = {
    python: 'Python (3.11.4)',
    cpp: 'C++ (GCC 17)',
};

export default function AssignmentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [assignment, setAssignment] = useState<any>(null);
    const [selectedQ, setSelectedQ] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [socket, setSocket] = useState<Socket | null>(null);

    const [lang, setLang] = useState('python');
    const [code, setCode] = useState(STARTER.python);
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [err, setErr] = useState('');
    const [tab, setTab] = useState<'input' | 'output' | 'error'>('input');
    const [running, setRunning] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [proctorStarted, setProctorStarted] = useState(false);
    const [alertMsg, setAlertMsg] = useState('');
    const [showHint, setShowHint] = useState(false);
    const [aiResponse, setAiResponse] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const u = localStorage.getItem('gfg_user');
        if (!u) { router.push('/login'); return; }
        setUser(JSON.parse(u));
        fetchAssignment();

        const s = io('http://localhost:4000', { transports: ['websocket'] });
        setSocket(s);
        return () => { s.disconnect(); };
    }, [id]);

    const fetchAssignment = async () => {
        try {
            const { data } = await API.get(`/assignments/${id}`);
            setAssignment(data);
            if (data.questions?.length > 0) {
                const firstQ = data.questions[0].question;
                setSelectedQ(firstQ);
                if (firstQ.starterCode) setCode(firstQ.starterCode);
            }
        } catch (e: any) { router.push('/dashboard'); }
        finally { setLoading(false); }
    };

    const handleSelectQ = (q: any) => {
        setSelectedQ(q);
        if (q.starterCode) setCode(q.starterCode);
        else setCode(STARTER[lang]);
        setAiResponse('');
        setShowHint(false);
        setOutput('');
        setErr('');
    };

    const startExam = async () => {
        if (assignment.isProctored) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) videoRef.current.srcObject = stream;
                if (containerRef.current?.requestFullscreen) {
                    await containerRef.current.requestFullscreen();
                }
            } catch (err) {
                setAlertMsg('Camera and Fullscreen are required for this exam.');
                return;
            }
        }
        setProctorStarted(true);
    };

    const sendProctorAlert = (event: string) => {
        if (socket && user) {
            socket.emit('proctor_alert', {
                roomId: 'proctoring-general',
                userId: user.id, userName: user.name,
                event, time: new Date().toISOString()
            });
        }
    };

    const handleFullscreenChange = useCallback(() => {
        const isFS = !!document.fullscreenElement;
        if (proctorStarted && assignment?.isProctored && !isFS) {
            sendProctorAlert('EXITED_FULLSCREEN');
            setAlertMsg('WARNING: Fullscreen exited! This activity has been recorded.');
        }
    }, [proctorStarted, assignment]);

    const handleVisibilityChange = useCallback(() => {
        if (document.hidden && proctorStarted && assignment?.isProctored) {
            sendProctorAlert('TAB_SWITCHED');
            setAlertMsg('WARNING: Tab switch detected! Stay focused on the test.');
        }
    }, [proctorStarted, assignment]);

    useEffect(() => {
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [handleFullscreenChange, handleVisibilityChange]);

    const handleRun = async () => {
        setRunning(true); setTab('output'); setErr(''); setOutput('');
        try {
            const { data } = await API.post('/execute', { code, language: lang, input });
            setOutput(data.output || '');
            setErr(data.error || '');
            if (data.error) setTab('error');
        } catch (e: any) {
            setErr(e.response?.data?.error || 'Execution failed');
            setTab('error');
        } finally { setRunning(false); }
    };

    const handleSubmitCode = async () => {
        setSubmitting(true);
        try {
            const testcases = JSON.parse(selectedQ?.testcases || '[]');
            let allPassed = true;
            for (const tc of testcases) {
                const { data } = await API.post('/execute', { code, language: lang, input: tc.input });
                if ((data.output || '').trim() !== (tc.output || '').trim() || data.status !== 'Success') {
                    allPassed = false; break;
                }
            }
            const verdict = allPassed ? 'Accepted' : 'Wrong Answer';
            setTab('output');
            setOutput(verdict === 'Accepted' ? '✓ All test cases passed!' : '✗ Wrong Answer on a test case');
            await API.post('/submissions', { questionId: selectedQ.id, code, language: lang, status: verdict });
        } catch (e: any) {
            setErr('Submission failed');
            setTab('error');
        } finally { setSubmitting(false); }
    };

    const fetchHint = async () => {
        setAiLoading(true); setShowHint(true);
        try {
            const { data } = await API.post('/ai', { code, language: lang, error: err, mode: 'hint', questionTitle: selectedQ?.title });
            setAiResponse(data.response);
        } catch { setAiResponse('AI Hint unavailable.'); }
        finally { setAiLoading(false); }
    };

    if (loading) return <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>;

    if (!proctorStarted && assignment.isProctored) {
        return (
            <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-[#111827] border border-[#1e2d45] rounded-3xl p-10 text-center space-y-6">
                    <div className="text-6xl">🔒</div>
                    <h1 className="text-2xl font-black text-white">{assignment.title}</h1>
                    <p className="text-slate-400 text-sm leading-relaxed font-medium">
                        This is a proctored exam. Fullscreen and Camera are required.
                        Activity monitoring is active.
                    </p>
                    <button onClick={startExam} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 text-lg">
                        START TEST
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="min-h-screen bg-[#0a0e1a] flex flex-col overflow-hidden text-slate-300 select-none">
            {/* Header */}
            <header className="h-14 bg-[#111827] border-b border-[#1e2d45] flex items-center justify-between px-6 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-slate-500 hover:text-white transition-colors">← Back</button>
                    <span className="text-slate-700">|</span>
                    <h1 className="font-bold text-white text-sm tracking-wide truncate max-w-[300px]">{assignment.title} - {selectedQ?.title}</h1>
                </div>
                <div className="flex items-center gap-3">
                    {assignment.reward && (
                        <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                            <span className="text-amber-500 text-xs font-black tracking-widest">{assignment.reward}</span>
                        </div>
                    )}
                    <button onClick={handleRun} disabled={running} className="flex items-center gap-2 text-slate-400 hover:text-white font-bold text-xs uppercase px-4 py-2 rounded-xl transition-all">
                        {running ? '...' : '▶'} Run
                    </button>
                    <button onClick={handleSubmitCode} disabled={submitting} className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase px-6 py-2 rounded-xl shadow-lg transition-all active:scale-95">
                        {submitting ? '...' : 'Submit'}
                    </button>
                    {assignment.isProctored && (
                        <div className="ml-4 flex items-center gap-2">
                            <video ref={videoRef} autoPlay playsInline muted className="w-10 h-10 rounded-lg bg-black object-cover border border-amber-500/30" />
                        </div>
                    )}
                </div>
            </header>

            {/* Alert Banner */}
            {alertMsg && <div className="bg-red-600 text-white text-[10px] font-black py-1.5 text-center animate-pulse uppercase tracking-widest">{alertMsg}</div>}

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden bg-[#0d1117]">
                {/* Left Panel: Question Content */}
                <div className="w-[450px] border-r border-[#1e2d45] flex flex-col shrink-0 bg-[#0d1117]">
                    <div className="flex border-b border-[#1e2d45] bg-[#161b22]">
                        <button className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 border-b-2 border-amber-500">Question</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                        {selectedQ ? (
                            <>
                                <div>
                                    <h2 className="text-2xl font-black text-white mb-2">{selectedQ.title}</h2>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                        Time Limit: {selectedQ.timeLimit}s | Memory: {selectedQ.memoryLimit}MB
                                    </p>
                                </div>
                                <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed font-medium">
                                    {selectedQ.statement.split('\n\n').map((p: string, i: number) => (
                                        <p key={i} dangerouslySetInnerHTML={{
                                            __html: p.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>').replace(/\n/g, '<br/>')
                                        }} />
                                    ))}
                                </div>
                                {JSON.parse(selectedQ.testcases || '[]').slice(0, 1).map((tc: any, i: number) => (
                                    <div key={i} className="mt-8 pt-8 border-t border-[#1e2d45]">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Example Case</p>
                                        <div className="bg-black/30 rounded-2xl p-4 font-mono text-sm space-y-4">
                                            <div>
                                                <div className="text-[9px] text-slate-600 font-bold mb-1 uppercase tracking-widest">Input</div>
                                                <div className="text-green-400">{tc.input}</div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] text-slate-600 font-bold mb-1 uppercase tracking-widest">Output</div>
                                                <div className="text-amber-400">{tc.output}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-600 text-sm italic">Select a question to start</div>
                        )}

                        {/* Question Switcher at bottom */}
                        <div className="mt-20 pt-10 border-t border-[#1e2d45]">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Assignment Progress</p>
                            <div className="grid grid-cols-4 gap-3">
                                {assignment.questions?.map((q: any, i: number) => (
                                    <button key={q.id} onClick={() => handleSelectQ(q.question)}
                                        className={`h-12 rounded-xl font-bold transition-all border ${selectedQ?.id === q.questionId ? 'bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-[#111827] text-slate-500 border-[#1e2d45] hover:border-slate-500'}`}>
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Compiler */}
                <div className="flex-1 flex flex-col relative bg-black">
                    {/* Editor Header */}
                    <div className="h-12 bg-[#161b22] border-b border-[#1e2d45] flex items-center px-6 gap-6 shrink-0">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                            {LANG_LABELS[lang]}
                        </div>
                    </div>

                    {/* Monaco Editor */}
                    <div className="flex-1 min-h-0">
                        <MonacoEditor
                            height="100%"
                            language={lang}
                            value={code}
                            onChange={(v) => setCode(v || '')}
                            theme="vs-dark"
                            options={{
                                fontSize: 15, minimap: { enabled: false },
                                lineNumbers: 'on', scrollBeyondLastLine: false,
                                automaticLayout: true, tabSize: 4, wordWrap: 'on',
                                padding: { top: 20 },
                            }}
                        />
                    </div>

                    {/* I/O Tabs */}
                    <div className="bg-[#0d1117] border-t border-[#1e2d45]" style={{ height: '220px' }}>
                        <div className="flex bg-[#161b22] px-6">
                            {(['input', 'output', 'error'] as const).map(t => (
                                <button key={t} onClick={() => setTab(t)}
                                    className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${tab === t ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-600 hover:text-slate-400'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                        <div className="p-6 h-[calc(100%-40px)] overflow-y-auto font-mono text-sm leading-relaxed">
                            {tab === 'input' && (
                                <textarea className="w-full h-full bg-transparent resize-none outline-none border-none text-slate-300 placeholder-slate-800"
                                    placeholder="Enter your input here..." value={input} onChange={e => setInput(e.target.value)} />
                            )}
                            {tab === 'output' && <div className="text-green-400 whitespace-pre-wrap">{output || (running ? 'Executing...' : 'Ready.')}</div>}
                            {tab === 'error' && <div className="text-red-500 whitespace-pre-wrap">{err || 'Clean.'}</div>}
                        </div>
                    </div>

                    {/* Floating AI Chat Assistant (Newton Style) */}
                    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3 pointer-events-none">
                        {showHint && (
                            <div className="pointer-events-auto bg-[#161b22] border border-[#1e2d45] w-96 max-h-[500px] overflow-hidden rounded-[2rem] shadow-2xl animate-chat-popup flex flex-col">
                                <div className="p-5 border-b border-[#1e2d45] flex items-center justify-between bg-gradient-to-r from-[#161b22] to-[#0d1117]">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-lg">🤖</div>
                                        <div>
                                            <p className="font-black text-white text-xs uppercase tracking-widest">AI AIssistant</p>
                                            <p className="text-[10px] text-green-500 font-bold">Online • Ready to help</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowHint(false)} className="text-slate-500 hover:text-white transition-colors">✕</button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[#0d1117]/50">
                                    <div className="flex gap-3">
                                        <div className="bg-[#1e2d45] text-slate-200 p-4 rounded-2xl rounded-tl-none text-xs leading-relaxed max-w-[85%] border border-[#1e2d45]">
                                            Hello! I'm your AI tutor. How can I help you with **{selectedQ?.title}**? I can give you hints or explain the problem statement.
                                        </div>
                                    </div>
                                    {aiLoading ? (
                                        <div className="flex gap-3">
                                            <div className="bg-amber-500/10 text-amber-500 p-3 rounded-2xl rounded-tl-none flex items-center gap-2 border border-amber-500/20">
                                                <span className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Bot is thinking...</span>
                                            </div>
                                        </div>
                                    ) : aiResponse && (
                                        <div className="flex gap-3">
                                            <div className="bg-amber-500 text-black p-4 rounded-2xl rounded-tl-none text-xs font-bold leading-relaxed max-w-[85%] shadow-lg shadow-amber-500/10">
                                                {aiResponse}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 bg-[#161b22] border-t border-[#1e2d45] flex gap-2">
                                    <button onClick={fetchHint} disabled={aiLoading} className="flex-1 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold py-3 rounded-xl transition-all border border-white/10 active:scale-95">
                                        GET NEW HINT
                                    </button>
                                    <button onClick={() => setAiResponse('Try looking at the edge cases like empty input or very large numbers.')} className="flex-1 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold py-3 rounded-xl transition-all border border-white/10 active:scale-95">
                                        EXPLAIN ERROR
                                    </button>
                                </div>
                            </div>
                        )}
                        <button onClick={() => setShowHint(true)} className="pointer-events-auto bg-[#ff3b30] hover:bg-[#ff453a] text-white px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95 group border-2 border-white/10">
                            <span className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                                <span className="text-xl">💡</span> Need explanation of question?
                            </span>
                            <span className="bg-black/20 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest border border-white/10">VIEW HINT</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
