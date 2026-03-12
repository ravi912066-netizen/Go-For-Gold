'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import API from '@/lib/api';

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [form, setForm] = useState({ name: '', email: '', password: '', college: '', role: 'student' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
            const { data } = await API.post(endpoint, form);
            localStorage.setItem('gfg_token', data.token);
            localStorage.setItem('gfg_user', JSON.stringify(data.user));
            router.push(data.user.role === 'admin' ? '/admin' : '/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
            {/* Background glow */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative z-10 animate-slide-up">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                            <span className="text-black font-black text-lg">G</span>
                        </div>
                        <span className="text-2xl font-black gradient-text">GO FOR GOLD</span>
                    </div>
                    <p className="text-slate-400 text-sm">Your competitive programming journey starts here</p>
                </div>

                {/* Card */}
                <div className="card p-8 shadow-2xl">
                    {/* Tab switcher */}
                    <div className="flex bg-[#0a0e1a] rounded-lg p-1 mb-6">
                        {(['login', 'register'] as const).map(m => (
                            <button key={m} onClick={() => setMode(m)}
                                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200 ${mode === m ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'}`}>
                                {m === 'login' ? 'Sign In' : 'Sign Up'}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'register' && (
                            <>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Full Name</label>
                                    <input className="input-field" placeholder="Your full name" value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">College</label>
                                    <input className="input-field" placeholder="Your college / institution" value={form.college}
                                        onChange={e => setForm(f => ({ ...f, college: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Role</label>
                                    <select className="input-field" value={form.role}
                                        onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                                        <option value="student">Student</option>
                                        <option value="admin">Admin / Teacher</option>
                                    </select>
                                </div>
                            </>
                        )}
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Email</label>
                            <input type="email" className="input-field" placeholder="you@example.com" value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Password</label>
                            <input type="password" className="input-field" placeholder="••••••••" value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-3 py-2 rounded-lg">
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={loading}
                            className="btn-gold w-full py-3 mt-2 flex items-center justify-center gap-2 disabled:opacity-50">
                            {loading ? (
                                <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />{mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
                            ) : (
                                mode === 'login' ? '→ Sign In' : '→ Create Account'
                            )}
                        </button>
                    </form>

                    {/* Demo credentials */}
                    <div className="mt-5 p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                        <p className="text-xs text-amber-400/80 font-medium mb-1">Demo credentials</p>
                        <p className="text-xs text-slate-400">Student: ravi@example.com / student123</p>
                        <p className="text-xs text-slate-400">Admin: admin@goforgold.dev / admin123</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
