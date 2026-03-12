'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import API from '@/lib/api';

export default function AssignmentsPage() {
    const router = useRouter();
    const [assignments, setAssignments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('gfg_token');
        if (!token) { router.push('/login'); return; }
        fetchAssignments();
    }, []);

    const fetchAssignments = async () => {
        try {
            const { data } = await API.get('/assignments');
            setAssignments(data);
        } catch { }
        finally { setLoading(false); }
    };

    const getStatusColor = (deadline: string) => {
        const d = new Date(deadline);
        const now = new Date();
        if (d < now) return 'text-red-500 bg-red-500/10 border-red-500/20';
        return 'text-green-500 bg-green-500/10 border-green-500/20';
    };

    return (
        <div className="flex min-h-screen bg-[#0a0e1a]">
            <Sidebar role="student" />
            <main className="flex-1 overflow-y-auto">
                <div className="sticky top-0 z-10 bg-[#0a0e1a]/90 backdrop-blur border-b border-[#1e2d45] px-6 py-3 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-white uppercase tracking-tight">Assignments</h1>
                        <p className="text-xs text-slate-500">Practice tasks and graded exams from your instructors</p>
                    </div>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {assignments.map(a => (
                                <Link key={a.id} href={`/assignments/${a.id}`}
                                    className="card group hover:border-amber-500/30 transition-all duration-300 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-3">
                                        {a.isProctored && (
                                            <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg">Proctored</span>
                                        )}
                                    </div>

                                    <div className="p-6">
                                        <div className="w-12 h-12 rounded-2xl bg-[#1e2d45] flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                                            {a.externalUrl ? '📄' : '📝'}
                                        </div>
                                        <h3 className="text-lg font-black text-white mb-2 line-clamp-1">{a.title}</h3>
                                        <p className="text-xs text-slate-500 line-clamp-2 mb-6 h-8">
                                            {a.description || 'Complete the assigned questions and tasks before the deadline.'}
                                        </p>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                                                <span className="text-slate-600">Course</span>
                                                <span className="text-slate-400">{a.course?.title || 'General'}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                                                <span className="text-slate-600">Deadline</span>
                                                <span className={getStatusColor(a.deadline)}>
                                                    {new Date(a.deadline).toLocaleDateString()}
                                                </span>
                                            </div>
                                            {a.reward && (
                                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                                                    <span className="text-slate-600">Reward</span>
                                                    <span className="text-amber-500">{a.reward}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-[#1e2d45] flex items-center justify-between">
                                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest group-hover:translate-x-1 transition-transform inline-block">View Details →</span>
                                            <div className="flex -space-x-2">
                                                {/* Placeholder for small question icons or count */}
                                                <span className="w-6 h-6 rounded-full bg-[#0a0e1a] border border-[#1e2d45] flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                    {a.questions?.length || 0}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            {assignments.length === 0 && (
                                <div className="col-span-full text-center py-20 text-slate-500">
                                    <div className="text-6xl mb-4 opacity-20">📝</div>
                                    <p className="font-bold">No assignments posted yet</p>
                                    <p className="text-sm mt-1">Check back later for new tasks!</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
