'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const LiveRoom = dynamic(() => import('@/components/LiveRoom'), { ssr: false });

export default function LiveRoomPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [user, setUser] = useState<any>(null);

    const roomId = searchParams.get('room') || 'general';
    const teacherName = searchParams.get('teacher') || 'Teacher';

    useEffect(() => {
        const u = localStorage.getItem('gfg_user');
        if (!u) { router.push('/login'); return; }
        setUser(JSON.parse(u));
    }, []);

    if (!user) return (
        <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
            {/* Header */}
            <div className="bg-[#111827] border-b border-[#1e2d45] px-4 py-3 flex items-center gap-3">
                <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm transition-colors">← Back</button>
                <div className="w-px h-5 bg-[#1e2d45]" />
                <div>
                    <p className="text-white font-bold text-sm">{user.role === 'admin' ? '🎓 Teacher Room' : `📡 ${teacherName}'s Room`}</p>
                    <p className="text-slate-500 text-xs">Room: {roomId}</p>
                </div>
            </div>

            {/* Main content area */}
            <div className="flex flex-1 min-h-0">
                {/* Room */}
                <div className="flex-1 p-4">
                    <div style={{ height: 'calc(100vh - 120px)' }}>
                        <LiveRoom
                            roomId={roomId}
                            userId={user.id}
                            userName={user.name}
                            role={user.role}
                            onClose={() => router.back()}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
