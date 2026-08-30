import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { roomAPI } from '../utils/api';
import { Shield, MicOff, Mic, Ban, Undo, PauseCircle, Gauge } from 'lucide-react';

export default function OwnerPanel({ roomId, ownerId, bannedUsers, mutedUsers, allowPauseAll, allowRateAll }) {
  const { socket, on, off } = useSocket();
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const handleMembers = (list) => setMembers(list);
    on('room:members', handleMembers);
    return () => off('room:members', handleMembers);
  }, [socket, on, off]);

  const act = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (e) { alert(e.response?.data?.error || '操作失败'); }
    finally { setBusy(false); }
  };

  const togglePause = () => act(() => roomAPI.permissions(roomId, { allowPauseAll: !allowPauseAll }));
  const toggleRate = () => act(() => roomAPI.permissions(roomId, { allowRateAll: !allowRateAll }));
  const banUser = (userId) => act(() => roomAPI.ban(roomId, userId));
  const unbanUser = (userId) => act(() => roomAPI.unban(roomId, userId));
  const muteUser = (userId) => act(() => roomAPI.mute(roomId, userId));
  const unmuteUser = (userId) => act(() => roomAPI.unmute(roomId, userId));

  return (
    <div className="glass p-4">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Shield className="w-4 h-4 text-yellow-500" /> 房主权限管理
      </h3>

      {/* 权限开关 */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400 flex items-center gap-1.5"><PauseCircle className="w-4 h-4" /> 所有人可播放/暂停</span>
          <button
            onClick={togglePause}
            disabled={busy}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${allowPauseAll ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}
          >
            {allowPauseAll ? '已开启' : '已关闭'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400 flex items-center gap-1.5"><Gauge className="w-4 h-4" /> 所有人可调倍速</span>
          <button
            onClick={toggleRate}
            disabled={busy}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${allowRateAll ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}
          >
            {allowRateAll ? '已开启' : '已关闭'}
          </button>
        </div>
      </div>

      {/* 成员管理 */}
      <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-dark-700/50">
            <span className="text-sm text-gray-300 flex-1 truncate">{m.username}</span>
            {m.id !== ownerId && (
              <div className="flex gap-1">
                {mutedUsers.includes(m.id) ? (
                  <button onClick={() => unmuteUser(m.id)} className="p-1 text-green-400 hover:text-green-300" title="解除禁言"><Mic className="w-3.5 h-3.5" /></button>
                ) : (
                  <button onClick={() => muteUser(m.id)} className="p-1 text-yellow-400 hover:text-yellow-300" title="禁言"><MicOff className="w-3.5 h-3.5" /></button>
                )}
                {bannedUsers.includes(m.id) ? (
                  <button onClick={() => unbanUser(m.id)} className="p-1 text-green-400 hover:text-green-300" title="解除封禁"><Undo className="w-3.5 h-3.5" /></button>
                ) : (
                  <button onClick={() => banUser(m.id)} className="p-1 text-red-400 hover:text-red-300" title="封禁并踢出"><Ban className="w-3.5 h-3.5" /></button>
                )}
              </div>
            )}
          </div>
        ))}
        {members.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-3">暂无成员</p>
        )}
      </div>
    </div>
  );
}