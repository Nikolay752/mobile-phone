import { useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'umi';
import { logout, resetUserLoadingStatus } from '../services/api';

const INACTIVE_TIMEOUT = 10 * 60 * 1000


interface UseAutoLogoutProps {
  isLoggedIn: boolean; // 登录状态，外部传入
  onLogout: () => void; // 登出后的本地状态重置逻辑（外部定义）
}

export const useAutoLogout = ({ isLoggedIn, onLogout }: UseAutoLogoutProps) => {
  // 全局计时器引用（单例）
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const location = useLocation(); // 监听路由变化

  // 核心：自动登出逻辑
  const handleAutoLogout = useCallback(async () => {
    if (!isLoggedIn) return;

    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      try {
        await logout({ username: currentUser });
        console.log('自动登出：已调用登出接口');
      } catch (err) {
        console.error('自动登出接口失败，尝试重置状态：', err);
        await resetUserLoadingStatus({ username: currentUser });
      }
    }

    // 登出后通用操作
    localStorage.removeItem('currentUser');
    alert('长时间未操作，已自动退出登录');
    navigate('/');
    onLogout(); // 触发外部的本地状态重置（比如setIsLoggedIn(false)）
  }, [isLoggedIn, navigate, onLogout]);

  // 重置计时器（核心方法：清零重新计时）
  const resetLogoutTimer = useCallback(() => {
    // 未登录时直接清空计时器
    if (!isLoggedIn) {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }
      return;
    }

    // 清空原有计时器，重新开始15分钟计时
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    logoutTimerRef.current = setTimeout(handleAutoLogout, INACTIVE_TIMEOUT);
  }, [isLoggedIn, handleAutoLogout]);

  // 全局用户操作监听：任意页面的鼠标/键盘/点击等操作都重置计时
  const bindUserActivityListeners = useCallback(() => {
    if (!isLoggedIn) return () => { };
    const handler = resetLogoutTimer;
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    // 绑定事件
    events.forEach((event) => window.addEventListener(event, handler));

    // 返回清理函数
    return () => {
      events.forEach((event) => window.removeEventListener(event, handler));
    };
  }, [isLoggedIn, resetLogoutTimer]);

  // 副作用1：监听登录状态 + 全局用户操作
  useEffect(() => {
    // 登录状态变化时，重置计时器
    resetLogoutTimer();

    // 绑定全局操作监听，并在卸载时清理
    const removeActivityListeners = bindUserActivityListeners();
    return () => {
      removeActivityListeners();
      clearLogoutTimer();
    };
  }, [isLoggedIn, resetLogoutTimer, bindUserActivityListeners]);

  // 副作用2：监听路由跳转（页面切换时重置计时）
  useEffect(() => {
    // 路由变化（页面跳转）时，立即重置计时器
    resetLogoutTimer();
  }, [location.pathname, resetLogoutTimer]); // 监听pathname变化

  // 暴露手动清除计时器的方法（比如退出登录时调用）
  const clearLogoutTimer = useCallback(() => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  return { resetLogoutTimer, clearLogoutTimer };
};