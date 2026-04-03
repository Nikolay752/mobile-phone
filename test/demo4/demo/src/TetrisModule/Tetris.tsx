import React, { useState, useEffect,useCallback } from 'react';
import './Tetris.less';
import { updateHighestScore, getHighestScore } from '../services/api';

const WIDTH = 10;
const HEIGHT = 20;
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

const createEmptyBoard = () => Array(HEIGHT).fill(0).map(() => Array(WIDTH).fill(0));
const getCurrentUser = () => {
  const userInfo = localStorage.getItem('userInfo');
  if (!userInfo) return null;
  try {
    return JSON.parse(userInfo);
  } catch (e) {
    console.error("用户信息解析失败", e);
    return null;
  }
};

const Tetris = () => {

  const [board, setBoard] = useState(createEmptyBoard());
  const [piece, setPiece] = useState<number[][]>([]);
  const [color, setColor] = useState('');
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [gameOver, setGameOver] = useState(true);
  const [score, setScore] = useState(0);
  const [highestScore, setHighestScore] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const fetchHighestScore = async () => {
    // 【实时获取用户，不再用初始化的currentUser】
    const user = getCurrentUser();
    if (!user) return;
    try {
      const res = await getHighestScore({ username: user.username });
      if (res.success) {
        setHighestScore(res.data.highestScore || 0);
      }
    } catch (e) {
      console.log('获取最高分失败');
    }
  };
  // ✅ 游戏结束才保存最高分
  const saveHighestScore = async () => {
    // 【实时获取最新用户信息】
    const user = getCurrentUser();
    if (!user || !user.username) {
      console.log("❌ 未登录或用户名无效");
      return;
    }
    // 【只有分数更高才保存，避免无效请求】
    if (score <= highestScore) return;

    try {
      const res = await updateHighestScore({
        username: user.username,
        score: score,
      });
      if (res.success) {
        setHighestScore(score);
        console.log("✅ 最高分保存成功");
      } else {
        console.log("保存失败：", res.message);
      }
    } catch (err) {
      console.log("请求失败：", err);
    }
  };

  // ✅ 游戏结束触发保存
  useEffect(() => {
    if (gameOver) {
      saveHighestScore();
    }
  }, [gameOver]);

  const newPiece = () => {
    const idx = Math.floor(Math.random() * shapes.length);
    const p = shapes[idx];
    const cx = Math.floor(WIDTH / 2) - Math.floor(p[0].length / 2);
    setPiece(p);
    setColor(colors[idx]);
    setX(cx);
    setY(0);

    if (collide(cx, 0, p)) {
      setGameOver(true);
      saveHighestScore();
    }
  };

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

const rotate = useCallback(() => {
  if (gameOver) return;
  const rotated = piece[0].map((_, idx) => piece.map(row => row[idx]).reverse());
  if (!collide(x, y, rotated)) setPiece(rotated);
}, [gameOver, piece, x, y, collide]);

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

    const fullLines = b.filter(row => row.every(v => v)).length;
    if (fullLines > 0) {
      const scoreMap = [0, 100, 300, 500, 800];
      setScore(prev => prev + scoreMap[fullLines]);
    }

    const newBoard = b.filter(row => !row.every(v => v));
    while (newBoard.length < HEIGHT) newBoard.unshift(Array(WIDTH).fill(0));
    setBoard(newBoard);
    newPiece();
  };

const drop = useCallback(() => {
  if (gameOver) return;
  if (!collide(x, y + 1, piece)) setY(y + 1);
  else merge();
}, [gameOver, x, y, piece, collide, merge]);

const move = useCallback((dir: number) => {
  if (gameOver) return;
  if (!collide(x + dir, y, piece)) setX(x + dir);
}, [gameOver, x, y, piece, collide]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;
      if (e.key === 'ArrowLeft') {
        move(-1);
        e.preventDefault();
      }
      if (e.key === 'ArrowRight'){
        move(1);
        e.preventDefault();
      }
      if (e.key === 'ArrowDown'){
        drop();
        e.preventDefault();
      }
      if (e.key === 'ArrowUp'){
        rotate();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, move, drop, rotate]);

  useEffect(() => {
    if (gameOver) return;
    const timer = setInterval(drop, 800);
    return () => clearInterval(timer);
  }, [gameOver, drop]);

  const start = () => {
    setGameOver(false);
    setBoard(createEmptyBoard());
    setScore(0);
    // 【每次开始都重新拉取最高分】
    fetchHighestScore();
    setTimeout(newPiece, 0);
  };

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
      <div className="score-board">
        <div>当前积分: {score}</div>
        <div>历史最高: {highestScore}</div>
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
      <button onClick={start} className="start-btn">开始游戏</button>

      {/* 手机端虚拟按键（自动识别） */}
      {isMobile && (
        <div className="mobile-controls">
          <div className="control-group">
            <button className="control-btn" onClick={() => move(-1)}>←</button>
            <button className="control-btn" onClick={() => rotate()}>↑</button>
            <button className="control-btn" onClick={() => move(1)}>→</button>
          </div>
          <button className="control-btn big" onClick={() => drop()}>↓</button>
        </div>
      )}
    </div>
  );
};
  export default Tetris;