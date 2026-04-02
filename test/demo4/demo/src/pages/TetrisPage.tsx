import React from "react";
import Styles from "../TetrisModule/TetrisPage.less";
import button from "../layouts/button_back.less";
import { useNavigate } from "umi";
// 导入俄罗斯方块组件（关键！）
import Tetris from "../TetrisModule/Tetris";

// 组件名统一为 TetrisPage，和文件名一致
export default function TetrisPage() {
  const navigate = useNavigate();
  const handleBackClick = () => {
    navigate("/game"); // 跳回游戏列表页
  };

  // 必须用 return() 包裹所有 JSX
  return (
    <div className={Styles.main}>
      <div className={Styles.header}>
        <h1>Let's play Tetris.</h1>
        {/* 返回按钮，和 GobangPage 保持一致 */}
        <div className={button.button} onClick={handleBackClick}>
          back
        </div>
      </div>

      <div className={Styles.body}>
        {/* 渲染俄罗斯方块游戏组件（关键！） */}
        <Tetris />
      </div>

      <div className={Styles.footer}></div>
    </div>
  );
}