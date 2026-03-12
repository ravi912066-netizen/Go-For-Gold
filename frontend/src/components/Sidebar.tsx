'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const NAV_STUDENT = [
    { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { href: '/problems', icon: '💡', label: 'Problems' },
    { href: '/courses', icon: '📚', label: 'Courses' },
    { href: '/leaderboard', icon: '🏆', label: 'Leaderboard' },
    { href: '/contests', icon: '⚔️', label: 'Contests' },
    { href: '/profile', icon: '👤', label: 'Profile' },
];

const NAV_ADMIN = [
    { href: '/admin', icon: '📊', label: 'Dashboard' },
    { href: '/admin/questions', icon: '💡', label: 'Questions' },
    { href: '/admin/assignments', icon: '📝', label: 'Assignments' },
    { href: '/admin/courses', icon: '📚', label: 'Courses' },
    { href: '/admin/contests', icon: '⚔️', label: 'Contests' },
    { href: '/admin/students', icon: '👥', label: 'Students' },
    { href: '/admin/materials', icon: '📁', label: 'Materials' },
];

interface SidebarProps { role?: string; collapsed?: boolean; }

export default function Sidebar({ role = 'student', collapsed = false }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const nav = role === 'admin' ? NAV_ADMIN : NAV_STUDENT;

    const handleLogout = () => {
        localStorage.removeItem('gfg_token');
        localStorage.removeItem('gfg_user');
        router.push('/login');
    };

    return (
        <aside className={`${collapsed ? 'w-16' : 'w-60'} bg-[#111827] border-r border-[#1e2d45] flex flex-col h-screen sticky top-0 transition-all duration-300 shrink-0`}>
            {/* Logo */}
            <div className="px-4 py-5 border-b border-[#1e2d45]">
                <Link href={role === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-black font-black text-sm">G</span>
                    </div>
                    {!collapsed && <span className="font-black text-white text-sm leading-tight gradient-text">GO FOR GOLD</span>}
                </Link>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                {nav.map(({ href, icon, label }) => {
                    const active = pathname === href || (href !== '/dashboard' && href !== '/admin' && pathname.startsWith(href));
                    return (
                        <Link key={href} href={href}
                            className={`sidebar-link ${active ? 'active' : ''}`}>
                            <span className="text-lg leading-none">{icon}</span>
                            {!collapsed && <span>{label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom */}
            <div className="px-2 py-3 border-t border-[#1e2d45]">
                <button onClick={handleLogout} className="sidebar-link w-full text-left">
                    <span className="text-lg">🚪</span>
                    {!collapsed && <span>Sign Out</span>}
                </button>
            </div>
        </aside>
    );
}
