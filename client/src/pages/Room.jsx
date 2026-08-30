import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { roomAPI, animeAPI } from '../utils/api';
import ChatBox from '../components/ChatBox';
import VoiceChat from '../components/VoiceChat';
import UserList from '../components/UserList';
import VideoPlayer from '../components/VideoPlayer';
import VideoLibrary from '../components/VideoLibrary';
import VideoUploader from '../components/VideoUploader';
import ActivityToast from '../components/ActivityToast';
import OwnerPanel from '../components/OwnerPanel';
import { List, ArrowLeft, Share2, Trash2, Check, Search } from 'lucide-react';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { socket, joinRoom, leaveRoom, emit, on } = useSocket();
  const [room, setRoom] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [currentEp, setCurrentEp] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [videoSource, setVideoSource] = useState('anime'); // 'anime' | 'library'
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bannedUsers, setBannedUsers] = useState([]);
  const [mutedUsers, setMutedUsers] = useState([]);
  const [allowPauseAll, setAllowPauseAll] = useState(true);
  const [allowRateAll, setAllowRateAll] = useState(true);
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [roomSearchResults, setRoomSearchResults] = useState([]);
  const [roomSearching, setRoomSearching] = useState(false);
  const currentTimeRef = useRef(0);
  const lastSyncEmitRef = useRef(0);
  const lastSeekEmitRef = useRef(0);

  useEffect(() => {
    if (!socket) return;
    const handleState = (state) => {
      setRoom(state.room);
      setCurrentEp(state.episodeNumber || 1);
      currentTimeRef.current = state.currentTime || 0;
      if (state.bannedUsers) setBannedUsers(state.bannedUsers);
      if (state.mutedUsers) setMutedUsers(state.mutedUsers);
      if (state.allowPauseAll !== undefined) setAllowPauseAll(state.allowPauseAll);
      if (state.allowRateAll !== undefined) setAllowRateAll(state.allowRateAll);
    };
    const handleRoomDeleted = ({ roomId: deletedRoomId }) => {
      if (deletedRoomId === roomId) {
        leaveRoom(roomId);
        navigate('/', { replace: true });
      }
    };
    const handleBanned = ({ userId }) => {
      setBannedUsers((prev) => [...new Set([...prev, userId])]);
      if (userId === user?.id) {
        leaveRoom(roomId);
        navigate('/', { replace: true });
      }
    };
    const handleMuted = ({ userId }) => {
      setMutedUsers((prev) => [...new Set([...prev, userId])]);
    };
    const handleUnmuted = ({ userId }) => {
      setMutedUsers((prev) => prev.filter((id) => id !== userId));
    };
    const handleUnbanned = ({ userId }) => {
      setBannedUsers((prev) => prev.filter((id) => id !== userId));
    };
    const handleKicked = ({ userId }) => {
      if (userId === user?.id) {
        leaveRoom(roomId);
        navigate('/', { replace: true });
      }
    };
    const handleRoomError = ({ error }) => {
      // 加入房间被拒绝（如被封禁）
      alert(error);
      leaveRoom(roomId);
      navigate('/', { replace: true });
    };
    const handlePermissions = ({ allowPauseAll: p, allowRateAll: r }) => {
      if (p !== undefined) setAllowPauseAll(p);
      if (r !== undefined) setAllowRateAll(r);
    };
    const handleAnimeChanged = ({ animeId, animeTitle, categoryId }) => {
      setRoom((prev) => prev ? { ...prev, anime_id: animeId, anime_title: animeTitle, category_id: categoryId } : prev);
      setCurrentEp(1);
      setEpisodes([]);
    };
    const unsubs = [
      on('room:state', handleState),
      on('room:deleted', handleRoomDeleted),
      on('room:user-banned', handleBanned),
      on('room:user-muted', handleMuted),
      on('room:user-unmuted', handleUnmuted),
      on('room:user-unbanned', handleUnbanned),
      on('room:permissions', handlePermissions),
      on('room:kicked', handleKicked),
      on('room:anime-changed', handleAnimeChanged),
      on('room:error', handleRoomError),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [socket, on, roomId, leaveRoom, navigate, user]);

  // 加入房间（放在 socket 监听之后，确保监听先注册）
  useEffect(() => {
    if (!user || !roomId || roomId === 'new' || !socket) return;
    joinRoom(roomId);
    return () => leaveRoom(roomId);
  }, [roomId, user, socket]);

  useEffect(() => {
    if (roomId === 'new') {
      const vodId = searchParams.get('vodId') || '';
      const categoryId = searchParams.get('categoryId') || '';
      const animeTitle = searchParams.get('animeTitle') || '';
      if (!user) { setLoading(false); return; }
      roomAPI.create({
        name: animeTitle || '新房间',
        description: '',
        animeId: vodId,
        categoryId,
        animeTitle,
        isPublic: true,
      }).then((res) => {
        navigate('/room/' + res.data.id, { replace: true });
      }).catch(() => setLoading(false));
      return;
    }

    roomAPI.get(roomId).then((res) => {
      const r = res.data;
      setRoom(r);
      setCurrentEp(r.episode_number || 1);
      if (r.bannedUsers) setBannedUsers(r.bannedUsers);
      if (r.mutedUsers) setMutedUsers(r.mutedUsers);
      if (r.allow_pause_all !== undefined) setAllowPauseAll(r.allow_pause_all === 1);
      if (r.allow_rate_all !== undefined) setAllowRateAll(r.allow_rate_all === 1);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [roomId, user, searchParams, navigate]);

  // 加载剧集列表
  useEffect(() => {
    if (!room?.anime_id) return;
    animeAPI.episodes(room.anime_id, room.category_id).then((res) => {
      setEpisodes(res.data.episodes || []);
    }).catch(() => {});
  }, [room?.anime_id, room?.category_id]);

  const changeEpisode = useCallback((epNum) => {
    const ep = episodes.find((e) => (e.number !== undefined ? e.number : e.sort + 1) === epNum);
    if (!ep) return;
    // 樱花动漫 m3u8 可直接播放
    const videoUrl = ep.m3u8_url || '';
    emit('video:change-episode', {
      roomId,
      episodeId: ep.episode_id,
      episodeNumber: epNum,
      videoUrl,
      animeTitle: room?.anime_title,
    });
    setCurrentEp(epNum);
    setShowEpisodes(false);
  }, [episodes, room, roomId, emit]);

  const handlePlay = useCallback(() => {
    const now = Date.now();
    if (now - lastSyncEmitRef.current < 800) return;
    lastSyncEmitRef.current = now;
    emit('video:sync', { roomId, currentTime: currentTimeRef.current, paused: false, userId: user?.id });
  }, [roomId, user, emit]);

  const handlePause = useCallback(() => {
    const now = Date.now();
    if (now - lastSyncEmitRef.current < 800) return;
    lastSyncEmitRef.current = now;
    emit('video:sync', { roomId, currentTime: currentTimeRef.current, paused: true, userId: user?.id });
  }, [roomId, user, emit]);

  const handleSeek = useCallback((time) => {
    currentTimeRef.current = time;
    const now = Date.now();
    if (now - lastSeekEmitRef.current < 1000) return;
    lastSeekEmitRef.current = now;
    emit('video:seek', { roomId, currentTime: time, userId: user?.id });
  }, [roomId, user, emit]);

  const handleRate = useCallback((rate) => {
    emit('video:rate', { roomId, rate, userId: user?.id });
  }, [roomId, user, emit]);

  const handleTimeUpdate = useCallback((time) => {
    currentTimeRef.current = time;
  }, []);

  const handleVideoSelect = useCallback((video) => {
    emit('video:change-episode', {
      roomId,
      episodeId: video.id,
      episodeNumber: 1,
      videoUrl: video.video_url,
      animeTitle: video.title,
    });
    setCurrentEp(1);
    setVideoSource('library');
  }, [roomId, emit]);

  // 房间内搜索番剧
  const handleRoomSearch = useCallback(async () => {
    if (!roomSearchQuery.trim()) return;
    setRoomSearching(true);
    try {
      const res = await animeAPI.search(roomSearchQuery.trim());
      setRoomSearchResults(res.data.list || []);
    } catch {
      setRoomSearchResults([]);
    } finally {
      setRoomSearching(false);
    }
  }, [roomSearchQuery]);

  // 房主在房间内切换番剧
  const handleSelectAnime = useCallback(async (anime) => {
    try {
      await roomAPI.update(roomId, {
        animeId: anime.vod_id,
        animeTitle: anime.name,
        categoryId: anime.category_id,
      });
      setRoom((prev) => ({ ...prev, anime_id: anime.vod_id, anime_title: anime.name, category_id: anime.category_id }));
      setCurrentEp(1);
      setEpisodes([]);
      setRoomSearchQuery('');
      setRoomSearchResults([]);
      // 广播给房间其他人
      emit('room:anime-change', {
        roomId,
        animeId: anime.vod_id,
        animeTitle: anime.name,
        categoryId: anime.category_id,
      });
    } catch (err) {
      console.error('切换番剧失败', err);
      alert('切换番剧失败');
    }
  }, [roomId, emit]);

  const handleShare = useCallback(() => {
    const url = window.location.origin + '/room/' + roomId;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomId]);

  const handleDeleteRoom = useCallback(async () => {
    try {
      await roomAPI.delete(roomId);
      leaveRoom(roomId);
      navigate('/', { replace: true });
    } catch (err) {
      alert('删除房间失败');
    }
  }, [roomId, leaveRoom, navigate]);

  const isOwner = room?.owner_id === user?.id;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">房间不存在或已关闭</p>
        <button onClick={() => navigate('/')} className="btn-primary mt-4">返回首页</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => { leaveRoom(roomId); navigate('/'); }} className="p-2 hover:bg-dark-600 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {room.name}
            <span className="text-gray-500 font-normal text-base ml-2">(ID: {roomId})</span>
          </h1>
          <p className="text-gray-400 text-sm">
            {room.anime_title || '未选择动漫'} · 第{currentEp}集 · 房主: {room.owner_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShare} className="btn-ghost flex items-center gap-1 text-sm" title="复制房间链接">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
            {copied ? '已复制!' : '分享'}
          </button>
          {isOwner && (
            <button onClick={() => setShowDeleteConfirm(true)} className="btn-ghost flex items-center gap-1 text-sm text-red-400 hover:text-red-300">
              <Trash2 className="w-4 h-4" /> 删除
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass p-6 rounded-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">确认删除房间</h3>
            <p className="text-gray-400 text-sm mb-4">
              确定要删除房间 "{room.name}" 吗？此操作不可撤销，房间内的所有用户将被移出。
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-ghost text-sm">取消</button>
              <button onClick={handleDeleteRoom} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">确认删除</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <VideoPlayer
            roomId={roomId}
            initialVideoUrl={room.video_url || ''}
            initialCurrentTime={room.current_time || 0}
            initialPaused={room.paused === 1}
            initialPlaybackRate={room.playback_rate || 1}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onRate={handleRate}
            onTimeUpdate={handleTimeUpdate}
            canPause={isOwner || allowPauseAll}
            canRate={isOwner || allowRateAll}
          />

          <div className="glass p-4">
            {/* 房主在房间内搜索并切换番剧 */}
            {isOwner && (
              <div className="mb-3">
                <div className="flex gap-2">
                  <input
                    value={roomSearchQuery}
                    onChange={(e) => setRoomSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRoomSearch()}
                    placeholder="搜索番剧并切换播放..."
                    className="input-field flex-1 text-sm py-2"
                  />
                  <button onClick={handleRoomSearch} disabled={roomSearching} className="btn-primary px-3 py-2 text-sm flex items-center gap-1">
                    <Search className="w-4 h-4" /> {roomSearching ? '搜索中' : '搜索'}
                  </button>
                </div>
                {roomSearchResults.length > 0 && (
                  <div className="mt-2 max-h-[260px] overflow-y-auto space-y-2">
                    {roomSearchResults.map((anime) => (
                      <div
                        key={anime.vod_id}
                        onClick={() => handleSelectAnime(anime)}
                        className="flex items-center gap-3 p-2 rounded-lg bg-dark-700/60 hover:bg-dark-600 cursor-pointer"
                      >
                        <img src={anime.pic} alt={anime.name} className="w-10 h-14 object-cover rounded shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 truncate">{anime.name}</p>
                          <p className="text-xs text-gray-500">{[anime.year, anime.region, anime.note].filter(Boolean).join(' · ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={() => setShowEpisodes(!showEpisodes)} className="flex items-center gap-2 text-sm font-medium">
              <List className="w-4 h-4" />
              <span>剧集列表（共{episodes.length}集）</span>
              <span className="text-gray-500 ml-auto">当前: 第{currentEp}集</span>
            </button>
            {showEpisodes && (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mt-3 max-h-[300px] overflow-y-auto">
                {episodes.map((ep) => {
                  const num = ep.number !== undefined ? ep.number : (ep.sort + 1);
                  return (
                    <button
                      key={ep.episode_id || ep.name}
                      onClick={() => changeEpisode(num)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        num === currentEp ? 'bg-primary-600 text-white' : 'bg-dark-600 hover:bg-dark-500 text-gray-300'
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <VoiceChat roomId={roomId} muted={mutedUsers.includes(user?.id)} />
        </div>

        <div className="space-y-4">
          {/* Video source toggle for owner */}
          {isOwner && (
            <div className="flex bg-dark-800 rounded-lg p-0.5">
              <button onClick={() => setVideoSource('anime')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${videoSource === 'anime' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                动漫剧集
              </button>
              <button onClick={() => setVideoSource('library')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${videoSource === 'library' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                我的视频
              </button>
            </div>
          )}

          {/* 房主权限管理面板 */}
          {isOwner && (
            <OwnerPanel
              roomId={roomId}
              ownerId={room.owner_id}
              bannedUsers={bannedUsers}
              mutedUsers={mutedUsers}
              allowPauseAll={allowPauseAll}
              allowRateAll={allowRateAll}
            />
          )}

          <UserList roomId={roomId} ownerId={room.owner_id} />
          <ChatBox roomId={roomId} muted={mutedUsers.includes(user?.id)} />

          {videoSource === 'library' && (
            <VideoLibrary onSelect={handleVideoSelect} onUploadClick={() => setShowUploader(true)} />
          )}
        </div>
      </div>

      <ActivityToast roomId={roomId} />

      {showUploader && (
        <VideoUploader onClose={() => setShowUploader(false)} onSuccess={() => setShowUploader(false)} />
      )}
    </div>
  );
}