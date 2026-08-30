import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roomAPI } from '../utils/api';
import { Plus, LogIn, X } from 'lucide-react';

export default function RoomControls() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createRoom = async () => {
    if (!roomName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await roomAPI.create({ name: roomName, description: roomDesc, isPublic });
      navigate('/room/' + res.data.id);
    } catch (err) {
      setError(err.response?.data?.error || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = () => {
    if (!joinCode.trim()) return;
    navigate('/room/' + joinCode.trim());
  };

  if (!user) return null;

  return (
    <>
      <div className="flex gap-3">
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> 创建房间
        </button>
        <button onClick={() => setShowJoin(true)} className="btn-ghost flex items-center gap-2 border border-dark-500">
          <LogIn className="w-4 h-4" /> 加入房间
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowCreate(false)}>
          <div className="bg-dark-700 border border-dark-500 rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">创建新房间</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-dark-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="房间名称" className="input-field mb-3" maxLength={50} />
            <textarea value={roomDesc} onChange={(e) => setRoomDesc(e.target.value)} placeholder="房间简介（可选）" className="input-field mb-4 resize-none h-20" maxLength={200} />
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-400">房间公开性</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${isPublic ? 'bg-primary-600 text-white' : 'bg-dark-600 text-gray-400'}`}
                >
                  公开
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!isPublic ? 'bg-primary-600 text-white' : 'bg-dark-600 text-gray-400'}`}
                >
                  私有
                </button>
              </div>
            </div>
            {!isPublic && <p className="text-xs text-yellow-400 mb-3">私有房间不会出现在大厅列表，只能通过房间 ID 加入</p>}
            <button onClick={createRoom} disabled={loading || !roomName.trim()} className="btn-primary w-full">
              {loading ? '创建中...' : '创建房间'}
            </button>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowJoin(false)}>
          <div className="bg-dark-700 border border-dark-500 rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">加入房间</h2>
              <button onClick={() => setShowJoin(false)} className="p-1 hover:bg-dark-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="输入6位房间ID"
              className="input-field mb-4"
              inputMode="numeric"
              maxLength={6}
            />
            <button onClick={joinRoom} disabled={!joinCode.trim()} className="btn-primary w-full">加入房间</button>
          </div>
        </div>
      )}
    </>
  );
}