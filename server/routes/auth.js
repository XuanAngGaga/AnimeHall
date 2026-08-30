const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const svgCaptcha = require('svg-captcha');
const nodemailer = require('nodemailer');
const net = require('net');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'anime-sync-secret-key-2024';

// In-memory captcha store: token -> { text, expires }
const captchaStore = new Map();

// In-memory email code store: email -> { code, expires }
const emailCodeStore = new Map();

function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : '';
}

// 通过 HTTP CONNECT 代理建立到 SMTP 服务器的隧道 socket
function createProxySocket(proxyUrl, targetHost, targetPort) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(proxyUrl);
    } catch (e) {
      return reject(new Error('代理地址格式错误'));
    }
    const proxyHost = u.hostname;
    const proxyPort = parseInt(u.port || '8080', 10);
    const auth = u.username ? Buffer.from(decodeURIComponent(u.username) + ':' + decodeURIComponent(u.password)).toString('base64') : '';

    const socket = net.connect(proxyPort, proxyHost);
    let buffer = '';
    let settled = false;

    socket.on('connect', () => {
      let req = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n`;
      if (auth) req += `Proxy-Authorization: Basic ${auth}\r\n`;
      req += '\r\n';
      socket.write(req);
    });

    socket.on('data', (data) => {
      buffer += data.toString();
      if (buffer.includes('\r\n\r\n') && !settled) {
        const statusLine = buffer.split('\r\n')[0] || '';
        if (statusLine.includes(' 200 ')) {
          settled = true;
          socket.removeAllListeners('data');
          resolve(socket);
        } else {
          settled = true;
          socket.destroy();
          reject(new Error('代理 CONNECT 失败: ' + statusLine));
        }
      }
    });

    socket.on('error', (err) => {
      if (!settled) reject(err);
    });
    socket.setTimeout(20000, () => {
      if (!settled) { socket.destroy(); reject(new Error('代理连接超时')); }
    });
  });
}

function createMailTransporter() {
  const host = getSetting('smtp_host');
  if (!host) return null;
  const port = parseInt(getSetting('smtp_port') || '465', 10);
  const secure = getSetting('smtp_secure') !== '0'; // 默认 SSL
  const proxyUrl = getSetting('smtp_proxy');

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: getSetting('smtp_user'),
      pass: getSetting('smtp_pass'),
    },
  });

  // 配置了代理时，覆盖 getSocket，通过代理建立隧道连接
  if (proxyUrl) {
    transporter.getSocket = (options, callback) => {
      createProxySocket(proxyUrl, options.host, options.port)
        .then((socket) => callback(null, { connection: socket }))
        .catch((err) => callback(err));
    };
  }

  return transporter;
}

// Clean expired captchas periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of captchaStore) {
    if (entry.expires < now) captchaStore.delete(token);
  }
  for (const [email, entry] of emailCodeStore) {
    if (entry.expires < now) emailCodeStore.delete(email);
  }
}, 60000);

// 发送邮件验证码
router.post('/send-email-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }
    const transporter = createMailTransporter();
    if (!transporter) return res.status(500).json({ error: 'SMTP 未配置，请联系管理员' });

    // 生成 6 位验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    emailCodeStore.set(email, { code, expires: Date.now() + 10 * 60 * 1000 });

    const from = getSetting('smtp_from') || getSetting('smtp_user');
    const siteName = getSetting('site_name') || '轩昂の小破站';
    await transporter.sendMail({
      from: `"${siteName}" <${from}>`,
      to: email,
      subject: `${siteName} 注册验证码`,
      text: `您的注册验证码是：${code}，10 分钟内有效。`,
      html: `<p>您的注册验证码是：<strong style="font-size:20px">${code}</strong></p><p>10 分钟内有效。</p>`,
    });

    res.json({ success: true, message: '验证码已发送' });
  } catch (err) {
    console.error('[send-email-code]', err);
    res.status(500).json({ error: '发送失败: ' + err.message });
  }
});

// Generate CAPTCHA
router.get('/captcha', (req, res) => {
  try {
    const captcha = svgCaptcha.create({
      size: 4,
      ignoreChars: '0o1il',
      noise: 2,
      color: true,
      background: '#1a1a2e',
    });
    const token = uuidv4();
    captchaStore.set(token, {
      text: captcha.text.toLowerCase(),
      expires: Date.now() + 5 * 60 * 1000,
    });
    res.json({ token, svg: captcha.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify CAPTCHA
router.post('/verify-captcha', (req, res) => {
  const { token, captcha } = req.body;
  if (!token || !captcha) return res.status(400).json({ error: 'Token and captcha required' });
  const entry = captchaStore.get(token);
  if (!entry) return res.status(400).json({ error: 'CAPTCHA expired or invalid' });
  captchaStore.delete(token); // one-time use
  if (entry.expires < Date.now()) return res.status(400).json({ error: 'CAPTCHA expired' });
  if (entry.text !== captcha.toLowerCase().trim()) return res.status(400).json({ error: 'CAPTCHA incorrect' });
  res.json({ success: true });
});

// Register
router.post('/register', (req, res) => {
  try {
    const { username, password, captchaToken, captcha, inviteCode, email, emailCode } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    // Verify captcha (始终需要图形验证码防机器人)
    if (!captchaToken || !captcha) return res.status(400).json({ error: 'Please complete the CAPTCHA' });
    const entry = captchaStore.get(captchaToken);
    if (!entry) return res.status(400).json({ error: 'CAPTCHA expired or invalid' });
    captchaStore.delete(captchaToken);
    if (entry.expires < Date.now()) return res.status(400).json({ error: 'CAPTCHA expired' });
    if (entry.text !== captcha.toLowerCase().trim()) return res.status(400).json({ error: 'CAPTCHA incorrect' });

    // 邀请码：仅当开启时校验
    let invite = null;
    if (getSetting('require_invite_code') !== '0') {
      if (!inviteCode) return res.status(400).json({ error: 'Invitation code required' });
      invite = getDb().prepare('SELECT * FROM invite_codes WHERE code = ?').get(inviteCode.trim());
      if (!invite) return res.status(400).json({ error: 'Invalid invitation code' });
      if (invite.used) return res.status(400).json({ error: 'Invitation code already used' });
    }

    // 邮件验证码：仅当开启时校验
    if (getSetting('require_email_verify') === '1') {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: '请输入有效的邮箱地址' });
      }
      if (!emailCode) return res.status(400).json({ error: '请输入邮件验证码' });
      const ec = emailCodeStore.get(email);
      if (!ec) return res.status(400).json({ error: '邮件验证码过期或未发送' });
      if (ec.expires < Date.now()) { emailCodeStore.delete(email); return res.status(400).json({ error: '邮件验证码已过期' }); }
      if (ec.code !== String(emailCode).trim()) return res.status(400).json({ error: '邮件验证码不正确' });
      emailCodeStore.delete(email); // 一次性使用
    }

    const existing = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (existing) return res.status(409).json({ error: 'Username already taken' });

    // 邮箱唯一：一个邮箱只能注册一个账号
    if (email) {
      const emailExists = getDb().prepare("SELECT id FROM users WHERE email = ? AND email != ''").get(email.trim());
      if (emailExists) return res.status(409).json({ error: '该邮箱已注册' });
    }

    const id = uuidv4();
    const hashed = bcrypt.hashSync(password, 10);
    getDb().prepare('INSERT INTO users (id, username, password, email) VALUES (?, ?, ?, ?)')
      .run(id, username, hashed, email || '');

    // Mark invite code as used
    if (invite) {
      getDb().prepare('UPDATE invite_codes SET used = 1, used_by = ? WHERE id = ?').run(id, invite.id);
    }

    const token = jwt.sign({ id, username, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id, username, role: 'user' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.banned) return res.status(403).json({ error: 'Account is banned' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = getDb().prepare('SELECT id, username, role, avatar, created_at FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Change own password
router.post('/change-password', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: '请填写旧密码和新密码' });
    if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少需要6位' });

    const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const valid = bcrypt.compareSync(oldPassword, user.password);
    if (!valid) return res.status(400).json({ error: '旧密码不正确' });

    const hashed = bcrypt.hashSync(newPassword, 10);
    getDb().prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, decoded.id);
    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ error: err.message || '操作失败' });
  }
});

module.exports = router;
