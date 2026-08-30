import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { animeAPI, roomAPI } from '../utils/api';
import { useSettings } from '../context/SettingsContext';
import AnimeCard from '../components/AnimeCard';
import RoomControls from '../components/RoomControls';
import { Search, Users } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [rooms, setRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    roomAPI.list().then((res) => setRooms(res.data || [])).catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await animeAPI.search(searchQuery);
      setSearchResults(res.data.list || []);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const handleAnimeClick = (anime) => {
    const params = new URLSearchParams();
    params.set('vodId', anime.vod_id || '');
    params.set('categoryId', anime.category_id || '');
    params.set('animeTitle', anime.name || '');
    navigate('/room/new?' + params.toString());
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">{settings.home_title || '一起同步看番'}</h1>
        <p className="text-gray-400 text-lg mb-6">{settings.home_subtitle || '创建房间，邀请朋友，同步观看动漫'}</p>
        <div className="flex items-center justify-center gap-3 mb-6">
          <RoomControls />
        </div>
        <div className="flex items-center max-w-lg mx-auto gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索动漫..."
              className="input-field pl-10"
            />
          </div>
          <button onClick={handleSearch} disabled={searching} className="btn-primary">
            {searching ? '搜索中...' : '搜索'}
          </button>
        </div>
      </div>

      {searchResults.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Search className="w-5 h-5 text-primary-400" /> 搜索结果</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {searchResults.map((anime) => (
              <AnimeCard key={anime.vod_id} anime={anime} onClick={() => handleAnimeClick(anime)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-green-400" /> 活跃房间</h2>
        {rooms.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p>暂无活跃房间，快来创建第一个吧！</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <div key={room.id} onClick={() => navigate('/room/' + room.id)} className="card cursor-pointer hover:border-primary-600/50">
                <h3 className="font-semibold text-lg">{room.name}</h3>
                <p className="text-sm text-gray-400 mt-1 line-clamp-1">{room.description || '暂无简介'}</p>
                <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                  <span>房主: {room.owner_name}</span>
                  <span>{room.member_count || 0} 人在线</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}