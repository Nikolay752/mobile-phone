import { Link, useNavigate } from 'umi';
import Mainstyle from '@/layouts/Mainstyle.less';
import btnstyles from '../layouts/button_login.less';
import { useState, useEffect } from 'react';
import { KeyboardEvent } from 'react';
import Items from '../layouts/items';
import { login, LoginResponse, logout } from '@/services/api';

export default function Layout() {
  // 状态管理
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // 导航和功能列表
  const { functionList } = Items();
  const navigate = useNavigate();

  // 格式化时间
  const formatTime = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  };

  // 优化：统一的登录状态恢复逻辑
  const restoreLoginState = () => {
    const savedToken = localStorage.getItem('token');
    const savedIsLoggedIn = localStorage.getItem('isLoggedIn');
    const savedUsername = localStorage.getItem('username');

    // 双重校验：token存在 或 isLoggedIn标识为true，都判定为已登录
    const loginState = !!(savedToken || savedIsLoggedIn === 'true');
    setIsLoggedIn(loginState);
    if (loginState && savedUsername) {
      setUsername(savedUsername);
    } else {
      setUsername('');
    }
  };

  // 时间更新 + 登录状态恢复
  useEffect(() => {
    // 初始化时间
    setCurrentTime(formatTime());
    // 每秒更新时间
    const timer = setInterval(() => setCurrentTime(formatTime()), 1000);

    // 初始化时立即恢复登录状态
    restoreLoginState();

    // 监听 localStorage 变化（跨页面修改时实时同步）
    window.addEventListener('storage', restoreLoginState);

    // 清除定时器和监听
    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', restoreLoginState);
    };
  }, []);

  const handleLogin = async () => {
    try {
      setLoading(true);
      const res = await login({ username, password });
      if (res.success) {
        // ✅ 临时用固定字符串代替 token，绕过校验
        localStorage.setItem('token', 'fake_token_for_test');
        localStorage.setItem('role', res.userInfo.role);
        localStorage.setItem('username', res.userInfo.username);
        localStorage.setItem('class', res.userInfo.class);
        // 新增：显式设置登录状态标识
        localStorage.setItem('isLoggedIn', 'true');

        setIsLoggedIn(true);
        localStorage.setItem('userInfo', JSON.stringify(res.userInfo));
        localStorage.setItem('currentUser', res.userInfo.username);

        // 跳转到游戏页
      } else {
        alert(res.message || '登录失败');
      }
    } catch (error) {
      console.error('登录失败：', error);
      alert('网络异常，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 注册跳转
  const handleSignup = () => {
    navigate('/signup');
  };

  // 回车登录
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoggedIn && username) {
      handleLogin();
    }
  };

  // 优化：登出时清空所有登录标识
  const handleLogout = async () => {
    try {
      await logout({ username });
      setIsLoggedIn(false);
      setUsername('');
      setPassword('');
      localStorage.clear(); // 清空所有localStorage
    } catch (error) {
      console.error('登出失败：', error);
    }
  };

  // 渲染页面
  return (
    <div className={Mainstyle.main}>

      {/* 主体内容 */}
      {!isLoggedIn ? (
        // 未登录状态：登录表单
        <div className={Mainstyle.body}>
          <p className='login'>Please Login</p>
          <input
            className={Mainstyle.input}
            type="text"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <input
            className={Mainstyle.input}
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className={btnstyles.button} onClick={handleLogin} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <button className={btnstyles.button} onClick={handleSignup}>
            signup
          </button>
        </div>
      ) : (
        // 已登录状态：功能链接 + 登出按钮
        <div className={Mainstyle.body}>
          <div className='link'>
            {functionList.map((item) => (
              <div key={item.id}>
                {item.externalLink ? (
                  <a
                    href={item.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={Mainstyle.linkItem}
                  >
                    {item.name}
                  </a>
                ) : item.internalLink ? (
                  <Link to={item.internalLink} className={Mainstyle.linkItem}>
                    {item.name}
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
          <button
            className={btnstyles.button}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      )}

      {/* 底部 */}
      <div className={Mainstyle.footer}>
        <span className={Mainstyle.currentTime}>{currentTime}</span>
      </div>
    </div>
  );
}