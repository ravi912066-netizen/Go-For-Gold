'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import API from '@/lib/api';

export default function ResumeClient() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchUser();
    }, [id]);

    const fetchUser = async () => {
        try {
            const { data } = await API.get(`/profile/${id}`);
            setUser(data);
        } catch { 
            router.push('/'); 
        } finally { 
            setLoading(false); 
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
    );

    if (!user) return <div className="text-white text-center py-20">User not found</div>;

    const stats = user.externalProfile || {};
    const avatar = `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=1e2d45&textColor=f59e0b`;

    return (
        <div className="min-h-screen bg-[#0a0e1a] text-slate-300 py-12 px-4 selection:bg-amber-500/30">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-16 relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/10 blur-[100px] rounded-full -z-10" />
                    <img src={user.photoUrl || avatar} className="w-32 h-32 rounded-3xl mx-auto mb-6 border-4 border-[#1e2d45] shadow-2xl object-cover" alt="" />
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight">{user.name}</h1>
                    <p className="text-amber-500 font-bold tracking-widest uppercase text-sm mb-4">{user.college || 'Competitive Programmer'}</p>
                    <p className="max-w-xl mx-auto text-slate-400 text-lg leading-relaxed">{user.bio || 'Passionate about algorithms, data structures, and solving complex problems on various CP platforms.'}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="card p-6 border-amber-500/20 bg-gradient-to-br from-[#111827] to-[#0d1117] text-center">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Total XP</p>
                        <p className="text-4xl font-black text-amber-500">{user.xp}</p>
                    </div>
                    <div className="card p-6 border-blue-500/20 bg-gradient-to-br from-[#111827] to-[#0d1117] text-center">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Current Streak</p>
                        <p className="text-4xl font-black text-blue-400">🔥 {user.currentStreak}</p>
                    </div>
                    <div className="card p-6 border-green-500/20 bg-gradient-to-br from-[#111827] to-[#0d1117] text-center">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Global Rank</p>
                        <p className="text-4xl font-black text-green-400">#{user.leaderboard?.globalRank || 'N/A'}</p>
                    </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <span className="w-8 h-px bg-amber-500" /> External Achievements
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                    {stats.codeforcesId && (
                        <div className="card p-6 group hover:border-blue-500/40 transition-all">
                            <div className="flex items-center gap-3 mb-4">
                                <img src="https://simpleicons.org/icons/codeforces.svg" className="w-6 h-6 invert" alt="" />
                                <h4 className="font-bold text-white">Codeforces</h4>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                                    <span className="text-xs text-slate-500">Rating</span>
                                    <span className="text-sm font-black text-blue-400">{stats.cfRating || '0'}</span>
                                </div>
                                <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                                    <span className="text-xs text-slate-500">Rank</span>
                                    <span className="text-sm font-bold text-slate-300">{stats.cfRank || 'Unranked'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {stats.leetcodeId && (
                        <div className="card p-6 group hover:border-amber-500/40 transition-all">
                            <div className="flex items-center gap-3 mb-4">
                                <img src="https://simpleicons.org/icons/leetcode.svg" className="w-6 h-6 invert" alt="" />
                                <h4 className="font-bold text-white">LeetCode</h4>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                                    <span className="text-xs text-slate-500">Solved</span>
                                    <span className="text-sm font-black text-amber-500">{stats.lcSolved || '0'}</span>
                                </div>
                                <div className="flex gap-1.5 mt-2">
                                    <div className="flex-1 h-1.5 bg-green-500/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500" style={{ width: `${(stats.lcEasy / stats.lcSolved) * 100 || 0}%` }} />
                                    </div>
                                    <div className="flex-1 h-1.5 bg-amber-500/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500" style={{ width: `${(stats.lcMedium / stats.lcSolved) * 100 || 0}%` }} />
                                    </div>
                                    <div className="flex-1 h-1.5 bg-red-500/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-500" style={{ width: `${(stats.lcHard / stats.lcSolved) * 100 || 0}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {stats.atcoderId && (
                        <div className="card p-6 group hover:border-red-500/40 transition-all">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-6 h-6 bg-red-500 rounded flex items-center justify-center font-bold text-[10px] text-white">AC</div>
                                <h4 className="font-bold text-white">AtCoder</h4>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                                    <span className="text-xs text-slate-500">Rating</span>
                                    <span className="text-sm font-black text-red-500">{stats.acRating || '0'}</span>
                                </div>
                                <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                                    <span className="text-xs text-slate-500">Contests</span>
                                    <span className="text-sm font-bold text-slate-300">{stats.acContests || '0'}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t border-[#1e2d45] pt-12 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-slate-500 text-sm">© 2026 GO FOR GOLD Portolio • Verified Achievement</p>
                    <div className="flex items-center gap-4">
                        {user.githubUrl && (
                            <a href={user.githubUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors">GitHub</a>
                        )}
                        <button onClick={() => window.print()} className="bg-[#1e2d45] hover:bg-[#2d3b55] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                            Download PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
