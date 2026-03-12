'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import API from '@/lib/api';

export default function ProblemsPage() {
    const router = useRouter();
    const [questions, setQuestions] = useState<any[]>([]);
    const [filter, setFilter] = useState({ search: '', difficulty: '' });
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('gfg_token');
        if (!token) { router.push('/login'); return; }
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [qRes, subRes] = await Promise.allSettled([API.get('/questions'), API.get('/submissions/me')]);
            if (qRes.status === 'fulfilled') setQuestions(qRes.value.data);
            if (subRes.status === 'fulfilled') setSubmissions(subRes.value.data);
        } finally { setLoading(false); }
    };

    const filtered = questions.filter(q => {
        const matchSearch = q.title.toLowerCase().includes(filter.search.toLowerCase());
        const matchDiff = !filter.difficulty || q.difficulty === filter.difficulty;
        return matchSearch && matchDiff;
    });

    const isSolved = (q: any) => submissions.some(s => s.question?.title === q.title && s.status === 'Accepted');
    const isAttempted = (q: any) => submissions.some(s => s.question?.title === q.title);

    const counts = { Easy: 0, Medium: 0, Hard: 0 };
    questions.forEach(q => { if (q.difficulty in counts) (counts as any)[q.difficulty]++; });

    return (
        <div className="flex min-h-screen bg-[#0a0e1a]">
            <Sidebar role="student" />
            <main className="flex-1 overflow-y-auto">
                <div className="sticky top-0 z-10 bg-[#0a0e1a]/90 backdrop-blur border-b border-[#1e2d45] px-6 py-3">
                    <h1 className="text-lg font-bold text-white">Problems</h1>
                    <p className="text-xs text-slate-500">Practice coding and improve your skills</p>
                </div>
                <div className="p-6 max-w-5xl">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        {[
                            { label: 'Easy', count: counts.Easy, color: 'green' },
                            { label: 'Medium', count: counts.Medium, color: 'yellow' },
                            { label: 'Hard', count: counts.Hard, color: 'red' },
                        ].map(({ label, count, color }) => (
                            <div key={label} className="card p-4 text-center">
                                <p className="text-2xl font-black" style={{ color: color === 'green' ? '#4ade80' : color === 'yellow' ? '#fbbf24' : '#f87171' }}>{count}</p>
                                <p className="text-xs text-slate-500 mt-1">{label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex gap-3 mb-4 flex-wrap">
                        <input className="input-field max-w-sm text-sm" placeholder="🔍 Search problems..."
                            value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
                        <select className="input-field w-36 text-sm" value={filter.difficulty}
                            onChange={e => setFilter(f => ({ ...f, difficulty: e.target.value }))}>
                            <option value="">All Difficulties</option>
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                        </select>
                    </div>

                    {/* Table */}
                    <div className="card overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#1e2d45] text-slate-500 text-xs uppercase">
                                    <th className="text-left px-4 py-3 w-10">Status</th>
                                    <th className="text-left px-4 py-3"># Title</th>
                                    <th className="text-left px-4 py-3">Difficulty</th>
                                    <th className="text-left px-4 py-3 hidden md:table-cell">Tags</th>
                                    <th className="text-left px-4 py-3 hidden lg:table-cell">Course</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr><td colSpan={5} className="text-center py-10 text-slate-500">Loading…</td></tr>
                                )}
                                {!loading && filtered.map((q, i) => (
                                    <tr key={q.id} className="border-b border-[#1e2d45]/50 hover:bg-white/2 transition-colors group">
                                        <td className="px-4 py-3">
                                            {isSolved(q) ? <span className="text-green-400">✓</span> :
                                                isAttempted(q) ? <span className="text-yellow-400">~</span> :
                                                    <span className="text-slate-700">○</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link href={`/problems/${q.id}`} className="text-slate-200 group-hover:text-amber-400 font-medium transition-colors">
                                                {i + 1}. {q.title}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={q.difficulty === 'Easy' ? 'badge-easy' : q.difficulty === 'Medium' ? 'badge-medium' : 'badge-hard'}>
                                                {q.difficulty}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 hidden md:table-cell">
                                            <div className="flex gap-1 flex-wrap">
                                                {JSON.parse(q.tags || '[]').slice(0, 2).map((t: string) => (
                                                    <span key={t} className="text-xs text-slate-500 bg-[#1e2d45] px-2 py-0.5 rounded">#{t}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{q.course?.title || '-'}</td>
                                    </tr>
                                ))}
                                {!loading && filtered.length === 0 && (
                                    <tr><td colSpan={5} className="text-center py-10 text-slate-500">No problems match your filters</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
