import { useState, useEffect } from 'react';
import { videoAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Play, Trash2, Globe, Upload, RefreshCw } from 'lucide-react';

export default function VideoLibrary({ onSelect, showUpload, onUploadClick }) {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('mine'); // 'mine' | 'public'

  useEffect(() => {
    if (!user) return;
    loadVideos();
  }, [user, tab]);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const res = tab === 'mine' ? await videoAPI.list() : await videoAPI.public();
      setVideos(res.data || []);
    } catch { setVideos([]); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this video?')) return;
    try {
      await videoAPI.delete(id);
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSelect = (video) => {
    onSelect?.(video);
  };

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">视频库</h3>
        <div className="flex items-center gap-1">
          <button onClick={loadVideos} className="p-1 hover:bg-dark-600 rounded" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
          </button>
          {onUploadClick && (
            <button onClick={onUploadClick} className="btn-primary text-xs py-1 px-3 flex items-center gap-1">
              <Upload className="w-3 h-3" /> 上传
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex mb-3 bg-dark-800 rounded-lg p-0.5">
        <button onClick={() => setTab('mine')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'mine' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
          我的视频
        </button>
        <button onClick={() => setTab('public')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'public' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
          <Globe className="w-3 h-3 inline mr-0.5" /> 公开
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-4 text-xs text-gray-500">
          <p>暂无视频</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          {videos.map((v) => (
            <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-dark-600 group transition-colors">
              <div className="w-8 h-8 rounded bg-dark-800 flex items-center justify-center shrink-0 overflow-hidden">
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Play className="w-4 h-4 text-primary-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">{v.title}</p>
                <p className="text-xs text-gray-500 truncate">
                  {v.owner_name ? '上传者: ' + v.owner_name : v.file_size > 0 ? (v.file_size / 1024 / 1024).toFixed(1) + ' MB' : '链接'}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleSelect(v)} className="p-1 bg-primary-600 hover:bg-primary-700 rounded text-white" title="Play">
                  <Play className="w-3 h-3" />
                </button>
                {(tab === 'mine' || user?.role === 'admin') && (
                  <button onClick={() => handleDelete(v.id)} className="p-1 bg-red-600/30 hover:bg-red-600/50 rounded text-red-400" title="Delete">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}