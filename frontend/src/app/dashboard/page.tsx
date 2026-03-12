'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import API from '@/lib/api';

const LiveRoom = dynamic(() => import('@/components/LiveRoom'), { ssr: false });

interface QOTD { id: number; title: string; difficulty: string; deadline: string; isQotd: boolean; }
interface LeaderEntry { id: number; rank: number; user: { id: number; name: string; college: string; photoUrl?: string; currentStreak: number }; totalSolved: number; totalXp: number; }
interface Question { id: number; title: string; difficulty: string; createdAt: string; slug: string; }
interface Submission { id: number; status: string; question: { title: string; difficulty: string }; createdAt: string; }

export default function Dashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [qotd, setQotd] = useState<QOTD | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [recentSubs, setRecentSubs] = useState<Submission[]>([]);
    const [countdown, setCountdown] = useState('');
    const [activeTab, setActiveTab] = useState<'fastest' | 'streak' | 'overall'>('overall');
    const [filterQ, setFilterQ] = useState('');
    const [showChat, setShowChat] = useState(false);

    useEffect(() => {
        const u = localStorage.getItem('gfg_user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        setUser(parsed);
        if (parsed.role === 'admin') { router.push('/admin'); return; }
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [qotdRes, lbRes, qRes, subRes] = await Promise.allSettled([
                API.get('/questions/qotd'),
                API.get('/leaderboard'),
                API.get('/questions'),
                API.get('/submissions/me'),
            ]);
            if (qotdRes.status === 'fulfilled') setQotd(qotdRes.value.data);
            if (lbRes.status === 'fulfilled') setLeaderboard(lbRes.value.data);
            if (qRes.status === 'fulfilled') setQuestions(qRes.value.data);
            if (subRes.status === 'fulfilled') setRecentSubs(subRes.value.data);
        } catch { }
    };

    // Countdown timer
    useEffect(() => {
        if (!qotd?.deadline) return;
        const tick = () => {
            const diff = new Date(qotd.deadline).getTime() - Date.now();
            if (diff <= 0) { setCountdown('Ended'); return; }
            const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            setCountdown(`${h}:${m}:${s}`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [qotd]);

    const diffColor = (d: string) => d === 'Easy' ? 'badge-easy' : d === 'Medium' ? 'badge-medium' : 'badge-hard';

    const filteredQ = questions.filter(q => q.title.toLowerCase().includes(filterQ.toLowerCase()));
    const topLeaders = activeTab === 'streak'
        ? [...leaderboard].sort((a, b) => (b.user.currentStreak || 0) - (a.user.currentStreak || 0)).slice(0, 10)
        : leaderboard.slice(0, 10);

    const avatar = (name: string) => `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=1e2d45&textColor=f59e0b`;

    const myrank = user ? leaderboard.findIndex(e => e.user?.id === user.id) + 1 : null;

    return (
        <div className="flex min-h-screen bg-[#0a0e1a]">
            <Sidebar role="student" />

            <main className="flex-1 overflow-y-auto">
                {/* Top bar */}
                <div className="sticky top-0 z-20 bg-[#0a0e1a]/90 backdrop-blur border-b border-[#1e2d45] px-6 py-3 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-white">Dashboard</h1>
                        <p className="text-xs text-slate-500">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋</p>
                    </div>
                    <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <img src={avatar(user?.name || 'U')} className="w-8 h-8 rounded-full bg-[#1e2d45]" alt="" />
                        <span className="text-sm text-slate-300 hidden sm:block">{user?.name}</span>
                    </Link>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* QOTD Card */}
                        {qotd && (
                            <div className="qotd-gradient rounded-2xl p-6 relative overflow-hidden shadow-lg">
                                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #10b981, transparent)' }} />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide animate-pulse">LIVE</span>
                                        {countdown && (
                                            <span className="bg-black/30 text-white text-xs font-mono px-3 py-1.5 rounded-full flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></span>
                                                ENDS IN {countdown}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-green-200 text-xs font-medium uppercase tracking-widest mb-1">Question of the Day</p>
                                    <h2 className="text-2xl font-black text-white mb-4">{qotd.title}</h2>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <Link href={`/problems/${qotd.id}`}
                                            className="bg-white text-gray-900 hover:bg-gray-100 font-semibold px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2">
                                            Solve Now →
                                        </Link>
                                        <span className={diffColor(qotd.difficulty)}>{qotd.difficulty}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Questions table */}
                        <div className="card overflow-hidden">
                            <div className="p-4 border-b border-[#1e2d45] flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <h3 className="font-bold text-white">Previously Asked Questions</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Practice and climb the all-time leaderboard</p>
                                </div>
                            </div>
                            {/* Filter */}
                            <div className="px-4 pt-3">
                                <input className="input-field text-sm" placeholder="🔍 Search question id, name..."
                                    value={filterQ} onChange={e => setFilterQ(e.target.value)} />
                            </div>
                            <div className="overflow-x-auto mt-3">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[#1e2d45] text-slate-500 text-xs uppercase tracking-wide">
                                            <th className="text-left px-4 py-2 w-10">Status</th>
                                            <th className="text-left px-4 py-2">Question Name</th>
                                            <th className="text-left px-4 py-2">Difficulty</th>
                                            <th className="text-left px-4 py-2 hidden sm:table-cell">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredQ.slice(0, 15).map(q => {
                                            const solved = recentSubs.some(s => s.question?.title === q.title && s.status === 'Accepted');
                                            return (
                                                <tr key={q.id} className="border-b border-[#1e2d45]/50 hover:bg-white/2 transition-colors group">
                                                    <td className="px-4 py-3 text-center">
                                                        {solved
                                                            ? <span className="text-green-400 text-base">✓</span>
                                                            : <span className="text-slate-600 text-base">◯</span>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Link href={`/problems/${q.id}`} className="text-slate-200 group-hover:text-amber-400 transition-colors font-medium">
                                                            {q.title}
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-3"><span className={diffColor(q.difficulty)}>{q.difficulty}</span></td>
                                                    <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">
                                                        {new Date(q.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredQ.length === 0 && (
                                            <tr><td colSpan={4} className="text-center py-10 text-slate-500">No questions found</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Right column */}
                    <div className="space-y-4">
                        {/* Performance */}
                        <div className="card p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-white">Performance</h3>
                                <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <span key={i} className={`text-lg ${i <= 3 ? 'text-red-400' : 'text-slate-700'}`}>♥</span>
                                    ))}
                                </div>
                            </div>
                            <p className="text-slate-500 text-xs mb-4">Set records for your practice</p>

                            <div className="mb-4">
                                <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Your Streak</p>
                                <p className="text-4xl font-black text-white flex items-center gap-2">
                                    <span>🔥</span><span>{user?.currentStreak || 0} days</span>
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                <div>
                                    <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Longest Streak</p>
                                    <p className="font-bold text-white">{user?.longestStreak || 0} days</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#1e2d45]">
                                <div className="bg-[#0a0e1a] rounded-lg p-3 text-center">
                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Solved</p>
                                    <p className="text-2xl font-black text-green-400">{recentSubs.filter(s => s.status === 'Accepted').length}</p>
                                </div>
                                <div className="bg-[#0a0e1a] rounded-lg p-3 text-center">
                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Attempted</p>
                                    <p className="text-2xl font-black text-amber-400">{recentSubs.length}</p>
                                </div>
                            </div>
                            {myrank && (
                                <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between">
                                    <span className="text-xs text-amber-400 font-medium">Your Rank</span>
                                    <span className="text-amber-400 font-black">#{myrank}</span>
                                </div>
                            )}
                        </div>

                        {/* Leaderboard */}
                        <div className="card p-5">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-bold text-white">Leaderboard</h3>
                                <select className="text-xs bg-[#0a0e1a] border border-[#1e2d45] text-slate-400 rounded px-2 py-1">
                                    <option>All Colleges</option>
                                </select>
                            </div>
                            <p className="text-slate-500 text-xs mb-4">Rank against your friends and other coders</p>

                            <div className="flex border-b border-[#1e2d45] mb-4 text-xs">
                                {(['fastest', 'streak', 'overall'] as const).map(t => (
                                    <button key={t} onClick={() => setActiveTab(t)}
                                        className={`flex-1 pb-2 font-medium transition-all capitalize ${activeTab === t ? 'text-white border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}>
                                        {t === 'fastest' ? "Today's Fastest" : t === 'streak' ? 'Longest Streak' : 'Overall'}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-2">
                                {topLeaders.slice(0, 8).map((entry, i) => (
                                    <div key={entry.id} className="flex items-center gap-2.5 py-1.5 hover:bg-white/2 rounded-lg px-1 transition-colors">
                                        <span className={`text-xs font-black w-5 text-center ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-700' : 'text-slate-600'}`}>
                                            {i + 1}
                                        </span>
                                        <img src={avatar(entry.user?.name || '?')} className="w-7 h-7 rounded-full" alt="" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-slate-200 truncate">{entry.user?.name}</p>
                                            <p className="text-xs text-slate-600 truncate">{entry.user?.college}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-amber-400">{activeTab === 'streak' ? `🔥${entry.user.currentStreak}` : entry.totalXp + ' XP'}</p>
                                        </div>
                                    </div>
                                ))}
                                {leaderboard.length === 0 && (
                                    <p className="text-center text-slate-600 text-xs py-4">No data yet</p>
                                )}
                            </div>

                            <Link href="/leaderboard" className="block mt-3 text-center text-xs text-amber-400 hover:text-amber-300">
                                View full leaderboard →
                            </Link>
                        </div>
                    </div>
                </div>
            </main>

            {/* ── Floating Live Chat Button ─────────────────────────────── */}
            <button
                onClick={() => setShowChat(prev => !prev)}
                className="fixed bottom-6 right-6 z-40 bg-amber-500 hover:bg-amber-400 text-black p-4 rounded-2xl shadow-2xl flex items-center gap-2 font-bold text-sm transition-all hover:scale-105 active:scale-95"
            >
                {showChat ? (
                    <><span className="text-lg">✕</span> Close Chat</>
                ) : (
                    <><span className="text-lg">💬</span> Live Chat<span className="bg-black/20 text-black text-xs px-1.5 py-0.5 rounded-full">+ Video</span></>
                )}
            </button>

            {/* ── Live Room Drawer ─────────────────────────────────────── */}
            {showChat && user && (
                <div className="fixed bottom-20 right-6 z-40 w-96 shadow-2xl animate-slide-up" style={{ height: '520px' }}>
                    <LiveRoom
                        roomId="student-teacher-general"
                        userId={user.id}
                        userName={user.name}
                        role={user.role}
                        onClose={() => setShowChat(false)}
                    />
                </div>
            )}
        </div>
    );
}
