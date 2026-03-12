'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface ProctorShieldProps {
    examId: string;           // contest/assignment ID
    userId: number;
    userName: string;
    role: 'student' | 'admin';
    children: React.ReactNode; // the actual exam content
}

export default function ProctorShield({
    examId, userId, userName, role, children
}: ProctorShieldProps) {
    const [status, setStatus] = useState<'gate' | 'starting' | 'active' | 'warning'>('gate');
    const [warnings, setWarnings] = useState(0);
    const [warningMsg, setWarningMsg] = useState('');
    const [cameraAllowed, setCameraAllowed] = useState(false);
    const [fullscreenActive, setFullscreenActive] = useState(false);
    const [alerts, setAlerts] = useState<string[]>([]);
    const cameraVideoRef = useRef<HTMLVideoElement>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const examRoomId = `exam-${examId}`;

    // ── Admin just sees children + alert panel ─────────────────────────────────
    if (role === 'admin') {
        return (
            <div className="flex flex-col h-full">
                {alerts.length > 0 && (
                    <div className="bg-red-900/30 border-b border-red-500/30 px-4 py-2 max-h-24 overflow-y-auto">
                        <p className="text-xs text-red-400 font-bold mb-1">🚨 Proctoring Alerts ({alerts.length})</p>
                        {alerts.slice(0, 5).map((a, i) => <p key={i} className="text-xs text-red-300">{a}</p>)}
                    </div>
                )}
                {children}
            </div>
        );
    }

    // ── GATE: show camera/rules confirmation before exam starts ────────────────
    if (status === 'gate') {
        return (
            <div className="fixed inset-0 bg-[#0a0e1a] z-50 flex items-center justify-center p-4">
                <div className="max-w-lg w-full">
                    <div className="card p-8 text-center space-y-6">
                        <div>
                            <div className="text-5xl mb-3">🔒</div>
                            <h2 className="text-2xl font-black text-white mb-2">Exam Mode</h2>
                            <p className="text-slate-400 text-sm">Before entering the exam, please read the rules carefully.</p>
                        </div>

                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-left space-y-2">
                            <p className="text-red-400 font-bold text-sm">📋 Exam Rules</p>
                            <ul className="space-y-1.5 text-sm text-slate-300">
                                <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">•</span>Your <strong className="text-white">camera will turn on</strong> automatically</li>
                                <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">•</span>The exam runs in <strong className="text-white">fullscreen mode</strong> — you cannot exit</li>
                                <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">•</span>Switching tabs or minimizing window is <strong className="text-white">flagged</strong></li>
                                <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">•</span>Right-click and copy shortcuts are <strong className="text-white">disabled</strong></li>
                                <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">•</span>3 warnings = <strong className="text-red-400">automatic disqualification</strong></li>
                                <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">•</span>Your teacher is notified of <strong className="text-white">every suspicious action</strong></li>
                            </ul>
                        </div>

                        <button onClick={() => setStatus('starting')}
                            className="btn-gold w-full py-3 text-base font-bold">
                            ✓ I Understand — Enter Exam
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── STARTING: request camera, go fullscreen, then activate ────────────────
    if (status === 'starting') {
        return <ProctorActivator
            examRoomId={examRoomId} userId={userId} userName={userName}
            cameraVideoRef={cameraVideoRef} cameraStreamRef={cameraStreamRef}
            socketRef={socketRef} wrapperRef={wrapperRef}
            onReady={() => setStatus('active')}
        />;
    }

    // ── ACTIVE EXAM ─────────────────────────────────────────────────────────────
    return (
        <ActiveExam
            examRoomId={examRoomId} userId={userId} userName={userName}
            cameraVideoRef={cameraVideoRef} cameraStreamRef={cameraStreamRef}
            socketRef={socketRef} wrapperRef={wrapperRef}
            warnings={warnings} setWarnings={setWarnings}
            warningMsg={warningMsg} setWarningMsg={setWarningMsg}
        >
            {children}
        </ActiveExam>
    );
}

// ─── Sub-component: Activator ────────────────────────────────────────────────
function ProctorActivator({ examRoomId, userId, userName, cameraVideoRef, cameraStreamRef, socketRef, wrapperRef, onReady }: any) {
    const [step, setStep] = useState<'camera' | 'fullscreen' | 'done'>('camera');
    const [err, setErr] = useState('');

    const requestCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            cameraStreamRef.current = stream;
            if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
            setStep('fullscreen');
        } catch {
            setErr('Camera access is required to take this exam. Please allow camera permissions and try again.');
        }
    };

    const requestFullscreen = async () => {
        try {
            const el = document.documentElement;
            if (el.requestFullscreen) await el.requestFullscreen();
            else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
            // Connect socket
            const s = io('http://localhost:4000', { transports: ['websocket', 'polling'] });
            s.emit('register', { userId, name: userName, role: 'student' });
            s.emit('join_room', { roomId: examRoomId });
            socketRef.current = s;
            setStep('done');
            setTimeout(onReady, 500);
        } catch {
            setErr('Please allow fullscreen access to continue.');
        }
    };

    return (
        <div className="fixed inset-0 bg-[#0a0e1a] z-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full card p-8 text-center space-y-5">
                <div className="text-4xl">{step === 'camera' ? '📷' : step === 'fullscreen' ? '🖥️' : '✅'}</div>
                <h3 className="text-xl font-black text-white">
                    {step === 'camera' ? 'Enable Camera' : step === 'fullscreen' ? 'Enter Fullscreen' : 'Starting Exam…'}
                </h3>
                {step === 'camera' && (
                    <>
                        <p className="text-slate-400 text-sm">Your camera will remain on throughout the exam so your teacher can verify your identity.</p>
                        {err && <p className="text-red-400 text-sm">{err}</p>}
                        <button onClick={requestCamera} className="btn-gold w-full py-3">Enable Camera →</button>
                    </>
                )}
                {step === 'fullscreen' && (
                    <>
                        <div className="w-full aspect-video bg-black rounded-xl overflow-hidden">
                            <video ref={cameraVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        </div>
                        <p className="text-slate-400 text-sm">Camera is active! Now click to enter fullscreen exam mode.</p>
                        {err && <p className="text-red-400 text-sm">{err}</p>}
                        <button onClick={requestFullscreen} className="btn-gold w-full py-3">Enter Fullscreen Exam →</button>
                    </>
                )}
                {step === 'done' && (
                    <div className="flex justify-center">
                        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Sub-component: Active exam with anti-cheat ───────────────────────────────
function ActiveExam({ examRoomId, userId, userName, cameraVideoRef, cameraStreamRef, socketRef, wrapperRef, warnings, setWarnings, warningMsg, setWarningMsg, children }: any) {
    const [showWarning, setShowWarning] = useState(false);

    const triggerWarning = useCallback((msg: string) => {
        setWarnings((w: number) => {
            const next = w + 1;
            setWarningMsg(`⚠️ Warning ${next}/3: ${msg}`);
            setShowWarning(true);
            setTimeout(() => setShowWarning(false), 4000);
            // Notify admin via socket
            socketRef.current?.emit('proctor_event', { roomId: examRoomId, event: msg, userId, userName });
            if (next >= 3) {
                alert('🚨 You have received 3 warnings and have been disqualified from this exam.');
            }
            return next;
        });
    }, [examRoomId, userId, userName]);

    // ── Anti-cheat event listeners ─────────────────────────────────────────
    useEffect(() => {
        // Fullscreen exit detection
        const onFsChange = () => {
            if (!document.fullscreenElement) {
                triggerWarning('Exited fullscreen');
                // Try to re-enter
                setTimeout(() => {
                    document.documentElement.requestFullscreen?.();
                }, 500);
            }
        };

        // Tab visibility
        const onVisibility = () => {
            if (document.hidden) {
                triggerWarning('Switched to another tab/window');
                socketRef.current?.emit('tab_switch', { examRoomId, userId, userName });
            }
        };

        // Disable right-click
        const onContextMenu = (e: Event) => { e.preventDefault(); triggerWarning('Right-click detected'); };

        // Disable copy/paste/cut
        const onCopy = (e: Event) => { e.preventDefault(); };
        const onPaste = (e: Event) => { e.preventDefault(); };
        const onCut = (e: Event) => { e.preventDefault(); };

        // Disable DevTools shortcuts
        const onKeydown = (e: KeyboardEvent) => {
            if (
                (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
                e.key === 'F12' ||
                (e.ctrlKey && e.key === 'u') ||
                (e.metaKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key))
            ) {
                e.preventDefault();
                triggerWarning(`Blocked shortcut: ${e.key}`);
            }
        };

        document.addEventListener('fullscreenchange', onFsChange);
        document.addEventListener('visibilitychange', onVisibility);
        document.addEventListener('contextmenu', onContextMenu);
        document.addEventListener('copy', onCopy);
        document.addEventListener('paste', onPaste);
        document.addEventListener('cut', onCut);
        document.addEventListener('keydown', onKeydown);

        return () => {
            document.removeEventListener('fullscreenchange', onFsChange);
            document.removeEventListener('visibilitychange', onVisibility);
            document.removeEventListener('contextmenu', onContextMenu);
            document.removeEventListener('copy', onCopy);
            document.removeEventListener('paste', onPaste);
            document.removeEventListener('cut', onCut);
            document.removeEventListener('keydown', onKeydown);
            // Stop camera on exit
            cameraStreamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
            socketRef.current?.disconnect();
        };
    }, [triggerWarning]);

    return (
        <div ref={wrapperRef} className="relative min-h-screen bg-[#0a0e1a]" style={{ userSelect: 'none' }}>
            {/* Warning toast */}
            {showWarning && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-red-500 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl flex items-center gap-3 animate-bounce">
                    <span className="text-xl">🚨</span>
                    <span>{warningMsg}</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded-lg text-sm">{warnings}/3</span>
                </div>
            )}

            {/* Camera pip (always visible, top-right) */}
            <div className="fixed top-4 right-4 z-50 w-36 bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-500/40">
                <video ref={cameraVideoRef} autoPlay muted playsInline className="w-full aspect-video object-cover" />
                <div className="bg-black/80 text-center py-1">
                    <span className="text-xs text-green-400 font-medium flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                        Proctored
                    </span>
                </div>
            </div>

            {/* Warning counter (top-left) */}
            <div className={`fixed top-4 left-4 z-50 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg ${warnings === 0 ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : warnings === 1 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                <span>{warnings === 0 ? '🛡️' : '⚠️'}</span>
                {warnings === 0 ? 'No warnings' : `${warnings}/3 Warnings`}
            </div>

            {/* Exam content */}
            <div className="pt-16">
                {children}
            </div>
        </div>
    );
}
