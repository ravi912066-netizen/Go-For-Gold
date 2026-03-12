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

export default function AssignmentClient() {
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

    // Expected Output Generator
    const [genInput, setGenInput] = useState('');
    const [genOutput, setGenOutput] = useState('');
    const [genLoading, setGenLoading] = useState(false);

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
        if (id) fetchAssignment();

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

    const handleGenerateExpected = async () => {
        if (!genInput) return;
        setGenLoading(true);
        try {
            const { data } = await API.post('/execute', { code, language: lang, input: genInput });
            setGenOutput(data.output || data.error || 'Generated Successfully');
        } catch { setGenOutput('Generation failed'); }
        finally { setGenLoading(false); }
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
        <div ref={containerRef} className="min-h-screen bg-[#0d1117] flex flex-col overflow-hidden select-none">
            <header className="h-12 bg-[#0d1117] border-b border-[#2d2f39] flex items-center justify-between px-4 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-tight">
                        <span className="text-lg">←</span> Back
                    </button>
                    <div className="h-4 w-px bg-[#2d2f39]" />
                    <h1 className="font-bold text-slate-100 text-[13px] tracking-tight truncate max-w-[250px]">{selectedQ?.title}</h1>
                </div>

                <div className="flex items-center gap-4">
                    {assignment.reward && (
                        <div className="flex items-center gap-1.5 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                            <span className="text-amber-500 text-[10px] font-black uppercase tracking-widest">{assignment.reward}</span>
                        </div>
                    )}
                    <button onClick={handleRun} disabled={running} className="flex items-center gap-2 text-slate-400 hover:text-white font-bold text-[11px] uppercase px-4 py-1.5 rounded-md transition-all border border-[#2d2f39] bg-[#161b22]">
                        {running ? '...' : 'Run'}
                    </button>
                    <button onClick={handleSubmitCode} disabled={submitting} className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] uppercase px-6 py-1.5 rounded-md shadow-sm transition-all active:scale-95">
                        {submitting ? '...' : 'Submit'}
                    </button>
                </div>
            </header>

            {alertMsg && <div className="bg-red-600 text-white text-[10px] font-black py-1 text-center animate-pulse uppercase tracking-widest">{alertMsg}</div>}

            <div className="flex-1 flex overflow-hidden">
                <div className="w-[60px] bg-[#0d1117] border-r border-[#2d2f39] flex flex-col items-center py-4 gap-4 shrink-0">
                    <div className="w-10 h-10 bg-[#161b22] rounded-lg flex items-center justify-center text-blue-500 border border-blue-500/20 cursor-pointer shadow-lg shadow-blue-500/5">
                        <span className="text-xl">Q</span>
                    </div>
                    <div className="w-10 h-10 hover:bg-[#161b22] rounded-lg flex items-center justify-center text-slate-500 cursor-pointer transition-colors">
                        <span className="text-xl">☰</span>
                    </div>
                    <div className="w-10 h-10 hover:bg-[#161b22] rounded-lg flex items-center justify-center text-slate-500 cursor-pointer transition-colors">
                        <span className="text-xl">⚙</span>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden bg-white">
                    <div className="w-[40%] min-w-[400px] border-r border-slate-200 flex flex-col shrink-0 bg-white relative">
                        <div className="h-10 bg-slate-50 border-b border-slate-200 flex items-center px-4">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Question</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar-light">
                            {selectedQ ? (
                                <>
                                    <div className="prose prose-slate prose-sm max-w-none text-slate-600 leading-relaxed font-medium space-y-4">
                                        <p className="border-b border-slate-100 pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Description</p>
                                        <div dangerouslySetInnerHTML={{
                                            __html: selectedQ.statement.replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 font-black">$1</strong>').replace(/\n/g, '<br/>')
                                        }} />
                                    </div>

                                    <div className="pt-8 border-t border-slate-100 mt-8">
                                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-4">Generated Expected Output</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Insert Input</p>
                                                <textarea
                                                    value={genInput}
                                                    onChange={(e) => setGenInput(e.target.value)}
                                                    className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 font-mono text-[13px] placeholder-slate-300 focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                    placeholder="Paste input here..."
                                                />
                                            </div>
                                            <button
                                                onClick={handleGenerateExpected}
                                                disabled={genLoading || !genInput}
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] uppercase h-10 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                {genLoading ? 'Generating...' : 'Generate Expected Output >'}
                                            </button>
                                            {genOutput && (
                                                <div className="animate-fade-in">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Expected Output</p>
                                                    <div className="bg-slate-50 text-slate-800 font-mono text-[12px] p-4 rounded-xl border border-slate-200 overflow-x-auto">
                                                        {genOutput}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-10 pt-8 border-t border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-4">Select Question</p>
                                        <div className="flex flex-wrap gap-2">
                                            {assignment.questions?.map((q: any, i: number) => (
                                                <button key={q.id} onClick={() => handleSelectQ(q.question)}
                                                    className={`w-8 h-8 rounded-lg font-black text-[11px] transition-all border ${selectedQ?.id === q.questionId ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}>
                                                    {i + 1}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-300 text-sm">Select a question</div>
                            )}
                        </div>
                        <div className="absolute right-[-1px] top-0 bottom-0 w-[2px] bg-slate-200 cursor-col-resize hover:bg-blue-400 transition-colors z-20" />
                    </div>

                    <div className="flex-1 flex flex-col relative bg-[#1e1e1e]">
                        <div className="h-10 bg-[#1e1e1e] border-b border-[#2d2d2d] flex items-center px-4 justify-between shrink-0">
                            <div className="flex items-center gap-4 h-full">
                                <div className="h-full flex items-center border-b-2 border-blue-500 px-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-100">{LANG_LABELS[lang]}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] text-slate-500 font-bold">Autosaved at 3:11 PM</span>
                                <div className="flex items-center gap-3">
                                    <button className="text-slate-500 hover:text-white transition-colors">↺</button>
                                    <button className="text-slate-500 hover:text-white transition-colors">⛶</button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 bg-[#1e1e1e]">
                            <MonacoEditor
                                height="100%"
                                language={lang}
                                value={code}
                                onChange={(v) => setCode(v || '')}
                                theme="vs-dark"
                                options={{
                                    fontSize: 14,
                                    minimap: { enabled: false },
                                    lineNumbers: 'on',
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    padding: { top: 16 },
                                    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                                }}
                            />
                        </div>

                        <div className="bg-[#1e1e1e] border-t border-[#2d2d2d] flex flex-col" style={{ height: '220px' }}>
                            <div className="flex px-4 items-center bg-[#161b22] border-b border-[#2d2f39]">
                                {(['input', 'output', 'error'] as const).map(t => (
                                    <button key={t} onClick={() => setTab(t)}
                                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all h-10 ${tab === t ? 'text-white border-b-2 border-white' : 'text-slate-500 hover:text-slate-300'}`}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                            <div className="flex-1 p-4 font-mono text-[13px] leading-relaxed overflow-y-auto bg-[#0d1117] custom-scrollbar">
                                {tab === 'input' && (
                                    <textarea className="w-full h-full bg-transparent resize-none outline-none border-none text-slate-300 placeholder-slate-700"
                                        placeholder="Enter custom test input here..." value={input} onChange={e => setInput(e.target.value)} />
                                )}
                                {tab === 'output' && <div className="text-green-400 whitespace-pre-wrap">{output || (running ? 'Executing...' : 'Run code to see output.')}</div>}
                                {tab === 'error' && <div className="text-red-400 whitespace-pre-wrap">{err || 'No errors.'}</div>}
                            </div>
                        </div>

                        <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3 pointer-events-none">
                            {showHint && (
                                <div className="pointer-events-auto bg-[#1a1c23] border border-[#2d2f39] w-[380px] h-[500px] rounded-3xl shadow-2xl animate-chat-popup flex flex-col border border-white/5">
                                    <div className="p-5 border-b border-[#2d2f39] flex items-center justify-between bg-[#111319] rounded-t-3xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-[#ff3b30] flex items-center justify-center text-lg shadow-lg shadow-[#ff3b30]/20">🤖</div>
                                            <div>
                                                <p className="font-extrabold text-white text-[11px] uppercase tracking-widest">AI Tutor</p>
                                                <p className="text-[9px] text-green-500 font-bold uppercase tracking-widest">Listening</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setShowHint(false)} className="text-slate-500 hover:text-white transition-colors w-7 h-7 flex items-center justify-center bg-[#252833] rounded-full text-xs transition-all">✕</button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar bg-[#0d1117]/80">
                                        <div className="flex gap-3">
                                            <div className="bg-[#161b22] text-slate-300 p-4 rounded-2xl rounded-tl-none text-[12px] leading-relaxed border border-[#2d2f39] max-w-[85%]">
                                                How can I help you today? I can explain the **{selectedQ?.title}** problem or give you a hint.
                                            </div>
                                        </div>
                                        {aiLoading ? (
                                            <div className="flex gap-3">
                                                <div className="bg-[#ff3b30]/10 text-[#ff3b30] p-3 rounded-2xl rounded-tl-none flex items-center gap-2 border border-[#ff3b30]/20">
                                                    <span className="w-3 h-3 border-2 border-[#ff3b30]/30 border-t-[#ff3b30] rounded-full animate-spin" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Thinking</span>
                                                </div>
                                            </div>
                                        ) : aiResponse && (
                                            <div className="flex gap-3 animate-fade-in">
                                                <div className="bg-[#ff3b30] text-white p-4 rounded-2xl rounded-tl-none text-[12px] font-bold leading-relaxed max-w-[85%] shadow-xl shadow-[#ff3b30]/10">
                                                    {aiResponse}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 bg-[#111319] border-t border-[#2d2f39] flex gap-2 rounded-b-3xl">
                                        <button onClick={fetchHint} disabled={aiLoading} className="flex-1 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase py-4 rounded-xl transition-all border border-white/5 active:scale-95 tracking-[0.1em]">
                                            GET HINT
                                        </button>
                                        <button onClick={() => setAiResponse('Try using a sliding window approach for O(N) complexity.')} className="flex-1 bg-[#ff3b30] hover:bg-[#ff453a] text-white text-[10px] font-black uppercase py-4 rounded-xl transition-all shadow-lg shadow-[#ff3b30]/20 active:scale-95 tracking-[0.1em]">
                                            ASK AI
                                        </button>
                                    </div>
                                </div>
                            )}
                            <button onClick={() => setShowHint(true)} className="pointer-events-auto bg-[#ff3b30] hover:bg-[#ff453a] text-white pl-8 pr-12 py-5 rounded-full shadow-2xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95 group border-2 border-white/10">
                                <span className="font-black text-sm uppercase tracking-wider flex items-center gap-3">
                                    <span className="text-2xl">💡</span> Need explanation?
                                </span>
                                <span className="bg-black/20 px-5 py-2 rounded-full text-[10px] font-black tracking-widest border border-white/10">VIEW HINT</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar-light::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar-light::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-light::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #2d2d2d; border-radius: 10px; }
                
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                @keyframes chat-popup { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                .animate-chat-popup { animation: chat-popup 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
            `}</style>
        </div>
    );
}
