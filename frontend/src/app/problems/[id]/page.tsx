'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import API from '@/lib/api';

export function generateStaticParams() {
    return [];
}

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const STARTER: Record<string, string> = {
    python: '# Write your solution here\nn = int(input())\n',
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    // Write your solution\n    return 0;\n}\n',
    java: 'import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution\n    }\n}\n',
    javascript: 'const readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin });\n// Write your solution\n',
};

const LANG_LABELS: Record<string, string> = {
    python: 'Python (3.11.4)',
    cpp: 'C++ (GCC 17)',
    java: 'Java (JDK 17)',
    javascript: 'JavaScript (Node)',
};

const MONACO_LANG: Record<string, string> = {
    python: 'python', cpp: 'cpp', java: 'java', javascript: 'javascript',
};

export default function ProblemPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [problem, setProblem] = useState<any>(null);
    const [lang, setLang] = useState('python');
    const [code, setCode] = useState(STARTER.python);
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [err, setErr] = useState('');
    const [runtime, setRuntime] = useState<number | null>(null);
    const [memory, setMemory] = useState<number | null>(null);
    const [tab, setTab] = useState<'input' | 'output' | 'error'>('input');
    const [running, setRunning] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [showLangDrop, setShowLangDrop] = useState(false);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    // AI Panel
    const [aiMode, setAiMode] = useState<'debug' | 'explain' | 'hint' | 'optimize'>('hint');
    const [aiResponse, setAiResponse] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('gfg_token');
        if (!token) { router.push('/login'); return; }
        fetchProblem();
    }, [id]);

    const fetchProblem = async () => {
        try {
            const { data } = await API.get(`/questions/${id}`);
            setProblem(data);
            if (data.starterCode) setCode(data.starterCode);
            // Load submissions
            const subRes = await API.get(`/submissions/question/${id}`);
            setSubmissions(subRes.data);
        } catch { router.push('/problems'); }
    };

    const handleLangChange = (l: string) => {
        setLang(l);
        setCode(STARTER[l]);
        setShowLangDrop(false);
    };

    const handleRun = async () => {
        setRunning(true); setTab('output'); setErr(''); setOutput(''); setStatus('');
        try {
            const { data } = await API.post('/execute', { code, language: lang, input });
            setOutput(data.output || '');
            setErr(data.error || '');
            setRuntime(data.runtime);
            setMemory(data.memory);
            setStatus(data.status);
            if (data.error) setTab('error');
        } catch (e: any) {
            setErr(e.response?.data?.error || 'Execution failed');
            setTab('error');
        } finally { setRunning(false); }
    };

    const handleSubmit = async () => {
        setSubmitting(true); setStatus('Judging…');
        try {
            // Run against test cases
            const testcases = JSON.parse(problem?.testcases || '[]');
            let allPassed = true;
            let finalRuntime = 0;
            let finalMemory = 0;

            for (const tc of testcases) {
                const { data } = await API.post('/execute', { code, language: lang, input: tc.input });
                finalRuntime = Math.max(finalRuntime, data.runtime || 0);
                finalMemory = Math.max(finalMemory, data.memory || 0);
                const actualOut = (data.output || '').trim();
                const expectedOut = (tc.output || '').trim();
                if (actualOut !== expectedOut || data.status !== 'Success') { allPassed = false; break; }
            }

            const verdict = allPassed ? 'Accepted' : 'Wrong Answer';
            setStatus(verdict);
            setRuntime(finalRuntime);
            setMemory(finalMemory);
            setTab('output');
            setOutput(verdict === 'Accepted' ? '✓ All test cases passed!' : '✗ Wrong Answer on a test case');

            // Save submission
            await API.post('/submissions', {
                questionId: id, code, language: lang, status: verdict, runtime: finalRuntime, memory: finalMemory
            });
            await fetchProblem();
        } catch (e: any) {
            setStatus('Runtime Error');
            setErr(e.response?.data?.error || 'Submission failed');
            setTab('error');
        } finally { setSubmitting(false); }
    };

    const handleAI = async () => {
        setAiLoading(true); setAiResponse('');
        try {
            const { data } = await API.post('/ai', { code, language: lang, error: err, mode: aiMode, questionTitle: problem?.title });
            setAiResponse(data.response);
        } catch { setAiResponse('AI service temporarily unavailable.'); }
        finally { setAiLoading(false); }
    };

    const statusColor = () => {
        if (status === 'Accepted') return 'text-green-400';
        if (status === 'Wrong Answer') return 'text-red-400';
        if (status === 'TLE') return 'text-yellow-400';
        return 'text-slate-400';
    };

    if (!problem) return (
        <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0a0e1a] flex flex-col" onClick={() => setShowLangDrop(false)}>
            {/* Top Nav */}
            <header className="h-12 bg-[#111827] border-b border-[#1e2d45] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                    <Link href="/problems" className="text-slate-400 hover:text-white text-sm flex items-center gap-1.5 transition-colors">
                        ← Back
                    </Link>
                    <span className="text-slate-600">|</span>
                    <span className="text-sm font-semibold text-white truncate max-w-48">{problem.title}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleRun} disabled={running}
                        className="flex items-center gap-1.5 border border-[#1e2d45] hover:border-slate-500 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
                        {running ? <span className="w-3 h-3 border border-slate-400/30 border-t-slate-400 rounded-full animate-spin" /> : '▶'}
                        Run
                    </button>
                    <button onClick={handleSubmit} disabled={submitting}
                        className="btn-gold px-4 py-1.5 text-sm flex items-center gap-1.5">
                        {submitting ? <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : null}
                        Submit
                    </button>
                    <button onClick={() => setShowHistory(!showHistory)} className="text-slate-400 hover:text-white px-2 py-1.5 text-sm border border-[#1e2d45] rounded-lg transition-colors">
                        History
                    </button>
                </div>
            </header>

            {/* 3-panel layout */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* LEFT: Problem statement */}
                <div className="w-80 lg:w-[450px] bg-[#111827] border-r border-[#1e2d45] flex flex-col shrink-0">
                    <div className="px-4 py-2 border-b border-[#1e2d45] flex items-center justify-between bg-[#0d1117]">
                        <div className="flex gap-4">
                            <button className="text-[10px] font-black text-amber-500 uppercase tracking-widest border-b-2 border-amber-500 pb-1">Question</button>
                            <button className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-300 pb-1">Submissions</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#0d1117]">
                        <div className="flex gap-2 mb-4">
                            <span className={`${problem.difficulty === 'Easy' ? 'badge-easy' : problem.difficulty === 'Medium' ? 'badge-medium' : 'badge-hard'}`}>{problem.difficulty}</span>
                            {JSON.parse(problem.tags || '[]').map((t: string) => (
                                <span key={t} className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded uppercase font-black tracking-widest">#{t}</span>
                            ))}
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">{problem.title}</h2>
                        <div className="prose-dark text-sm text-slate-300 leading-relaxed mb-8">
                            {problem.statement.split('\n\n').map((para: string, i: number) => (
                                <p key={i} className="mb-4" dangerouslySetInnerHTML={{
                                    __html: para.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                                        .replace(/\n/g, '<br/>')
                                }} />
                            ))}
                        </div>

                        {/* Examples Section */}
                        {JSON.parse(problem.testcases || '[]').slice(0, 2).map((tc: any, i: number) => (
                            <div key={i} className="mb-8">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Example {i + 1}</h4>
                                <div className="bg-[#0a0e1a] rounded-2xl p-5 border border-white/5 space-y-4">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Input</p>
                                        <div className="bg-black/40 rounded-xl p-3 font-mono text-sm text-green-400 border border-white/5">{tc.input}</div>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Output</p>
                                        <div className="bg-black/40 rounded-xl p-3 font-mono text-sm text-amber-400 border border-white/5">{tc.output}</div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Constraints */}
                        <div className="mt-8 pt-6 border-t border-white/5">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Constraints</h4>
                            <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4">
                                <li>Time Limit: {problem.timeLimit}s</li>
                                <li>Memory Limit: {problem.memoryLimit}MB</li>
                                <li>Test Cases: Hidden except samples</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* CENTER: Editor + I/O */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
                    {/* Editor toolbar */}
                    <div className="h-10 bg-[#0d1117] border-b border-[#1e2d45] flex items-center px-4 justify-between shrink-0">
                        <div className="relative" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setShowLangDrop(!showLangDrop)}
                                className="flex items-center gap-2 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all">
                                {LANG_LABELS[lang]}
                                <span className={`transition-transform duration-200 ${showLangDrop ? 'rotate-180' : ''}`}>▼</span>
                            </button>
                            {showLangDrop && (
                                <div className="absolute top-full left-0 mt-2 bg-[#111827] border border-[#1e2d45] rounded-xl overflow-hidden z-[60] shadow-2xl min-w-[160px] animate-scale-in">
                                    {Object.entries(LANG_LABELS).map(([k, v]) => (
                                        <button key={k} onClick={() => handleLangChange(k)}
                                            className={`block w-full text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors ${lang === k ? 'text-amber-500 bg-amber-500/5' : 'text-slate-400'}`}>
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all"><span className="text-sm">🔄</span></button>
                            <button className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all"><span className="text-sm">⛶</span></button>
                        </div>
                    </div>

                    {/* Monaco Editor */}
                    <div className="flex-1 min-h-0 border-b border-[#1e2d45]">
                        <MonacoEditor
                            height="100%"
                            language={MONACO_LANG[lang]}
                            value={code}
                            onChange={(v) => setCode(v || '')}
                            theme="vs-dark"
                            options={{
                                fontSize: 13,
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                minimap: { enabled: false },
                                lineNumbers: 'on',
                                padding: { top: 16 },
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                tabSize: 4,
                                wordWrap: 'on',
                                hideCursorInOverviewRuler: true,
                                overviewRulerBorder: false,
                            }}
                        />
                    </div>

                    {/* I/O Tabs */}
                    <div className="bg-[#0d1117] shrink-0 flex flex-col" style={{ height: '240px' }}>
                        <div className="flex border-b border-[#1e2d45] px-4">
                            {(['INPUT', 'OUTPUT', 'ERROR'] as const).map(t => (
                                <button key={t} onClick={() => setTab(t.toLowerCase() as any)}
                                    className={`px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${tab === t.toLowerCase() ? 'text-amber-500 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                                    {t}
                                </button>
                            ))}
                            <div className="ml-auto flex items-center gap-4">
                                {status && <span className={`text-[10px] font-black uppercase tracking-widest ${statusColor()}`}>{status}</span>}
                                {runtime !== null && <span className="text-[10px] text-slate-500 font-black tracking-widest lowercase">{runtime}ms · {memory}mb</span>}
                            </div>
                        </div>
                        <div className="flex-1 flex min-h-0 bg-[#0a0e1a]/50">
                            {/* Custom Console with Line Numbers */}
                            <div className="w-10 bg-[#0d1117]/50 flex flex-col items-center pt-3 text-[10px] text-slate-700 font-mono border-r border-white/5 select-none">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <div key={n} className="leading-6">{n}</div>)}
                            </div>
                            <div className="flex-1 p-3 overflow-y-auto">
                                {tab === 'input' && (
                                    <textarea className="w-full h-full bg-transparent text-sm text-slate-300 font-mono resize-none outline-none placeholder-slate-600 leading-6"
                                        placeholder="Enter custom test input here…" value={input}
                                        onChange={e => setInput(e.target.value)} />
                                )}
                                {tab === 'output' && (
                                    <pre className="text-sm font-mono text-green-300 whitespace-pre-wrap leading-6">{output || (running ? 'Judging…' : 'Run code to see results')}</pre>
                                )}
                                {tab === 'error' && (
                                    <pre className="text-sm font-mono text-red-400 whitespace-pre-wrap leading-6">{err || 'No compile time errors'}</pre>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: AI Assistant */}
                <div className="w-72 xl:w-80 border-l border-[#1e2d45] bg-[#111827] flex flex-col shrink-0">
                    <div className="px-5 py-6 space-y-1">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Newton AI</h3>
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Assistant</p>
                    </div>

                    <div className="px-5 space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { mode: 'hint', label: '💡 HINT', active: aiMode === 'hint' },
                                { mode: 'debug', label: '🔍 DEBUG', active: aiMode === 'debug' },
                                { mode: 'explain', label: '📖 EXPLAIN', active: aiMode === 'explain' },
                                { mode: 'optimize', label: '⚡ SPEED', active: aiMode === 'optimize' },
                            ].map(m => (
                                <button key={m.mode} onClick={() => setAiMode(m.mode as any)}
                                    className={`py-3 rounded-xl text-[10px] font-black transition-all border ${m.active ? 'bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-transparent border-white/5 text-slate-500 hover:border-white/10 hover:text-white'}`}>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                        <button onClick={handleAI} disabled={aiLoading}
                            className="w-full bg-slate-100 hover:bg-white text-black py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50">
                            {aiLoading ? 'Synthesizing...' : 'ASK ASSISTANT'}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 mt-4 custom-scrollbar">
                        {aiResponse ? (
                            <div className="bg-[#0a0e1a] rounded-2xl p-5 border border-white/5 space-y-4">
                                <div className="prose-dark text-xs text-slate-400 leading-relaxed">
                                    {aiResponse.split('\n').map((line, i) => (
                                        <p key={i} className="mb-2">{line}</p>
                                    ))}
                                </div>
                                <div className="pt-4 border-t border-white/5">
                                    <button onClick={() => setAiResponse('')} className="text-[9px] font-black text-slate-600 uppercase tracking-widest hover:text-slate-400 transition-all">Clear Response</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
                                <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-3xl">🤖</div>
                                <div>
                                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Need help?</p>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight mt-1">Select a mode above</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Submission History Panel */}
            {showHistory && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowHistory(false)}>
                    <div className="bg-[#111827] border border-[#1e2d45] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-[#1e2d45]">
                            <h3 className="font-bold text-white">Submission History</h3>
                            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white text-lg">×</button>
                        </div>
                        <div className="overflow-y-auto max-h-[calc(80vh-60px)]">
                            {submissions.length === 0 ? (
                                <p className="text-center text-slate-500 py-10">No submissions yet</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead><tr className="text-slate-500 text-xs uppercase border-b border-[#1e2d45]">
                                        <th className="text-left px-4 py-2">#</th>
                                        <th className="text-left px-4 py-2">Status</th>
                                        <th className="text-left px-4 py-2">Language</th>
                                        <th className="text-left px-4 py-2">Runtime</th>
                                        <th className="text-left px-4 py-2">Time</th>
                                    </tr></thead>
                                    <tbody>
                                        {submissions.map((s, i) => (
                                            <tr key={s.id} className="border-b border-[#1e2d45]/50 hover:bg-white/2">
                                                <td className="px-4 py-3 text-slate-500">{submissions.length - i}</td>
                                                <td className="px-4 py-3"><span className={`font-medium ${s.status === 'Accepted' ? 'text-green-400' : s.status === 'Wrong Answer' ? 'text-red-400' : 'text-yellow-400'}`}>{s.status}</span></td>
                                                <td className="px-4 py-3 text-slate-400 capitalize">{s.language}</td>
                                                <td className="px-4 py-3 text-slate-400">{s.runtime ? `${Math.round(s.runtime)}ms` : '-'}</td>
                                                <td className="px-4 py-3 text-slate-500 text-xs">{new Date(s.createdAt).toLocaleTimeString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
