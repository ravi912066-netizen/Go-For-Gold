'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import API from '@/lib/api';

export default function LeaderboardPage() {
    const router = useRouter();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'overall' | 'streak'>('overall');
    const avatar = (n: string) => `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(n || 'U')}&backgroundColor=1e2d45&textColor=f59e0b`;

    useEffect(() => {
        const token = localStorage.getItem('gfg_token');
        if (!token) { router.push('/login'); return; }
        API.get('/leaderboard').then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    const displayed = tab === 'streak'
        ? [...data].sort((a, b) => (b.user?.currentStreak || 0) - (a.user?.currentStreak || 0))
        : data;

    const medalColors = ['🥇', '🥈', '🥉'];

    return (
        <div className="flex min-h-screen bg-[#0a0e1a]">
            <Sidebar role="student" />
            <main className="flex-1 overflow-y-auto">
                <div className="sticky top-0 z-10 bg-[#0a0e1a]/90 backdrop-blur border-b border-[#1e2d45] px-6 py-3">
                    <h1 className="text-lg font-bold text-white">Leaderboard</h1>
                    <p className="text-xs text-slate-500">Rank against coders from all colleges</p>
                </div>
                <div className="p-6 max-w-3xl">
                    {/* Podium Top 3 */}
                    {!loading && displayed.length >= 3 && (
                        <div className="flex items-end justify-center gap-4 mb-8">
                            {[displayed[1], displayed[0], displayed[2]].map((entry, i) => {
                                const heights = ['h-24', 'h-32', 'h-20'];
                                const positions = [2, 1, 3];
                                return (
                                    <div key={entry?.id} className="flex flex-col items-center gap-2">
                                        <img src={avatar(entry?.user?.name)} className="w-12 h-12 rounded-full ring-2 ring-amber-500/30" alt="" />
                                        <p className="text-xs font-bold text-white text-center max-w-16 truncate">{entry?.user?.name}</p>
                                        <div className={`${heights[i]} w-20 bg-gradient-to-t ${i === 1 ? 'from-amber-600 to-amber-400' : 'from-slate-600 to-slate-500'} rounded-t-lg flex items-center justify-center text-2xl`}>
                                            {medalColors[positions[i] - 1]}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex border-b border-[#1e2d45] mb-4">
                        {(['overall', 'streak'] as const).map(t => (
                            <button key={t} onClick={() => setTab(t)}
                                className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-500 hover:text-white'}`}>
                                {t === 'overall' ? '🏆 Overall XP' : '🔥 Longest Streak'}
                            </button>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="card overflow-hidden">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-[#1e2d45] text-slate-500 text-xs uppercase">
                                <th className="text-left px-4 py-3">Rank</th>
                                <th className="text-left px-4 py-3">Player</th>
                                <th className="text-left px-4 py-3 hidden sm:table-cell">College</th>
                                <th className="text-right px-4 py-3">{tab === 'streak' ? 'Streak' : 'XP'}</th>
                                <th className="text-right px-4 py-3 hidden md:table-cell">Solved</th>
                            </tr></thead>
                            <tbody>
                                {loading && <tr><td colSpan={5} className="text-center py-10 text-slate-500">Loading…</td></tr>}
                                {!loading && displayed.map((entry, i) => (
                                    <tr key={entry.id} className="border-b border-[#1e2d45]/50 hover:bg-white/2 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className={`font-black text-sm ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-700' : 'text-slate-600'}`}>
                                                #{i + 1}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <img src={avatar(entry.user?.name)} className="w-8 h-8 rounded-full" alt="" />
                                                <span className="font-medium text-slate-200">{entry.user?.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{entry.user?.college}</td>
                                        <td className="px-4 py-3 text-right font-bold text-amber-400">
                                            {tab === 'streak' ? `🔥 ${entry.user?.currentStreak || 0}d` : `${entry.totalXp} XP`}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-400 hidden md:table-cell">{entry.totalSolved}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
