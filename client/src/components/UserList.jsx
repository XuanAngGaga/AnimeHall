import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Users, Crown } from 'lucide-react';

export default function UserList({ roomId, ownerId }) {
  const { socket, on, off } = useSocket();
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!socket) return;
    const handleMembers = (list) => setMembers(list);
    on('room:members', handleMembers);
    return () => off('room:members', handleMembers);
  }, [socket, roomId]);

  return (
    <div className="glass p-4">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Users className="w-4 h-4" /> Online ({members.length})
      </h3>
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-dark-600 text-sm">
            <div className="w-7 h-7 rounded-full bg-primary-600/20 flex items-center justify-center text-xs font-bold text-primary-400">
              {m.username?.charAt(0).toUpperCase()}
            </div>
            <span className="text-gray-300">{m.username}</span>
            {m.id === ownerId && <Crown className="w-3.5 h-3.5 text-yellow-500 ml-auto" />}
          </div>
        ))}
      </div>
    </div>
  );
}
