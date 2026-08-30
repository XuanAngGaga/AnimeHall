const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'anime-sync-secret-key-2024';

function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// 生成 6 位数字房间 ID（保证唯一）
function generateRoomId() {
  for (let i = 0; i < 100; i++) {
    const id = String(Math.floor(100000 + Math.random() * 900000));
    const existing = getDb().prepare('SELECT id FROM rooms WHERE id = ?').get(id);
    if (!existing) return id;
  }
  // 极端冲突兜底：时间戳后 6 位
  return String(Date.now() % 1000000).padStart(6, '0');
}

// Get all public rooms
router.get('/', (req, res) => {
  const rooms = getDb().prepare(
    'SELECT r.*, u.username as owner_name, (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count FROM rooms r JOIN users u ON r.owner_id = u.id WHERE r.is_public = 1 ORDER BY r.created_at DESC'
  ).all();
  res.json(rooms);
});

// Create room
router.post('/', authMiddleware, (req, res) => {
  try {
    const { name, description, animeId, animeTitle, categoryId, isPublic, maxUsers } = req.body;
    const id = generateRoomId();
    getDb().prepare(
      'INSERT INTO rooms (id, name, description, owner_id, anime_id, anime_title, category_id, is_public, max_users) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name, description || '', req.user.id, animeId || '', animeTitle || '', categoryId || '', isPublic !== false ? 1 : 0, maxUsers || 20);
    res.json({ id, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get room by ID
router.get('/:id', (req, res) => {
  const room = getDb().prepare(
    'SELECT r.*, u.username as owner_name FROM rooms r JOIN users u ON r.owner_id = u.id WHERE r.id = ?'
  ).get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const members = getDb().prepare(
    'SELECT u.id, u.username, u.avatar FROM room_members rm JOIN users u ON rm.user_id = u.id WHERE rm.room_id = ?'
  ).all(req.params.id);
  const bans = getDb().prepare('SELECT user_id FROM room_bans WHERE room_id = ?').all(req.params.id).map(r => r.user_id);
  const mutes = getDb().prepare('SELECT user_id FROM room_mutes WHERE room_id = ?').all(req.params.id).map(r => r.user_id);
  res.json({ ...room, members, bannedUsers: bans, mutedUsers: mutes });
});

// Owner check helper
function isOwner(room, req) {
  return room && (room.owner_id === req.user.id || req.user.role === 'admin');
}

// Ban user (owner only)
router.post('/:id/ban', authMiddleware, async (req, res) => {
  const room = getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!isOwner(room, req)) return res.status(403).json({ error: '仅房主可操作' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: '缺少用户' });
  getDb().prepare('INSERT OR REPLACE INTO room_bans (id, room_id, user_id, banned_by) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), req.params.id, userId, req.user.id);
  getDb().prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(req.params.id, userId);
  const io = req.app.get('io');
  if (io) {
    io.to(req.params.id).emit('room:user-banned', { roomId: req.params.id, userId });
    // 强制断开被封禁用户的 socket，防止其继续在房间内操作
    try {
      const sockets = await io.in(req.params.id).fetchSockets();
      for (const s of sockets) {
        if (s.data.userId === userId) {
          s.disconnect(true);
        }
      }
    } catch (e) {}
  }
  res.json({ success: true });
});

// Unban user
router.post('/:id/unban', authMiddleware, (req, res) => {
  const room = getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!isOwner(room, req)) return res.status(403).json({ error: '仅房主可操作' });
  const { userId } = req.body;
  getDb().prepare('DELETE FROM room_bans WHERE room_id = ? AND user_id = ?').run(req.params.id, userId);
  const io = req.app.get('io');
  if (io) io.to(req.params.id).emit('room:user-unbanned', { roomId: req.params.id, userId });
  res.json({ success: true });
});

// Mute user
router.post('/:id/mute', authMiddleware, (req, res) => {
  const room = getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!isOwner(room, req)) return res.status(403).json({ error: '仅房主可操作' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: '缺少用户' });
  getDb().prepare('INSERT OR REPLACE INTO room_mutes (id, room_id, user_id, muted_by) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), req.params.id, userId, req.user.id);
  const io = req.app.get('io');
  if (io) io.to(req.params.id).emit('room:user-muted', { roomId: req.params.id, userId });
  res.json({ success: true });
});

// Unmute user
router.post('/:id/unmute', authMiddleware, (req, res) => {
  const room = getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!isOwner(room, req)) return res.status(403).json({ error: '仅房主可操作' });
  const { userId } = req.body;
  getDb().prepare('DELETE FROM room_mutes WHERE room_id = ? AND user_id = ?').run(req.params.id, userId);
  const io = req.app.get('io');
  if (io) io.to(req.params.id).emit('room:user-unmuted', { roomId: req.params.id, userId });
  res.json({ success: true });
});

// Update permissions (pause/rate for all)
router.patch('/:id/permissions', authMiddleware, (req, res) => {
  const room = getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!isOwner(room, req)) return res.status(403).json({ error: '仅房主可操作' });
  const { allowPauseAll, allowRateAll } = req.body;
  getDb().prepare('UPDATE rooms SET allow_pause_all = ?, allow_rate_all = ? WHERE id = ?')
    .run(
      allowPauseAll !== undefined ? (allowPauseAll ? 1 : 0) : room.allow_pause_all,
      allowRateAll !== undefined ? (allowRateAll ? 1 : 0) : room.allow_rate_all,
      req.params.id
    );
  const io = req.app.get('io');
  if (io) io.to(req.params.id).emit('room:permissions', { allowPauseAll, allowRateAll });
  res.json({ success: true });
});

// Delete room
router.delete('/:id', authMiddleware, (req, res) => {
  const room = getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  getDb().prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
  // Notify all users in the room via socket so they get redirected
  const io = req.app.get('io');
  if (io) {
    io.to(req.params.id).emit('room:deleted', { roomId: req.params.id });
    // Force-disconnect sockets in this room by server-side leave
    io.in(req.params.id).disconnectSockets(true);
  }
  res.json({ success: true });
});

// Update room settings
router.patch('/:id', authMiddleware, (req, res) => {
  const room = getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const { name, description, isPublic, maxUsers, animeId, animeTitle, categoryId } = req.body;
  getDb().prepare(
    'UPDATE rooms SET name = COALESCE(?, name), description = COALESCE(?, description), is_public = COALESCE(?, is_public), max_users = COALESCE(?, max_users), anime_id = COALESCE(?, anime_id), anime_title = COALESCE(?, anime_title), category_id = COALESCE(?, category_id) WHERE id = ?'
  ).run(name || null, description || null, isPublic !== undefined ? (isPublic ? 1 : 0) : null, maxUsers || null, animeId || null, animeTitle || null, categoryId || null, req.params.id);
  res.json({ success: true });
});

module.exports = router;
