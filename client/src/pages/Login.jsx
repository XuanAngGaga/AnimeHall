import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { captchaAPI, authAPI } from '../utils/api';
import { Film, RefreshCw, Mail } from 'lucide-react';

export default function Login() {
  const { login, register } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requireInviteCode = settings.require_invite_code !== '0';
  const requireEmailVerify = settings.require_email_verify === '1';

  const fetchCaptcha = async () => {
    try {
      const res = await captchaAPI.get();
      setCaptchaSvg(res.data.svg);
      setCaptchaToken(res.data.token);
      setCaptchaInput('');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isRegister) fetchCaptcha();
  }, [isRegister]);

  const handleSendEmailCode = async () => {
    setEmailMsg('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailMsg('请输入有效的邮箱地址');
      return;
    }
    setSendingEmail(true);
    try {
      const res = await authAPI.sendEmailCode(email.trim());
      setEmailMsg(res.data.message || '验证码已发送');
    } catch (err) {
      setEmailMsg(err.response?.data?.error || '发送失败');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('请填写所有字段');
      return;
    }
    if (isRegister && password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }
    if (password.length < 6) {
      setError('密码至少需要6位');
      return;
    }
    if (isRegister) {
      if (!captchaInput.trim()) {
        setError('请输入图形验证码');
        return;
      }
      if (requireInviteCode && !inviteCode.trim()) {
        setError('请输入邀请码');
        return;
      }
      if (requireEmailVerify) {
        if (!email.trim()) {
          setError('请输入邮箱');
          return;
        }
        if (!emailCode.trim()) {
          setError('请输入邮件验证码');
          return;
        }
      }
    }
    setLoading(true);
    try {
      if (isRegister) {
        await register(
          username.trim(),
          password,
          captchaToken,
          captchaInput.trim(),
          requireInviteCode ? inviteCode.trim() : '',
          requireEmailVerify ? email.trim() : '',
          requireEmailVerify ? emailCode.trim() : '',
        );
      } else {
        await login(username.trim(), password);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || '操作失败');
      if (isRegister) fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {settings.site_icon ? (
            <img src={settings.site_icon} alt="" className="w-16 h-16 mx-auto mb-3 rounded-xl object-cover" />
          ) : (
            <Film className="w-16 h-16 text-primary-400 mx-auto mb-3" />
          )}
          <h1 className="text-2xl font-bold">欢迎来到{settings.site_name || '轩昂の小破站'}</h1>
          <p className="text-gray-400 mt-2">{settings.home_subtitle || '和朋友一起同步看番'}</p>
        </div>

        <div className="glass p-6">
          <div className="flex mb-6">
            <button onClick={() => setIsRegister(false)} className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${!isRegister ? 'border-primary-500 text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              登录
            </button>
            <button onClick={() => setIsRegister(true)} className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${isRegister ? 'border-primary-500 text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              注册
            </button>
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">用户名</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} className="input-field" placeholder="请输入用户名" autoComplete="username" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">密码</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="input-field" placeholder="请输入密码" autoComplete={isRegister ? 'new-password' : 'current-password'} />
            </div>
            {isRegister && (
              <>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">确认密码</label>
                  <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" className="input-field" placeholder="请再次输入密码" autoComplete="new-password" />
                </div>

                {requireEmailVerify && (
                  <>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">邮箱</label>
                      <div className="flex gap-2">
                        <input value={email} onChange={(e) => setEmail(e.target.value)} className="input-field flex-1" placeholder="请输入邮箱" type="email" autoComplete="email" />
                        <button type="button" onClick={handleSendEmailCode} disabled={sendingEmail} className="btn-ghost border border-dark-500 whitespace-nowrap text-sm flex items-center gap-1">
                          <Mail className="w-4 h-4" /> {sendingEmail ? '发送中' : '获取验证码'}
                        </button>
                      </div>
                      {emailMsg && <p className={`text-xs mt-1 ${emailMsg.includes('失败') || emailMsg.includes('有效') ? 'text-red-400' : 'text-green-400'}`}>{emailMsg}</p>}
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">邮件验证码</label>
                      <input value={emailCode} onChange={(e) => setEmailCode(e.target.value)} className="input-field" placeholder="请输入邮件验证码" maxLength={6} />
                    </div>
                  </>
                )}

                {requireInviteCode && (
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">邀请码</label>
                    <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} className="input-field" placeholder="请输入邀请码" />
                  </div>
                )}

                <div>
                  <label className="text-sm text-gray-400 mb-1 block">图形验证码</label>
                  <div className="flex gap-2 items-center">
                    <input value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} className="input-field flex-1" placeholder="请输入验证码" autoComplete="off" />
                    <button type="button" onClick={fetchCaptcha} className="p-1 text-gray-400 hover:text-white" title="刷新验证码">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  {captchaSvg && (
                    <div className="mt-2 bg-dark-700 rounded flex justify-center" dangerouslySetInnerHTML={{ __html: captchaSvg }} />
                  )}
                </div>
              </>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? '处理中...' : isRegister ? '注册' : '登录'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}