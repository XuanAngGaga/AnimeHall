const express = require('express');
const axios = require('axios');

const router = express.Router();

// 樱花动漫对接 API 地址（可配置）
const ANIME_API = process.env.ANIME_API_URL || 'http://127.0.0.1:3000';

const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// 统一代理樱花动漫 API，并解包 { code, msg, data } 格式
async function proxyAnime(path, res, cacheKey) {
  try {
    if (cacheKey) {
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);
    }
    const { data } = await axios.get(ANIME_API + path, { timeout: 20000 });
    if (data && data.code === 0) {
      if (cacheKey) setCache(cacheKey, data.data);
      return res.json(data.data);
    }
    return res.status(502).json({ error: data?.msg || '樱花动漫 API 返回错误' });
  } catch (err) {
    return res.status(502).json({ error: '无法连接樱花动漫 API: ' + (err.code || err.message) });
  }
}

// 搜索动漫
router.get('/search', (req, res) => {
  const { keyword, page = 1 } = req.query;
  if (!keyword) return res.status(400).json({ error: '缺少搜索关键词' });
  return proxyAnime(`/api/search?keyword=${encodeURIComponent(keyword)}&page=${page}`, res, 'search:' + keyword + ':' + page);
});

// 动漫详情（含全部剧集 + m3u8）
router.get('/info/:vodId/:categoryId?', (req, res) => {
  const { vodId, categoryId } = req.params;
  const path = categoryId ? `/api/vod/${vodId}/${categoryId}` : `/api/vod/${vodId}`;
  return proxyAnime(path, res, 'info:' + vodId + ':' + (categoryId || ''));
});

// 仅剧集 + m3u8（轻量）
router.get('/episodes/:vodId/:categoryId?', (req, res) => {
  const { vodId, categoryId } = req.params;
  const path = categoryId ? `/api/episodes/${vodId}/${categoryId}` : `/api/episodes/${vodId}`;
  return proxyAnime(path, res, 'episodes:' + vodId + ':' + (categoryId || ''));
});

module.exports = router;