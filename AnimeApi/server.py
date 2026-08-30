# -*- coding: utf-8 -*-
"""
樱花动漫 (yhtn.cc) 对接 API —— Python + curl_cffi 版
启动: python server.py
默认端口: 3000 (可用环境变量 PORT 覆盖)
"""
import os

from flask import Flask, jsonify, request

import scraper

app = Flask(__name__)
PORT = int(os.environ.get('PORT') or 3000)


def ok(data):
    return jsonify({'code': 0, 'msg': 'success', 'data': data})


def fail(msg, code=1):
    return jsonify({'code': code, 'msg': msg, 'data': None})


@app.route('/')
def index():
    return '''
樱花动漫 (yhtn.cc) 对接 API (Python/curl_cffi 版)

接口列表:
  1. 动漫搜索
     GET /api/search?keyword=<关键词>&page=<页码>
  2. 动漫详情 (含全部剧集 + m3u8)
     GET /api/vod/:vod_id/:category_id
  3. 仅剧集 + m3u8 (轻量)
     GET /api/episodes/:vod_id/:category_id

分类 ID: 229 日韩 | 228 国产 | 231 欧美 | 230 港台 | 272 动画片 | 77 电影 | 78 电视剧
'''.strip()


@app.route('/api/search')
def api_search():
    try:
        keyword = request.args.get('keyword', '')
        page = int(request.args.get('page', '1') or 1)
        if not keyword:
            return fail('缺少 keyword 参数')
        data = scraper.search(keyword, page)
        return ok(data)
    except Exception as e:
        print('[search]', e)
        return fail('搜索失败: ' + str(e))


@app.route('/api/vod/<vod_id>')
@app.route('/api/vod/<vod_id>/<category_id>')
def api_detail(vod_id, category_id=None):
    try:
        data = scraper.detail(vod_id, category_id or '229')
        return ok(data)
    except Exception as e:
        print('[detail]', e)
        return fail('获取详情失败: ' + str(e))


@app.route('/api/episodes/<vod_id>')
@app.route('/api/episodes/<vod_id>/<category_id>')
def api_episodes(vod_id, category_id=None):
    try:
        data = scraper.episodes(vod_id, category_id or '229')
        return ok(data)
    except Exception as e:
        print('[episodes]', e)
        return fail('获取剧集失败: ' + str(e))


@app.errorhandler(404)
def not_found(e):
    return fail('接口不存在', 404)


if __name__ == '__main__':
    print(f'樱花动漫对接 API 已启动 (Python/curl_cffi): http://127.0.0.1:{PORT}')
    app.run(host='127.0.0.1', port=PORT, threaded=True)
