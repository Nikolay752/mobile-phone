import { Link, useNavigate } from 'umi';
import Mainstyle from '@/layouts/Mainstyle.less';
import btnstyles from '../layouts/button_login.less';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { KeyboardEvent } from 'react';
import Items from '../layouts/items';
import { getUserLoadingStatus, login, LoginResponse, logout, resetUserLoadingStatus } from '../services/api';

const INACTIVE_TIMEOUT = 15 * 60 * 1000;

export default function Layout() {
  // 状态管理
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginFailCount, setLoginFailCount] = useState(0);
  const [loginLockTime, setLoginLockTime] = useState(0);
  // 导航和功能列表
  const { functionList } = Items();
  const navigate = useNavigate();
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  const restoreLoginState = useCallback(async () => {
    const savedUsername = localStorage.getItem('username');
    // 仅在输入框为空且有保存的用户名时，调用接口同步状态
    if (username === '' && savedUsername) {
      const res = await getUserLoadingStatus({ username: savedUsername });
      // 服务端isLoading → 前端isLoggedIn
      const loginState = res.success ? res.isLoading : false;
      setIsLoggedIn(loginState);
      setUsername(savedUsername);
    } else if (username === '') {
      // 无保存用户名，重置状态
      setIsLoggedIn(false);
    }

    // 恢复锁定状态（原有逻辑）
    if (loginLockTime === 0) {
      const lockTime = localStorage.getItem('loginLockTime');
      if (lockTime) setLoginLockTime(Number(lockTime));
    }
  }, [username, loginLockTime]);

  const handleLogout = async () => {
    const savedUsername = localStorage.getItem('username') || username;
    if (!savedUsername) {
      localStorage.clear();
      setIsLoggedIn(false);
      setUsername('');
      setPassword('');
      return;
    }

    try {
      await logout({ username: savedUsername });
    } catch (logoutErr) {
      console.error('登出接口调用失败，尝试兜底重置isLoading:', logoutErr);
      try {
        await resetUserLoadingStatus({ username: savedUsername });
      } catch (resetErr) {
        console.error('重置isLoading也失败:', resetErr);
      }
    } finally {
      setIsLoggedIn(false);
      setUsername('');
      setPassword('');
      localStorage.clear();
    }
  };

  //自动登出（自动登出修改点3）
  const handleAutoLogout = async () => {
    if (!isLoggedIn) return;
    //const currentUser = localStorage.getItem('currentUser');

    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);

    const currentUser = localStorage.getItem('currentUser')
    if (currentUser) {
      try {
        await logout({ username: currentUser });
        console.log('自动登出：已重置 isLoading 为 false');
      } catch (err) {
        console.error('自动登出重置状态失败：', err);
        await resetUserLoadingStatus({ username: currentUser })
      }
    }
    localStorage.removeItem('currentUser');
    navigate('/');
    alert('长时间未操作，默认退出');
    setIsLoggedIn(false);
  };
  //重置计时器（自动登出修改点4）
  const resetLogoutTimer = () => {
    if (!isLoggedIn) {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      return;
    }
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    logoutTimerRef.current = setTimeout(handleAutoLogout, INACTIVE_TIMEOUT);
  };

  //绑定用户操作监听（自动登出修改点5）
  const bindUserActivityListeners = () => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    if (!isLoggedIn) {
      return () => { };
    }
    const handler = resetLogoutTimer ;
    events.forEach(event => window.addEventListener(event, resetLogoutTimer));
    return () => {
      events.forEach(event => window.removeEventListener(event, resetLogoutTimer));
    };
  };

  //获取users.json并赋值isLoggedIn
  const fetchUsersJson = useCallback(async () => {
    try {
      const savedUsername = localStorage.getItem('username');
      if (!savedUsername) {
        setIsLoggedIn(false);
        return;
      }

      const response = await fetch('/users.json');
      if (!response.ok) throw new Error('获取用户数据失败');

      const users = await response.json();
      const currentUser = users.find((user: any) => user.username === savedUsername);
      if (currentUser) {
        setIsLoggedIn(currentUser.isLoading);
      } else {
        setIsLoggedIn(false);
        localStorage.removeItem('username');
      }
    } catch (error) {
      console.log('获取users.josn失败', error);
    }
  }, []);

  // 时间更新 + 登录状态恢复
  useEffect(() => {
    // 初始化时间
    setCurrentTime(formatTime());
    const timer = setInterval(() => setCurrentTime(formatTime()), 1000);

    // 初始化时恢复登录状态
    restoreLoginState();

    //自动登出修改点6
    const removeActivityListeners = bindUserActivityListeners();
    const init = async () => {
      resetLogoutTimer();
    };
    init();

    const pollTimer = setInterval(fetchUsersJson, 500);

    // 监听 localStorage 变化（跨页面修改时实时同步）
    const handleStorageChange = () => {
      // 仅在未登录状态下同步（输入中不干扰）
      if (!isLoggedIn && username === '') {
        restoreLoginState();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    /*
    // 闲置退出逻辑（关键修复：排除输入框事件）
    let idleTimer: NodeJS.Timeout;
    const resetTimer = () => {
      if (!isLoggedIn) {
        if (idleTimer) clearTimeout(idleTimer);
        return;
      }
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        handleLogout();
      }, 15 * 60 * 1000);
    };

    // 修复：全局事件不拦截输入框的操作
    const handleGlobalEvent = (e: Event) => {
      //未登录时不处理任何事件
      if (!isLoggedIn) return;

      if (!(e.target instanceof HTMLInputElement)) {
        resetTimer();
        return;
      }
      // 排除输入框的事件源
      const target = e.target as HTMLInputElement;
      if (target.type === 'text' || target.type === 'password') {
        return;
      }
      resetTimer();
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'touchmove', 'click', 'scroll'];
    if (isLoggedIn) {
      events.forEach(event => window.addEventListener(event, handleGlobalEvent));
      resetTimer();
    }
    */

    // 清除副作用
    return () => {
      clearInterval(timer);
      clearInterval(pollTimer);
      window.removeEventListener('storage', handleStorageChange);
      //clearTimeout(idleTimer);
      //events.forEach(event => window.removeEventListener(event, handleGlobalEvent));
      removeActivityListeners();
    };
  }, [isLoggedIn, username, restoreLoginState, fetchUsersJson]); // 精准依赖

  const handleLogin = async () => {
    if (loginLockTime > Date.now()) {
      alert(`你的设备已锁定，剩余${Math.ceil((loginLockTime - Date.now()) / 1000)}秒`)
      return;
    }
    try {
      setLoading(true);
      const res = await login({ username, password });
      if (res.success) {
        localStorage.setItem('token', 'fake_token_for_test');
        localStorage.setItem('role', res.userInfo.role);
        localStorage.setItem('username', res.userInfo.username);
        localStorage.setItem('class', res.userInfo.class);
        localStorage.setItem('isLoggedIn', 'true');

        setIsLoggedIn(true);
        localStorage.setItem('userInfo', JSON.stringify(res.userInfo));
        localStorage.setItem('currentUser', res.userInfo.username);

        setLoginFailCount(0);
        setLoginLockTime(0);
        localStorage.removeItem('loginLockTime');

      } else {
        const newCount = loginFailCount + 1;
        setLoginFailCount(newCount);
        if (newCount >= 5) {
          setLoginLockTime(Date.now() + 5 * 60 * 1000);
          localStorage.setItem('loginLockTime', String(Date.now() + 5 * 60 * 1000))
        } else {
          alert(`密码错误，登录失败，你还有${5 - newCount}次机会`)
        }
      }
    } catch (error) {
      console.error('登录失败：', error);
      alert('网络异常，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = () => {
    navigate('/signup');
  };

  // 回车登录（优化：仅在输入框聚焦时触发）
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoggedIn && username) {
      e.preventDefault(); // 阻止默认行为，避免页面刷新
      handleLogin();
    }
  };

  // 渲染页面
  return (
    <div className={Mainstyle.main}>
      {/* 主体内容 */}
      {!isLoggedIn ? (
        // 未登录状态：登录表单（关键修复：增加autoComplete、name等属性）
        <div className={Mainstyle.body}>
          <p className='login'>Please Login</p>
          <input
            className={Mainstyle.input}
            type="text"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off" // 禁用自动填充
            name="username"    // 增加name属性，避免浏览器拦截
            disabled={loading} // 加载时禁用输入（可选）
          />
          <input
            className={Mainstyle.input}
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="new-password" // 禁用密码自动填充
            name="password"             // 增加name属性
            disabled={loading}          // 加载时禁用输入（可选）
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