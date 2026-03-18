declare global {
  interface Window {
    GOBANG_RECORD: {
      board: string[][];
      currentPlayer: string;
      gameOver: boolean;
      winner: string | null;
      gameMode: string;
      updateTime: string;
    };
    gobangApi: {
      updateRecord: (data: any) => void;
    };
    getGobangRecord: () => Promise<GobangRecord>;
    resetGobangGame: () => Promise<void>;
    judgeGobangSituation: () => Promise<{
      gameStatus: string;
      winner: ChessType;
      currentPlayer: ChessType;
      gameMode: 'ai' | 'human';
      chessCount: { black: number; white: number };
      updateTime: string;
    }>;
    checkGobangWin: (board: ChessType[][], row: number, col: number, player: ChessType) => boolean;
  }
}

import React, { useState, useEffect } from 'react';
import styles from './Gobang.less';
import button from './button.less';

// 基础配置
const BOARD_SIZE = 15;
type ChessType = 'black' | 'white' | null;
const API_BASE = 'http://localhost:3001/api/gobang';

// 棋盘数据结构
interface GobangRecord {
  currentBoard: ChessType[][];
  currentPlayer: 'black' | 'white';
  gameOver: boolean;
  winner: ChessType;
  gameMode: 'ai' | 'human';
  updateTime: string;
}

// AI落子延迟（毫秒），模拟思考过程
const AI_DELAY = 800;

// 接口请求封装
const gobangApi = {
  getRecord: async (): Promise<GobangRecord> => {
    try {
      const res = await fetch(`${API_BASE}/getRecord`);
      if (!res.ok) throw new Error(`getRecord接口失败：${res.status}`);
      const data = await res.json();
      return data.code === 200 ? data.data : initDefaultRecord();
    } catch (err) {
      console.error('❌ getRecord接口调用失败：', (err as Error).message);
      return initDefaultRecord();
    }
  },
  updateRecord: async (record: Partial<GobangRecord>) => {
    try {
      const res = await fetch(`${API_BASE}/updateRecord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (!res.ok) throw new Error(`updateRecord接口失败：${res.status}`);
    } catch (err) {
      console.error('❌ updateRecord接口调用失败：', (err as Error).message);
    }
  },
  resetRecord: async () => {
    try {
      const res = await fetch(`${API_BASE}/resetRecord`, { method: 'POST' });
      if (!res.ok) throw new Error(`resetRecord接口失败：${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('❌ resetRecord接口调用失败：', (err as Error).message);
      return { code: 500, msg: '接口调用失败' };
    }
  }
};

// 初始默认数据
const initDefaultRecord = (): GobangRecord => ({
  currentBoard: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
  currentPlayer: 'black',
  gameOver: false,
  winner: null,
  gameMode: 'human',
  updateTime: new Date().toISOString()
});

const Gobang: React.FC = () => {
  // 核心状态
  const [board, setBoard] = useState<ChessType[][]>(
    Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null))
  );
  const [currentPlayer, setCurrentPlayer] = useState<'black' | 'white'>('black');
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [winner, setWinner] = useState<ChessType>(null);
  const [gameMode, setGameMode] = useState<'ai' | 'human'>('human');
  // AI相关状态（仅保留思考中状态）
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);

  const getFullBoardData = () => {
    return {
      currentBoard: board, // 15×15棋盘数组
      currentPlayer,       // 当前落子方
      gameOver,            // 游戏是否结束
      winner,              // 获胜方
      gameMode,            // 游戏模式
      updateTime: new Date().toISOString() // 更新时间
    };
  };

  // 初始化：加载后端数据+暴露PageAgent方法
  useEffect(() => {
    const loadData = async () => {
      const record = await gobangApi.getRecord();
      setBoard(record.currentBoard);
      setCurrentPlayer(record.currentPlayer);
      setGameOver(record.gameOver);
      setWinner(record.winner);
      setGameMode(record.gameMode);
      // 暴露全局变量给PageAgent
      (window as any).GOBANG_RECORD = getFullBoardData();
    };
    loadData();

    // 暴露PageAgent专用方法
    (window as any).getGobangRecord = gobangApi.getRecord;
    (window as any).resetGobangGame = resetGame;
    (window as any).judgeGobangSituation = judgeSituation;
    (window as any).checkGobangWin = checkWin;

  }, []);

  // 状态变化同步后端
  useEffect(() => {
    if (board?.length === BOARD_SIZE) {
      (gobangApi as any).updateRecord({
        currentBoard: board, // 改board为currentBoard
        currentPlayer,
        gameOver,
        winner,
        gameMode
      });
      // 同步更新全局变量：统一用currentBoard
      (window as any).GOBANG_RECORD = {
        currentBoard: board, // 改board为currentBoard
        currentPlayer,
        gameOver,
        winner,
        gameMode,
        updateTime: new Date().toISOString()
      };
    }
  }, [board, currentPlayer, gameOver, winner, gameMode]);

  // AI落子逻辑：监听游戏模式和当前玩家变化
  useEffect(() => {
    if (gameMode === 'ai' && currentPlayer === 'white' && !gameOver && !isAiThinking) {
      setIsAiThinking(true);
      // 模拟AI思考延迟
      setTimeout(() => {
        aiMakeMove();
        setIsAiThinking(false);
      }, AI_DELAY);
    }
  }, [gameMode, currentPlayer, gameOver, board]);

  // 修复：重置游戏（前端+后端同步重置）
  const resetGame = async () => {
    const res = await gobangApi.resetRecord();
    if (res.code === 200) {
      setBoard(res.data.currentBoard);
      setCurrentPlayer(res.data.currentPlayer);
      setGameOver(res.data.gameOver);
      setWinner(res.data.winner);
      setIsAiThinking(false);
      (window as any).GOBANG_RECORD = {
        currentBoard: res.data.currentBoard, // 改board为currentBoard
        currentPlayer: res.data.currentPlayer,
        gameOver: res.data.gameOver,
        winner: res.data.winner,
        gameMode,
        updateTime: new Date().toISOString()
      };
      console.log('✅ 游戏重置成功');
    }
  };

  // 胜负判断
  const checkWin = (board: ChessType[][], row: number, col: number, player: ChessType): boolean => {
    if (!player) return false;
    const directions = [[[0, 1], [0, -1]], [[1, 0], [-1, 0]], [[1, 1], [-1, -1]], [[1, -1], [-1, 1]]];
    for (const [d1, d2] of directions) {
      let count = 1;
      let r = row + d1[0], c = col + d1[1];
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        count++; r += d1[0]; c += d1[1];
      }
      r = row + d2[0], c = col + d2[1];
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        count++; r += d2[0]; c += d2[1];
      }
      if (count >= 5) return true;
    }
    return false;
  };

  // 检查是否有形成四子的情况（活四/冲四）
  const checkFourInLine = (board: ChessType[][], row: number, col: number, player: ChessType): boolean => {
    if (!player) return false;
    const directions = [[[0, 1], [0, -1]], [[1, 0], [-1, 0]], [[1, 1], [-1, -1]], [[1, -1], [-1, 1]]];
    
    for (const [d1, d2] of directions) {
      let count = 1;
      let blockCount = 0; // 记录两端被阻挡的数量
      
      // 正向检查
      let r = row + d1[0], c = col + d1[1];
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        if (board[r][c] === player) {
          count++;
          r += d1[0];
          c += d1[1];
        } else if (board[r][c] === null) {
          break;
        } else {
          blockCount++;
          break;
        }
      }
      
      // 反向检查
      r = row - d1[0], c = col - d1[1];
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        if (board[r][c] === player) {
          count++;
          r -= d1[0];
          c -= d1[1];
        } else if (board[r][c] === null) {
          break;
        } else {
          blockCount++;
          break;
        }
      }
      
      // 活四（4子且两端都没被挡）或冲四（4子且一端被挡）
      if (count === 4 && blockCount < 2) {
        return true;
      }
    }
    return false;
  };

  // 检查是否有形成三子的情况（活三）
  const checkThreeInLine = (board: ChessType[][], row: number, col: number, player: ChessType): boolean => {
    if (!player) return false;
    const directions = [[[0, 1], [0, -1]], [[1, 0], [-1, 0]], [[1, 1], [-1, -1]], [[1, -1], [-1, 1]]];
    
    for (const [d1, d2] of directions) {
      let count = 1;
      let blockCount = 0;
      
      let r = row + d1[0], c = col + d1[1];
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        if (board[r][c] === player) {
          count++;
          r += d1[0];
          c += d1[1];
        } else if (board[r][c] === null) {
          break;
        } else {
          blockCount++;
          break;
        }
      }
      
      r = row - d1[0], c = col - d1[1];
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        if (board[r][c] === player) {
          count++;
          r -= d1[0];
          c -= d1[1];
        } else if (board[r][c] === null) {
          break;
        } else {
          blockCount++;
          break;
        }
      }
      
      // 活三（3子且两端都没被挡）
      if (count === 3 && blockCount === 0) {
        return true;
      }
    }
    return false;
  };

  // 新增：检查活二/冲二（AI发展策略）
  const checkTwoInLine = (board: ChessType[][], row: number, col: number, player: ChessType): boolean => {
    if (!player) return false;
    const directions = [[[0, 1], [0, -1]], [[1, 0], [-1, 0]], [[1, 1], [-1, -1]], [[1, -1], [-1, 1]]];
    
    for (const [d1, d2] of directions) {
      let count = 1;
      let blockCount = 0;
      
      let r = row + d1[0], c = col + d1[1];
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        if (board[r][c] === player) {
          count++;
          r += d1[0];
          c += d1[1];
        } else if (board[r][c] === null) {
          break;
        } else {
          blockCount++;
          break;
        }
      }
      
      r = row - d1[0], c = col - d1[1];
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        if (board[r][c] === player) {
          count++;
          r -= d1[0];
          c -= d1[1];
        } else if (board[r][c] === null) {
          break;
        } else {
          blockCount++;
          break;
        }
      }
      
      // 活二（2子且两端都没被挡）
      if (count === 2 && blockCount === 0) {
        return true;
      }
    }
    return false;
  };

  // PageAgent专用：局势判断
  const judgeSituation = async () => {
    const record = await gobangApi.getRecord();
    const chessCount = record.currentBoard.reduce((cnt, row) => {
      row.forEach(cell => {
        if (cell === 'black') cnt.black++;
        else if (cell === 'white') cnt.white++;
      });
      return cnt;
    }, { black: 0, white: 0 });
    return {
      gameStatus: record.gameOver ? 'over' : 'playing',
      winner: record.winner,
      currentPlayer: record.currentPlayer,
      gameMode: record.gameMode,
      chessCount,
      updateTime: record.updateTime
    };
  };

  // 新增：检查棋盘是否下满（平局判断）
  const isBoardFull = (board: ChessType[][]): boolean => {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === null) {
          return false;
        }
      }
    }
    return true;
  };

  // 高难度AI落子核心逻辑（增强版）
  const aiMakeMove = () => {
    const newBoard = JSON.parse(JSON.stringify(board));
    let bestMove: { row: number; col: number } | null = null;

    // 优先级1：AI自己能赢的位置（必胜）
    bestMove = findWinningMove(newBoard, 'white');
    if (bestMove) {
      executeAiMove(newBoard, bestMove);
      return;
    }

    // 优先级2：堵截玩家能赢的位置（防玩家必胜）
    bestMove = findWinningMove(newBoard, 'black');
    if (bestMove) {
      executeAiMove(newBoard, bestMove);
      return;
    }

    // 优先级3：AI形成活四/冲四的位置
    bestMove = findFourInLineMove(newBoard, 'white');
    if (bestMove) {
      executeAiMove(newBoard, bestMove);
      return;
    }

    // 优先级4：堵截玩家活四/冲四的位置
    bestMove = findFourInLineMove(newBoard, 'black');
    if (bestMove) {
      executeAiMove(newBoard, bestMove);
      return;
    }

    // 优先级5：AI形成活三的位置
    bestMove = findThreeInLineMove(newBoard, 'white');
    if (bestMove) {
      executeAiMove(newBoard, bestMove);
      return;
    }

    // 优先级6：堵截玩家活三的位置
    bestMove = findThreeInLineMove(newBoard, 'black');
    if (bestMove) {
      executeAiMove(newBoard, bestMove);
      return;
    }

    // 新增优先级7：AI形成活二的位置（发展优势）
    bestMove = findTwoInLineMove(newBoard, 'white');
    if (bestMove) {
      executeAiMove(newBoard, bestMove);
      return;
    }

    // 新增优先级8：堵截玩家活二的位置（限制发展）
    bestMove = findTwoInLineMove(newBoard, 'black');
    if (bestMove) {
      executeAiMove(newBoard, bestMove);
      return;
    }

    // 优先级9：高得分的发展位置（强化版得分计算）
    bestMove = findBestDevelopMove(newBoard);
    if (bestMove) {
      executeAiMove(newBoard, bestMove);
      return;
    }

    // 最后兜底：随机空位置
    bestMove = getRandomEmptyCell(newBoard);
    if (bestMove) {
      executeAiMove(newBoard, bestMove);
    }
  };

  // 执行AI落子并更新状态（新增平局判断）
  const executeAiMove = (newBoard: ChessType[][], move: { row: number; col: number }) => {
    newBoard[move.row][move.col] = 'white';
    setBoard(newBoard);

    // 检查AI是否获胜
    const isAiWin = checkWin(newBoard, move.row, move.col, 'white');
    if (isAiWin) {
      setGameOver(true);
      setWinner('white');
      return;
    }

    // 新增：检查是否平局
    if (isBoardFull(newBoard)) {
      setGameOver(true);
      setWinner(null); // 无获胜方
      return;
    }

    // 切换回玩家回合
    setCurrentPlayer('black');
  };

  // 寻找能赢的落子位置
  const findWinningMove = (board: ChessType[][], player: ChessType): { row: number; col: number } | null => {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === null) {
          // 模拟落子
          const tempBoard = JSON.parse(JSON.stringify(board));
          tempBoard[row][col] = player;
          if (checkWin(tempBoard, row, col, player)) {
            return { row, col };
          }
        }
      }
    }
    return null;
  };

  // 寻找形成四子的落子位置
  const findFourInLineMove = (board: ChessType[][], player: ChessType): { row: number; col: number } | null => {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === null) {
          const tempBoard = JSON.parse(JSON.stringify(board));
          tempBoard[row][col] = player;
          if (checkFourInLine(tempBoard, row, col, player)) {
            return { row, col };
          }
        }
      }
    }
    return null;
  };

  // 寻找形成三子的落子位置
  const findThreeInLineMove = (board: ChessType[][], player: ChessType): { row: number; col: number } | null => {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === null) {
          const tempBoard = JSON.parse(JSON.stringify(board));
          tempBoard[row][col] = player;
          if (checkThreeInLine(tempBoard, row, col, player)) {
            return { row, col };
          }
        }
      }
    }
    return null;
  };

  // 新增：寻找形成二子的落子位置
  const findTwoInLineMove = (board: ChessType[][], player: ChessType): { row: number; col: number } | null => {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === null) {
          const tempBoard = JSON.parse(JSON.stringify(board));
          tempBoard[row][col] = player;
          if (checkTwoInLine(tempBoard, row, col, player)) {
            return { row, col };
          }
        }
      }
    }
    return null;
  };

  // 寻找最佳发展落子位置（强化版得分计算）
  const findBestDevelopMove = (board: ChessType[][]) => {
    let bestScore = 0;
    let bestMove: { row: number; col: number } | null = null;

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === null) {
          const score = calculateEnhancedPositionScore(board, row, col);
          if (score > bestScore) {
            bestScore = score;
            bestMove = { row, col };
          }
        }
      }
    }
    return bestMove;
  };

  // 强化版位置得分计算（难度翻倍核心）
  const calculateEnhancedPositionScore = (board: ChessType[][], row: number, col: number): number => {
    let score = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    // 1. 周围2格内有棋子的权重（扩大检测范围）
    for (let r = Math.max(0, row - 2); r <= Math.min(BOARD_SIZE - 1, row + 2); r++) {
      for (let c = Math.max(0, col - 2); c <= Math.min(BOARD_SIZE - 1, col + 2); c++) {
        if (board[r][c] !== null) {
          // 距离越近得分越高
          const distance = Math.sqrt(Math.pow(r - row, 2) + Math.pow(c - col, 2));
          score += distance === 0 ? 0 : (20 / distance);
        }
      }
    }

    // 2. 各方向连续棋子得分（强化权重）
    for (const [dr, dc] of directions) {
      let whiteCount = 0;
      let blackCount = 0;
      let whiteBlocked = 0;
      let blackBlocked = 0;

      // 正向检查
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        if (board[r][c] === 'white') {
          whiteCount++;
          r += dr;
          c += dc;
        } else if (board[r][c] === 'black') {
          blackCount++;
          r += dr;
          c += dc;
        } else if (board[r][c] === null) {
          break;
        } else {
          if (whiteCount > 0) whiteBlocked++;
          if (blackCount > 0) blackBlocked++;
          break;
        }
      }

      // 反向检查
      r = row - dr, c = col - dc;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        if (board[r][c] === 'white') {
          whiteCount++;
          r -= dr;
          c -= dc;
        } else if (board[r][c] === 'black') {
          blackCount++;
          r -= dr;
          c -= dc;
        } else if (board[r][c] === null) {
          break;
        } else {
          if (whiteCount > 0) whiteBlocked++;
          if (blackCount > 0) blackBlocked++;
          break;
        }
      }

      // 活棋得分更高（未被阻挡）
      const whiteLiveScore = whiteBlocked === 0 ? 2 : 1;
      const blackLiveScore = blackBlocked === 0 ? 2 : 1;
      
      score += whiteCount * 15 * whiteLiveScore;  // AI自己棋子权重翻倍
      score += blackCount * 12 * blackLiveScore;  // 玩家棋子权重提升
    }

    // 3. 中心区域额外加分（扩大中心区域）
    if (Math.abs(row - 7) <= 5 && Math.abs(col - 7) <= 5) {
      score += 10; // 加分翻倍
    }

    // 4. 边角惩罚（避免AI走边角）
    if (row <= 2 || row >= 12 || col <= 2 || col >= 12) {
      score -= 15;
    }

    return score;
  };

  // 获取随机空位置
  const getRandomEmptyCell = (board: ChessType[][]): { row: number; col: number } | null => {
    const emptyCells: { row: number; col: number }[] = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === null) {
          emptyCells.push({ row, col });
        }
      }
    }
    return emptyCells.length > 0 ? emptyCells[Math.floor(Math.random() * emptyCells.length)] : null;
  };

  // 落子逻辑（新增平局判断）
  const handleCellClick = (row: number, col: number) => {
    // 人机模式下只有黑棋（玩家）能落子，且AI思考中不能落子
    if (gameOver || board[row][col] !== null || isAiThinking || (gameMode === 'ai' && currentPlayer !== 'black')) {
      return;
    }

    const newBoard = JSON.parse(JSON.stringify(board));
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);

    // 检查玩家是否获胜
    const isPlayerWin = checkWin(newBoard, row, col, currentPlayer);
    if (isPlayerWin) {
      setGameOver(true);
      setWinner(currentPlayer);
      return;
    }

    // 新增：检查是否平局
    if (isBoardFull(newBoard)) {
      setGameOver(true);
      setWinner(null);
      return;
    }

    // 切换玩家（人机模式下切换到AI，双人模式下切换到白棋）
    setCurrentPlayer(currentPlayer === 'black' ? 'white' : 'black');
  };

  return (
    <div className={styles.gobangContainer} id="gobang-root">
      <h2 className={styles.gameTitle}>
        五子棋 {gameMode === 'ai' ? '【人机对战】' : '【双人对战】'}
      </h2>
      <div className={styles.gameControl} id="gobang-control-bar">
        <button
          id="gobang-btn-ai"
          onClick={() => setGameMode('ai')}
          className={`${button.button} ${gameMode === 'ai' ? styles.activeBtn : ''}`}
        >
          人机对战
        </button>
        <button
          id="gobang-btn-human"
          onClick={() => setGameMode('human')}
          className={`${button.button} ${gameMode === 'human' ? styles.activeBtn : ''}`}
        >
          双人对战
        </button>
        <button
          id="gobang-btn-reset"
          onClick={resetGame}
          className={button.button}
        >
          重置游戏
        </button>
      </div>
      <div id="gobang-game-status" className={styles.gameStatus}>
        {gameOver ? (
          <span id="gobang-winner-text" className={styles.winnerText}>
            {winner ? `${winner === 'black' ? '黑棋' : '白棋'}获胜！` : '游戏平局！'}
          </span>
        ) : (
          <>
            <span id="gobang-current-player">当前回合：{currentPlayer === 'black' ? '黑棋' : '白棋'}</span>
            {isAiThinking && <span className={styles.aiThinking}>AI正在思考...</span>}
          </>
        )}
      </div>
      <div className={styles.boardWrapper} id="gobang-board-wrapper">
        <div className={styles.chessBoard} id="gobang-chess-board">
          <div className={styles.gridLinesHorizontal}></div>
          <div className={styles.gridLinesVertical}></div>
          {board?.map((row, rowIndex) =>
            row?.map((cell, colIndex) => (
              <div
                key={`gobang-point-${rowIndex}-${colIndex}`}
                className={`${styles.intersection} ${cell === null ? 'gobang-grid-empty' : 'gobang-grid-has-chess'}`}
                data-row={rowIndex}
                data-col={colIndex}
                style={{ top: `${(rowIndex / 14) * 100}%`, left: `${(colIndex / 14) * 100}%` }}
                onClick={() => handleCellClick(rowIndex, colIndex)}
                id={`gobang-intersection-${rowIndex}-${colIndex}`}
              >
                {cell && (
                  <div
                    style={{
                      opacity: 1,
                      background: cell === 'black' ? '#000' : '#fff',
                      border: cell === 'white' ? '1px solid #ccc' : 'none',
                      width: '90%',
                      height: '90%',
                      borderRadius: '50%',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                      zIndex: 10,
                      position: 'relative'
                    }}
                    className={`gobang-chess gobang-chess-${cell}`}
                    data-chess-type={cell}
                  ></div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Gobang;