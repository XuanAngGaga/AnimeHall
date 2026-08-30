import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { Lock, Maximize } from 'lucide-react';

export default function VideoPlayer({ roomId, initialVideoUrl, initialCurrentTime, initialPaused, initialPlaybackRate, onTimeUpdate, onPause, onPlay, onSeek, onRate, canPause = true, canRate = true }) {
  const artRef = useRef(null);
  const containerRef = useRef(null);
  const isRemoteUpdate = useRef(false);
  const remoteTimerRef = useRef(null);
  const { socket, on, off } = useSocket();
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const pendingTimeRef = useRef(initialCurrentTime);
  const pendingPausedRef = useRef(initialPaused);
  const pendingRateRef = useRef(initialPlaybackRate || 1);
  const lockedRateRef = useRef(initialPlaybackRate || 1); // 房主设定的锁定倍速
  const canPauseRef = useRef(canPause);
  const canRateRef = useRef(canRate);
  const enforcingRef = useRef(false); // 防止播放/暂停强制恢复时死循环

  // Keep refs in sync with latest props
  useEffect(() => {
    pendingTimeRef.current = initialCurrentTime;
    pendingPausedRef.current = initialPaused;
  }, [initialCurrentTime, initialPaused]);

  useEffect(() => {
    pendingRateRef.current = initialPlaybackRate || 1;
    lockedRateRef.current = initialPlaybackRate || 1;
  }, [initialPlaybackRate]);

  useEffect(() => {
    canPauseRef.current = canPause;
  }, [canPause]);

  useEffect(() => {
    canRateRef.current = canRate;
  }, [canRate]);

  // Mark remote update and auto-clear after a safe window.
  // Using a cumulative timer so each incoming remote event resets the cooldown.
  const markRemoteUpdate = useCallback(() => {
    isRemoteUpdate.current = true;
    if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
    remoteTimerRef.current = setTimeout(() => {
      isRemoteUpdate.current = false;
    }, 800);
  }, []);

  // Create ArtPlayer instance once
  useEffect(() => {
    if (!containerRef.current || artRef.current) return;

    const instance = new Artplayer({
      container: containerRef.current,
      url: videoUrl || '',
      autoplay: false,
      autoSize: true,
      autoMini: true,
      playbackRate: true,
      aspectRatio: true,
      setting: true,
      hotkey: true,
      pip: true,
      mutex: true,
      fullscreen: true,
      fullscreenWeb: true,
      theme: '#4c6ef5',
      lang: 'zh-cn',
      // 用 hls.js 处理 m3u8（ArtPlayer 5.x 不再内置 HLS）
      customType: {
        m3u8: function (video, url, art) {
          // 切换集数时先销毁旧实例，避免多个 hls 绑定同一 video
          if (art.hls) {
            art.hls.destroy();
            art.hls = null;
          }
          console.log('[VideoPlayer] 尝试加载 m3u8:', url, 'Hls.isSupported()=', Hls.isSupported(), 'isSecureContext=', window.isSecureContext);
          if (Hls.isSupported()) {
            const hls = new Hls();
            hls.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) {
                console.error('HLS 致命错误:', data.type, data.details, data);
                art.notice.show = '视频加载失败: ' + data.details;
              }
            });
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              console.log('HLS manifest 解析成功，共', hls.levels.length, '档清晰度');
            });
            hls.loadSource(url);
            hls.attachMedia(video);
            art.hls = hls;
            art.on('destroy', () => hls.destroy());
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari 原生 HLS
            video.src = url;
          } else if (!window.isSecureContext) {
            art.notice.show = '播放 m3u8 需通过 localhost 或 HTTPS 访问（当前非安全上下文，MSE 不可用）';
          } else {
            art.notice.show = '当前浏览器不支持播放此格式';
          }
        },
      },
    });

    instance.on('video:timeupdate', () => {
      if (isRemoteUpdate.current) return;
      onTimeUpdate?.(instance.currentTime);
    });

    instance.on('video:playing', () => {
      if (isRemoteUpdate.current) return;
      if (enforcingRef.current) return; // 强制执行引发的事件，忽略
      // 无播放权限（播放控制权被房主关闭）：强制暂停
      if (!canPauseRef.current) {
        enforcingRef.current = true;
        instance.pause();
        setTimeout(() => { enforcingRef.current = false; }, 150);
        instance.notice.show = '房主已关闭播放权限';
        return;
      }
      onPlay?.();
    });

    instance.on('video:pause', () => {
      if (isRemoteUpdate.current) return;
      if (enforcingRef.current) return; // 强制执行引发的事件，忽略
      // 无暂停权限（播放控制权被房主关闭）：强制恢复播放
      if (!canPauseRef.current) {
        enforcingRef.current = true;
        instance.play();
        setTimeout(() => { enforcingRef.current = false; }, 150);
        instance.notice.show = '房主已关闭暂停权限';
        return;
      }
      onPause?.();
    });

    instance.on('video:seek', () => {
      if (isRemoteUpdate.current) return;
      onSeek?.(instance.currentTime);
    });

    instance.on('video:ratechange', () => {
      if (isRemoteUpdate.current) return;
      // 无倍速权限：强制恢复到房主设定的锁定倍速
      if (!canRateRef.current) {
        const target = lockedRateRef.current || 1;
        if (Math.abs(instance.playbackRate - target) > 0.01) {
          // 直接操作 video 元素，绕过 ArtPlayer setter 的 notice 干扰
          instance.video.playbackRate = target;
          // 双重保险：下一帧再次确认，防止被后续逻辑覆盖
          setTimeout(() => {
            const art = artRef.current;
            if (art && art.video && Math.abs(art.video.playbackRate - target) > 0.01) {
              art.video.playbackRate = target;
            }
          }, 60);
        }
        instance.notice.show = '房主已关闭倍速权限';
        return;
      }
      onRate?.(instance.playbackRate);
    });

    // Apply initial time/pause/rate state once video is loaded
    instance.on('ready', () => {
      if (pendingRateRef.current !== 1) {
        instance.playbackRate = pendingRateRef.current;
      }
      if (pendingTimeRef.current > 0) {
        instance.currentTime = pendingTimeRef.current;
      }
      if (pendingPausedRef.current) {
        instance.pause();
      }
    });

    artRef.current = instance;

    return () => {
      instance.destroy();
      artRef.current = null;
      if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
    };
  }, []);

  // Update video source URL
  useEffect(() => {
    if (artRef.current && videoUrl) {
      artRef.current.url = videoUrl;
    }
  }, [videoUrl]);

  // Socket event listeners for remote sync
  useEffect(() => {
    if (!socket || !artRef.current) return;

    const handleSync = ({ currentTime, paused }) => {
      const art = artRef.current;
      if (!art) return;
      
      const diff = Math.abs(art.currentTime - currentTime);
      markRemoteUpdate();

      // Only seek if time gap is significant (> 1.5 seconds)
      // Otherwise just match the pause/play state
      if (diff > 1.5) {
        art.currentTime = currentTime;
      }
      if (paused) {
        art.pause();
      } else {
        art.play();
      }
    };

    const handleSeek = ({ currentTime }) => {
      const art = artRef.current;
      if (!art) return;

      const diff = Math.abs(art.currentTime - currentTime);
      // Only seek if time gap is significant
      if (diff > 1.5) {
        markRemoteUpdate();
        art.currentTime = currentTime;
      }
    };

    const handleChangeEpisode = ({ videoUrl: newUrl }) => {
      setVideoUrl(newUrl);
    };

    const handleRate = ({ rate }) => {
      const art = artRef.current;
      if (!art) return;
      // 记录房主设定的锁定倍速
      lockedRateRef.current = rate;
      markRemoteUpdate();
      art.playbackRate = rate;
    };

    const unsubs = [
      on('video:sync', handleSync),
      on('video:seek', handleSeek),
      on('video:change-episode', handleChangeEpisode),
      on('video:rate', handleRate),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [socket, on]);

  return (
    <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
      <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden bg-black" />
      {/* 无播放/暂停权限时，覆盖透明遮罩拦截鼠标交互 */}
      {!canPause && videoUrl && (
        <div className="absolute inset-0 z-[130] cursor-not-allowed">
          <div className="absolute top-3 right-3 bg-black/70 text-yellow-300 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 pointer-events-none">
            <Lock className="w-3.5 h-3.5" /> 播放已锁定
          </div>
          {/* 全屏按钮：穿透遮罩，正常可点击 */}
          <button
            onClick={() => {
              const art = artRef.current;
              if (art) art.fullscreen = !art.fullscreen;
            }}
            className="absolute bottom-3 right-3 p-2.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-colors"
            title="全屏"
          >
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      )}
      {!videoUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-dark-800/90 rounded-xl">
          <div className="text-center">
            <p className="text-gray-400 text-lg">等待视频源...</p>
            <p className="text-gray-600 text-sm mt-2">房主选择剧集后开始播放</p>
          </div>
        </div>
      )}
    </div>
  );
}