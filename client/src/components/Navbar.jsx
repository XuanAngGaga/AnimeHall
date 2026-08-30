import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Film, User, LogOut, Settings } from 'lucide-react';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  return (
    <nav className="bg-dark-800/70 backdrop-blur-[var(--site-blur)] border-b border-dark-600 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary-400 hover:text-primary-300 transition-colors">
          {settings.site_icon ? (
            <img src={settings.site_icon} alt="" className="w-7 h-7 rounded object-cover" />
          ) : (
            <Film className="w-7 h-7" />
          )}
          <span>{settings.site_name || '轩昂の小破站'}</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {isAdmin && (
                <button onClick={() => navigate('/admin')} className="btn-ghost flex items-center gap-1.5 text-sm">
                  <Settings className="w-4 h-4" /> 管理
                </button>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <User className="w-4 h-4" />
                <span>{user.username}</span>
              </div>
              <button onClick={logout} className="btn-ghost flex items-center gap-1.5 text-sm text-red-400">
                <LogOut className="w-4 h-4" /> 退出
              </button>
            </>
          ) : (
            <button onClick={() => navigate('/login')} className="btn-primary text-sm">
              登录 / 注册
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}