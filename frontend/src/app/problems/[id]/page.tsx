'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import API from '@/lib/api';

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
            <div className="flex flex-1 min-h-0">
                {/* LEFT: Problem statement */}
                <div className="w-80 lg:w-96 bg-[#111827] border-r border-[#1e2d45] flex flex-col overflow-hidden shrink-0">
                    <div className="px-4 pt-3 pb-2 border-b border-[#1e2d45] flex items-center gap-2 bg-[#0d1117]">
                        <span className="text-xs bg-[#1e2d45] text-slate-300 px-2 py-1 rounded font-medium">Problem Statement</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <h2 className="text-lg font-black text-white mb-1">{problem.title}</h2>
                        <p className="text-xs text-slate-500 mb-3">
                            Time Limit: {problem.timeLimit}s, Memory Limit: {problem.memoryLimit}MB
                        </p>
                        <div className="flex gap-2 mb-4 flex-wrap">
                            <span className={`${problem.difficulty === 'Easy' ? 'badge-easy' : problem.difficulty === 'Medium' ? 'badge-medium' : 'badge-hard'}`}>{problem.difficulty}</span>
                            {JSON.parse(problem.tags || '[]').map((t: string) => (
                                <span key={t} className="text-xs bg-[#1e2d45] text-slate-400 px-2 py-0.5 rounded">#{t}</span>
                            ))}
                        </div>
                        <div className="prose-dark text-sm text-slate-300 leading-relaxed space-y-4">
                            {problem.statement.split('\n\n').map((para: string, i: number) => (
                                <p key={i} dangerouslySetInnerHTML={{
                                    __html: para.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                                        .replace(/\n/g, '<br/>')
                                }} />
                            ))}
                        </div>
                        {/* Sample testcases */}
                        {JSON.parse(problem.testcases || '[]').slice(0, 2).map((tc: any, i: number) => (
                            <div key={i} className="mt-6">
                                <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Example {i + 1}:</p>
                                <div className="bg-[#0a0e1a] rounded-xl p-4 border border-[#1e2d45] shadow-inner">
                                    <p className="text-[10px] uppercase font-bold text-slate-600 mb-2 tracking-widest">Input</p>
                                    <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap mb-4 bg-black/40 p-2 rounded">{tc.input}</pre>
                                    <p className="text-[10px] uppercase font-bold text-slate-600 mb-2 tracking-widest">Output</p>
                                    <pre className="text-amber-400 font-mono text-sm whitespace-pre-wrap bg-black/40 p-2 rounded">{tc.output}</pre>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CENTER: Editor + I/O */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Editor toolbar */}
                    <div className="h-10 bg-[#0d1117] border-b border-[#1e2d45] flex items-center px-3 gap-3 shrink-0">
                        <div className="relative" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setShowLangDrop(!showLangDrop)}
                                className="flex items-center gap-1.5 text-slate-300 hover:text-white text-sm font-medium">
                                {LANG_LABELS[lang]} ▾
                            </button>
                            {showLangDrop && (
                                <div className="absolute top-full left-0 mt-1 bg-[#1a2235] border border-[#1e2d45] rounded-lg overflow-hidden z-50 shadow-xl">
                                    {Object.entries(LANG_LABELS).map(([k, v]) => (
                                        <button key={k} onClick={() => handleLangChange(k)}
                                            className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors ${lang === k ? 'text-amber-400' : 'text-slate-300'}`}>
                                            {v} {lang === k && '✓'}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Monaco Editor */}
                    <div className="flex-1 min-h-0">
                        <MonacoEditor
                            height="100%"
                            language={MONACO_LANG[lang]}
                            value={code}
                            onChange={(v) => setCode(v || '')}
                            theme="vs-dark"
                            options={{
                                fontSize: 14,
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                minimap: { enabled: false },
                                lineNumbers: 'on',
                                padding: { top: 12 },
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                tabSize: 4,
                                wordWrap: 'on',
                            }}
                        />
                    </div>

                    {/* I/O Tabs */}
                    <div className="border-t border-[#1e2d45] bg-[#0d1117] shrink-0" style={{ height: '180px' }}>
                        <div className="flex border-b border-[#1e2d45] px-3">
                            {(['input', 'output', 'error'] as const).map(t => (
                                <button key={t} onClick={() => setTab(t)}
                                    className={`px-3 py-2 text-xs font-medium uppercase tracking-wide transition-colors ${tab === t ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-500 hover:text-slate-300'}`}>
                                    {t}
                                </button>
                            ))}
                            {status && (
                                <span className={`ml-auto self-center text-xs font-bold ${statusColor()}`}>{status}</span>
                            )}
                            {runtime !== null && (
                                <span className="ml-3 self-center text-xs text-slate-500">{runtime}ms · {memory}MB</span>
                            )}
                        </div>
                        <div className="p-3 h-[calc(100%-36px)] overflow-y-auto">
                            {tab === 'input' && (
                                <textarea className="w-full h-full bg-transparent text-sm text-slate-300 font-mono resize-none outline-none placeholder-slate-600"
                                    placeholder="Enter custom test input here…" value={input}
                                    onChange={e => setInput(e.target.value)} />
                            )}
                            {tab === 'output' && (
                                <pre className="text-sm font-mono text-green-300 whitespace-pre-wrap">{output || (running ? 'Running…' : 'Run your code to see output')}</pre>
                            )}
                            {tab === 'error' && (
                                <pre className="text-sm font-mono text-red-400 whitespace-pre-wrap">{err || 'No errors'}</pre>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT: AI Assistant */}
                <div className="w-72 xl:w-80 border-l border-[#1e2d45] bg-[#111827] flex flex-col shrink-0">
                    <div className="px-4 py-3 border-b border-[#1e2d45]">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-amber-400 text-lg">🤖</span>
                            <h3 className="font-bold text-white text-sm">AI Assistant</h3>
                        </div>
                        <p className="text-xs text-slate-500">Hints, debugging, and optimization help</p>
                    </div>

                    {/* Mode selector */}
                    <div className="p-3 border-b border-[#1e2d45]">
                        <div className="grid grid-cols-2 gap-1.5">
                            {([
                                { mode: 'hint', label: '💡 Hint', color: 'amber' },
                                { mode: 'debug', label: '🔍 Debug', color: 'blue' },
                                { mode: 'explain', label: '📖 Explain', color: 'purple' },
                                { mode: 'optimize', label: '⚡ Optimize', color: 'green' },
                            ] as const).map(({ mode, label }) => (
                                <button key={mode} onClick={() => setAiMode(mode)}
                                    className={`text-xs py-2 px-2 rounded-lg font-medium transition-all ${aiMode === mode ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' : 'bg-[#0a0e1a] border border-[#1e2d45] text-slate-400 hover:text-white'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <button onClick={handleAI} disabled={aiLoading}
                            className="btn-gold w-full mt-2 py-2 text-sm flex items-center justify-center gap-2">
                            {aiLoading ? <><span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />Thinking…</> : 'Ask AI'}
                        </button>
                    </div>

                    {/* AI Response */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {aiResponse ? (
                            <div className="space-y-2">
                                <div className="bg-[#0a0e1a] rounded-xl p-4 text-sm text-slate-300 leading-relaxed border border-[#1e2d45]">
                                    {aiResponse.split('\n').map((line, i) => {
                                        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-white mb-2">{line.replace(/\*\*/g, '')}</p>;
                                        if (line.startsWith('*') && line.endsWith('*')) return <p key={i} className="text-slate-500 italic text-xs mt-2">{line.replace(/\*/g, '')}</p>;
                                        return <p key={i} className="text-slate-300">{line}</p>;
                                    })}
                                </div>
                                <p className="text-xs text-slate-600 text-center">AI gives hints only. Ask explicitly for full solution.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                                <span className="text-4xl mb-3">🤖</span>
                                <p className="text-slate-500 text-sm">Select a mode and click "Ask AI"</p>
                                <p className="text-slate-600 text-xs mt-1">AI gives hints by default, not full solutions</p>
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
