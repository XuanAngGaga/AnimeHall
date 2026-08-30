const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'anime-sync-secret-key-2024';

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  },
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件 (.png, .jpg, .jpeg, .gif, .webp, .svg, .ico)'));
    }
  },
});

function getSettings() {
  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach((r) => { obj[r.key] = r.value; });
  return obj;
}

function adminMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// 公开读取站点设置
router.get('/', (req, res) => {
  res.json(getSettings());
});

// 管理员修改站点设置
router.put('/', adminMiddleware, (req, res) => {
  const allowed = ['site_name', 'site_icon', 'site_background', 'blur_amount', 'home_title', 'home_subtitle', 'allow_video_upload', 'require_invite_code', 'require_email_verify', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure', 'smtp_from', 'smtp_proxy'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
        .run(key, String(req.body[key]));
    }
  }
  res.json(getSettings());
});

// 上传站点图标/背景图（管理员）
router.post('/upload', adminMiddleware, imageUpload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '未收到文件' });
    const url = '/uploads/' + req.file.filename;
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;