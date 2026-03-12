'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import API from '@/lib/api';

export default function CoursesPage() {
    const router = useRouter();
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('gfg_token');
        if (!token) { router.push('/login'); return; }
        API.get('/courses').then(r => setCourses(r.data)).finally(() => setLoading(false));
    }, []);

    const courseColors = ['from-blue-600 to-blue-800', 'from-purple-600 to-purple-800', 'from-green-600 to-green-800', 'from-orange-600 to-orange-800'];

    return (
        <div className="flex min-h-screen bg-[#0a0e1a]">
            <Sidebar role="student" />
            <main className="flex-1 overflow-y-auto">
                <div className="sticky top-0 z-10 bg-[#0a0e1a]/90 backdrop-blur border-b border-[#1e2d45] px-6 py-3">
                    <h1 className="text-lg font-bold text-white">Courses</h1>
                    <p className="text-xs text-slate-500">Structured learning paths curated by your teachers</p>
                </div>
                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {courses.map((c, i) => (
                                <Link key={c.id} href={`/courses/${c.id}`}
                                    className="card hover:border-amber-500/30 hover:glow-gold transition-all duration-300 group overflow-hidden">
                                    <div className={`h-28 bg-gradient-to-br ${courseColors[i % courseColors.length]} flex items-center justify-center text-5xl group-hover:scale-105 transition-transform duration-300`}>
                                        {c.icon || '📚'}
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-bold text-white group-hover:text-amber-400 transition-colors mb-1">{c.title}</h3>
                                        <p className="text-xs text-slate-500 line-clamp-2">{c.description}</p>
                                        <div className="mt-3 pt-3 border-t border-[#1e2d45] flex items-center justify-between">
                                            <span className="text-xs text-amber-400 font-medium">View Course →</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            {courses.length === 0 && (
                                <div className="col-span-full text-center py-20 text-slate-500">
                                    <p className="text-4xl mb-3">📚</p>
                                    <p>No courses available yet</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
