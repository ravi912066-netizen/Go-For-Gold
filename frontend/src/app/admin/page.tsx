'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import API from '@/lib/api';
import { io, Socket } from 'socket.io-client';

const LiveRoom = dynamic(() => import('@/components/LiveRoom'), { ssr: false });
const VideoCallOverlay = dynamic(() => import('@/components/VideoCallOverlay'), { ssr: false });
const TeacherAnalytics = dynamic(() => import('@/components/TeacherAnalytics'), { ssr: false });

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState({ users: 0, questions: 0, submissions: 0, courses: 0 });
    const [questions, setQuestions] = useState<any[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]);
    const [view, setView] = useState<'overview' | 'questions' | 'assignments' | 'courses' | 'students' | 'materials' | 'newton_urls' | 'calendar' | 'analytics'>('overview');

    // Forms
    const [qForm, setQForm] = useState({ title: '', statement: '', difficulty: 'Medium', tags: '', timeLimit: 2, memoryLimit: 256, starterCode: '', isQotd: false, courseId: '' });
    const [qTestcases, setQTestcases] = useState('');
    const [cForm, setCForm] = useState({ title: '', description: '', icon: '📚' });
    const [aForm, setAForm] = useState({ title: '', courseId: '', description: '', deadline: '', difficulty: 'Medium', tags: '', externalUrl: '', isProctored: false, reward: '100 XP' });

    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [showChat, setShowChat] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [sheetInput, setSheetInput] = useState('');
    const [sheetPreview, setSheetPreview] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);
    const [externalContests, setExternalContests] = useState<any[]>([]);

    // Newton URL Log Form
    const [nrForm, setNrForm] = useState({ title: '', url: '' });

    // Video Call State
    const [activeCall, setActiveCall] = useState<{ targetUserId: number; userName: string; socketId?: string } | null>(null);
    const [callStatus, setCallStatus] = useState<'idle' | 'requesting' | 'accepted' | 'rejected'>('idle');
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000');
        setSocket(s);

        s.on('call_accepted', ({ by }) => {
            setActiveCall(prev => prev ? { ...prev, socketId: by } : null);
            setCallStatus('accepted');
        });

        s.on('call_rejected', () => {
            setMsg('Student busy or call rejected');
            setCallStatus('rejected');
            setTimeout(() => { setActiveCall(null); setCallStatus('idle'); }, 3000);
        });

        s.on('call_ended', () => {
            setActiveCall(null);
            setCallStatus('idle');
        });

        return () => { s.disconnect(); };
    }, []);

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
            const [statsRes, qRes, cRes, sRes, calendarRes, resRes] = await Promise.allSettled([
                API.get('/admin/stats'), API.get('/questions'), API.get('/courses'), API.get('/admin/students'), API.get('/contests/external'), API.get('/resources')
            ]);
            if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
            if (qRes.status === 'fulfilled') setQuestions(qRes.value.data);
            if (cRes.status === 'fulfilled') setCourses(cRes.value.data);
            if (sRes.status === 'fulfilled') setStudents(sRes.value.data);
            if (calendarRes.status === 'fulfilled') setExternalContests(calendarRes.value.data);
            if (resRes.status === 'fulfilled') setResources(resRes.value.data);
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
        try {
            await API.post('/assignments', { ...aForm, courseId: parseInt(aForm.courseId) });
            setMsg('✓ Assignment created!');
            setAForm({ title: '', courseId: '', description: '', deadline: '', difficulty: 'Medium', tags: '', externalUrl: '', isProctored: false, reward: '100 XP' });
            fetchAll();
        }
        catch { setMsg('Error creating assignment'); } finally { setSaving(false); }
    };

    const handleSheetPreview = async () => {
        if (!sheetInput) return;
        setImporting(true); setMsg('');
        try {
            const res = await API.post('/import/sheet', { sheetUrl: sheetInput });
            setSheetPreview(res.data.questions);
            setMsg(`✓ Found ${res.data.questions.length} questions`);
        } catch (e: any) { setMsg('Error: ' + (e.response?.data?.error || 'Failed to read sheet')); }
        finally { setImporting(false); }
    };

    const handleSheetSave = async () => {
        if (sheetPreview.length === 0) return;
        setSaving(true);
        try {
            await API.post('/import/sheet/save', { questions: sheetPreview, courseId: qForm.courseId });
            setMsg('✓ Questions imported as STAGED (unreleased)');
            setSheetPreview([]); setSheetInput('');
            fetchAll();
        } catch { setMsg('Error saving questions'); }
        finally { setSaving(false); }
    };

    const handleRelease = async (ids: number[]) => {
        try {
            await API.post('/import/release', { questionIds: ids });
            setMsg('✓ Questions released to students');
            fetchAll();
        } catch { setMsg('Error releasing questions'); }
    };

    const handleDeleteStudent = async (id: number) => {
        if (!confirm('Permanently remove this student? All their progress will be lost.')) return;
        try {
            await API.delete(`/admin/students/${id}`);
            setMsg('✓ Student removed');
            fetchAll();
        } catch { setMsg('Error removing student'); }
    };

    const handleAddResource = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await API.post('/resources', nrForm);
            setMsg('✓ URL logged successfully');
            setNrForm({ title: '', url: '' });
            fetchAll();
        } catch { setMsg('Error logging URL'); }
        finally { setSaving(false); }
    };

    const handleDeleteResource = async (id: number) => {
        try {
            await API.delete(`/resources/${id}`);
            setMsg('✓ Resource deleted');
            fetchAll();
        } catch { }
    };

    const initiateCall = (student: any) => {
        if (!socket) return;
        setMsg(`Calling ${student.name}...`);
        setActiveCall({ targetUserId: student.id, userName: student.name });
        setCallStatus('requesting');
        socket.emit('call_request', { targetUserId: student.id, callerName: user.name });
    };

    const NAV = [
        { key: 'overview', label: '📊 Overview' },
        { key: 'questions', label: '💡 Questions' },
        { key: 'assignments', label: '📝 Assignments' },
        { key: 'courses', label: '📚 Courses' },
        { key: 'students', label: '👥 Students' },
        { key: 'materials', label: '📁 Materials' },
        { key: 'newton_urls', label: '🔗 Newton URLs' },
        { key: 'analytics', label: '📈 Analytics' },
    ];

    return (
        <div className="flex min-h-screen bg-[#0a0e1a]">
            <Sidebar role="admin" />
            <main className="flex-1 overflow-y-auto">
                <div className="sticky top-0 z-10 bg-[#0a0e1a]/90 backdrop-blur border-b border-[#1e2d45] px-6 py-3 flex items-center justify-between">
                    <h1 className="text-lg font-bold text-white">Admin Panel</h1>
                    {msg && <span className={`text-sm ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</span>}
                </div>

                <div className="p-6">
                    <div className="flex gap-1 mb-6 flex-wrap">
                        {NAV.map(({ key, label }) => (
                            <button key={key} onClick={() => { setView(key as any); setMsg(''); }}
                                className={`text-sm py-2 px-3 rounded-lg font-medium transition-all ${view === key ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {view === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { label: 'Students', value: stats.users, icon: '👥' },
                                    { label: 'Questions', value: stats.questions, icon: '💡' },
                                    { label: 'Accepted', value: stats.submissions, icon: '✓' },
                                    { label: 'Courses', value: stats.courses, icon: '📚' },
                                ].map(({ label, value, icon }) => (
                                    <div key={label} className="card p-5">
                                        <div className="text-3xl mb-2">{icon}</div>
                                        <div className="text-3xl font-black text-white">{value}</div>
                                        <div className="text-sm text-slate-500 mt-1">{label}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="card p-5">
                                <h3 className="font-bold text-white mb-4">Quick Actions</h3>
                                <div className="flex gap-3 flex-wrap">
                                    <button onClick={() => setView('questions')} className="btn-outline text-sm py-2">+ New Question</button>
                                    <button onClick={() => setView('courses')} className="btn-outline text-sm py-2">+ New Course</button>
                                    <button onClick={() => setView('assignments')} className="btn-outline text-sm py-2">+ New Assignment</button>
                                     <button onClick={() => setView('students')} className="btn-outline text-sm py-2">👥 View Students</button>
                                     <button onClick={() => setView('newton_urls')} className="btn-outline text-sm py-2">🔗 URL Logger</button>
                                     <button onClick={() => setView('analytics')} className="btn-gold text-sm py-2">📈 View Analytics</button>
                                 </div>
                            </div>
                        </div>
                    )}

                    {view === 'questions' && (
                        <div className="max-w-4xl space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="card p-6">
                                    <h3 className="font-bold text-white mb-5">Create New Question</h3>
                                    <form onSubmit={handleCreateQuestion} className="space-y-4">
                                        <div><label className="text-xs text-slate-400 mb-1 block">Title *</label>
                                            <input className="input-field" required value={qForm.title} onChange={e => setQForm(f => ({ ...f, title: e.target.value }))} /></div>
                                        <div><label className="text-xs text-slate-400 mb-1 block">Course</label>
                                            <select className="input-field" value={qForm.courseId} onChange={e => setQForm(f => ({ ...f, courseId: e.target.value }))}>
                                                <option value="">No Course</option>
                                                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                            </select></div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="text-xs text-slate-400 mb-1 block">Difficulty</label>
                                                <select className="input-field" value={qForm.difficulty} onChange={e => setQForm(f => ({ ...f, difficulty: e.target.value }))}>
                                                    <option>Easy</option><option>Medium</option><option>Hard</option></select></div>
                                            <div><label className="text-xs text-slate-400 mb-1 block">Time (s)</label>
                                                <input type="number" className="input-field" value={qForm.timeLimit} onChange={e => setQForm(f => ({ ...f, timeLimit: +e.target.value }))} /></div>
                                        </div>
                                        <button type="submit" disabled={saving} className="btn-gold py-2.5 px-6 w-full">{saving ? 'Creating…' : '+ Create Question'}</button>
                                    </form>
                                </div>
                                <div className="card p-6 border-amber-500/20 bg-amber-500/[0.02]">
                                    <h3 className="font-bold text-white mb-2 flex items-center gap-2">📂 Bulk Import (Google Sheet)</h3>
                                    <div className="flex gap-2 mb-4">
                                        <input className="input-field" placeholder="Google Sheet URL..." value={sheetInput} onChange={e => setSheetInput(e.target.value)} />
                                        <button onClick={handleSheetPreview} disabled={importing} className="btn-outline px-4 shrink-0">{importing ? '...' : 'Fetch'}</button>
                                    </div>
                                    {sheetPreview.length > 0 && (
                                        <div className="space-y-3">
                                            <div className="max-h-40 overflow-y-auto text-xs border border-[#1e2d45] rounded-lg">
                                                {sheetPreview.map((p, i) => <div key={i} className="p-2 border-b border-[#1e2d45]/30 text-slate-300">{p.title} ({p.difficulty})</div>)}
                                            </div>
                                            <button onClick={handleSheetSave} disabled={saving} className="btn-gold py-2 w-full text-xs">Import {sheetPreview.length} Questions</button>
                                        </div>
                                    )}
                                </div>
                                {/* Drag & Drop Docs Area */}
                                <div className="card p-6 border-dashed border-2 border-[#1e2d45] flex flex-col items-center justify-center text-center hover:border-amber-500/50 transition-all cursor-pointer group"
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={async e => {
                                        e.preventDefault();
                                        const file = e.dataTransfer.files[0];
                                        if (file) {
                                            setMsg(`✓ File "${file.name}" detected! Uploading simulated...`);
                                            // Simulated upload logic: In real app, upload to S3/Cloudinary and log URL via API
                                            setTimeout(() => {
                                                API.post('/resources', { title: `Doc: ${file.name}`, url: `https://gfg-storage.com/${file.name}`, type: 'doc' }).then(() => fetchAll());
                                            }, 1000);
                                        }
                                    }}>
                                    <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">📄</span>
                                    <h4 className="text-xs font-black text-white uppercase tracking-widest">Drag & Drop Documents</h4>
                                    <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">PDF, DOCX, or Slides (Simulated)</p>
                                </div>
                            </div>
                            <div className="card overflow-hidden">
                                <div className="p-4 border-b border-[#1e2d45] flex items-center justify-between">
                                    <h3 className="font-bold text-white">All Questions ({questions.length})</h3>
                                    <span className="text-[10px] text-slate-500 uppercase">Released questions are visible to students</span>
                                </div>
                                <div className="divide-y divide-[#1e2d45]">
                                    {questions.map(q => (
                                        <div key={q.id} className="px-4 py-3 flex items-center justify-between hover:bg-white/2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium text-slate-200">{q.title}</p>
                                                    {!q.isReleased && <span className="text-[8px] bg-slate-700 text-slate-400 px-1 py-0.5 rounded uppercase font-black">Unreleased</span>}
                                                </div>
                                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{q.difficulty} • {q.course?.title || 'GENERAL'}</p>
                                            </div>
                                            <div className="flex gap-3 items-center">
                                                {!q.isReleased && <button onClick={() => handleRelease([q.id])} className="text-[10px] bg-green-500 text-black px-2 py-1 rounded font-black hover:bg-green-400 transition-all uppercase">Release</button>}
                                                <button onClick={() => handleDeleteQuestion(q.id)} className="text-xs text-red-500 hover:text-red-400 hover:underline">Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'assignments' && (
                        <div className="max-w-xl card p-6">
                            <h3 className="font-bold text-white mb-5">Create Assignment</h3>
                            <form onSubmit={handleCreateAssignment} className="space-y-4">
                                <div><label className="text-xs text-slate-400 mb-1 block">Title *</label>
                                    <input className="input-field" required value={aForm.title} onChange={e => setAForm(f => ({ ...f, title: e.target.value }))} /></div>
                                <div><label className="text-xs text-slate-400 mb-1 block">Course *</label>
                                    <select className="input-field" required value={aForm.courseId} onChange={e => setAForm(f => ({ ...f, courseId: e.target.value }))}>
                                        <option value="">Select Course</option>
                                        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                    </select></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-xs text-slate-400 mb-1 block">Deadline</label>
                                        <input type="datetime-local" className="input-field" value={aForm.deadline} onChange={e => setAForm(f => ({ ...f, deadline: e.target.value }))} /></div>
                                    <div><label className="text-xs text-slate-400 mb-1 block">Difficulty</label>
                                        <select className="input-field" value={aForm.difficulty} onChange={e => setAForm(f => ({ ...f, difficulty: e.target.value }))}>
                                            <option>Easy</option><option>Medium</option><option>Hard</option></select></div>
                                </div>
                                <button type="submit" disabled={saving} className="btn-gold py-2.5 px-6 w-full">{saving ? 'Creating…' : '+ Create Assignment'}</button>
                            </form>
                        </div>
                    )}

                    {view === 'courses' && (
                        <div className="max-w-xl space-y-6">
                            <div className="card p-6">
                                <h3 className="font-bold text-white mb-5">Create New Course</h3>
                                <form onSubmit={handleCreateCourse} className="space-y-4">
                                    <div><label className="text-xs text-slate-400 mb-1 block">Title *</label>
                                        <input className="input-field" required value={cForm.title} onChange={e => setCForm(f => ({ ...f, title: e.target.value }))} /></div>
                                    <div><label className="text-xs text-slate-400 mb-1 block">Icon (emoji)</label>
                                        <input className="input-field w-20" value={cForm.icon} onChange={e => setCForm(f => ({ ...f, icon: e.target.value }))} /></div>
                                    <button type="submit" disabled={saving} className="btn-gold py-2.5 px-6 w-full">{saving ? 'Creating…' : '+ Create Course'}</button>
                                </form>
                            </div>
                        </div>
                    )}

                    {view === 'students' && (
                        <div className="card overflow-hidden max-w-4xl">
                            <div className="p-4 border-b border-[#1e2d45] flex items-center justify-between">
                                <h3 className="font-bold text-white">All Students ({students.length})</h3>
                                <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Live CP Metrics Enabled</div>
                            </div>
                            <table className="w-full text-sm">
                                <thead><tr className="border-b border-[#1e2d45] text-slate-500 text-[10px] uppercase font-black tracking-widest">
                                    <th className="text-left px-4 py-3">Student</th>
                                    <th className="text-right px-4 py-3">GFG Stats</th>
                                    <th className="text-right px-4 py-3">External CP</th>
                                    <th className="text-right px-4 py-3">Actions</th>
                                </tr></thead>
                                <tbody>
                                    {students.map(s => (
                                        <tr key={s.id} className="border-b border-[#1e2d45]/50 hover:bg-white/2 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-200 text-sm">{s.name}</div>
                                                <div className="text-[10px] text-slate-500 uppercase tracking-tight">{s.college || 'No College'}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="text-amber-500 font-bold">{s.xp} XP</div>
                                                <div className="text-[10px] text-orange-400 uppercase font-black tracking-widest">🔥 {s.currentStreak} Streak</div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {s.externalProfile ? (
                                                    <div className="flex flex-col gap-0.5 items-end">
                                                        <div className="text-[10px] font-bold"><span className="text-blue-400">CF:</span> {(s.externalProfile as any).cfRating || 0}</div>
                                                        <div className="text-[10px] font-bold"><span className="text-amber-500">LC:</span> {(s.externalProfile as any).lcSolved || 0}</div>
                                                        <div className="text-[10px] font-bold"><span className="text-teal-400">AC:</span> {(s.externalProfile as any).acRating || 0}</div>
                                                    </div>
                                                ) : <span className="text-[10px] text-slate-600 italic">Unlinked</span>}
                                            </td>                                             <td className="px-4 py-3 text-right">
                                                 <div className="flex gap-2 justify-end">
                                                     <button onClick={() => initiateCall(s)}
                                                         className="text-[10px] font-black text-amber-500 hover:text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded">
                                                         {callStatus === 'requesting' && activeCall?.targetUserId === s.id ? 'Calling...' : 'Call'}
                                                     </button>
                                                     <button onClick={() => handleDeleteStudent(s.id)} className="text-[10px] font-black text-red-500 hover:text-red-400 hover:underline uppercase tracking-widest">Delete</button>
                                                 </div>
                                             </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* CP Calendar View */}
                    {view === 'calendar' && (
                        <div className="card overflow-hidden max-w-4xl">
                            <div className="p-4 border-b border-[#1e2d45] flex items-center justify-between">
                                <h3 className="font-bold text-white">Automated CP Calendar</h3>
                                <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-1 rounded">External Platforms Sync</span>
                            </div>
                            <div className="divide-y divide-[#1e2d45]">
                                {externalContests.map((c, i) => (
                                    <div key={i} className="p-4 flex items-center justify-between hover:bg-white/2 transition-all">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${c.site === 'CodeForces' ? 'bg-blue-500/20 text-blue-400' : c.site === 'LeetCode' ? 'bg-amber-500/20 text-amber-400' : 'bg-teal-500/20 text-teal-400'}`}>{c.site}</span>
                                                <h4 className="font-bold text-white text-sm">{c.name}</h4>
                                            </div>
                                            <p className="text-xs text-slate-500">Starts: {new Date(c.start_time).toLocaleString()}</p>
                                        </div>
                                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="btn-outline py-1 px-3 text-xs">Join ↗</a>
                                    </div>
                                ))}
                                {externalContests.length === 0 && <div className="p-8 text-center text-slate-600 italic">No upcoming contests found.</div>}
                            </div>
                        </div>
                    )}

                    {view === 'newton_urls' && (
                        <div className="space-y-6 max-w-4xl">
                            <div className="card p-6 border-amber-500/20 bg-amber-500/[0.02]">
                                <h3 className="font-bold text-white mb-4">🔗 Newton Playground URL Logger</h3>
                                <form onSubmit={handleAddResource} className="flex gap-3">
                                    <input className="input-field" placeholder="Description/Title..." value={nrForm.title} onChange={e => setNrForm(f => ({ ...f, title: e.target.value }))} required />
                                    <input className="input-field" placeholder="https://newtonschool.co/playground/..." value={nrForm.url} onChange={e => setNrForm(f => ({ ...f, url: e.target.value }))} required />
                                    <button type="submit" disabled={saving} className="btn-gold px-6 shrink-0">{saving ? '...' : 'Log URL'}</button>
                                </form>
                            </div>

                            <div className="card overflow-hidden">
                                <div className="p-4 border-b border-[#1e2d45] flex items-center justify-between">
                                    <h3 className="font-bold text-white">Logged Resources (Internal Sheet)</h3>
                                    <button onClick={fetchAll} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest">Refresh Sync</button>
                                </div>
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-[#1e2d45] text-slate-500 text-[10px] uppercase font-black tracking-widest">
                                        <th className="text-left px-4 py-3">Title</th>
                                        <th className="text-left px-4 py-3">URL</th>
                                        <th className="text-right px-4 py-3">Added</th>
                                        <th className="text-right px-4 py-3 text-red-400">Action</th>
                                    </tr></thead>
                                    <tbody>
                                        {resources.map(r => (
                                            <tr key={r.id} className="border-b border-white/5 hover:bg-white/2 transition-all">
                                                <td className="px-4 py-3 font-bold text-slate-200">{r.title}</td>
                                                <td className="px-4 py-3"><a href={r.url} target="_blank" rel="noreferrer" className="text-amber-500 hover:underline">{r.url.substring(0, 40)}...</a></td>
                                                <td className="px-4 py-3 text-xs text-slate-500 text-right">{new Date(r.createdAt).toLocaleDateString()}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={() => handleDeleteResource(r.id)} className="text-red-500 hover:text-red-400">✕</button>
                                                </td>
                                            </tr>
                                        ))}
                                        {resources.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-600 italic">No URLs logged yet.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {view === 'analytics' && (
                        <TeacherAnalytics students={students} />
                    )}
                </div>
            </main>

            <button onClick={() => setShowChat(prev => !prev)}
                className="fixed bottom-6 right-6 z-40 bg-amber-500 hover:bg-amber-400 text-black p-4 rounded-2xl shadow-2xl flex items-center gap-2 font-bold text-sm transition-all hover:scale-105 active:scale-95">
                {showChat ? <span>✕ Close</span> : <><span className="text-lg">💬</span> Live Chat</>}
            </button>

            {showChat && user && (
                <div className="fixed bottom-24 right-6 z-40 w-96 shadow-2xl animate-slide-up" style={{ height: '540px' }}>
                    <LiveRoom roomId="student-teacher-general" userId={user.id} userName={user.name} role="admin" onClose={() => setShowChat(false)} />
                </div>
            )}

            {activeCall && activeCall.socketId && user && (
                <VideoCallOverlay
                    socket={socket}
                    currentUserId={user.id}
                    currentUserName={user.name}
                    isInitiator={true}
                    targetSocketId={activeCall.socketId}
                    onClose={() => { setActiveCall(null); setCallStatus('idle'); }}
                />
            )}
        </div>
    );
}
