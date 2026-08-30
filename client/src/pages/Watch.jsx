import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { roomAPI, animeAPI } from '../utils/api';
import VideoPlayer from '../components/VideoPlayer';
import ChatBox from '../components/ChatBox';
import VoiceChat from '../components/VoiceChat';
import UserList from '../components/UserList';
import VideoLibrary from '../components/VideoLibrary';
import VideoUploader from '../components/VideoUploader';
import ActivityToast from '../components/ActivityToast';
import { ArrowLeft, Users, MessageSquare, Phone, Upload, Share2, Check } from 'lucide-react';

export default function Watch() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, joinRoom, leaveRoom, emit, on, off } = useSocket();
  const [room, setRoom] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [currentEp, setCurrentEp] = useState(1);
  const [animeTitle, setAnimeTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [showUsers, setShowUsers] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [videoSource, setVideoSource] = useState('anime');
  const [copied, setCopied] = useState(false);
  const currentTimeRef = useRef(0);

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

  useEffect(() => {
    if (!user || !roomId) return;
    joinRoom(roomId);
    return () => leaveRoom(roomId);
  }, [roomId, user]);

  useEffect(() => {
    if (!socket) return;

    const handleState = (state) => {
      setRoom(state.room);
      setCurrentEp(state.episodeNumber || 1);
      setAnimeTitle(state.room?.anime_title || '');
      setVideoUrl(state.videoUrl || '');
      currentTimeRef.current = state.currentTime || 0;
    };

    const handleChangeEpisode = ({ episodeNumber, videoUrl: newUrl, animeTitle: title }) => {
      setCurrentEp(episodeNumber);
      setVideoUrl(newUrl);
      if (title) setAnimeTitle(title);
      currentTimeRef.current = 0;
    };

    const unsub1 = on('room:state', handleState);
    const unsub2 = on('video:change-episode', handleChangeEpisode);

    roomAPI.get(roomId).then((res) => {
      setRoom(res.data);
      setCurrentEp(res.data.episode_number || 1);
      setAnimeTitle(res.data.anime_title || '');
      setVideoUrl(res.data.video_url || '');
      if (res.data.anime_id) {
        animeAPI.episodes(res.data.anime_id).then((r) => setEpisodes(r.data.episodes || [])).catch(() => {});
      }
    }).catch(() => {});

    return () => { unsub1(); unsub2(); };
  }, [socket, roomId, on]);

  const handlePlay = useCallback(() => {
    emit('video:sync', { roomId, currentTime: currentTimeRef.current, paused: false, userId: user?.id });
  }, [roomId, user, emit]);

  const handlePause = useCallback(() => {
    emit('video:sync', { roomId, currentTime: currentTimeRef.current, paused: true, userId: user?.id });
  }, [roomId, user, emit]);

  const handleSeek = useCallback((time) => {
    currentTimeRef.current = time;
    emit('video:seek', { roomId, currentTime: time, userId: user?.id });
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
    setAnimeTitle(video.title);
    setVideoUrl(video.video_url);
    setVideoSource('library');
  }, [roomId, emit]);

  const changeEpisode = async (epNum) => {
    const ep = episodes.find((e) => e.number === epNum);
    if (!ep) return;
    try {
      const watchRes = await animeAPI.watch(ep.id);
      const sources = watchRes.data.sources || [];
      const url = sources.find((s) => s.quality === 'default' || s.quality === '720p')?.url || sources[0]?.url || '';
      emit('video:change-episode', {
        roomId,
        episodeId: ep.id,
        episodeNumber: epNum,
        videoUrl: url,
        animeTitle,
      });
      setCurrentEp(epNum);
      currentTimeRef.current = 0;
    } catch (err) {
      console.error('Failed to load episode:', err);
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="bg-dark-800 border-b border-dark-600 px-4 py-2 flex items-center gap-3 shrink-0">
        <button onClick={() => { leaveRoom(roomId); navigate('/room/' + roomId); }} className="p-1.5 hover:bg-dark-600 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">
            {room?.name || '加载中...'}
            <span className="text-gray-500 font-normal ml-1.5">(ID: {roomId})</span>
          </h2>
          <p className="text-xs text-gray-400 truncate">{animeTitle} · 第{currentEp}集</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleShare}
            className="p-1.5 rounded-lg hover:bg-dark-600 text-gray-400"
            title="复制房间链接"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
          </button>
          <button onClick={() => setShowChat(!showChat)} className={`p-1.5 rounded-lg ${showChat ? 'bg-primary-600/30 text-primary-400' : 'hover:bg-dark-600 text-gray-400'}`}>
            <MessageSquare className="w-4 h-4" />
          </button>
          <button onClick={() => setShowUsers(!showUsers)} className={`p-1.5 rounded-lg ${showUsers ? 'bg-primary-600/30 text-primary-400' : 'hover:bg-dark-600 text-gray-400'}`}>
            <Users className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative bg-black">
          <VideoPlayer
            roomId={roomId}
            initialVideoUrl={videoUrl}
            initialCurrentTime={currentTimeRef.current}
            initialPaused={true}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onTimeUpdate={handleTimeUpdate}
          />

          <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 overflow-x-auto pb-2">
            {episodes.slice(0, 30).map((ep) => (
              <button
                key={ep.id || ep.number}
                onClick={() => changeEpisode(ep.number)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md transition-colors ${
                  ep.number === currentEp
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-800/80 text-gray-300 hover:bg-dark-700/80'
                }`}
              >
                第{ep.number}集
              </button>
            ))}
          </div>
        </div>

        {showChat && (
          <div className="w-80 shrink-0 border-l border-dark-600 flex flex-col bg-dark-800">
            <div className="flex-1 overflow-hidden">
              <ChatBox roomId={roomId} />
            </div>
          </div>
        )}

        {showUsers && (
          <div className="w-64 shrink-0 border-l border-dark-600 bg-dark-800 p-3 overflow-y-auto">
            <UserList roomId={roomId} ownerId={room?.owner_id} />
            <div className="mt-4">
              <VoiceChat roomId={roomId} />
            </div>

            {/* Video source toggle */}
            {room?.owner_id === user?.id && (
              <div className="mt-4 flex bg-dark-700 rounded-lg p-0.5">
                <button onClick={() => setVideoSource('anime')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${videoSource === 'anime' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                  动漫
                </button>
                <button onClick={() => setVideoSource('library')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${videoSource === 'library' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                  我的视频
                </button>
              </div>
            )}

            {videoSource === 'library' && (
              <div className="mt-4">
                <VideoLibrary
                  onSelect={handleVideoSelect}
                  onUploadClick={() => setShowUploader(true)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast notifications */}
      <ActivityToast roomId={roomId} />

      {/* Upload Modal */}
      {showUploader && (
        <VideoUploader
          onClose={() => setShowUploader(false)}
          onSuccess={() => setShowUploader(false)}
        />
      )}
    </div>
  );
}
