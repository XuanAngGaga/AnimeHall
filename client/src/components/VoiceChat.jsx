import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Mic, MicOff, Phone, PhoneOff, Users } from 'lucide-react';

export default function VoiceChat({ roomId, muted: roomMuted }) {
  const { socket, on, off } = useSocket();
  const { user } = useAuth();
  const [inVoice, setInVoice] = useState(false);
  const [muted, setMuted] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [peers, setPeers] = useState(new Map());
  const [micError, setMicError] = useState('');
  const localStreamRef = useRef(null);
  const peerConnsRef = useRef(new Map());

  const getMedia = async () => {
    setMicError('');
    // Try a series of fallback constraints for better device compatibility
    const constraintsList = [
      { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false },
      { audio: { echoCancellation: true }, video: false },
      { audio: true, video: false },
    ];

    for (const constraints of constraintsList) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        return stream;
      } catch (err) {
        // Try next constraint set
        if (err.name === 'NotAllowedError') {
          setMicError('麦克风权限被拒绝。请在浏览器设置中允许麦克风访问。');
          return null;
        }
        if (err.name === 'NotFoundError') {
          setMicError('未检测到麦克风设备。请连接麦克风后重试。');
          return null;
        }
        if (err.name === 'NotReadableError') {
          setMicError('麦克风被其他应用占用或硬件错误。请关闭其他使用麦克风的应用后重试。');
          return null;
        }
        // Other errors (OverconstrainedError, etc.) — continue with next constraints
        continue;
      }
    }
    // All constraints failed
    setMicError('无法访问麦克风。请检查设备权限或浏览器设置。');
    return null;
  };

  const createPeerConnection = useCallback((targetSocketId, localStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
    });

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('voice:signal', { roomId, to: targetSocketId, from: socket.id, signal: { type: 'ice-candidate', candidate: e.candidate } });
      }
    };

    pc.ontrack = (e) => {
      setPeers((prev) => {
        const next = new Map(prev);
        next.set(targetSocketId, e.streams[0]);
        return next;
      });
    };

    peerConnsRef.current.set(targetSocketId, pc);
    return pc;
  }, [socket, roomId]);

  const joinVoice = async () => {
    if (roomMuted) {
      setMicError('你已被房主禁言，无法加入语音');
      return;
    }
    const stream = await getMedia();
    if (!stream) return;

    socket.emit('voice:join', { roomId, userId: user.id });
    setInVoice(true);
  };

  const leaveVoice = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    peerConnsRef.current.forEach((pc) => pc.close());
    peerConnsRef.current.clear();
    setPeers(new Map());
    socket.emit('voice:leave', { roomId });
    setInVoice(false);
    setMuted(false);
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMuted((m) => !m);
  };

  useEffect(() => {
    if (!socket || !inVoice) return;

    const handleParticipants = async (pList) => {
      setParticipants(pList);
      const stream = localStreamRef.current;
      if (!stream) return;
      for (const p of pList) {
        if (!peerConnsRef.current.has(p.socketId)) {
          const pc = createPeerConnection(p.socketId, stream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('voice:signal', { roomId, to: p.socketId, from: socket.id, signal: { type: 'offer', sdp: offer } });
        }
      }
    };

    const handleSignal = async ({ from, signal }) => {
      const pc = peerConnsRef.current.get(from);
      if (!pc) {
        const stream = localStreamRef.current;
        if (!stream) return;
        const newPc = createPeerConnection(from, stream);
        if (signal.type === 'offer') {
          await newPc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await newPc.createAnswer();
          await newPc.setLocalDescription(answer);
          socket.emit('voice:signal', { roomId, to: from, from: socket.id, signal: { type: 'answer', sdp: answer } });
        }
        return;
      }
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice:signal', { roomId, to: from, from: socket.id, signal: { type: 'answer', sdp: answer } });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'ice-candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    };

    const handleUserJoined = async ({ socketId }) => {
      const stream = localStreamRef.current;
      if (!stream || peerConnsRef.current.has(socketId)) return;
      const pc = createPeerConnection(socketId, stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('voice:signal', { roomId, to: socketId, from: socket.id, signal: { type: 'offer', sdp: offer } });
    };

    const handleUserLeft = ({ socketId }) => {
      const pc = peerConnsRef.current.get(socketId);
      if (pc) { pc.close(); peerConnsRef.current.delete(socketId); }
      setPeers((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    };

    on('voice:participants', handleParticipants);
    on('voice:signal', handleSignal);
    on('voice:user-joined', handleUserJoined);
    on('voice:user-left', handleUserLeft);

    return () => {
      off('voice:participants', handleParticipants);
      off('voice:signal', handleSignal);
      off('voice:user-joined', handleUserJoined);
      off('voice:user-left', handleUserLeft);
    };
  }, [socket, inVoice, roomId, createPeerConnection]);

  return (
    <div className="glass p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">{inVoice ? (participants.length + 1) : 0} 人在语音</span>
        </div>
        <div className="flex items-center gap-2">
          {inVoice && (
            <button onClick={toggleMute} className={`p-2 rounded-lg ${muted ? 'bg-red-600/20 text-red-400' : 'bg-dark-600 text-gray-300'}`}>
              {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={inVoice ? leaveVoice : joinVoice}
            className={`p-2 rounded-lg flex items-center gap-1.5 text-sm font-medium ${inVoice ? 'bg-red-600 hover:bg-red-700 text-white' : roomMuted ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
          >
            {inVoice ? <><PhoneOff className="w-4 h-4" /> 离开</> : <><Phone className="w-4 h-4" /> 加入语音</>}
          </button>
        </div>
      </div>
      {micError && (
        <p className="text-xs text-red-400 mt-2">{micError}</p>
      )}
    </div>
  );
}
