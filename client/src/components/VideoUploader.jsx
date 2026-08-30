import { useState, useRef, useCallback } from 'react';
import { videoAPI } from '../utils/api';
import { useSettings } from '../context/SettingsContext';
import { Upload, Link, X, FileVideo, Loader } from 'lucide-react';

export default function VideoUploader({ onClose, onSuccess }) {
  const { settings } = useSettings();
  const allowFileUpload = settings.allow_video_upload !== '0';
  const [mode, setMode] = useState(allowFileUpload ? 'file' : 'url'); // 'file' | 'url'
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState(null);
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0] || e.target.files?.[0];
    if (f) {
      if (!f.name.match(/\.(mp4|webm|mkv|mov|avi)$/i)) {
        setError('Only video files allowed (.mp4, .webm, .mkv, .mov, .avi)');
        return;
      }
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
      setError('');
    }
  }, [title]);

  const handleUpload = async () => {
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }

    if (mode === 'file' && !file) { setError('Please select a video file'); return; }
    if (mode === 'url' && !videoUrl.trim()) { setError('Please enter a video URL'); return; }

    setUploading(true);
    setProgress(0);

    try {
      if (mode === 'file') {
        const formData = new FormData();
        formData.append('video', file);
        formData.append('title', title.trim());
        formData.append('description', description.trim());
        formData.append('isPublic', isPublic);
        await videoAPI.upload(formData, (e) => {
          setProgress(Math.round((e.loaded / e.total) * 100));
        });
      } else {
        await videoAPI.saveUrl({
          title: title.trim(),
          description: description.trim(),
          videoUrl: videoUrl.trim(),
          isPublic,
        });
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-dark-700 border border-dark-500 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary-400" /> 上传视频
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-dark-600 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm mb-4">{error}</div>}

        {/* Mode Tabs */}
        {allowFileUpload ? (
          <div className="flex mb-4 bg-dark-800 rounded-lg p-1">
            <button onClick={() => { setMode('file'); setError(''); }} className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'file' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <FileVideo className="w-4 h-4 inline mr-1" /> 上传文件
            </button>
            <button onClick={() => { setMode('url'); setError(''); }} className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'url' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <Link className="w-4 h-4 inline mr-1" /> 视频链接
            </button>
          </div>
        ) : (
          <p className="text-xs text-yellow-400 mb-4">管理员已关闭文件上传，仅支持视频链接</p>
        )}

        {/* Title */}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="视频标题 *" className="input-field mb-3" maxLength={100} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="视频简介（可选）" className="input-field mb-4 resize-none h-16" maxLength={300} />

        {/* File Upload Area */}
        {mode === 'file' && (
          <div
            className="border-2 border-dashed border-dark-500 rounded-xl p-8 text-center mb-4 hover:border-primary-500/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
          >
            {file ? (
              <div className="space-y-2">
                <FileVideo className="w-10 h-10 text-primary-400 mx-auto" />
                <p className="text-sm font-medium text-gray-200">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-10 h-10 text-gray-500 mx-auto" />
                <p className="text-sm text-gray-400">点击选取或拖拽文件</p>
                <p className="text-xs text-gray-600">最大 500MB · .mp4, .webm, .mkv, .mov, .avi</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileDrop} />
          </div>
        )}

        {/* URL Input */}
        {mode === 'url' && (
          <div className="mb-4">
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="粘贴视频链接 (mp4, m3u8 等)" className="input-field" />
            <p className="text-xs text-gray-600 mt-1">视频文件或流媒体的直链地址</p>
          </div>
        )}

        {/* Public toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-400 mb-4 cursor-pointer">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="rounded bg-dark-600 border-dark-500" />
          允许其他用户在房间中使用此视频
        </label>

        {/* Progress */}
        {uploading && (
          <div className="mb-4">
            <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
              <div className="h-full bg-primary-600 transition-all duration-300" style={{ width: progress + '%' }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">已上传 {progress}%</p>
          </div>
        )}

        {/* Submit */}
        <button onClick={handleUpload} disabled={uploading} className="btn-primary w-full">
          {uploading ? <Loader className="w-4 h-4 inline animate-spin mr-2" /> : null}
          {uploading ? '上传中...' : mode === 'file' ? '上传视频' : '保存视频'}
        </button>
      </div>
    </div>
  );
}