import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { settingsAPI } from '../utils/api';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    site_name: '轩昂の小破站',
    site_icon: '',
    site_background: '',
    blur_amount: '10',
    home_title: '一起同步看番',
    home_subtitle: '创建房间，邀请朋友，同步观看动漫',
    allow_video_upload: '1',
    socket_transport: 'polling',
  });

  const applySettings = useCallback((s) => {
    // 站点标题
    if (s.site_name) {
      document.title = s.site_name;
    }
    // 站点图标
    if (s.site_icon) {
      let link = document.querySelector("link[rel='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = s.site_icon;
    }
    // 背景图 + 高斯模糊
    const blur = Math.max(0, Math.min(40, Number(s.blur_amount) || 0));
    document.documentElement.style.setProperty('--site-blur', blur + 'px');
    if (s.site_background) {
      document.documentElement.style.setProperty('--site-bg-image', `url("${s.site_background}")`);
    } else {
      document.documentElement.style.setProperty('--site-bg-image', 'none');
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await settingsAPI.get();
      setSettings(res.data);
      applySettings(res.data);
    } catch (e) {
      // 使用默认值
    }
  }, [applySettings]);

  useEffect(() => { load(); }, [load]);

  const updateSettings = useCallback(async (data) => {
    const res = await settingsAPI.update(data);
    setSettings(res.data);
    applySettings(res.data);
    return res.data;
  }, [applySettings]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, reload: load }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);