const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'anime-sync-secret-key-2024';

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

// Dashboard stats
router.get('/stats', adminMiddleware, (req, res) => {
  const totalUsers = getDb().prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalRooms = getDb().prepare('SELECT COUNT(*) as count FROM rooms').get().count;
  const totalMessages = getDb().prepare('SELECT COUNT(*) as count FROM chat_messages').get().count;
  const activeRooms = getDb().prepare('SELECT COUNT(DISTINCT room_id) as count FROM room_members').get().count;
  const bannedUsers = getDb().prepare('SELECT COUNT(*) as count FROM users WHERE banned = 1').get().count;
  res.json({ totalUsers, totalRooms, totalMessages, activeRooms, bannedUsers });
});

// Get all users
router.get('/users', adminMiddleware, (req, res) => {
  const users = getDb().prepare('SELECT id, username, email, role, avatar, created_at, banned FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

// Ban user
router.post('/users/:id/ban', adminMiddleware, (req, res) => {
  const { reason } = req.body;
  getDb().prepare('UPDATE users SET banned = 1 WHERE id = ?').run(req.params.id);
  getDb().prepare('INSERT INTO bans (id, user_id, banned_by, reason) VALUES (?, ?, ?, ?)').run(
    uuidv4(), req.params.id, req.user.id, reason || ''
  );
  res.json({ success: true });
});

// Unban user
router.post('/users/:id/unban', adminMiddleware, (req, res) => {
  getDb().prepare('UPDATE users SET banned = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Delete user
router.delete('/users/:id', adminMiddleware, (req, res) => {
  getDb().prepare('DELETE FROM users WHERE id = ? AND role != ?').run(req.params.id, 'admin');
  res.json({ success: true });
});

// Change any user's password (admin only)
router.post('/users/:id/password', adminMiddleware, (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: '密码至少需要6位' });
    }
    const hashed = bcrypt.hashSync(password, 10);
    getDb().prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all rooms (admin)
router.get('/rooms', adminMiddleware, (req, res) => {
  const rooms = getDb().prepare(
    'SELECT r.*, u.username as owner_name, (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count FROM rooms r JOIN users u ON r.owner_id = u.id ORDER BY r.created_at DESC'
  ).all();
  res.json(rooms);
});

// Delete any room (admin)
router.delete('/rooms/:id', adminMiddleware, (req, res) => {
  getDb().prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Get room messages (admin)
router.get('/rooms/:id/messages', adminMiddleware, (req, res) => {
  const messages = getDb().prepare(
    'SELECT * FROM chat_messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 200'
  ).all(req.params.id);
  res.json(messages.reverse());
});

// Generate invite codes
router.post('/invites/generate', adminMiddleware, (req, res) => {
  try {
    const { count = 1 } = req.body;
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
      const id = uuidv4();
      getDb().prepare('INSERT INTO invite_codes (id, code, created_by) VALUES (?, ?, ?)').run(id, code, req.user.id);
      codes.push(code);
    }
    res.json({ codes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all invite codes
router.get('/invites', adminMiddleware, (req, res) => {
  try {
    const invites = getDb().prepare(
      'SELECT ic.*, u.username as created_by_name, u2.username as used_by_name FROM invite_codes ic LEFT JOIN users u ON ic.created_by = u.id LEFT JOIN users u2 ON ic.used_by = u2.id ORDER BY ic.created_at DESC'
    ).all();
    res.json(invites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an invite code
router.delete('/invites/:id', adminMiddleware, (req, res) => {
  try {
    getDb().prepare('DELETE FROM invite_codes WHERE id = ? AND used = 0').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
