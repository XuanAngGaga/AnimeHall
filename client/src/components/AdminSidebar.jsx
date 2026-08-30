import { LayoutDashboard, Users, Film, Ticket, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const tabs = [
  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'rooms', label: '房间管理', icon: Film },
  { id: 'invites', label: '邀请码', icon: Ticket },
  { id: 'settings', label: '站点设置', icon: Settings },
];

export default function AdminSidebar({ activeTab, onTabChange }) {
  const navigate = useNavigate();

  return (
    <div className="w-56 bg-dark-800 border-r border-dark-600 p-4 flex flex-col shrink-0">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">管理后台</h2>
      <nav className="space-y-1 flex-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-600/20 text-primary-400 font-medium'
                : 'text-gray-400 hover:bg-dark-700 hover:text-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </nav>
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 mt-4 px-3 py-2">
        <LogOut className="w-4 h-4" /> 返回首页
      </button>
    </div>
  );
}