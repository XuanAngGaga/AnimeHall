# -*- coding: utf-8 -*-
"""
樱花动漫 (yhtn.cc) 爬虫核心 —— Python + curl_cffi 版
用 curl_cffi 模拟 Chrome TLS 指纹，绕过 Cloudflare 反爬。
"""
import base64
import os
import re
import time
import urllib.parse

from bs4 import BeautifulSoup
from curl_cffi import requests

BASE_URL = 'https://www.yhtn.cc'

DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': BASE_URL + '/',
}

# 代理池：环境变量 PROXY_POOL，逗号分隔
PROXY_POOL = [p.strip() for p in (os.environ.get('PROXY_POOL') or '').split(',') if p.strip()]
_proxy_index = 0


def _next_proxy():
    global _proxy_index
    if not PROXY_POOL:
        return None
    proxy = PROXY_POOL[_proxy_index % len(PROXY_POOL)]
    _proxy_index += 1
    return proxy


# 简单内存缓存
_cache = {}
_CACHE_TTL = 10 * 60  # 10 分钟


def _cache_get(key):
    hit = _cache.get(key)
    if hit and time.time() - hit['ts'] < _CACHE_TTL:
        return hit['value']
    if hit:
        _cache.pop(key, None)
    return None


def _cache_set(key, value):
    if len(_cache) > 500:
        _cache.clear()
    _cache[key] = {'ts': time.time(), 'value': value}


def fetch_html(path, params=None, retries=3):
    """抓取页面 HTML，带重试与代理轮询。"""
    url = BASE_URL + path
    for i in range(retries):
        try:
            kwargs = dict(
                params=params or {},
                headers=DEFAULT_HEADERS,
                impersonate='chrome',
                timeout=25,
                allow_redirects=True,
            )
            proxy = _next_proxy()
            if proxy:
                kwargs['proxies'] = {'https': proxy, 'http': proxy}
            resp = requests.get(url, **kwargs)
            if resp.status_code < 400:
                return resp.text
            # 403/429/5xx 退避重试
            if i < retries - 1:
                time.sleep((i + 1) * 1.5)
                continue
        except Exception:
            if i < retries - 1:
                time.sleep((i + 1) * 1.5)
                continue
            raise
    raise Exception(f'抓取失败: {url}')


def decode_m3u8(file):
    """解码 m3u8 地址：去掉前 3 字符 -> base64 -> URL 解码。"""
    if not file or not isinstance(file, str):
        return ''
    stripped = file[3:]
    try:
        stripped += '=' * (-len(stripped) % 4)
        base64_decoded = base64.b64decode(stripped).decode('utf-8')
        return urllib.parse.unquote(base64_decoded)
    except Exception:
        return ''


def _decode_entities(s):
    return (s or '').replace('&amp;', '&').replace('&lt;', '<') \
        .replace('&gt;', '>').replace('&quot;', '"') \
        .replace('&#39;', "'").replace('&nbsp;', ' ')


def extract_tem_line_list(html):
    """从播放页提取 temLineList（全部剧集）。"""
    m = re.search(r'var\s+temLineList\s*=\s*(\[[\s\S]*?\])\s*;', html)
    if not m:
        return []
    raw = m.group(1)
    try:
        import json
        return json.loads(raw)
    except Exception:
        # 兜底：给 key 加引号
        try:
            import json
            cleaned = re.sub(r'([{,])\s*(\w+)(\s*:)', r'\1"\2"\3', raw)
            cleaned = cleaned.replace("'", '"')
            return json.loads(cleaned)
        except Exception:
            return []


def search(keyword, page=1):
    """动漫搜索。"""
    keyword = (keyword or '').strip()
    if not keyword:
        raise Exception('关键词不能为空')
    cache_key = f'search:{keyword}:{page}'
    hit = _cache_get(cache_key)
    if hit:
        return hit

    html = fetch_html('/public/auto/search1.html', {'keyword': keyword, 'page': page})
    soup = BeautifulSoup(html, 'lxml')

    total_text = soup.select_one('.mac_total')
    total = int(total_text.get_text(strip=True) or '0') if total_text else 0

    result_list = []
    for item in soup.select('.module-card-item'):
        detail_href = ''
        a_title = item.select_one('a.module-card-item-title')
        a_poster = item.select_one('a.module-card-item-poster')
        if a_title:
            detail_href = a_title.get('href', '')
        elif a_poster:
            detail_href = a_poster.get('href', '')
        if not detail_href:
            a = item.select_one('a[href^="/v/"]')
            if a:
                detail_href = a.get('href', '')

        m = re.match(r'^/([vp])/(\d+)/(\d+)(?:/(\d+))?', detail_href or '')
        vod_id = m.group(2) if m else ''
        category_id = m.group(3) if m else ''

        name_el = item.select_one('.module-card-item-title strong') or \
                  item.select_one('.module-card-item-title a') or \
                  item.select_one('img')
        name = _decode_entities(name_el.get('alt') or name_el.get_text(strip=True) if name_el else '')

        pic = ''
        img = item.select_one('img[data-original]') or item.select_one('img[src]')
        if img:
            pic = img.get('data-original') or img.get('src') or ''

        note = item.select_one('.module-item-note')
        note = note.get_text(strip=True) if note else ''

        category = item.select_one('.module-card-item-class')
        category = category.get_text(strip=True) if category else ''

        info = item.select_one('.module-card-item-info .module-info-item-content')
        info_text = re.sub(r'\s+', '', info.get_text() if info else '')
        parts = [p for p in info_text.split('/') if p]
        year = parts[0] if len(parts) > 0 else ''
        region = parts[1] if len(parts) > 1 else ''

        result_list.append({
            'vod_id': vod_id,
            'category_id': category_id,
            'name': name,
            'pic': pic,
            'note': note,
            'category': category,
            'year': year,
            'region': region,
        })

    result = {'total': total, 'page': page, 'list': result_list}
    _cache_set(cache_key, result)
    return result


def _parse_episodes(player_html):
    line_list = extract_tem_line_list(player_html)
    eps = []
    for item in line_list:
        ep = {
            'episode_id': str(item.get('id') or ''),
            'name': _decode_entities(str(item.get('name') or item.get('subTitle') or '')),
            'sort': item.get('sort', 0) if item.get('sort') is not None else 0,
            'm3u8_url': decode_m3u8(item.get('file')),
        }
        if ep['m3u8_url']:
            eps.append(ep)
    eps.sort(key=lambda x: x['sort'])
    return eps


def detail(vod_id, category_id=None):
    """动漫详情（含全部剧集 + m3u8）。"""
    if not vod_id:
        raise Exception('缺少 vod_id')
    category_id = category_id or '229'
    cache_key = f'detail:{vod_id}:{category_id}'
    hit = _cache_get(cache_key)
    if hit:
        return hit

    detail_html = fetch_html(f'/v/{vod_id}/{category_id}')
    player_html = fetch_html(f'/p/{vod_id}/{category_id}/0')

    soup = BeautifulSoup(detail_html, 'lxml')
    name = _decode_entities(soup.select_one('.module-info-heading h1').get_text(strip=True) if soup.select_one('.module-info-heading h1') else '')

    pic = ''
    img = soup.select_one('.module-info-poster img[data-original]') or soup.select_one('.module-info-poster img[src]')
    if img:
        pic = img.get('data-original') or img.get('src') or ''

    tags = []
    for t in soup.select('.module-info-heading .module-info-tag-link div'):
        txt = t.get_text(strip=True)
        if txt:
            tags.append(_decode_entities(txt))

    desc_el = soup.select_one('.module-info-introduction-content')
    description = _decode_entities(desc_el.get_text(strip=True) if desc_el else '')

    director = ''
    actor = ''
    for item in soup.select('.module-info-items .module-info-item'):
        title_el = item.select_one('.module-info-item-title')
        content_el = item.select_one('.module-info-item-content')
        title = title_el.get_text(strip=True) if title_el else ''
        content = re.sub(r'\s+', '', content_el.get_text() if content_el else '')
        if '导演' in title:
            director = content
        elif '主演' in title:
            actor = content

    note = tags[-1] if tags else ''

    eps = _parse_episodes(player_html)

    result = {
        'vod_id': str(vod_id),
        'category_id': str(category_id),
        'name': name,
        'pic': pic,
        'note': note,
        'category': tags[-1] if tags else '',
        'year': tags[0] if tags else '',
        'region': tags[1] if len(tags) > 1 else '',
        'description': description,
        'director': director,
        'actor': actor,
        'episodes': eps,
        'episode_count': len(eps),
    }
    _cache_set(cache_key, result)
    return result


def episodes(vod_id, category_id=None):
    """仅剧集 + m3u8（轻量）。"""
    if not vod_id:
        raise Exception('缺少 vod_id')
    category_id = category_id or '229'
    cache_key = f'episodes:{vod_id}:{category_id}'
    hit = _cache_get(cache_key)
    if hit:
        return hit

    player_html = fetch_html(f'/p/{vod_id}/{category_id}/0')
    eps = _parse_episodes(player_html)

    result = {
        'vod_id': str(vod_id),
        'category_id': str(category_id),
        'episode_count': len(eps),
        'episodes': eps,
    }
    _cache_set(cache_key, result)
    return result
