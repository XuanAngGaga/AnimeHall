import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);

  // 保存最后一次有效 user（logout 后 user 变 null，但 leaveRoom 仍需 userId）
  const lastUserRef = useRef(null);
  if (user) lastUserRef.current = user;

  const pendingRoomRef = useRef(null);
  const currentRoomRef = useRef(null);

  useEffect(() => {
    // 根据后台配置选择传输方式：polling（默认，CDN 兼容）或 websocket（优先，失败回退 polling）
    const transport = settings.socket_transport || 'polling';
    const transports = transport === 'websocket' ? ['websocket', 'polling'] : ['polling'];
    const socket = io('/', { transports });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // 连接/重连成功后，重新加入房间（pending 优先，其次当前房间）
      const u = lastUserRef.current;
      const roomId = pendingRoomRef.current || currentRoomRef.current;
      if (roomId && u) {
        socket.emit('room:join', { roomId, userId: u.id, username: u.username });
        pendingRoomRef.current = null;
      }
    });
    socket.on('disconnect', () => setConnected(false));

    return () => { socket.disconnect(); };
  }, [settings.socket_transport]);

  const joinRoom = useCallback((roomId) => {
    const u = lastUserRef.current;
    if (!u) return;
    pendingRoomRef.current = roomId;
    currentRoomRef.current = roomId;
    setCurrentRoom(roomId);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('room:join', { roomId, userId: u.id, username: u.username });
      pendingRoomRef.current = null;
    }
  }, []);

  const leaveRoom = useCallback((roomId) => {
    const u = lastUserRef.current;
    pendingRoomRef.current = null;
    currentRoomRef.current = null;
    setCurrentRoom(null);
    if (socketRef.current && socketRef.current.connected && u) {
      socketRef.current.emit('room:leave', { roomId, userId: u.id });
    }
  }, []);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, currentRoom, joinRoom, leaveRoom, emit, on, off }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);