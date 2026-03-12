'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
    const router = useRouter();
    useEffect(() => {
        const token = localStorage.getItem('gfg_token');
        if (token) router.push('/dashboard');
        else router.push('/login');
    }, [router]);
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
                <p className="text-slate-400 text-sm">Loading GO FOR GOLD…</p>
            </div>
        </div>
    );
}
