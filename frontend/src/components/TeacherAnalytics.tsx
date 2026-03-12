'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ScatterChart, Scatter, ZAxis } from 'recharts';

interface TeacherAnalyticsProps {
    students: any[];
}

export default function TeacherAnalytics({ students }: TeacherAnalyticsProps) {
    const data = students.map(s => ({
        name: s.name,
        xp: s.xp || 0,
        streak: s.currentStreak || 0,
        cfRating: (s.externalProfile as any)?.cfRating || 0,
        lcSolved: (s.externalProfile as any)?.lcSolved || 0,
    })).sort((a, b) => b.xp - a.xp);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-5 border-l-4 border-amber-500">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Top Performer</p>
                    <h4 className="text-xl font-black text-white">{data[0]?.name || 'N/A'}</h4>
                    <p className="text-amber-500 font-bold text-xs">{data[0]?.xp || 0} XP earned</p>
                </div>
                <div className="card p-5 border-l-4 border-blue-500">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Average Streak</p>
                    <h4 className="text-xl font-black text-white">
                        {(data.reduce((acc, curr) => acc + curr.streak, 0) / (data.length || 1)).toFixed(1)} Days
                    </h4>
                    <p className="text-blue-400 font-bold text-xs">Platform Activity</p>
                </div>
                <div className="card p-5 border-l-4 border-teal-500">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">External Sync</p>
                    <h4 className="text-xl font-black text-white">
                        {students.filter(s => s.externalProfile).length} / {students.length}
                    </h4>
                    <p className="text-teal-400 font-bold text-xs">Profiles Linked</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Platform XP Chart */}
                <div className="card p-6 min-h-[400px]">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-amber-500 rounded-full"></span> Platform XP Distribution
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.slice(0, 10)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #1e2d45', borderRadius: '8px' }}
                                    itemStyle={{ color: '#f59e0b', fontSize: '12px' }}
                                />
                                <Bar dataKey="xp" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* CP vs Platform Correlation */}
                <div className="card p-6 min-h-[400px]">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span> CP Rating vs Platform XP
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid stroke="#1e2d45" strokeDasharray="3 3" />
                                <XAxis type="number" dataKey="xp" name="Platform XP" stroke="#64748b" fontSize={10} unit=" XP" />
                                <YAxis type="number" dataKey="cfRating" name="Codeforces" stroke="#64748b" fontSize={10} unit=" R" />
                                <ZAxis type="number" dataKey="streak" range={[50, 400]} name="Streak" />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} 
                                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #1e2d45', borderRadius: '8px' }}
                                />
                                <Scatter name="Students" data={data} fill="#3b82f6" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Detailed Analytics Table Snippet */}
            <div className="card overflow-hidden">
                <div className="p-4 border-b border-[#1e2d45] flex items-center justify-between">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Efficiency Metrics</h3>
                </div>
                <table className="w-full text-[11px]">
                    <thead>
                        <tr className="bg-white/5 text-slate-500 uppercase font-black tracking-widest">
                            <th className="px-4 py-3 text-left">Student</th>
                            <th className="px-4 py-3 text-right">LC Solved</th>
                            <th className="px-4 py-3 text-right">CF Rating</th>
                            <th className="px-4 py-3 text-right">XP/Day Est.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.slice(0, 5).map((d, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-300">{d.name}</td>
                                <td className="px-4 py-3 text-right text-amber-500">{d.lcSolved}</td>
                                <td className="px-4 py-3 text-right text-blue-400">{d.cfRating}</td>
                                <td className="px-4 py-3 text-right text-slate-500">{(d.xp / 7).toFixed(0)} XP</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
