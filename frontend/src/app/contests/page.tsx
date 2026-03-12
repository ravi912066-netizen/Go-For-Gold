'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import API from '@/lib/api';

export default function ContestsPage() {
    const router = useRouter();
    const [contests, setContests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('gfg_token');
        if (!token) { router.push('/login'); return; }
        API.get('/contests').then(r => setContests(r.data)).finally(() => setLoading(false));
    }, []);

    const now = new Date();
    const upcoming = contests.filter(c => new Date(c.startTime) > now);
    const active = contests.filter(c => c.isActive);
    const past = contests.filter(c => new Date(c.startTime) <= now && !c.isActive);

    return (
        <div className="flex min-h-screen bg-[#0a0e1a]">
            <Sidebar role="student" />
            <main className="flex-1 overflow-y-auto">
                <div className="sticky top-0 z-10 bg-[#0a0e1a]/90 backdrop-blur border-b border-[#1e2d45] px-6 py-3">
                    <h1 className="text-lg font-bold text-white">Contests</h1>
                    <p className="text-xs text-slate-500">Compete in timed coding challenges</p>
                </div>
                <div className="p-6 max-w-3xl space-y-6">
                    {active.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wide mb-3">🔴 Live Now</h3>
                            {active.map(c => (
                                <div key={c.id} className="card p-5 border-red-500/30 bg-red-500/5">
                                    <div className="flex items-center justify-between">
                                        <div><h4 className="font-bold text-white">{c.title}</h4>
                                            <p className="text-xs text-slate-400 mt-1">Duration: {c.duration} min</p></div>
                                        <button className="btn-gold py-2 px-4 text-sm">Enter Contest →</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {upcoming.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide mb-3">⏳ Upcoming</h3>
                            {upcoming.map(c => (
                                <div key={c.id} className="card p-5 mb-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-white">{c.title}</h4>
                                            <p className="text-xs text-slate-400 mt-1">Starts: {new Date(c.startTime).toLocaleString()} · {c.duration} min</p>
                                        </div>
                                        <button className="btn-outline text-sm py-2">Register</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {past.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">📜 Past Contests</h3>
                            {past.map(c => (
                                <div key={c.id} className="card p-4 mb-3 opacity-60">
                                    <h4 className="font-medium text-slate-300">{c.title}</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">{new Date(c.startTime).toLocaleDateString()} · {c.duration} min</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && contests.length === 0 && (
                        <div className="text-center py-20">
                            <p className="text-4xl mb-3">⚔️</p>
                            <p className="text-slate-500">No contests scheduled yet</p>
                            <p className="text-xs text-slate-600 mt-1">Check back soon for upcoming competitions</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
