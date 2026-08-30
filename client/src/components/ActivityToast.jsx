import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Play, Pause, SkipForward, LogIn, LogOut, UserX, Gauge, Ban, MicOff } from 'lucide-react';

let toastId = 0;

export default function ActivityToast({ roomId }) {
  const { socket, on, off } = useSocket();
  const { user } = useAuth();
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((text, icon, color = 'text-gray-200') => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-4), { id, text, icon, color }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const cleanups = [
      on('room:user-joined', ({ username }) => {
        if (username !== user?.username) {
          addToast(`${username} 加入了房间`, <LogIn className="w-3 h-3" />, 'text-green-400');
        }
      }),
      on('room:user-left', ({ userId }) => {
        addToast('有人离开了房间', <LogOut className="w-3 h-3" />, 'text-gray-400');
      }),
      on('video:sync', ({ paused, userId, username }) => {
        if (userId === user?.id) return;
        const name = username || '有人';
        if (paused) {
          addToast(`${name} 暂停了视频`, <Pause className="w-3 h-3" />, 'text-yellow-400');
        } else {
          addToast(`${name} 播放了视频`, <Play className="w-3 h-3" />, 'text-green-400');
        }
      }),
      on('video:seek', ({ userId, username }) => {
        if (userId === user?.id) return;
        const name = username || '有人';
        addToast(`${name} 跳转了视频进度`, <SkipForward className="w-3 h-3" />, 'text-blue-400');
      }),
      on('video:change-episode', ({ episodeNumber, animeTitle }) => {
        const title = animeTitle ? `${animeTitle} ` : '';
        addToast(`切换至 ${title}第${episodeNumber}集`, <SkipForward className="w-3 h-3" />, 'text-primary-400');
      }),
      on('room:kicked', ({ userId }) => {
        if (userId === user?.id) {
          addToast('你被房主移出了房间', <UserX className="w-3 h-3" />, 'text-red-400');
        }
      }),
      on('video:rate', ({ rate, userId, username }) => {
        if (userId === user?.id) return;
        const name = username || '有人';
        addToast(`${name} 设置了 ${rate}x 倍速`, <Gauge className="w-3 h-3" />, 'text-purple-400');
      }),
      on('room:user-banned', ({ userId }) => {
        if (userId === user?.id) {
          addToast('你已被房主封禁并移出房间', <Ban className="w-3 h-3" />, 'text-red-400');
        }
      }),
      on('room:user-muted', ({ userId }) => {
        if (userId === user?.id) {
          addToast('你已被房主禁言', <MicOff className="w-3 h-3" />, 'text-yellow-400');
        }
      }),
    ];

    return () => cleanups.forEach((fn) => fn());
  }, [socket, user, addToast, on]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="glass px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm animate-[slideIn_0.3s_ease-out] pointer-events-auto"
          style={{
            background: 'rgba(20,21,23,0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <span className={t.color}>{t.icon}</span>
          <span className="text-gray-200">{t.text}</span>
        </div>
      ))}
    </div>
  );
}