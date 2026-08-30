const { getDb } = require('./db');
const { v4: uuidv4 } = require('uuid');

function setupSocket(io) {
  const onlineUsers = new Map();
  const voiceRooms = new Map();

  function getUserInfo(socketId) {
    return onlineUsers.get(socketId);
  }

  function isBanned(roomId, userId) {
    return getDb().prepare('SELECT 1 FROM room_bans WHERE room_id = ? AND user_id = ?').get(roomId, userId) !== undefined;
  }

  function isMuted(roomId, userId) {
    return getDb().prepare('SELECT 1 FROM room_mutes WHERE room_id = ? AND user_id = ?').get(roomId, userId) !== undefined;
  }

  function getRoom(roomId) {
    return getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  }

  function canControlPlayback(room, userId) {
    if (!room) return false;
    if (room.owner_id === userId) return true;
    return room.allow_pause_all === 1;
  }

  function canChangeRate(room, userId) {
    if (!room) return false;
    if (room.owner_id === userId) return true;
    return room.allow_rate_all === 1;
  }

  io.on('connection', (socket) => {
    console.log('User connected: ' + socket.id);

    // Room: Join
    socket.on('room:join', ({ roomId, userId, username }) => {
      console.log('[room:join]', roomId, username);
      const room = getRoom(roomId);
      if (!room) {
        socket.emit('room:error', { error: '房间不存在' });
        return;
      }
      // 封禁检查
      if (isBanned(roomId, userId)) {
        socket.emit('room:error', { error: '你已被房主封禁，无法加入该房间' });
        return;
      }

      socket.join(roomId);
      onlineUsers.set(socket.id, { userId, username, roomId });

      const existing = getDb().prepare('SELECT * FROM room_members WHERE room_id = ? AND user_id = ?').get(roomId, userId);
      if (!existing) {
        getDb().prepare('INSERT INTO room_members (id, room_id, user_id) VALUES (?, ?, ?)').run(uuidv4(), roomId, userId);
      }

      const bannedUsers = getDb().prepare('SELECT user_id FROM room_bans WHERE room_id = ?').all(roomId).map(r => r.user_id);
      const mutedUsers = getDb().prepare('SELECT user_id FROM room_mutes WHERE room_id = ?').all(roomId).map(r => r.user_id);

      socket.emit('room:state', {
        room,
        currentTime: room.current_time,
        paused: room.paused === 1,
        episodeId: room.episode_id,
        episodeNumber: room.episode_number,
        videoUrl: room.video_url,
        playbackRate: room.playback_rate || 1,
        allowPauseAll: room.allow_pause_all === 1,
        allowRateAll: room.allow_rate_all === 1,
        bannedUsers,
        mutedUsers,
      });

      const messages = getDb().prepare(
        'SELECT * FROM chat_messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 50'
      ).all(roomId).reverse();
      socket.emit('chat:history', messages);

      const members = getDb().prepare('SELECT u.username, u.id FROM room_members rm JOIN users u ON rm.user_id = u.id WHERE rm.room_id = ?').all(roomId);
      io.to(roomId).emit('room:user-joined', { userId, username });
      io.to(roomId).emit('room:members', members);
    });

    // Room: Leave
    socket.on('room:leave', ({ roomId, userId }) => {
      console.log('[room:leave]', roomId, userId);
      socket.leave(roomId);
      onlineUsers.delete(socket.id);
      getDb().prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(roomId, userId);
      const members = getDb().prepare('SELECT u.username, u.id FROM room_members rm JOIN users u ON rm.user_id = u.id WHERE rm.room_id = ?').all(roomId);
      io.to(roomId).emit('room:user-left', { userId });
      io.to(roomId).emit('room:members', members);
    });

    // Video Sync: Play/Pause (权限检查)
    socket.on('video:sync', ({ roomId, currentTime, paused, userId }) => {
      const room = getRoom(roomId);
      if (!canControlPlayback(room, userId)) return; // 无权限，忽略
      getDb().prepare('UPDATE rooms SET current_time = ?, paused = ? WHERE id = ?').run(currentTime, paused ? 1 : 0, roomId);
      const userInfo = getUserInfo(socket.id);
      socket.to(roomId).emit('video:sync', { currentTime, paused, userId, username: userInfo?.username || '' });
    });

    // Video: Seek (权限检查)
    socket.on('video:seek', ({ roomId, currentTime, userId }) => {
      const room = getRoom(roomId);
      if (!canControlPlayback(room, userId)) return;
      getDb().prepare('UPDATE rooms SET current_time = ? WHERE id = ?').run(currentTime, roomId);
      const userInfo = getUserInfo(socket.id);
      socket.to(roomId).emit('video:seek', { currentTime, userId, username: userInfo?.username || '' });
    });

    // Video: Playback Rate (权限检查)
    socket.on('video:rate', ({ roomId, rate, userId }) => {
      const room = getRoom(roomId);
      if (!canChangeRate(room, userId)) return;
      getDb().prepare('UPDATE rooms SET playback_rate = ? WHERE id = ?').run(rate, roomId);
      const userInfo = getUserInfo(socket.id);
      socket.to(roomId).emit('video:rate', { rate, userId, username: userInfo?.username || '' });
    });

    // Room: 房主切换番剧（广播给其他人）
    socket.on('room:anime-change', ({ roomId, animeId, animeTitle, categoryId }) => {
      const room = getRoom(roomId);
      const userInfo = getUserInfo(socket.id);
      if (!room || room.owner_id !== userInfo?.userId) return;
      getDb().prepare('UPDATE rooms SET anime_id = ?, anime_title = ?, category_id = ? WHERE id = ?')
        .run(animeId, animeTitle, categoryId || '', roomId);
      socket.to(roomId).emit('room:anime-changed', { animeId, animeTitle, categoryId });
    });

    // Video: Change Episode (仅房主)
    socket.on('video:change-episode', ({ roomId, episodeId, episodeNumber, videoUrl, animeTitle }) => {
      const room = getRoom(roomId);
      const userInfo = getUserInfo(socket.id);
      if (!room || room.owner_id !== userInfo?.userId) return;
      getDb().prepare(
        'UPDATE rooms SET episode_id = ?, episode_number = ?, video_url = ?, anime_title = ?, current_time = 0, paused = 1 WHERE id = ?'
      ).run(episodeId, episodeNumber, videoUrl, animeTitle || '', roomId);
      io.to(roomId).emit('video:change-episode', { episodeId, episodeNumber, videoUrl, animeTitle });
    });

    // Chat (禁言检查)
    socket.on('chat:message', ({ roomId, userId, username, message }) => {
      if (isMuted(roomId, userId)) {
        socket.emit('chat:blocked', { error: '你已被房主禁言' });
        return;
      }
      const msgId = uuidv4();
      const msg = { id: msgId, roomId, userId, username, message, created_at: new Date().toISOString() };
      getDb().prepare('INSERT INTO chat_messages (id, room_id, user_id, username, message) VALUES (?, ?, ?, ?, ?)').run(
        msgId, roomId, userId, username, message
      );
      io.to(roomId).emit('chat:message', msg);
    });

    // Voice Chat (禁言检查)
    socket.on('voice:join', ({ roomId, userId }) => {
      if (isMuted(roomId, userId)) {
        socket.emit('voice:blocked', { error: '你已被房主禁言，无法加入语音' });
        return;
      }
      if (!voiceRooms.has(roomId)) voiceRooms.set(roomId, new Set());
      voiceRooms.get(roomId).add(socket.id);
      socket.join('voice:' + roomId);
      socket.to('voice:' + roomId).emit('voice:user-joined', { userId, socketId: socket.id });
      const participants = [];
      voiceRooms.get(roomId).forEach(sid => {
        const user = onlineUsers.get(sid);
        if (user && sid !== socket.id) participants.push({ socketId: sid, userId: user.userId, username: user.username });
      });
      socket.emit('voice:participants', participants);
    });

    socket.on('voice:leave', ({ roomId }) => {
      if (voiceRooms.has(roomId)) {
        voiceRooms.get(roomId).delete(socket.id);
        socket.leave('voice:' + roomId);
        socket.to('voice:' + roomId).emit('voice:user-left', { socketId: socket.id });
      }
    });

    socket.on('voice:signal', ({ roomId, to, from, signal }) => {
      io.to(to).emit('voice:signal', { from, signal });
    });

    // Room: Kick User (仅房主)
    socket.on('room:kick', ({ roomId, targetUserId }) => {
      const room = getRoom(roomId);
      const userInfo = getUserInfo(socket.id);
      if (!room || room.owner_id !== userInfo?.userId) return;
      io.to(roomId).emit('room:kicked', { userId: targetUserId });
      getDb().prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(roomId, targetUserId);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected: ' + socket.id);
      const user = onlineUsers.get(socket.id);
      if (user && user.roomId) {
        socket.leave(user.roomId);
        getDb().prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(user.roomId, user.userId);
        const members = getDb().prepare('SELECT u.username, u.id FROM room_members rm JOIN users u ON rm.user_id = u.id WHERE rm.room_id = ?').all(user.roomId);
        io.to(user.roomId).emit('room:user-left', { userId: user.userId });
        io.to(user.roomId).emit('room:members', members);
      }
      voiceRooms.forEach((sockets, roomId) => {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          socket.to('voice:' + roomId).emit('voice:user-left', { socketId: socket.id });
        }
      });
      onlineUsers.delete(socket.id);
    });
  });
}

module.exports = setupSocket;