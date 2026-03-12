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

                <div className="p-6">
                    {/* TOP STATS ROW */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        {[
                            { label: 'Problems Solved', value: `${recentSubs.filter(s => s.status === 'Accepted').length}/372`, icon: '✔️', color: 'text-green-400' },
                            { label: 'Total XP', value: user?.xp || 0, icon: '⚡', color: 'text-amber-400' },
                            { label: 'Current Streak', value: `${user?.currentStreak || 0} Days`, icon: '🔥', color: 'text-orange-500' },
                            { label: 'Global Rank', value: `#${myrank || 'N/A'}`, icon: '🏆', color: 'text-blue-400' },
                        ].map((s, i) => (
                            <div key={i} className="card p-4 bg-gradient-to-br from-[#111827] to-[#0a0e1a] border-[#1e2d45] flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">{s.icon}</div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-none mb-1">{s.label}</p>
                                    <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CATEGORY CARDS GRID (Unacademy style) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
                        {[
                            { label: 'Live classes', icon: '📹', color: 'text-red-400' },
                            { label: 'Top educators', icon: '👤', color: 'text-blue-400' },
                            { label: 'Batches', icon: '👥', color: 'text-amber-400' },
                            { label: 'Courses', icon: '📚', color: 'text-indigo-400' },
                            { label: 'Playlist', icon: '📂', color: 'text-teal-400' },
                            { label: 'Practice', icon: '⚡', color: 'text-purple-400' },
                            { label: 'Test series', icon: '📝', color: 'text-cyan-400' },
                            { label: 'Doubts', icon: '💬', color: 'text-green-400' },
                        ].map((c, i) => (
                            <div key={i} className="card p-3 flex flex-col items-center justify-center gap-2 hover:border-amber-500/30 transition-all cursor-pointer group">
                                <span className={`text-2xl ${c.color} group-hover:scale-110 transition-transform`}>{c.icon}</span>
                                <span className="text-[10px] font-bold text-slate-300 uppercase text-center">{c.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* MAIN CONTENT AREA */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* LEFT COLUMN: Heatmap + Problems */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Heatmap Card */}
                            <div className="card p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Active days
                                    </h3>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                        <span>Streak: {user?.currentStreak || 0}d</span>
                                        <span className="w-px h-3 bg-slate-800" />
                                        <span>Longest: {user?.longestStreak || 0}d</span>
                                    </div>
                                </div>
                                <div className="flex gap-1 flex-wrap">
                                    {Array.from({ length: 52 }).map((_, i) => (
                                        <div key={i} className="flex flex-col gap-1">
                                            {Array.from({ length: 7 }).map((_, j) => (
                                                <div key={j} className={`w-3 h-3 rounded-sm ${Math.random() > 0.8 ? 'bg-green-500' : 'bg-[#1e2d45]'}`} />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between mt-4">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{recentSubs.length} problems solved this year</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-slate-500">Less</span>
                                        <div className="flex gap-1">
                                            <div className="w-3 h-3 rounded-sm bg-[#1e2d45]" />
                                            <div className="w-3 h-3 rounded-sm bg-green-900" />
                                            <div className="w-3 h-3 rounded-sm bg-green-700" />
                                            <div className="w-3 h-3 rounded-sm bg-green-500" />
                                        </div>
                                        <span className="text-[10px] text-slate-500">More</span>
                                    </div>
                                </div>
                            </div>

                            {/* QOTD Card */}
                            {qotd && (
                                <div className="qotd-gradient rounded-2xl p-6 relative overflow-hidden shadow-lg border border-amber-500/20">
                                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #10b981, transparent)' }} />
                                    <div className="relative z-10">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest animate-pulse">Live Now</span>
                                            {countdown && (
                                                <span className="bg-black/40 text-white text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/5">
                                                    ENDS IN {countdown}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Pick of the Day</p>
                                        <h2 className="text-2xl font-black text-white mb-4">{qotd.title}</h2>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <Link href={`/problems/${qotd.id}`}
                                                className="bg-white text-gray-900 hover:bg-amber-100 font-bold px-5 py-2 rounded-xl text-sm transition-all flex items-center gap-2 transform hover:-translate-y-1 shadow-xl">
                                                Solve Challenge →
                                            </Link>
                                            <span className={`${diffColor(qotd.difficulty)} font-bold`}>{qotd.difficulty}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Questions Table */}
                            <div className="card overflow-hidden">
                                <div className="px-5 py-4 border-b border-[#1e2d45] flex items-center justify-between">
                                    <h3 className="font-bold text-white tracking-wide">Problem practice</h3>
                                    <input className="bg-[#0a0e1a] border border-[#1e2d45] rounded-xl px-4 py-1.5 text-xs text-slate-300 w-64 focus:border-amber-500/50 outline-none"
                                        placeholder="Find a problem..." value={filterQ} onChange={e => setFilterQ(e.target.value)} />
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-[#0d1523]/50">
                                            <tr className="text-slate-500 text-[10px] uppercase font-black tracking-widest">
                                                <th className="text-left px-5 py-3">Status</th>
                                                <th className="text-left px-5 py-3">Problem Title</th>
                                                <th className="text-left px-5 py-3">Category</th>
                                                <th className="text-right px-5 py-3">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredQ.slice(0, 10).map(q => {
                                                const solved = recentSubs.some(s => s.question?.title === q.title && s.status === 'Accepted');
                                                return (
                                                    <tr key={q.id} className="border-b border-[#1e2d45]/30 hover:bg-white/[0.02] transition-colors group">
                                                        <td className="px-5 py-3">
                                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${solved ? 'border-green-500/50 text-green-400 bg-green-500/10' : 'border-slate-700 text-slate-600'}`}>
                                                                {solved ? '✓' : ''}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 font-bold text-slate-200">{q.title}</td>
                                                        <td className="px-5 py-3">
                                                            <span className={`${diffColor(q.difficulty)} px-2 py-0.5 rounded-full text-[10px] font-bold uppercase`}>{q.difficulty}</span>
                                                        </td>
                                                        <td className="px-5 py-3 text-right">
                                                            <Link href={`/problems/${q.id}`} className="text-amber-500 hover:text-amber-400 font-bold text-xs uppercase tracking-wider">Solve →</Link>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Streak Calendar + Leaderboard */}
                        <div className="space-y-6">
                            {/* Streak Calendar Card */}
                            <div className="card p-5 border-amber-500/10 bg-gradient-to-b from-[#111827] to-[#0a0e1a]">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-white text-sm uppercase tracking-widest flex items-center gap-2">
                                        🗓️ March 2026
                                    </h3>
                                    <div className="flex gap-2">
                                        <button className="text-slate-600 hover:text-white transition-colors">◀</button>
                                        <button className="text-slate-600 hover:text-white transition-colors">▶</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                    {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map(day => (
                                        <span key={day} className="text-[10px] font-black text-slate-600">{day}</span>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1 text-center">
                                    {Array.from({ length: 31 }).map((_, i) => {
                                        const day = i + 1;
                                        const streak = day < 12; // Example streak
                                        const today = day === 12;
                                        return (
                                            <div key={i} className={`aspect-square flex items-center justify-center text-[10px] font-bold rounded-full transition-all cursor-default
                                                ${streak ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-slate-500 hover:bg-white/5'}
                                                ${today ? 'border-2 border-amber-500 text-amber-500 animate-pulse' : ''}`}>
                                                {day}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-6 pt-4 border-t border-[#1e2d45] flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Visit Streak</p>
                                        <p className="font-black text-white text-xl flex items-center gap-1.5">🔥 {user?.currentStreak || 0}d</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Longest Streak</p>
                                        <p className="font-black text-slate-400 text-xl">{user?.longestStreak || 0}d</p>
                                    </div>
                                </div>
                            </div>

                            {/* Mini Leaderboard */}
                            <div className="card p-5">
                                <h3 className="font-bold text-white text-sm mb-4 uppercase tracking-widest">Global Ranks</h3>
                                <div className="space-y-4">
                                    {topLeaders.slice(0, 5).map((entry, i) => (
                                        <div key={entry.id} className="flex items-center gap-3 group translate-x-0 hover:translate-x-1 transition-transform">
                                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-black text-xs
                                                ${i === 0 ? 'border-amber-500 text-amber-500' : 'border-slate-800 text-slate-600'}`}>
                                                {i + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-200 truncate">{entry.user?.name}</p>
                                                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter truncate">{entry.user?.college}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-xs font-black text-amber-500">{entry.totalXp} XP</p>
                                                <p className="text-[9px] text-orange-500 font-bold uppercase tracking-tighter italic">🔥 {entry.user.currentStreak}d</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Link href="/leaderboard" className="mt-6 block text-center text-[10px] font-black text-amber-500 uppercase tracking-widest hover:text-white transition-colors">
                                    Explore all ranks ⮕
                                </Link>
                            </div>
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
