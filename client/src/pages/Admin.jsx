import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { adminAPI, settingsAPI } from '../utils/api';
import AdminSidebar from '../components/AdminSidebar';
import { Users, Film, MessageSquare, Activity, Trash2, RefreshCw, Copy, Check, Lock, Save, Upload, X } from 'lucide-react';

export default function Admin() {
  const { user, isAdmin, changePassword } = useAuth();
  const { settings, updateSettings } = useSettings();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [invites, setInvites] = useState([]);
  const [inviteCount, setInviteCount] = useState(1);
  const [copiedCode, setCopiedCode] = useState(null);
  const [loading, setLoading] = useState(true);

  // Site settings form
  const [siteName, setSiteName] = useState('');
  const [siteIcon, setSiteIcon] = useState('');
  const [siteBg, setSiteBg] = useState('');
  const [blurAmount, setBlurAmount] = useState('0');
  const [homeTitle, setHomeTitle] = useState('');
  const [homeSubtitle, setHomeSubtitle] = useState('');
  const [allowVideoUpload, setAllowVideoUpload] = useState('1');
  const [requireInviteCode, setRequireInviteCode] = useState('1');
  const [requireEmailVerify, setRequireEmailVerify] = useState('0');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState('1');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpProxy, setSmtpProxy] = useState('');
  const [settingsMsg, setSettingsMsg] = useState('');

  useEffect(() => {
    if (settings) {
      setSiteName(settings.site_name || '');
      setSiteIcon(settings.site_icon || '');
      setSiteBg(settings.site_background || '');
      setBlurAmount(settings.blur_amount || '0');
      setHomeTitle(settings.home_title || '');
      setHomeSubtitle(settings.home_subtitle || '');
      setAllowVideoUpload(settings.allow_video_upload !== undefined ? settings.allow_video_upload : '1');
      setRequireInviteCode(settings.require_invite_code !== undefined ? settings.require_invite_code : '1');
      setRequireEmailVerify(settings.require_email_verify !== undefined ? settings.require_email_verify : '0');
      setSmtpHost(settings.smtp_host || '');
      setSmtpPort(settings.smtp_port || '465');
      setSmtpUser(settings.smtp_user || '');
      setSmtpPass(settings.smtp_pass || '');
      setSmtpSecure(settings.smtp_secure !== undefined ? settings.smtp_secure : '1');
      setSmtpFrom(settings.smtp_from || '');
      setSmtpProxy(settings.smtp_proxy || '');
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    setSettingsMsg('');
    try {
      await updateSettings({
        site_name: siteName,
        site_icon: siteIcon,
        site_background: siteBg,
        blur_amount: blurAmount,
        home_title: homeTitle,
        home_subtitle: homeSubtitle,
        allow_video_upload: allowVideoUpload,
        require_invite_code: requireInviteCode,
        require_email_verify: requireEmailVerify,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        smtp_secure: smtpSecure,
        smtp_from: smtpFrom,
        smtp_proxy: smtpProxy,
      });
      setSettingsMsg('设置已保存');
    } catch (err) {
      setSettingsMsg('保存失败: ' + (err.response?.data?.error || err.message));
    }
  };

  // 上传图标/背景图
  const [uploading, setUploading] = useState('');
  const handleUploadImage = async (file, target) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    setUploading(target);
    setSettingsMsg('');
    try {
      const res = await settingsAPI.uploadImage(formData);
      const url = res.data.url;
      if (target === 'icon') setSiteIcon(url);
      else if (target === 'bg') setSiteBg(url);
    } catch (err) {
      setSettingsMsg('上传失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading('');
    }
  };

  // Self password change
  const [showSelfPw, setShowSelfPw] = useState(false);
  const [selfOldPw, setSelfOldPw] = useState('');
  const [selfNewPw, setSelfNewPw] = useState('');
  const [selfPwError, setSelfPwError] = useState('');
  const [selfPwMsg, setSelfPwMsg] = useState('');

  // Admin change user password
  const [pwUserId, setPwUserId] = useState(null);
  const [pwTargetName, setPwTargetName] = useState('');
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    loadData();
  }, [isAdmin, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await adminAPI.stats();
        setStats(res.data);
      } else if (activeTab === 'users') {
        const res = await adminAPI.users();
        setUsers(res.data);
      } else if (activeTab === 'rooms') {
        const res = await adminAPI.rooms();
        setRooms(res.data);
      } else if (activeTab === 'invites') {
        const res = await adminAPI.invites();
        setInvites(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async (userId) => {
    await adminAPI.banUser(userId);
    loadData();
  };

  const handleUnban = async (userId) => {
    await adminAPI.unbanUser(userId);
    loadData();
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('确定要删除此用户吗？')) return;
    await adminAPI.deleteUser(userId);
    loadData();
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm('确定要删除此房间吗？')) return;
    await adminAPI.deleteRoom(roomId);
    loadData();
  };

  const handleGenerateInvites = async () => {
    await adminAPI.generateInvites(inviteCount);
    loadData();
  };

  const handleDeleteInvite = async (inviteId) => {
    if (!confirm('确定要删除此邀请码吗？')) return;
    await adminAPI.deleteInvite(inviteId);
    loadData();
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const openPwModal = (u) => {
    setPwUserId(u.id);
    setPwTargetName(u.username);
    setPwInput('');
    setPwError('');
    setPwMsg('');
    setPwLoading(false);
  };

  const handleChangeUserPw = async () => {
    if (pwInput.length < 6) {
      setPwError('密码至少需要6位');
      return;
    }
    setPwLoading(true);
    setPwError('');
    setPwMsg('');
    try {
      await adminAPI.changeUserPassword(pwUserId, pwInput);
      setPwMsg('密码修改成功');
      setPwInput('');
    } catch (err) {
      setPwError(err.response?.data?.error || '修改失败');
    } finally {
      setPwLoading(false);
    }
  };

  const handleChangeSelfPw = async () => {
    setSelfPwError('');
    setSelfPwMsg('');
    if (!selfOldPw || !selfNewPw) {
      setSelfPwError('请填写旧密码和新密码');
      return;
    }
    if (selfNewPw.length < 6) {
      setSelfPwError('新密码至少需要6位');
      return;
    }
    try {
      await changePassword(selfOldPw, selfNewPw);
      setSelfPwMsg('密码修改成功');
      setSelfOldPw('');
      setSelfNewPw('');
      setTimeout(() => setShowSelfPw(false), 1500);
    } catch (err) {
      setSelfPwError(err.response?.data?.error || '修改失败');
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' && stats && (
            <div>
              <h1 className="text-2xl font-bold mb-6">管理仪表盘</h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: '总用户数', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
                  { label: '总房间数', value: stats.totalRooms, icon: Film, color: 'text-green-400' },
                  { label: '活跃房间', value: stats.activeRooms, icon: Activity, color: 'text-yellow-400' },
                  { label: '消息数', value: stats.totalMessages, icon: MessageSquare, color: 'text-purple-400' },
                ].map((item) => (
                  <div key={item.label} className="glass p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">{item.label}</span>
                      <item.icon className={'w-5 h-5 ' + item.color} />
                    </div>
                    <p className="text-3xl font-bold mt-2">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="glass p-5 mb-6">
                <p className="text-sm text-gray-400">封禁用户: {stats.bannedUsers}</p>
              </div>

              {/* Self password change */}
              <div className="glass p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">修改自己的密码</h2>
                  <button
                    onClick={() => { setShowSelfPw(!showSelfPw); setSelfPwError(''); setSelfPwMsg(''); }}
                    className="btn-ghost flex items-center gap-1 text-sm"
                  >
                    <Lock className="w-4 h-4" /> {showSelfPw ? '取消' : '修改密码'}
                  </button>
                </div>
                {showSelfPw && (
                  <div className="mt-4 space-y-3 max-w-sm">
                    {selfPwError && <p className="text-red-400 text-sm">{selfPwError}</p>}
                    {selfPwMsg && <p className="text-green-400 text-sm">{selfPwMsg}</p>}
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">旧密码</label>
                      <input
                        type="password"
                        value={selfOldPw}
                        onChange={(e) => setSelfOldPw(e.target.value)}
                        className="input-field"
                        placeholder="输入旧密码"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">新密码</label>
                      <input
                        type="password"
                        value={selfNewPw}
                        onChange={(e) => setSelfNewPw(e.target.value)}
                        className="input-field"
                        placeholder="输入新密码（至少6位）"
                      />
                    </div>
                    <button onClick={handleChangeSelfPw} className="btn-primary">确认修改</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">用户管理</h1>
                <button onClick={loadData} className="btn-ghost"><RefreshCw className="w-4 h-4" /></button>
              </div>
              <div className="glass overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-dark-700">
                      <tr className="text-left text-gray-400">
                        <th className="p-3">用户名</th>
                        <th className="p-3">邮箱</th>
                        <th className="p-3">角色</th>
                        <th className="p-3">状态</th>
                        <th className="p-3">注册时间</th>
                        <th className="p-3">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-t border-dark-600 hover:bg-dark-700/50">
                          <td className="p-3 font-medium">{u.username}</td>
                          <td className="p-3 text-gray-400">{u.email || '-'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs ${u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-primary-500/20 text-primary-400'}`}>
                              {u.role === 'admin' ? '管理员' : '用户'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs ${u.banned ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                              {u.banned ? '已封禁' : '正常'}
                            </span>
                          </td>
                          <td className="p-3 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                          <td className="p-3">
                            <div className="flex gap-2 flex-wrap">
                              <button onClick={() => openPwModal(u)} className="text-primary-400 hover:text-primary-300 text-xs">改密</button>
                              {u.banned ? (
                                <button onClick={() => handleUnban(u.id)} className="text-green-400 hover:text-green-300 text-xs">解封</button>
                              ) : (
                                u.role !== 'admin' && <button onClick={() => handleBan(u.id)} className="text-red-400 hover:text-red-300 text-xs">封禁</button>
                              )}
                              {u.role !== 'admin' && (
                                <button onClick={() => handleDeleteUser(u.id)} className="text-gray-500 hover:text-gray-300 text-xs">删除</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rooms' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">房间管理</h1>
                <button onClick={loadData} className="btn-ghost"><RefreshCw className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.map((room) => (
                  <div key={room.id} className="glass p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{room.name}</h3>
                        <p className="text-xs text-gray-400 mt-1">房主: {room.owner_name}</p>
                        <p className="text-xs text-gray-500">在线: {room.member_count || 0} 人</p>
                        <p className="text-xs text-gray-600 mt-1 font-mono">ID: {room.id}</p>
                      </div>
                      <button onClick={() => handleDeleteRoom(room.id)} className="text-red-400 hover:text-red-300 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'invites' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">邀请码管理</h1>
                <button onClick={loadData} className="btn-ghost"><RefreshCw className="w-4 h-4" /></button>
              </div>
              <div className="glass p-5 mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">生成数量:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={inviteCount}
                    onChange={(e) => setInviteCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    className="input-field w-20"
                  />
                  <button onClick={handleGenerateInvites} className="btn-primary">生成邀请码</button>
                </div>
              </div>
              <div className="glass overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-dark-700">
                      <tr className="text-left text-gray-400">
                        <th className="p-3">邀请码</th>
                        <th className="p-3">状态</th>
                        <th className="p-3">创建时间</th>
                        <th className="p-3">使用者</th>
                        <th className="p-3">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((inv) => (
                        <tr key={inv.id} className="border-t border-dark-600 hover:bg-dark-700/50">
                          <td className="p-3 font-mono font-medium">{inv.code}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs ${inv.used ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                              {inv.used ? '已使用' : '未使用'}
                            </span>
                          </td>
                          <td className="p-3 text-gray-500">{new Date(inv.created_at).toLocaleDateString()}</td>
                          <td className="p-3 text-gray-400">{inv.used_by_name || '-'}</td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleCopyCode(inv.code)}
                                className="text-primary-400 hover:text-primary-300 text-xs flex items-center gap-1"
                              >
                                {copiedCode === inv.code ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copiedCode === inv.code ? '已复制' : '复制'}
                              </button>
                              {!inv.used && (
                                <button onClick={() => handleDeleteInvite(inv.id)} className="text-red-400 hover:text-red-300 text-xs">删除</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {invites.length === 0 && (
                        <tr>
                          <td colSpan="5" className="p-6 text-center text-gray-500">暂无邀请码</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h1 className="text-2xl font-bold mb-6">站点设置</h1>
              <div className="glass p-6 max-w-xl space-y-5">
                {settingsMsg && (
                  <p className={`text-sm ${settingsMsg.includes('失败') ? 'text-red-400' : 'text-green-400'}`}>{settingsMsg}</p>
                )}
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">网站名称</label>
                  <input value={siteName} onChange={(e) => setSiteName(e.target.value)} className="input-field" placeholder="轩昂の小破站" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">首页主标语</label>
                  <input value={homeTitle} onChange={(e) => setHomeTitle(e.target.value)} className="input-field" placeholder="一起同步看番" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">首页副标语</label>
                  <input value={homeSubtitle} onChange={(e) => setHomeSubtitle(e.target.value)} className="input-field" placeholder="创建房间，邀请朋友，同步观看动漫" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">网站图标（上传图片）</label>
                  <div className="flex items-center gap-3">
                    {siteIcon && <img src={siteIcon} alt="图标预览" className="w-12 h-12 rounded-lg object-cover border border-dark-500" />}
                    <label className="btn-ghost flex items-center gap-2 border border-dark-500 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      {uploading === 'icon' ? '上传中...' : '上传图标'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUploadImage(e.target.files[0], 'icon')}
                      />
                    </label>
                    {siteIcon && (
                      <button onClick={() => setSiteIcon('')} className="p-2 text-red-400 hover:text-red-300" title="移除图标">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">背景图片（上传图片）</label>
                  <div className="flex items-center gap-3">
                    {siteBg && <img src={siteBg} alt="背景预览" className="w-24 h-14 rounded-lg object-cover border border-dark-500" />}
                    <label className="btn-ghost flex items-center gap-2 border border-dark-500 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      {uploading === 'bg' ? '上传中...' : '上传背景'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUploadImage(e.target.files[0], 'bg')}
                      />
                    </label>
                    {siteBg && (
                      <button onClick={() => setSiteBg('')} className="p-2 text-red-400 hover:text-red-300" title="移除背景">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">组件高斯模糊程度（0 - 40 px）</label>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    value={blurAmount}
                    onChange={(e) => setBlurAmount(e.target.value)}
                    className="input-field"
                  />
                  <p className="text-xs text-gray-500 mt-1">控制搜索框、卡片、按钮、导航栏等组件的毛玻璃模糊程度。0 为无模糊，数值越大组件越模糊。背景图片始终清晰显示。</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">允许用户上传视频文件</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAllowVideoUpload('1')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${allowVideoUpload === '1' ? 'bg-primary-600 text-white' : 'bg-dark-600 text-gray-400'}`}
                    >
                      允许
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllowVideoUpload('0')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${allowVideoUpload === '0' ? 'bg-primary-600 text-white' : 'bg-dark-600 text-gray-400'}`}
                    >
                      禁止
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">禁止后，用户只能通过视频链接（URL）添加视频，不能上传文件到服务器。</p>
                </div>

                <div className="border-t border-dark-600 pt-4">
                  <h3 className="font-semibold text-sm mb-3">注册设置</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">注册需要邀请码</label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setRequireInviteCode('1')} className={`px-4 py-2 rounded-lg text-sm font-medium ${requireInviteCode === '1' ? 'bg-primary-600 text-white' : 'bg-dark-600 text-gray-400'}`}>需要</button>
                        <button type="button" onClick={() => setRequireInviteCode('0')} className={`px-4 py-2 rounded-lg text-sm font-medium ${requireInviteCode === '0' ? 'bg-primary-600 text-white' : 'bg-dark-600 text-gray-400'}`}>不需要</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">注册需要邮件验证码</label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setRequireEmailVerify('1')} className={`px-4 py-2 rounded-lg text-sm font-medium ${requireEmailVerify === '1' ? 'bg-primary-600 text-white' : 'bg-dark-600 text-gray-400'}`}>需要</button>
                        <button type="button" onClick={() => setRequireEmailVerify('0')} className={`px-4 py-2 rounded-lg text-sm font-medium ${requireEmailVerify === '0' ? 'bg-primary-600 text-white' : 'bg-dark-600 text-gray-400'}`}>不需要</button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">开启后需先配置下方 SMTP。</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-dark-600 pt-4">
                  <h3 className="font-semibold text-sm mb-3">SMTP 邮件配置</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">SMTP 服务器地址</label>
                      <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className="input-field" placeholder="smtp.example.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm text-gray-400 mb-1 block">端口</label>
                        <input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className="input-field" placeholder="465" />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400 mb-1 block">加密方式</label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setSmtpSecure('1')} className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium ${smtpSecure === '1' ? 'bg-primary-600 text-white' : 'bg-dark-600 text-gray-400'}`}>SSL</button>
                          <button type="button" onClick={() => setSmtpSecure('0')} className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium ${smtpSecure === '0' ? 'bg-primary-600 text-white' : 'bg-dark-600 text-gray-400'}`}>无/STARTTLS</button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">账号</label>
                      <input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} className="input-field" placeholder="user@example.com" autoComplete="off" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">密码 / 授权码</label>
                      <input value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} type="password" className="input-field" placeholder="授权码" autoComplete="new-password" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">发件人地址</label>
                      <input value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} className="input-field" placeholder="user@example.com（可选，默认同账号）" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">SMTP 代理（可选，HTTP CONNECT）</label>
                      <input value={smtpProxy} onChange={(e) => setSmtpProxy(e.target.value)} className="input-field" placeholder="http://host:port 或 http://user:pass@host:port" autoComplete="off" />
                      <p className="text-xs text-gray-500 mt-1">通过 HTTP CONNECT 代理转发 SMTP 请求，隐藏源站 IP。留空则不使用代理。</p>
                    </div>
                  </div>
                </div>

                <button onClick={handleSaveSettings} className="btn-primary flex items-center gap-2">
                  <Save className="w-4 h-4" /> 保存设置
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change user password modal */}
      {pwUserId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPwUserId(null)}>
          <div className="glass p-6 rounded-xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">修改用户密码</h3>
            <p className="text-gray-400 text-sm mb-4">为 <strong>{pwTargetName}</strong> 修改密码</p>
            {pwError && <p className="text-red-400 text-sm mb-3">{pwError}</p>}
            {pwMsg && <p className="text-green-400 text-sm mb-3">{pwMsg}</p>}
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-1 block">新密码（至少6位）</label>
              <input
                type="password"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                className="input-field"
                placeholder="输入新密码"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPwUserId(null)} className="btn-ghost text-sm">取消</button>
              <button onClick={handleChangeUserPw} disabled={pwLoading} className="btn-primary text-sm">
                {pwLoading ? '修改中...' : '确认修改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}