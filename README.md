# AnimeHall
一个可以实现多人在线同步观看影视作品的在线放映厅

**开始前先叠甲** 本项目完全基于DeepseekHarness构建，开发者本人并无Javascript相关开发经验，还望多多包涵QAQ

## 开发宗旨

本项目设计初衷是创造一个可以与朋友及时异地仍可共同追番的在线平台，笔者认为相比于独自一人在阴暗潮湿的角落里孤独追番，与三五好友至爱亲朋手足兄弟共同欣赏或有更多乐趣，碍于笔者或多或少算一个死宅，网友多于现实朋友，在邀请朋友来自己家或去朋友家看番上力有不逮，于是诞生了此项目 ~~沃趣本大人文笔真好喵！~~

## 核心功能

### 普通功能
本项目核心功能即为多人在线实时同步视频进度，功能详解如下。

注册后，用户可在首页创建房间，即时成为房间房主，凡此房间成员在观看房间播放内容时，全员的播放、暂停事件，倍速切换事件均实时同步，为防止播放卡顿，几秒内的播放误差将被允许。

房间设有聊天框与语音聊天频道，房间用户可实时进行文字与语音聊天。

### 房主权限：
1、可设置房间成员的暂停/播放与倍速更改权限，若关闭权限，房间内将只有房主可进行暂停/播放、倍速更改操作
2、可自行上传视频资源在房间内播放，视频资源形式可为对应视频文件或URL，在管理员后台可设置是否允许上传视频文件至服务器本地~~服务器硬盘不够的不建议开，不然你服务器分分钟硬盘爆炸 =W=~~

本站通过自建的内容资源API实现了视频资源搜索功能，API的具体工作原理将在下文详述

~~哎呀，其实就是一个樱花动漫与B站一起看的融合产物啦喵~~
~~不过功能性上比B站略强，资源上更是吊打喵~~

## 部署方式

### 1、服务器准备
服务器需安装Node.js 20+，如需部署本站自带的内容资源API，则Python 3.9+也被需要

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```
```bash
apt-get install -y python3-pip python3-dev build-essential libffi-dev libssl-dev
```
### 2、上传项目Releases包至服务器并解压
~~有条件的也可以自己构建~~

### 3、部署项目
```bash
cd "你的文件路径"
npm install
# 设置环境变量
export JWT_SECRET="随机密钥"
export ANIME_API_URL="http://127.0.0.1:3000" #如果你有自己的API，请在这里设置
export PORT=3001

node index.js    # 测试启动
```
**部署内容资源API（可选）**
```bash
cd "文件路径"
python3 -m venv venv #虚拟环境
source venv/bin/activate
pip install --upgrade pip
pip install curl_cffi flask beautifulsoup4 lxml
# 可选：配置代理池（为什么这里需要配置代理，下文的API工作原理会说）
export PROXY_POOL="http://ip1:port,http://ip2:port"

python3 server.py    # 测试启动
```

### 4、启动项目
**使用pm2守护进程启动项目**

```bash
pm2 start server/index.js --name anime-sync --cwd /root/Anime/server

# 樱花动漫 API（指定 venv 的 python 解释器）
pm2 start server.py --name anime-api --interpreter /root/anime-api/venv/bin/python3 --cwd /root/anime-api

pm2 save
pm2 startup    # 按提示执行它输出的命令，实现开机自启

# 常用命令
pm2 status                  # 查看状态
pm2 logs anime-sync         # 看后端日志
pm2 restart anime-sync      # 重启后端
pm2 restart anime-api       # 重启樱花动漫 API
```
### 5、配置反向代理
这里建议用宝塔面板或1Panel直接配置，不做过多赘述

### 5、大功告成！
完成部署后，你就可以以管理员账户登录并配置站点了
默认张密：admin---admin123
其他的站点配置我就懒得讲了，讲点重点
1、语音聊天必须要网站开启HTTPS
2、Socket 传输方式上，如果你要配置CDN，且你的CDN不支持WebSocket，请使用Polling，不然你的房间内所有功能都是废的

## 内容资源API工作原理
其实这个API非常简单，就是我在网上随便找了一个樱花动漫，做了个爬虫爬他站喵·w<
不然我也没别的办法了，我找不到能用的免费的api
这些樱花动漫网站大都套了cloudflare，所以需要配置代理池不然容易风控（少量搜索请求应该没事）



