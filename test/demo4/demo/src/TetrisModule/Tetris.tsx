import React, { useState, useEffect } from 'react';
import './Tetris.less';

// 游戏配置
const WIDTH = 10;
const HEIGHT = 20;

// 7种方块
const shapes = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 1, 0], [0, 1, 1]],
];

const colors = ['cyan', 'yellow', 'purple', 'orange', 'blue', 'green', 'red'];

// 改为函数：每次调用生成全新的空棋盘（避免引用复用）
const createEmptyBoard = () => Array(HEIGHT).fill(0).map(() => Array(WIDTH).fill(0));

const Tetris = () => {
  // 初始化时调用函数生成新数组
  const [board, setBoard] = useState(createEmptyBoard());
  const [piece, setPiece] = useState<number[][]>([]);
  const [color, setColor] = useState('');
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [gameOver, setGameOver] = useState(true);
  const [score, setScore] = useState(0);

  // 随机生成方块（安全位置，不会一开始就撞）
  const newPiece = () => {
    const idx = Math.floor(Math.random() * shapes.length);
    const p = shapes[idx];
    const cx = Math.floor(WIDTH / 2) - Math.floor(p[0].length / 2);

    setPiece(p);
    setColor(colors[idx]);
    setX(cx);
    setY(0);

    // 真正的游戏结束判断：新方块出生就撞顶，才结束
    if (collide(cx, 0, p)) {
      setGameOver(true);
    }
  };

  // 碰撞检查
  const collide = (nx: number, ny: number, p: number[][]): boolean => {
    for (let dy = 0; dy < p.length; dy++) {
      for (let dx = 0; dx < p[dy].length; dx++) {
        if (p[dy][dx]) {
          const px = nx + dx;
          const py = ny + dy;
          if (px < 0 || px >= WIDTH || py >= HEIGHT) return true;
          if (py >= 0 && board[py][px]) return true;
        }
      }
    }
    return false;
  };

  // 旋转方块
  const rotate = () => {
    if (gameOver) return;
    const rotated = piece[0].map((_, idx) => piece.map(row => row[idx]).reverse());
    if (!collide(x, y, rotated)) {
      setPiece(rotated);
    }
  };

  // 落地固定
  const merge = () => {
    const b = [...board];
    piece.forEach((row, dy) => {
      row.forEach((v, dx) => {
        if (v) {
          const py = y + dy;
          const px = x + dx;
          if (py >= 0) b[py][px] = 1;
        }
      });
    });

    // 消行逻辑 - 计算消除的行数
    const fullLines = b.filter(row => row.every(v => v)).length;
    // 积分规则：消1行100分，消2行300分，消3行500分，消4行800分
    if (fullLines > 0) {
      const scoreMap = [0, 100, 300, 500, 800];
      setScore(prev => prev + scoreMap[fullLines]);
    }

    // 消行
    const newBoard = b.filter(row => !row.every(v => v));
    while (newBoard.length < HEIGHT) newBoard.unshift(Array(WIDTH).fill(0));

    setBoard(newBoard);
    newPiece();
  };

  // 下落
  const drop = () => {
    if (gameOver) return;
    if (!collide(x, y + 1, piece)) {
      setY(y + 1);
    } else {
      merge();
    }
  };

  // 左右移动
  const move = (dir: number) => {
    if (gameOver) return;
    if (!collide(x + dir, y, piece)) setX(x + dir);
  };

  // 键盘控制（核心修改：阻止方向键默认滚动行为）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;
      
      // 阻止方向键的默认行为（解决屏幕滚动）
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); // 关键：禁用默认滚动
      }

      // 原有控制逻辑
      if (e.key === 'ArrowLeft') move(-1);
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowDown') drop();
      if (e.key === 'ArrowUp') rotate();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, x, y, piece]);

  // 自动下落
  useEffect(() => {
    if (gameOver) return;
    const timer = setInterval(drop, 800);
    return () => clearInterval(timer);
  }, [gameOver, y]);

  // 修复开始游戏逻辑：关键修改
  const start = () => {
    // 1. 先标记游戏未结束（避免 newPiece 时直接触发 gameOver）
    setGameOver(false);
    // 2. 生成全新的空棋盘（引用变化，触发渲染）
    const resetBoard = createEmptyBoard();
    setBoard(resetBoard);
    // 3. 重置积分
    setScore(0);
    // 4. 重置方块位置（可选，newPiece 会重新设置）
    setX(0);
    setY(0);
    // 5. 延迟生成新方块，确保棋盘已更新（避免读取旧棋盘状态）
    setTimeout(() => {
      newPiece();
    }, 0);
  };

  // 绘制棋盘
  const draw = () => {
    const b = board.map(row => [...row]);
    if (!gameOver) {
      piece.forEach((row, dy) => {
        row.forEach((v, dx) => {
          if (v) {
            const py = y + dy;
            const px = x + dx;
            if (py >= 0) b[py][px] = 2;
          }
        });
      });
    }
    return b;
  };

  return (
    <div className="tetris">
      {/* 积分显示 */}
      <div className="score-board">
        积分: {score}
      </div>
      <div className="board">
        {draw().map((row, y) =>
          row.map((v, x) => (
            <div
              key={`${y}-${x}`}
              className="cell"
              style={{ backgroundColor: v === 0 ? '#111' : v === 1 ? '#333' : color }}
            />
          ))
        )}
      </div>
      {gameOver && <div className="go">游戏结束</div>}
      <div className="tips">
        ↑ 旋转 | ← → 移动 | ↓ 加速
      </div>
      <button onClick={start} className="start-btn">开始游戏</button>
      
      {/* 新增：移动端控制按钮 */}
      <div className="mobile-controls">
        <button 
          className="control-btn rotate-btn" 
          onClick={rotate}
          disabled={gameOver}
        >
          旋转
        </button>
        <div className="direction-btns">
          <button 
            className="control-btn left-btn" 
            onClick={() => move(-1)}
            disabled={gameOver}
          >
            ←
          </button>
          <button 
            className="control-btn down-btn" 
            onClick={drop}
            disabled={gameOver}
          >
            ↓
          </button>
          <button 
            className="control-btn right-btn" 
            onClick={() => move(1)}
            disabled={gameOver}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tetris;