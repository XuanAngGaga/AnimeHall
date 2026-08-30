const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { initDb, getDb } = require('./db');
const setupSocket = require('./socket');

async function main() {
  // Initialize database (async for sql.js WASM loading)
  await initDb();
  const db = getDb();

  // Import routes after DB is ready
  const authRoutes = require('./routes/auth');
  const roomRoutes = require('./routes/rooms');
  const animeRoutes = require('./routes/anime');
  const adminRoutes = require('./routes/admin');
  const videoRoutes = require('./routes/videos');
  const settingsRoutes = require('./routes/settings');

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    maxHttpBufferSize: 1e8,
  });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Serve uploaded files
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/anime', animeRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/videos', videoRoutes);
  app.use('/api/settings', settingsRoutes);

  // Serve client build in production
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Expose io to routes via app settings
  app.set('io', io);

  // Socket.IO
  setupSocket(io);

  // Create or migrate admin user
  const existingAdmin = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
  if (!existingAdmin) {
    const hashed = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)').run(
      uuidv4(), 'admin', hashed, 'admin'
    );
    console.log('Default admin created: admin / admin123');
  } else if (existingAdmin.username === 'XuanAng') {
    // Migrate old admin username to admin
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run('admin', existingAdmin.id);
    console.log('Admin username migrated: XuanAng → admin');
  }

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log('AnimeSync server running on http://localhost:' + PORT);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});