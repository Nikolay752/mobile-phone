import React, { useState, useEffect, useCallback } from "react";
import Gobang from "../GobangModule/Gobang";
import Styles from "../layouts/gamePage.less";
import button from "../layouts/button_back.less";
import { useNavigate } from "umi";
// 1. 直接导入 GameList 组件（默认导入）
import GameList from "../layouts/gameList";
import { useAutoLogout } from "@/Hook/useAutoLogout";

export default function GamePage() {

  //返回键
  const handleBackClick = () => {
    navigate("/");
  };

  /*==========自动登出========== */
  //声明状态
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('currentUser'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>('');

  //格式化时间
  const formatTime = useCallback(() => {
    const date = new Date();
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
  }, []);

  //自动登出钩子
  const { resetLogoutTimer, clearLogoutTimer } = useAutoLogout({
    isLoggedIn,
    onLogout: () => {
      setIsLoggedIn(false);
      localStorage.clear();
      navigate('/')
    }
  });
  /*============================== */

  useEffect(() => {
    setCurrentTime(formatTime());
    const timer = setInterval(() => setCurrentTime(formatTime()), 1000);
    const init = async () => {};
    init();
    return () => {
      clearInterval(timer);
      clearLogoutTimer();
    };
  }, [navigate,clearLogoutTimer,resetLogoutTimer]);

  return (
    <div className={Styles.main}>
      <div className={Styles.header}>
        <h1>Let's play a game.</h1>
        <div className={button.button} onClick={handleBackClick}>
          back
        </div>
      </div>

      <div className={Styles.body}>
        {/* 2. 直接使用组件，无需手动 map */}
        <GameList />
      </div>

      <div className={Styles.footer}></div>
    </div>
  );
}