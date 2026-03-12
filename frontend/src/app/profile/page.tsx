'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import API from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [ext, setExt] = useState({ codeforcesId: '', leetcodeId: '', atcoderId: '' });
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', college: '', bio: '', githubUrl: '' });
    const [syncing, setSyncing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        const u = localStorage.getItem('gfg_user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        setUser(parsed);
        fetchProfile(parsed.id);
    }, []);

    const fetchProfile = async (id: number) => {
        try {
            const { data } = await API.get(`/profile/${id}`);
            setProfile(data);
            setEditData({ name: data.name || '', college: data.college || '', bio: data.bio || '', githubUrl: data.githubUrl || '' });
            if (data.externalProfile) {
                setExt({ codeforcesId: data.externalProfile.codeforcesId || '', leetcodeId: data.externalProfile.leetcodeId || '', atcoderId: data.externalProfile.atcoderId || '' });
            }
        } catch { }
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            await API.put('/profile/me', editData);
            await fetchProfile(user.id);
            setEditing(false);
            setMsg('Profile updated!');
        } catch { setMsg('Failed to update profile'); }
        finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
    };

    const handleSaveExt = async () => {
        setSaving(true);
        try {
            await API.put('/profile/external', ext);
            setMsg('External profiles linked!');
        } catch { setMsg('Failed to link profiles'); }
        finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            await API.post('/profile/sync-stats');
            await fetchProfile(user.id);
            setMsg('Stats synced!');
        } catch { setMsg('Sync failed — check usernames'); }
        finally { setSyncing(false); setTimeout(() => setMsg(''), 3000); }
    };

    const ep = profile?.externalProfile;
    const lcData = ep ? [
        { name: 'Easy', value: ep.lcEasy || 0, color: '#4ade80' },
        { name: 'Medium', value: ep.lcMedium || 0, color: '#fbbf24' },
        { name: 'Hard', value: ep.lcHard || 0, color: '#f87171' },
    ] : [];
    const badges = profile?.badges || [];
    const avatar = (name: string) => `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name || 'U')}&backgroundColor=1e2d45&textColor=f59e0b`;

    return (
        <div className="flex min-h-screen bg-[#0a0e1a]">
            <Sidebar role={user?.role || 'student'} />
            <main className="flex-1 overflow-y-auto">
                <div className="sticky top-0 z-10 bg-[#0a0e1a]/90 backdrop-blur border-b border-[#1e2d45] px-6 py-3 flex items-center justify-between">
                    <div><h1 className="text-lg font-bold text-white">My Profile</h1></div>
                    {msg && <span className="text-sm text-green-400">{msg}</span>}
                </div>

                <div className="p-6 max-w-4xl space-y-6">
                    {/* Profile card */}
                    <div className="card p-6">
                        <div className="flex items-start gap-5 flex-wrap">
                            <img src={avatar(profile?.name || 'U')} className="w-20 h-20 rounded-2xl bg-[#1e2d45]" alt="" />
                            <div className="flex-1 min-w-0">
                                {editing ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div><label className="text-xs text-slate-400 mb-1 block">Name</label>
                                            <input className="input-field" value={editData.name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} /></div>
                                        <div><label className="text-xs text-slate-400 mb-1 block">College</label>
                                            <input className="input-field" value={editData.college} onChange={e => setEditData(d => ({ ...d, college: e.target.value }))} /></div>
                                        <div className="sm:col-span-2"><label className="text-xs text-slate-400 mb-1 block">Bio</label>
                                            <textarea className="input-field h-20 resize-none" value={editData.bio} onChange={e => setEditData(d => ({ ...d, bio: e.target.value }))} /></div>
                                        <div><label className="text-xs text-slate-400 mb-1 block">GitHub URL</label>
                                            <input className="input-field" placeholder="https://github.com/..." value={editData.githubUrl} onChange={e => setEditData(d => ({ ...d, githubUrl: e.target.value }))} /></div>
                                        <div className="flex gap-2 items-end">
                                            <button onClick={handleSaveProfile} disabled={saving} className="btn-gold py-2 px-4 text-sm">{saving ? 'Saving…' : 'Save'}</button>
                                            <button onClick={() => setEditing(false)} className="btn-outline py-2 px-4 text-sm">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-wrap items-center gap-3 mb-1">
                                            <h2 className="text-xl font-black text-white">{profile?.name}</h2>
                                            <button onClick={() => setEditing(true)} className="text-xs text-amber-400 hover:underline">Edit Info</button>
                                            <Link href={`/resume/${profile?.id}`} className="ml-auto bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg">
                                                📄 View Digital Resume
                                            </Link>
                                        </div>
                                        <p className="text-slate-400 text-sm mb-1">🏛️ {profile?.college || 'Not set'}</p>
                                        <p className="text-slate-500 text-sm mb-3">{profile?.bio || 'No bio yet'}</p>
                                        {editData.githubUrl && (
                                            <a href={editData.githubUrl} target="_blank" rel="noreferrer"
                                                className="text-xs text-amber-400 hover:underline flex items-center gap-1">🔗 GitHub</a>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* XP / Streak stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#1e2d45]">
                            {[
                                { label: 'XP Earned', value: profile?.xp || 0, icon: '⚡' },
                                { label: 'Current Streak', value: `${profile?.currentStreak || 0}d`, icon: '🔥' },
                                { label: 'Longest Streak', value: `${profile?.longestStreak || 0}d`, icon: '🏆' },
                                { label: 'Badges', value: badges.length, icon: '🎖️' },
                            ].map(({ label, value, icon }) => (
                                <div key={label} className="bg-[#0a0e1a] rounded-xl p-3 text-center">
                                    <div className="text-xl mb-1">{icon}</div>
                                    <div className="text-lg font-black text-white">{value}</div>
                                    <div className="text-xs text-slate-500">{label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Badges */}
                        {badges.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-[#1e2d45]">
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Badges Earned</p>
                                <div className="flex gap-2 flex-wrap">
                                    {badges.map((b: any) => (
                                        <div key={b.id} title={b.badge?.description}
                                            className="bg-[#1e2d45] border border-amber-500/20 rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
                                            <span>{b.badge?.icon}</span>
                                            <span className="text-slate-300">{b.badge?.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* External profiles */}
                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-white">Competitive Programming Profiles</h3>
                            <button onClick={handleSync} disabled={syncing} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5">
                                {syncing ? <><span className="w-3 h-3 border border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />Syncing…</> : '↻ Sync Stats'}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            {[
                                { key: 'codeforcesId', label: 'Codeforces', placeholder: 'handle', icon: '🏅' },
                                { key: 'leetcodeId', label: 'LeetCode', placeholder: 'username', icon: '🟡' },
                                { key: 'atcoderId', label: 'AtCoder', placeholder: 'username', icon: '🟣' },
                            ].map(({ key, label, placeholder, icon }) => (
                                <div key={key}>
                                    <label className="text-xs text-slate-400 mb-1 block">{icon} {label} Username</label>
                                    <input className="input-field text-sm" placeholder={placeholder}
                                        value={(ext as any)[key] || ''}
                                        onChange={e => setExt(x => ({ ...x, [key]: e.target.value }))} />
                                </div>
                            ))}
                        </div>
                        <button onClick={handleSaveExt} disabled={saving} className="btn-gold text-sm py-2 px-5">
                            {saving ? 'Saving…' : 'Link Profiles'}
                        </button>

                        {/* Stats Display */}
                        {ep && (
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Codeforces */}
                                {ep.codeforcesId && (
                                    <div className="bg-[#0a0e1a] rounded-xl p-4">
                                        <p className="text-xs text-slate-500 uppercase mb-3">Codeforces</p>
                                        <div className="flex gap-4">
                                            <div className="text-center"><p className="text-2xl font-black text-blue-400">{ep.cfRating || '-'}</p><p className="text-xs text-slate-500">Rating</p></div>
                                            <div className="text-center"><p className="text-lg font-bold text-slate-300 capitalize">{ep.cfRank || 'Unranked'}</p><p className="text-xs text-slate-500">Rank</p></div>
                                            <div className="text-center"><p className="text-2xl font-black text-amber-400">{ep.cfContests || '-'}</p><p className="text-xs text-slate-500">Contests</p></div>
                                        </div>
                                    </div>
                                )}

                                {/* LeetCode Pie */}
                                {ep.leetcodeId && ep.lcSolved > 0 && (
                                    <div className="bg-[#0a0e1a] rounded-xl p-4">
                                        <p className="text-xs text-slate-500 uppercase mb-1">LeetCode — {ep.lcSolved} Solved</p>
                                        <ResponsiveContainer width="100%" height={120}>
                                            <PieChart>
                                                <Pie data={lcData} dataKey="value" cx="50%" cy="50%" outerRadius={45} innerRadius={28}>
                                                    {lcData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                                </Pie>
                                                <Tooltip contentStyle={{ background: '#1a2235', border: 'none', fontSize: 12 }} />
                                                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                {/* AtCoder */}
                                {ep.atcoderId && (
                                    <div className="bg-[#0a0e1a] rounded-xl p-4">
                                        <p className="text-xs text-slate-500 uppercase mb-3">AtCoder</p>
                                        <div className="flex gap-4">
                                            <div><p className="text-2xl font-black text-purple-400">{ep.acRating || '-'}</p><p className="text-xs text-slate-500">Rating</p></div>
                                            <div><p className="text-2xl font-black text-amber-400">{ep.acContests || '-'}</p><p className="text-xs text-slate-500">Contests</p></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
