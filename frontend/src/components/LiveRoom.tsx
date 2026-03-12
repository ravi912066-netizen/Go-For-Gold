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

const avatar = (name: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

export default function LiveRoom({ roomId, userId, userName, role, onClose }: LiveRoomProps) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [activeTab, setActiveTab] = useState<'chat' | 'poll' | 'doubts' | 'results'>('chat');
    const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
    const [incomingFrom, setIncomingFrom] = useState<{ id: string; name: string } | null>(null);
    const [cameraOn, setCameraOn] = useState(false);
    const [micOn, setMicOn] = useState(true);
    const [onlineCount, setOnlineCount] = useState(0);
    const [proctorAlerts, setProctorAlerts] = useState<string[]>([]);

    // Poll state
    const [currentPoll, setCurrentPoll] = useState<{ question: string; startTime: string } | null>(null);
    const [myVote, setMyVote] = useState<string | null>(null);
    const [pollResults, setPollResults] = useState<{ [key: string]: number }>({ A: 0, B: 0, C: 0, D: 0 });

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const chatBottomRef = useRef<HTMLDivElement>(null);
    const remoteSocketId = useRef<string>('');

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

        // Poll events
        s.on('poll_started', (poll: any) => { setCurrentPoll(poll); setMyVote(null); setPollResults({ A: 0, B: 0, C: 0, D: 0 }); setActiveTab('poll'); });
        s.on('poll_stopped', () => setCurrentPoll(null));
        s.on('new_vote', ({ option }: any) => {
            if (role === 'admin') setPollResults(prev => ({ ...prev, [option]: (prev[option] || 0) + 1 }));
        });

        // WebRTC
        s.on('incoming_call', ({ from, callerName }: any) => { setIncomingFrom({ id: from, name: callerName }); setCallState('ringing'); });
        s.on('call_accepted', ({ by }: any) => { remoteSocketId.current = by; startCall(s, by, true); });
        s.on('call_rejected', () => { setCallState('idle'); alert('Teacher is busy'); });
        s.on('call_ended', () => endCall());
        s.on('webrtc_offer', async ({ offer, from }: any) => { remoteSocketId.current = from; await handleOffer(s, offer, from); });
        s.on('webrtc_answer', async ({ answer }: any) => { await peerRef.current?.setRemoteDescription(new RTCSessionDescription(answer)); });
        s.on('webrtc_ice', async ({ candidate }: any) => { try { await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch { } });

        s.on('proctor_alert', ({ event, userName: uName, time }: any) => {
            const msg = `⚠️ ${uName}: ${event} at ${new Date(time).toLocaleTimeString()}`;
            setProctorAlerts(prev => [msg, ...prev].slice(0, 20));
        });

        return () => { s.disconnect(); endCall(); };
    }, [roomId, userId, userName, role]);

    useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const getLocalStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            setCameraOn(true);
            return stream;
        } catch { return null; }
    };

    const createPeer = (s: Socket) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pc.onicecandidate = (e) => { if (e.candidate && remoteSocketId.current) s.emit('webrtc_ice', { candidate: e.candidate, to: remoteSocketId.current }); };
        pc.ontrack = (e) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; setCallState('connected'); };
        return pc;
    };

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

    const endCall = useCallback(() => {
        peerRef.current?.close(); peerRef.current = null;
        localStreamRef.current?.getTracks().forEach(t => t.stop()); localStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setCameraOn(false); setCallState('idle'); setIncomingFrom(null);
    }, []);

    const acceptCall = () => {
        if (!socket || !incomingFrom) return;
        socket.emit('call_accept', { to: incomingFrom.id });
        startCall(socket, incomingFrom.id, false);
        setIncomingFrom(null);
    };

    const rejectCall = () => {
        if (!socket || !incomingFrom) return;
        socket.emit('call_reject', { to: incomingFrom.id });
        setCallState('idle');
        setIncomingFrom(null);
    };

    const toggleMic = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
            setMicOn(prev => !prev);
        }
    };

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !socket) return;
        socket.emit('send_message', { roomId, message: input.trim(), senderName: userName, role });
        setInput('');
    };

    const startPoll = () => { socket?.emit('start_poll', { roomId, question: 'What will be the output?' }); };
    const vote = (opt: string) => { if (!myVote && socket) { setMyVote(opt); socket.emit('submit_vote', { roomId, option: opt, userId, userName }); } };

    return (
        <div className="fixed inset-0 z-50 bg-[#0a0e1a] flex flex-col md:flex-row overflow-hidden font-sans">
            <div className="flex-1 flex flex-col min-h-0 relative border-r border-[#1e2d45]">
                <div className="h-14 flex items-center justify-between px-6 bg-[#111827] border-b border-[#1e2d45]">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" className="w-8 h-8 rounded-lg" alt="" />
                        <div>
                            <p className="text-white font-black text-sm tracking-tight leading-none uppercase">C++, OOPS, OS & DBMS : BARC PRACTICE</p>
                            <p className="text-[10px] text-amber-500 font-bold tracking-widest mt-0.5">LECTURE 21 • LIVE NOW</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">{onlineCount} WATCHING</span>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-12 bg-[#0d1117] flex flex-col items-center justify-center text-center">
                    <div className="max-w-3xl w-full bg-[#111827] border border-[#1e2d45] rounded-3xl p-10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <img src="/logo.png" className="w-24 h-24 rotate-12" alt="" />
                        </div>
                        <div className="text-left">
                            <p className="text-amber-500 font-black text-xs uppercase tracking-[0.3em] mb-4">Challenge #21</p>
                            <h3 className="text-2xl font-black text-white mb-8 leading-tight">What will be the output of the following C++ code?</h3>
                            <div className="bg-[#0a0e1a] rounded-2xl p-6 font-mono text-sm text-slate-300 border border-white/5 mb-10 overflow-x-auto">
                                <pre>{`#include <iostream>
using namespace std;

int main() {
    int x = 10;
    cout << (x > 5 ? 100 : 200);
    return 0;
}`}</pre>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {['A', 'B', 'C', 'D'].map(opt => (
                                    <button key={opt} onClick={() => vote(opt)}
                                        className={`p-4 rounded-xl border-2 font-black transition-all flex items-center justify-between group
                                        ${myVote === opt ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-[#1e2d45]/50 border-[#1e2d45] text-slate-400 hover:border-amber-500/50 hover:text-white'}`}>
                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 ${myVote === opt ? 'bg-black/10 border-black/20' : 'bg-white/5 border-white/10 group-hover:bg-amber-500/10'}`}>{opt}</span>
                                        <span className="text-lg">{opt === 'A' ? '100' : opt === 'B' ? '200' : opt === 'C' ? '10' : 'Error'}</span>
                                        <div className="w-8 shrink-0"></div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-16 flex items-center justify-between px-8 bg-[#111827] border-t border-[#1e2d45]">
                    <div className="flex gap-4">
                        <button className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors">
                            <span className="text-lg">📜</span> NOTES
                        </button>
                    </div>
                    {role === 'admin' && (
                        <div className="flex gap-3">
                            <button onClick={startPoll} className="bg-amber-500 hover:bg-amber-400 text-black px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">START POLL</button>
                            <button onClick={() => socket?.emit('stop_poll', { roomId })} className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">RESET</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full md:w-96 flex flex-col bg-[#0d1523] shrink-0">
                <div className="aspect-video bg-black relative border-b border-[#1e2d45] overflow-hidden">
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    {callState !== 'connected' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <img src={avatar('Rahul')} className="w-16 h-16 rounded-full border-2 border-amber-500 mb-2" alt="" />
                            <p className="text-white font-bold text-xs uppercase tracking-widest">TEACHER OFFLINE</p>
                        </div>
                    )}
                    <video ref={localVideoRef} autoPlay playsInline muted
                        className="absolute bottom-3 right-3 w-24 h-24 object-cover rounded-2xl border-2 border-amber-500/50 shadow-2xl"
                        style={{ display: cameraOn ? 'block' : 'none' }} />
                </div>

                <div className="flex bg-[#111827] border-b border-[#1e2d45]">
                    {['chat', 'doubts', 'results'].map(t => (
                        <button key={t} onClick={() => setActiveTab(t as any)}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}>
                            {t}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {activeTab === 'chat' && (
                        <>
                            {messages.map(msg => {
                                const isMine = msg.senderName === userName;
                                const isAdmin = msg.role === 'admin';
                                return (
                                    <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-center gap-1.5 mb-1 px-1">
                                            {isAdmin && <span className="bg-amber-500 text-black text-[8px] font-black px-1.5 rounded uppercase leading-none py-0.5">TEACHER</span>}
                                            <span className="text-[10px] font-bold text-slate-500">{msg.senderName}</span>
                                        </div>
                                        <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed border shadow-sm ${isMine
                                            ? 'bg-amber-500 text-black border-amber-400/20 rounded-tr-none'
                                            : isAdmin ? 'bg-amber-500/10 border-amber-500/20 text-white rounded-tl-none' : 'bg-[#1e2d45] border-white/5 text-slate-200 rounded-tl-none'}`}>
                                            {msg.text}
                                        </div>
                                        <span className="text-[9px] text-slate-600 mt-1 uppercase font-bold tracking-tighter">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                );
                            })}
                            <div ref={chatBottomRef} />
                        </>
                    )}

                    {activeTab === 'results' && role === 'admin' && (
                        <div className="space-y-4 pt-4">
                            <h4 className="text-white font-black text-xs uppercase tracking-widest mb-6">Real-time voting</h4>
                            {Object.entries(pollResults).map(([opt, count]) => {
                                const total = Object.values(pollResults).reduce((a, b) => a + b, 0) || 1;
                                const pct = (count / total) * 100;
                                return (
                                    <div key={opt} className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                                            <span className="text-slate-400">Option {opt}</span>
                                            <span className="text-amber-500">{count} votes</span>
                                        </div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                            <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-[#1e2d45] bg-[#111827]">
                    {incomingFrom && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 mb-3 flex items-center justify-between animate-pulse">
                            <span className="text-[9px] font-black text-green-400 uppercase tracking-widest">INCOMING CALL...</span>
                            <div className="flex gap-2">
                                <button onClick={acceptCall} className="bg-green-500 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs">✓</button>
                                <button onClick={rejectCall} className="bg-red-500 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs">×</button>
                            </div>
                        </div>
                    )}
                    <form onSubmit={sendMessage} className="flex gap-2">
                        <input className="flex-1 bg-[#0a0e1a] border border-[#1e2d45] rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:border-amber-500/50 outline-none transition-all"
                            placeholder="Type reaching out..." value={input} onChange={e => setInput(e.target.value)} />
                        <button type="submit" disabled={!input.trim()} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black p-2.5 rounded-xl transition-all h-9 flex items-center justify-center">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
