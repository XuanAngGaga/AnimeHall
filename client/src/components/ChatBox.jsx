import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Send } from 'lucide-react';

export default function ChatBox({ roomId, muted }) {
  const { socket, on, off } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [blockedMsg, setBlockedMsg] = useState('');
  const bottomRef = useRef(null);
  // Use a ref to keep the latest user id for message alignment,
  // so messages are aligned correctly even if socket events arrive
  // before the auth context has re-hydrated after a page refresh.
  const userIdRef = useRef(null);
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    const handleHistory = (msgs) => setMessages(msgs);
    const handleMessage = (msg) => setMessages((prev) => [...prev, msg]);
    const handleBlocked = ({ error }) => {
      setBlockedMsg(error);
      setTimeout(() => setBlockedMsg(''), 3000);
    };

    on('chat:history', handleHistory);
    on('chat:message', handleMessage);
    on('chat:blocked', handleBlocked);

    return () => {
      off('chat:history', handleHistory);
      off('chat:message', handleMessage);
      off('chat:blocked', handleBlocked);
    };
  }, [socket, roomId, on, off]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    if (muted) return;
    socket.emit('chat:message', {
      roomId,
      userId: user.id,
      username: user.username,
      message: input.trim(),
    });
    setInput('');
  };

  return (
    <div className="flex flex-col h-full glass">
      <div className="p-3 border-b border-dark-600">
        <h3 className="font-semibold text-sm">聊天</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[400px]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.userId === userIdRef.current ? 'items-end' : 'items-start'}`}>
            <span className="text-xs text-gray-500 mb-0.5">{msg.username}</span>
            <div className={`px-3 py-1.5 rounded-xl text-sm max-w-[80%] break-words ${msg.userId === userIdRef.current ? 'bg-primary-600 text-white' : 'bg-dark-600 text-gray-200'}`}>
              {msg.message}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {blockedMsg && <p className="text-xs text-red-400 px-3 py-1">{blockedMsg}</p>}
      <form onSubmit={sendMessage} className="p-3 border-t border-dark-600 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={muted ? '你已被禁言' : '发送消息...'}
          className="input-field flex-1 text-sm py-2"
          maxLength={500}
          disabled={muted}
        />
        <button type="submit" className="btn-primary p-2" disabled={!input.trim() || muted}>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}