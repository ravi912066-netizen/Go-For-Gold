'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import API from '@/lib/api';

const LiveRoom = dynamic(() => import('@/components/LiveRoom'), { ssr: false });

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState({ users: 0, questions: 0, submissions: 0, courses: 0 });
    const [questions, setQuestions] = useState<any[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [view, setView] = useState<'overview' | 'questions' | 'assignments' | 'courses' | 'students' | 'materials'>('overview');
    // Create question form
    const [qForm, setQForm] = useState({ title: '', statement: '', difficulty: 'Medium', tags: '', timeLimit: 2, memoryLimit: 256, starterCode: '', isQotd: false, courseId: '' });
    const [qTestcases, setQTestcases] = useState('');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    // Create course form
    const [cForm, setCForm] = useState({ title: '', description: '', icon: '📚' });
    // Assignment form
    const [aForm, setAForm] = useState({ title: '', courseId: '', description: '', deadline: '', difficulty: 'Medium', tags: '' });
    const [showChat, setShowChat] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const u = localStorage.getItem('gfg_user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        setUser(parsed);
        if (parsed.role !== 'admin') { router.push('/dashboard'); return; }
        fetchAll();
    }, []);

    const fetchAll = async () => {
        try {
            const [statsRes, qRes, cRes, sRes] = await Promise.allSettled([
                API.get('/admin/stats'), API.get('/questions'), API.get('/courses'), API.get('/admin/students')
            ]);
            if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
            if (qRes.status === 'fulfilled') setQuestions(qRes.value.data);
            if (cRes.status === 'fulfilled') setCourses(cRes.value.data);
            if (sRes.status === 'fulfilled') setStudents(sRes.value.data);
        } catch { }
    };

    const handleCreateQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true); setMsg('');
        try {
            let testcases = [];
            try { testcases = JSON.parse(qTestcases); } catch { testcases = []; }
            await API.post('/questions', { ...qForm, tags: qForm.tags.split(',').map(t => t.trim()), testcases, courseId: qForm.courseId || null });
            setMsg('✓ Question created!');
            setQForm({ title: '', statement: '', difficulty: 'Medium', tags: '', timeLimit: 2, memoryLimit: 256, starterCode: '', isQotd: false, courseId: '' });
            setQTestcases('');
            fetchAll();
        } catch (e: any) { setMsg('Error: ' + (e.response?.data?.error || 'Failed')); }
        finally { setSaving(false); }
    };

    const handleDeleteQuestion = async (id: number) => {
        if (!confirm('Delete this question?')) return;
        try { await API.delete(`/questions/${id}`); fetchAll(); } catch { }
    };

    const handleCreateCourse = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try { await API.post('/courses', cForm); setMsg('✓ Course created!'); setCForm({ title: '', description: '', icon: '📚' }); fetchAll(); }
        catch { setMsg('Error creating course'); } finally { setSaving(false); }
    };

    const handleCreateAssignment = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try { await API.post('/assignments', { ...aForm, courseId: parseInt(aForm.courseId) }); setMsg('✓ Assignment created!'); setAForm({ title: '', courseId: '', description: '', deadline: '', difficulty: 'Medium', tags: '' }); }
        catch { setMsg('Error creating assignment'); } finally { setSaving(false); }
    };

    const NAV = [
        { key: 'overview', label: '📊 Overview' },
        { key: 'questions', label: '💡 Questions' },
        { key: 'assignments', label: '📝 Assignments' },
        { key: 'courses', label: '📚 Courses' },
        { key: 'students', label: '👥 Students' },
        { key: 'materials', label: '📁 Materials' },
    ];

    return (
        <div className="flex min-h-screen bg-[#0a0e1a]">
            <Sidebar role="admin" />
            <main className="flex-1 overflow-y-auto">
                {/* Top bar */}
                <div className="sticky top-0 z-10 bg-[#0a0e1a]/90 backdrop-blur border-b border-[#1e2d45] px-6 py-3 flex items-center justify-between">
                    <h1 className="text-lg font-bold text-white">Admin Panel</h1>
                    {msg && <span className={`text-sm ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</span>}
                </div>

                <div className="p-6">
                    {/* Sub-nav */}
                    <div className="flex gap-1 mb-6 flex-wrap">
                        {NAV.map(({ key, label }) => (
                            <button key={key} onClick={() => { setView(key as any); setMsg(''); }}
                                className={`text-sm py-2 px-3 rounded-lg font-medium transition-all ${view === key ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Overview cards */}
                    {view === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { label: 'Students', value: stats.users, icon: '👥', color: 'blue' },
                                    { label: 'Questions', value: stats.questions, icon: '💡', color: 'amber' },
                                    { label: 'Accepted', value: stats.submissions, icon: '✓', color: 'green' },
                                    { label: 'Courses', value: stats.courses, icon: '📚', color: 'purple' },
                                ].map(({ label, value, icon, color }) => (
                                    <div key={label} className="card p-5">
                                        <div className="text-3xl mb-2">{icon}</div>
                                        <div className="text-3xl font-black text-white">{value}</div>
                                        <div className="text-sm text-slate-500 mt-1">{label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Quick actions */}
                            <div className="card p-5">
                                <h3 className="font-bold text-white mb-4">Quick Actions</h3>
                                <div className="flex gap-3 flex-wrap">
                                    {[
                                        { label: '+ New Question', action: () => setView('questions') },
                                        { label: '+ New Course', action: () => setView('courses') },
                                        { label: '+ New Assignment', action: () => setView('assignments') },
                                        { label: '👥 View Students', action: () => setView('students') },
                                    ].map(({ label, action }) => (
                                        <button key={label} onClick={action} className="btn-outline text-sm py-2">{label}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Recent questions */}
                            <div className="card overflow-hidden">
                                <div className="p-4 border-b border-[#1e2d45]">
                                    <h3 className="font-bold text-white">Recent Questions</h3>
                                </div>
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-[#1e2d45] text-slate-500 text-xs uppercase">
                                        <th className="text-left px-4 py-2">Title</th>
                                        <th className="text-left px-4 py-2">Difficulty</th>
                                        <th className="text-left px-4 py-2">QOTD</th>
                                        <th className="text-left px-4 py-2">Course</th>
                                        <th className="px-4 py-2"></th>
                                    </tr></thead>
                                    <tbody>
                                        {questions.slice(0, 8).map(q => (
                                            <tr key={q.id} className="border-b border-[#1e2d45]/50 hover:bg-white/2">
                                                <td className="px-4 py-2.5 font-medium text-slate-200">{q.title}</td>
                                                <td className="px-4 py-2.5"><span className={q.difficulty === 'Easy' ? 'badge-easy' : q.difficulty === 'Medium' ? 'badge-medium' : 'badge-hard'}>{q.difficulty}</span></td>
                                                <td className="px-4 py-2.5">{q.isQotd ? '🟢 Yes' : <span className="text-slate-600">No</span>}</td>
                                                <td className="px-4 py-2.5 text-slate-500 text-xs">{q.course?.title || '-'}</td>
                                                <td className="px-4 py-2.5"><button onClick={() => handleDeleteQuestion(q.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Create Question */}
                    {view === 'questions' && (
                        <div className="max-w-2xl space-y-6">
                            <div className="card p-6">
                                <h3 className="font-bold text-white mb-5">Create New Question</h3>
                                <form onSubmit={handleCreateQuestion} className="space-y-4">
                                    <div><label className="text-xs text-slate-400 mb-1 block">Title *</label>
                                        <input className="input-field" required value={qForm.title} onChange={e => setQForm(f => ({ ...f, title: e.target.value }))} /></div>
                                    <div><label className="text-xs text-slate-400 mb-1 block">Problem Statement (Markdown) *</label>
                                        <textarea className="input-field h-40 resize-none font-mono text-sm" required value={qForm.statement} onChange={e => setQForm(f => ({ ...f, statement: e.target.value }))} placeholder="You are given..." /></div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-xs text-slate-400 mb-1 block">Difficulty</label>
                                            <select className="input-field" value={qForm.difficulty} onChange={e => setQForm(f => ({ ...f, difficulty: e.target.value }))}>
                                                <option>Easy</option><option>Medium</option><option>Hard</option></select></div>
                                        <div><label className="text-xs text-slate-400 mb-1 block">Course</label>
                                            <select className="input-field" value={qForm.courseId} onChange={e => setQForm(f => ({ ...f, courseId: e.target.value }))}>
                                                <option value="">No Course</option>
                                                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                            </select></div>
                                    </div>
                                    <div><label className="text-xs text-slate-400 mb-1 block">Tags (comma-separated)</label>
                                        <input className="input-field" placeholder="array, dp, greedy" value={qForm.tags} onChange={e => setQForm(f => ({ ...f, tags: e.target.value }))} /></div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-xs text-slate-400 mb-1 block">Time Limit (s)</label>
                                            <input type="number" className="input-field" value={qForm.timeLimit} onChange={e => setQForm(f => ({ ...f, timeLimit: +e.target.value }))} /></div>
                                        <div><label className="text-xs text-slate-400 mb-1 block">Memory Limit (MB)</label>
                                            <input type="number" className="input-field" value={qForm.memoryLimit} onChange={e => setQForm(f => ({ ...f, memoryLimit: +e.target.value }))} /></div>
                                    </div>
                                    <div><label className="text-xs text-slate-400 mb-1 block">Starter Code</label>
                                        <textarea className="input-field h-24 font-mono text-sm resize-none" value={qForm.starterCode} onChange={e => setQForm(f => ({ ...f, starterCode: e.target.value }))} placeholder="# Starter code for student" /></div>
                                    <div><label className="text-xs text-slate-400 mb-1 block">Test Cases (JSON: [&#123;"input":"...","output":"..."&#125;])</label>
                                        <textarea className="input-field h-24 font-mono text-sm resize-none" value={qTestcases} onChange={e => setQTestcases(e.target.value)} placeholder='[{"input":"5\n1 2 3 4 5","output":"15"}]' /></div>
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" id="qotd" checked={qForm.isQotd} onChange={e => setQForm(f => ({ ...f, isQotd: e.target.checked }))} className="accent-amber-500" />
                                        <label htmlFor="qotd" className="text-sm text-slate-300">Mark as Question of the Day (today)</label>
                                    </div>
                                    <button type="submit" disabled={saving} className="btn-gold py-2.5 px-6">
                                        {saving ? 'Creating…' : '+ Create Question'}
                                    </button>
                                </form>
                            </div>

                            {/* Existing questions */}
                            <div className="card overflow-hidden">
                                <div className="p-4 border-b border-[#1e2d45]"><h3 className="font-bold text-white">All Questions ({questions.length})</h3></div>
                                <div className="divide-y divide-[#1e2d45]">
                                    {questions.map(q => (
                                        <div key={q.id} className="px-4 py-3 flex items-center justify-between hover:bg-white/2">
                                            <div>
                                                <p className="text-sm font-medium text-slate-200">{q.title}</p>
                                                <p className="text-xs text-slate-500">{q.difficulty} · {q.course?.title || 'No course'}</p>
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                {q.isQotd && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">QOTD</span>}
                                                <Link href={`/problems/${q.id}`} className="text-xs text-amber-400 hover:underline">View</Link>
                                                <button onClick={() => handleDeleteQuestion(q.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Create Assignment */}
                    {view === 'assignments' && (
                        <div className="max-w-xl">
                            <div className="card p-6">
                                <h3 className="font-bold text-white mb-5">Create Assignment</h3>
                                <form onSubmit={handleCreateAssignment} className="space-y-4">
                                    <div><label className="text-xs text-slate-400 mb-1 block">Title *</label>
                                        <input className="input-field" required value={aForm.title} onChange={e => setAForm(f => ({ ...f, title: e.target.value }))} /></div>
                                    <div><label className="text-xs text-slate-400 mb-1 block">Course *</label>
                                        <select className="input-field" required value={aForm.courseId} onChange={e => setAForm(f => ({ ...f, courseId: e.target.value }))}>
                                            <option value="">Select Course</option>
                                            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                        </select></div>
                                    <div><label className="text-xs text-slate-400 mb-1 block">Description</label>
                                        <textarea className="input-field h-24 resize-none" value={aForm.description} onChange={e => setAForm(f => ({ ...f, description: e.target.value }))} /></div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-xs text-slate-400 mb-1 block">Deadline</label>
                                            <input type="datetime-local" className="input-field" value={aForm.deadline} onChange={e => setAForm(f => ({ ...f, deadline: e.target.value }))} /></div>
                                        <div><label className="text-xs text-slate-400 mb-1 block">Difficulty</label>
                                            <select className="input-field" value={aForm.difficulty} onChange={e => setAForm(f => ({ ...f, difficulty: e.target.value }))}>
                                                <option>Easy</option><option>Medium</option><option>Hard</option></select></div>
                                    </div>
                                    <div><label className="text-xs text-slate-400 mb-1 block">Tags</label>
                                        <input className="input-field" placeholder="debug, arrays" value={aForm.tags} onChange={e => setAForm(f => ({ ...f, tags: e.target.value }))} /></div>

                                    {/* Upload options */}
                                    <div className="border border-dashed border-[#1e2d45] rounded-xl p-6 text-center hover:border-amber-500/30 transition-colors cursor-pointer">
                                        <p className="text-3xl mb-2">📎</p>
                                        <p className="text-sm text-slate-400">Drag & drop assignment files here</p>
                                        <p className="text-xs text-slate-600 mt-1">PDF, DOCX, ZIP, TXT supported</p>
                                        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.zip,.txt" />
                                        <button type="button" className="btn-outline text-xs mt-3 py-1.5 px-3">Or Browse Files</button>
                                    </div>

                                    <button type="submit" disabled={saving} className="btn-gold py-2.5 px-6">
                                        {saving ? 'Creating…' : '+ Create Assignment'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Create Course */}
                    {view === 'courses' && (
                        <div className="max-w-xl space-y-6">
                            <div className="card p-6">
                                <h3 className="font-bold text-white mb-5">Create New Course</h3>
                                <form onSubmit={handleCreateCourse} className="space-y-4">
                                    <div><label className="text-xs text-slate-400 mb-1 block">Course Title *</label>
                                        <input className="input-field" required value={cForm.title} onChange={e => setCForm(f => ({ ...f, title: e.target.value }))} /></div>
                                    <div><label className="text-xs text-slate-400 mb-1 block">Description</label>
                                        <textarea className="input-field h-20 resize-none" value={cForm.description} onChange={e => setCForm(f => ({ ...f, description: e.target.value }))} /></div>
                                    <div><label className="text-xs text-slate-400 mb-1 block">Icon (emoji)</label>
                                        <input className="input-field w-20" value={cForm.icon} onChange={e => setCForm(f => ({ ...f, icon: e.target.value }))} /></div>
                                    <button type="submit" disabled={saving} className="btn-gold py-2.5 px-6">{saving ? 'Creating…' : '+ Create Course'}</button>
                                </form>
                            </div>
                            {/* Existing courses */}
                            <div className="card p-4">
                                <h3 className="font-bold text-white mb-3">All Courses</h3>
                                <div className="space-y-2">
                                    {courses.map(c => (
                                        <div key={c.id} className="flex items-center gap-3 py-2 border-b border-[#1e2d45]/50">
                                            <span className="text-2xl">{c.icon}</span>
                                            <div><p className="text-sm font-medium text-slate-200">{c.title}</p>
                                                <p className="text-xs text-slate-500">{c.description}</p></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Students */}
                    {view === 'students' && (
                        <div className="card overflow-hidden max-w-4xl">
                            <div className="p-4 border-b border-[#1e2d45]"><h3 className="font-bold text-white">All Students ({students.length})</h3></div>
                            <table className="w-full text-sm">
                                <thead><tr className="border-b border-[#1e2d45] text-slate-500 text-xs uppercase">
                                    <th className="text-left px-4 py-2">Name</th>
                                    <th className="text-left px-4 py-2 hidden md:table-cell">College</th>
                                    <th className="text-right px-4 py-2">XP</th>
                                    <th className="text-right px-4 py-2">Streak</th>
                                    <th className="text-left px-4 py-2 hidden lg:table-cell">Joined</th>
                                </tr></thead>
                                <tbody>
                                    {students.map(s => (
                                        <tr key={s.id} className="border-b border-[#1e2d45]/50 hover:bg-white/2">
                                            <td className="px-4 py-2.5 font-medium text-slate-200">{s.name}</td>
                                            <td className="px-4 py-2.5 text-slate-500 text-xs hidden md:table-cell">{s.college || '-'}</td>
                                            <td className="px-4 py-2.5 text-right text-amber-400 font-bold">{s.xp}</td>
                                            <td className="px-4 py-2.5 text-right text-orange-400">🔥{s.currentStreak}</td>
                                            <td className="px-4 py-2.5 text-slate-600 text-xs hidden lg:table-cell">{new Date(s.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Materials (stub) */}
                    {view === 'materials' && (
                        <div className="max-w-xl">
                            <div className="card p-6">
                                <h3 className="font-bold text-white mb-5">Upload Study Materials</h3>
                                <div className="space-y-4">
                                    <div><label className="text-xs text-slate-400 mb-1 block">Material Title</label>
                                        <input className="input-field" placeholder="Lecture Slides - Week 3" /></div>
                                    <div><label className="text-xs text-slate-400 mb-1 block">Course</label>
                                        <select className="input-field"><option value="">Select Course</option>{courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
                                    <div><label className="text-xs text-slate-400 mb-1 block">Google Drive / Link URL</label>
                                        <input className="input-field" placeholder="https://drive.google.com/..." /></div>
                                    <div className="border border-dashed border-[#1e2d45] rounded-xl p-8 text-center hover:border-amber-500/30 transition-colors cursor-pointer">
                                        <p className="text-4xl mb-2">📁</p>
                                        <p className="text-sm text-slate-400">Drag & drop files here</p>
                                        <p className="text-xs text-slate-600 mt-1">PDF, PPTX, DOCX, books supported</p>
                                        <button type="button" className="btn-outline text-xs mt-3 py-1.5 px-3">Browse Files</button>
                                    </div>
                                    <button className="btn-gold py-2.5 px-6">Upload Material</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* ── Floating Live Chat Button (Admin) ────────────────── */}
            <button
                onClick={() => setShowChat(prev => !prev)}
                className="fixed bottom-6 right-6 z-40 bg-amber-500 hover:bg-amber-400 text-black p-4 rounded-2xl shadow-2xl flex items-center gap-2 font-bold text-sm transition-all hover:scale-105 active:scale-95"
            >
                {showChat ? (
                    <><span className="text-lg">✕</span> Close</>
                ) : (
                    <><span className="text-lg">💬</span> Student Chat <span className="bg-red-500/80 text-white text-xs px-1.5 py-0.5 rounded-full">Live</span></>
                )}
            </button>

            {/* ── Admin Live Room Drawer ─────────────────────────────── */}
            {showChat && user && (
                <div className="fixed bottom-20 right-6 z-40 w-96 shadow-2xl animate-slide-up" style={{ height: '540px' }}>
                    <LiveRoom
                        roomId="student-teacher-general"
                        userId={user.id}
                        userName={user.name}
                        role="admin"
                        onClose={() => setShowChat(false)}
                    />
                </div>
            )}
        </div>
    );
}
