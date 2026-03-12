'use client';
import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

interface VideoCallOverlayProps {
    socket: Socket | null;
    currentUserId: number;
    currentUserName: string;
    targetUserId?: number; // For admin calling student
    targetSocketId?: string; // For established connection
    isInitiator: boolean;
    onClose: () => void;
}

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export default function VideoCallOverlay({ socket, currentUserId, currentUserName, targetSocketId, isInitiator, onClose }: VideoCallOverlayProps) {
    const [callState, setCallState] = useState<'connecting' | 'connected' | 'ended'>('connecting');
    const [cameraOn, setCameraOn] = useState(true);
    const [micOn, setMicOn] = useState(true);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteId = useRef<string>(targetSocketId || '');

    useEffect(() => {
        if (!socket) return;

        const init = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStreamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                const pc = new RTCPeerConnection(ICE_SERVERS);
                peerRef.current = pc;

                stream.getTracks().forEach(track => pc.addTrack(track, stream));

                pc.onicecandidate = (e) => {
                    if (e.candidate && remoteId.current) {
                        socket.emit('webrtc_ice', { candidate: e.candidate, to: remoteId.current });
                    }
                };

                pc.ontrack = (e) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = e.streams[0];
                        setCallState('connected');
                    }
                };

                if (isInitiator && remoteId.current) {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit('webrtc_offer', { offer, targetSocketId: remoteId.current });
                }

                socket.on('webrtc_offer', async ({ offer, from }) => {
                    if (isInitiator) return; // Should not happen in 1:1 if handled correctly
                    remoteId.current = from;
                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('webrtc_answer', { answer, to: from });
                });

                socket.on('webrtc_answer', async ({ answer }) => {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                });

                socket.on('webrtc_ice', async ({ candidate }) => {
                    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { }
                });

                socket.on('call_ended', () => {
                    setCallState('ended');
                    setTimeout(onClose, 2000);
                });

            } catch (err) {
                console.error("Video call error:", err);
                onClose();
            }
        };

        init();

        return () => {
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            peerRef.current?.close();
            socket.off('webrtc_offer');
            socket.off('webrtc_answer');
            socket.off('webrtc_ice');
            socket.off('call_ended');
        };
    }, [socket, isInitiator]);

    const toggleCamera = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setCameraOn(videoTrack.enabled);
            }
        }
    };

    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setMicOn(audioTrack.enabled);
            }
        }
    };

    const handleEndCall = () => {
        if (socket && remoteId.current) {
            socket.emit('call_end', { targetSocketId: remoteId.current });
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-fade-in">
            {/* Header */}
            <div className="absolute top-6 left-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center font-black text-black">G</div>
                <div>
                    <h2 className="text-white font-bold text-sm uppercase tracking-widest">GFG Secure Call</h2>
                    <p className="text-slate-500 text-[10px] uppercase font-black">End-to-end encrypted</p>
                </div>
            </div>

            {/* Video Grid */}
            <div className="w-full max-w-5xl aspect-video grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                {/* Remote Video */}
                <div className="relative bg-[#111827] rounded-3xl overflow-hidden border border-white/5 shadow-2xl group">
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    {callState === 'connecting' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-amber-500 font-black text-xs uppercase tracking-widest animate-pulse">Establishing Connection...</p>
                        </div>
                    )}
                    <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-white text-[10px] font-bold uppercase tracking-wider">Remote User</span>
                    </div>
                </div>

                {/* Local Video */}
                <div className="relative bg-[#0d1117] rounded-3xl overflow-hidden border border-white/5 shadow-2xl group">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
                    {!cameraOn && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]">
                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-4xl">👤</div>
                        </div>
                    )}
                    <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10">
                        <span className="text-white text-[10px] font-bold uppercase tracking-wider">You ({currentUserName})</span>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="mt-10 flex items-center gap-4 bg-[#111827]/80 backdrop-blur-2xl px-8 py-4 rounded-full border border-white/10 shadow-3xl">
                <button onClick={toggleMic} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${micOn ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-red-500 text-white'}`}>
                    {micOn ? '🎤' : '🔇'}
                </button>
                <button onClick={toggleCamera} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${cameraOn ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-red-500 text-white'}`}>
                    {cameraOn ? '📹' : '📵'}
                </button>
                <div className="w-px h-8 bg-white/10 mx-2"></div>
                <button onClick={handleEndCall} className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 transition-all active:scale-95">
                    End Call
                </button>
            </div>

            {/* Status Tip */}
            {callState === 'connected' && (
                <p className="mt-6 text-slate-500 text-[10px] uppercase font-black tracking-[0.2em]">HD Quality Enabled • Stable Network</p>
            )}
        </div>
    );
}
