const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'anime-sync-secret-key-2024';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(mp4|webm|mkv|mov|avi|m3u8|mpd)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed (.mp4, .webm, .mkv, .mov, .avi, .m3u8, .mpd)'));
    }
  },
});

// Auth middleware
function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : '';
}

// Upload video file
router.post('/upload', authMiddleware, upload.single('video'), (req, res) => {
  try {
    const { title, description, isPublic } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    // 检查是否允许上传文件
    if (req.file && getSetting('allow_video_upload') === '0') {
      if (req.file.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      return res.status(403).json({ error: '管理员已禁止上传视频文件，请使用视频链接' });
    }

    const id = uuidv4();
    let videoUrl = '';
    let filePath = '';

    if (req.file) {
      // File uploaded
      filePath = 'uploads/' + req.file.filename;
      videoUrl = '/' + filePath; // relative URL served by express static
    } else if (req.body.videoUrl) {
      // URL provided
      videoUrl = req.body.videoUrl;
    } else {
      return res.status(400).json({ error: 'No video file or URL provided' });
    }

    const fileSize = req.file ? req.file.size : 0;
    const thumbnailUrl = req.body.thumbnailUrl || '';

    getDb().prepare(
      'INSERT INTO user_videos (id, user_id, title, description, video_url, thumbnail_url, file_path, file_size, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, req.user.id, title, description || '', videoUrl, thumbnailUrl, filePath, fileSize, isPublic ? 1 : 0);

    res.json({
      id,
      title,
      videoUrl,
      message: req.file ? 'File uploaded successfully' : 'Video URL saved',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save video URL only (no file)
router.post('/url', authMiddleware, (req, res) => {
  try {
    const { title, description, videoUrl, thumbnailUrl, isPublic } = req.body;
    if (!title || !videoUrl) return res.status(400).json({ error: 'Title and video URL are required' });

    const id = uuidv4();
    getDb().prepare(
      'INSERT INTO user_videos (id, user_id, title, description, video_url, thumbnail_url, is_public) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, req.user.id, title, description || '', videoUrl, thumbnailUrl || '', isPublic ? 1 : 0);

    res.json({ id, title, videoUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's videos
router.get('/', authMiddleware, (req, res) => {
  try {
    const videos = getDb().prepare(
      'SELECT * FROM user_videos WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get public videos (for room selection)
router.get('/public', (req, res) => {
  try {
    const videos = getDb().prepare(
      'SELECT uv.*, u.username as owner_name FROM user_videos uv JOIN users u ON uv.user_id = u.id WHERE uv.is_public = 1 ORDER BY uv.created_at DESC LIMIT 50'
    ).all();
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single video
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const video = getDb().prepare('SELECT * FROM user_videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json(video);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete video
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const video = getDb().prepare('SELECT * FROM user_videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    if (video.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete file if it's a local upload
    if (video.file_path) {
      const filePath = path.join(__dirname, '..', '..', video.file_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    getDb().prepare('DELETE FROM user_videos WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;