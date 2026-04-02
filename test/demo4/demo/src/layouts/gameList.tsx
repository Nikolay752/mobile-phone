import React from "react";
import { Link } from "umi";
import "../layouts/gameList.less"; // 导入你的样式文件

// 1. 接口名首字母大写（TS 规范）
interface GameList {
  id: number;
  name: string;
  internalLink?: string;
}

// 2. 定义游戏列表数据
const functionList: GameList[] = [
  {
    id: 1,
    name: "gobang",
    internalLink: "/game/GobangPage",
  },
  {
    id:2,
    name:"Tetris",
    internalLink:"/game/TetrisPage"
  }
];

// 3. 导出组件，直接渲染列表
export default function GameList() {
  return (
    <div className="gameList">
      {functionList.map((game) => (
        <Link
          key={game.id}
          to={game.internalLink!}
          className="linkItem"
        >
          {game.name}
        </Link>
      ))}
    </div>
  );
}

// 4. 单独导出数据，方便其他地方使用（可选）
export { functionList };