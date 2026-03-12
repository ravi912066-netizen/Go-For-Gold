'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
    id: number;
    text: string;
    senderName: string;
    role: string;
    timestamp: string;
}

interface LiveRoomProps {
    roomId: string;
    userId: number;
    userName: string;
    role: 'student' | 'admin';
    onClose?: () => void;
}

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export default function LiveRoom({ roomId, userId, userName, role, onClose }: LiveRoomProps) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [view, setView] = useState<'chat' | 'video'>('chat');
    const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
    const [incomingFrom, setIncomingFrom] = useState<{ id: string; name: string } | null>(null);
    const [cameraOn, setCameraOn] = useState(false);
    const [micOn, setMicOn] = useState(true);
    const [onlineCount, setOnlineCount] = useState(0);
    const [proctorAlerts, setProctorAlerts] = useState<string[]>([]);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const chatBottomRef = useRef<HTMLDivElement>(null);
    const remoteSocketId = useRef<string>('');

    // ── Connect socket ────────────────────────────────────────────────────────
    useEffect(() => {
        const s = io('http://localhost:4000', { transports: ['websocket', 'polling'] });
        setSocket(s);

        s.on('connect', () => {
            s.emit('register', { userId, name: userName, role });
            s.emit('join_room', { roomId });
        });
        s.on('chat_history', (history: Message[]) => setMessages(history));
        s.on('new_message', (msg: Message) => setMessages(prev => [...prev, msg]));
        s.on('online_users', (count: number) => setOnlineCount(count));

        // ── WebRTC events ──────────────────────────────────────────────────────
        s.on('incoming_call', ({ from, callerName }: { from: string; callerName: string }) => {
            setIncomingFrom({ id: from, name: callerName });
            setCallState('ringing');
            setView('video');
        });
        s.on('call_accepted', ({ by }: { by: string }) => {
            remoteSocketId.current = by;
            startCall(s, by, true);
        });
        s.on('call_rejected', () => { setCallState('idle'); alert('Call rejected'); });
        s.on('call_ended', () => endCall());

        s.on('webrtc_offer', async ({ offer, from }: { offer: RTCSessionDescriptionInit; from: string }) => {
            remoteSocketId.current = from;
            await handleOffer(s, offer, from);
        });
        s.on('webrtc_answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
            await peerRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
        });
        s.on('webrtc_ice', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
            try { await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch { }
        });

        // ── Proctoring alerts (admin sees these) ───────────────────────────────
        s.on('proctor_alert', ({ event, userName: uName, time }: any) => {
            const msg = `⚠️ ${uName}: ${event === 'TAB_SWITCH' ? 'Switched tabs' : event} at ${new Date(time).toLocaleTimeString()}`;
            setProctorAlerts(prev => [msg, ...prev].slice(0, 20));
        });

        return () => { s.disconnect(); endCall(); };
    }, [roomId, userId, userName, role]);

    // ── Auto-scroll chat ───────────────────────────────────────────────────────
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Get local camera/mic stream ────────────────────────────────────────────
    const getLocalStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            setCameraOn(true);
            return stream;
        } catch (e) {
            alert('Camera/microphone access denied. Please allow camera permissions.');
            return null;
        }
    };

    // ── Create peer connection ────────────────────────────────────────────────
    const createPeer = (s: Socket) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pc.onicecandidate = (e) => {
            if (e.candidate && remoteSocketId.current) {
                s.emit('webrtc_ice', { candidate: e.candidate, to: remoteSocketId.current });
            }
        };
        pc.ontrack = (e) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
            setCallState('connected');
        };
        return pc;
    };

    // ── Initiate call (called when accepted) ───────────────────────────────────
    const startCall = async (s: Socket, targetId: string, isInitiator: boolean) => {
        const stream = await getLocalStream();
        if (!stream) return;
        const pc = createPeer(s);
        peerRef.current = pc;
        stream.getTracks().forEach(t => pc.addTrack(t, stream));

        if (isInitiator) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            s.emit('webrtc_offer', { roomId, offer, targetSocketId: targetId });
        }
    };

    // ── Handle incoming offer ────────────────────────────────────────────────
    const handleOffer = async (s: Socket, offer: RTCSessionDescriptionInit, from: string) => {
        const stream = await getLocalStream();
        if (!stream) return;
        const pc = createPeer(s);
        peerRef.current = pc;
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        s.emit('webrtc_answer', { answer, to: from });
        setCallState('connected');
    };

    // ── End call ─────────────────────────────────────────────────────────────
    const endCall = useCallback(() => {
        peerRef.current?.close();
        peerRef.current = null;
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setCameraOn(false);
        setCallState('idle');
        setIncomingFrom(null);
    }, []);

    // ── Initiate outgoing call ─────────────────────────────────────────────
    const initiateCall = () => {
        if (!socket) return;
        setCallState('calling');
        setView('video');
        socket.emit('call_request', { roomId, callerName: userName });
    };

    // ── Accept incoming call ──────────────────────────────────────────────
    const acceptCall = () => {
        if (!socket || !incomingFrom) return;
        socket.emit('call_accept', { to: incomingFrom.id });
        startCall(socket, incomingFrom.id, false);
        setIncomingFrom(null);
    };

    // ── Reject call ──────────────────────────────────────────────────────
    const rejectCall = () => {
        if (!socket || !incomingFrom) return;
        socket.emit('call_reject', { to: incomingFrom.id });
        setCallState('idle');
        setIncomingFrom(null);
    };

    // ── Hang up ───────────────────────────────────────────────────────────
    const hangUp = () => {
        socket?.emit('call_end', { roomId });
        endCall();
    };

    // ── Toggle mic ────────────────────────────────────────────────────────
    const toggleMic = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
            setMicOn(prev => !prev);
        }
    };

    // ── Send chat message ──────────────────────────────────────────────────
    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !socket) return;
        socket.emit('send_message', { roomId, message: input.trim(), senderName: userName, role });
        setInput('');
    };

    const timeStr = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="flex flex-col h-full min-h-0 bg-[#111827] border border-[#1e2d45] rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d45] bg-[#0d1117] shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="font-bold text-white text-sm">Live Room</span>
                    {role === 'admin' && (
                        <span className="text-xs text-slate-500">{onlineCount} student{onlineCount !== 1 ? 's' : ''} online</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setView('chat')}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-all ${view === 'chat' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-500 hover:text-white'}`}>
                        💬 Chat
                    </button>
                    <button onClick={() => setView('video')}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-all ${view === 'video' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-500 hover:text-white'}`}>
                        📹 Video
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="text-slate-500 hover:text-white text-lg ml-1">×</button>
                    )}
                </div>
            </div>

            {/* Incoming call banner */}
            {callState === 'ringing' && incomingFrom && (
                <div className="bg-green-500/20 border-b border-green-500/30 px-4 py-3 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">📞</span>
                        <span className="text-green-300 text-sm font-medium">{incomingFrom.name} is calling…</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={acceptCall} className="bg-green-500 hover:bg-green-400 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all">✓ Accept</button>
                        <button onClick={rejectCall} className="bg-red-500 hover:bg-red-400 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all">✗ Decline</button>
                    </div>
                </div>
            )}

            {/* CHAT VIEW */}
            {view === 'chat' && (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full opacity-40">
                                <span className="text-4xl mb-2">💬</span>
                                <p className="text-slate-400 text-sm">No messages yet. Say hello!</p>
                            </div>
                        )}
                        {messages.map((msg) => {
                            const isMine = msg.senderName === userName;
                            return (
                                <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                    {!isMine && (
                                        <span className="text-xs text-slate-500 mb-1 px-1">
                                            {msg.role === 'admin' ? '👨‍🏫' : '🎓'} {msg.senderName}
                                        </span>
                                    )}
                                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${isMine
                                            ? 'bg-amber-500 text-black rounded-br-sm'
                                            : msg.role === 'admin'
                                                ? 'bg-blue-500/20 border border-blue-500/30 text-slate-200 rounded-bl-sm'
                                                : 'bg-[#1e2d45] text-slate-200 rounded-bl-sm'
                                        }`}>
                                        {msg.text}
                                    </div>
                                    <span className="text-xs text-slate-600 mt-1 px-1">{timeStr(msg.timestamp)}</span>
                                </div>
                            );
                        })}
                        <div ref={chatBottomRef} />
                    </div>

                    <form onSubmit={sendMessage} className="p-3 border-t border-[#1e2d45] flex gap-2 shrink-0">
                        <input
                            className="flex-1 bg-[#0a0e1a] border border-[#1e2d45] rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-all"
                            placeholder="Type a message…"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                        />
                        <button type="submit" disabled={!input.trim()}
                            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black p-2 rounded-xl transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                </>
            )}

            {/* VIDEO VIEW */}
            {view === 'video' && (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Videos */}
                    <div className="flex-1 relative bg-black min-h-0">
                        {/* Remote video (full) */}
                        <video ref={remoteVideoRef} autoPlay playsInline
                            className="w-full h-full object-cover"
                            style={{ display: callState === 'connected' ? 'block' : 'none' }}
                        />
                        {callState !== 'connected' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                                <span className="text-6xl mb-4">📹</span>
                                {callState === 'idle' && (
                                    <p className="text-slate-400 text-sm">Start a video call with {role === 'admin' ? 'student' : 'your teacher'}</p>
                                )}
                                {callState === 'calling' && (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                                        <p className="text-amber-400 text-sm">Calling… waiting for answer</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Local video (PiP top-right) */}
                        <video ref={localVideoRef} autoPlay playsInline muted
                            className="absolute bottom-3 right-3 w-28 h-20 object-cover rounded-xl border-2 border-amber-500/40 shadow-lg"
                            style={{ display: cameraOn ? 'block' : 'none' }}
                        />
                        {cameraOn && (
                            <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">{userName} (You)</div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="p-4 border-t border-[#1e2d45] flex items-center justify-center gap-3 bg-[#0d1117] shrink-0">
                        {callState === 'idle' && (
                            <button onClick={initiateCall}
                                className="bg-green-500 hover:bg-green-400 text-white px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-lg">
                                <span>📞</span> Start Video Call
                            </button>
                        )}
                        {(callState === 'calling' || callState === 'connected') && (
                            <>
                                <button onClick={toggleMic}
                                    className={`p-3 rounded-full transition-all text-lg ${micOn ? 'bg-[#1e2d45] text-white' : 'bg-red-500 text-white'}`}>
                                    {micOn ? '🎙️' : '🔇'}
                                </button>
                                <button onClick={hangUp}
                                    className="bg-red-500 hover:bg-red-400 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all">
                                    <span>📵</span> End Call
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Admin: Proctoring Alerts Panel */}
            {role === 'admin' && proctorAlerts.length > 0 && (
                <div className="border-t border-red-500/20 bg-red-500/5 p-3 max-h-28 overflow-y-auto shrink-0">
                    <p className="text-xs text-red-400 font-bold mb-1.5">⚠️ Proctoring Alerts</p>
                    {proctorAlerts.map((a, i) => (
                        <p key={i} className="text-xs text-red-300">{a}</p>
                    ))}
                </div>
            )}
        </div>
    );
}
