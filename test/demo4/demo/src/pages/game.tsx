import React from "react";
import Gobang from "../GobangModule/Gobang";
import Styles from "../layouts/gamePage.less";
import button from "../layouts/button_back.less";
import { useNavigate } from "umi";
// 1. 直接导入 GameList 组件（默认导入）
import GameList from "../layouts/gameList";

export default function GamePage() {
  const navigate = useNavigate();
  const handleBackClick = () => {
    navigate("/");
  };

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