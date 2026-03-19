interface Window {
  GOBANG_RECORD: {
    currentBoard: string[][]; // 关键修改：board → currentBoard
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
  pageAgentReadGlobalBoard: () => Promise<any>; // 新增：暴露给读取脚本的方法
}
import React, { useState, useEffect, useRef } from 'react';
import styles from './Gobang.less';
import button from './button.less';

// 基础配置
const BOARD_SIZE = 15;
type ChessType = 'black' | 'white' | null;
const API_BASE = 'http://localhost:3001/api/gobang';
const SYNC_INTERVAL = 1000; // 核心修改：1秒同步一次棋盘

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
  // AI相关状态
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  // 定时器Ref：持久化存储定时器ID，防止重渲染丢失
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 获取完整的棋盘数据（同步全局变量用）
  const getFullBoardData = () => {
    return {
      currentBoard: board,
      currentPlayer,
      gameOver,
      winner,
      gameMode,
      updateTime: new Date().toISOString()
    };
  };

  // 核心方法：从服务端同步棋盘数据，1秒执行一次
  const syncBoardFromServer = async () => {
    try {
      const serverData = await gobangApi.getRecord();
      // 深度对比数据，仅不一致时更新，避免无意义重渲染
      if (
        JSON.stringify(serverData.currentBoard) !== JSON.stringify(board) ||
        serverData.currentPlayer !== currentPlayer ||
        serverData.gameOver !== gameOver ||
        serverData.winner !== winner ||
        serverData.gameMode !== gameMode
      ) {
        setBoard(serverData.currentBoard);
        setCurrentPlayer(serverData.currentPlayer);
        setGameOver(serverData.gameOver);
        setWinner(serverData.winner);
        setGameMode(serverData.gameMode);
        console.log(`[五子棋] 🔄 1秒同步：棋盘数据已更新`, new Date().toLocaleTimeString());
      }
      // 强制同步全局变量，保证读取脚本能获取最新数据
      (window as any).GOBANG_RECORD = {
        board: serverData.currentBoard,
        currentPlayer: serverData.currentPlayer,
        gameOver: serverData.gameOver,
        winner: serverData.winner,
        gameMode: serverData.gameMode,
        updateTime: serverData.updateTime
      };
    } catch (err) {
      console.error('❌ 同步后端棋盘数据失败：', (err as Error).message);
    }
  };

  // 初始化：加载数据+暴露全局方法+启动1秒定时同步
  useEffect(() => {
    // 初始加载服务端数据
    const loadInitData = async () => {
      const record = await gobangApi.getRecord();
      setBoard(record.currentBoard);
      setCurrentPlayer(record.currentPlayer);
      setGameOver(record.gameOver);
      setWinner(record.winner);
      setGameMode(record.gameMode);
      // 初始化全局变量
      (window as any).GOBANG_RECORD = {
        board: record.currentBoard,
        currentPlayer: record.currentPlayer,
        gameOver: record.gameOver,
        winner: record.winner,
        gameMode: record.gameMode,
        updateTime: record.updateTime
      };
    };
    loadInitData();

    // 暴露全局方法给PageAgent
    (window as any).getGobangRecord = gobangApi.getRecord;
    (window as any).resetGobangGame = resetGame;
    (window as any).judgeGobangSituation = judgeSituation;
    (window as any).checkGobangWin = checkWin;

    // 核心：启动1秒定时同步定时器
    timerRef.current = setInterval(syncBoardFromServer, SYNC_INTERVAL);
    console.log(`[五子棋] 🚀 启动1秒自动同步棋盘，间隔${SYNC_INTERVAL}ms`);

    // 组件卸载时清除定时器，防止内存泄漏
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        console.log(`[五子棋] ⏹️  组件卸载，清除1秒同步定时器`);
      }
    };
  }, []); // 空依赖：仅初始化执行一次

  // 前端状态变化时，立即同步到服务端
  useEffect(() => {
    if (board?.length === BOARD_SIZE && !isAiThinking) {
      const record = getFullBoardData();
      gobangApi.updateRecord(record);
      // 同步全局变量
      (window as any).GOBANG_RECORD = {
        board: record.currentBoard,
        currentPlayer: record.currentPlayer,
        gameOver: record.gameOver,
        winner: record.winner,
        gameMode: record.gameMode,
        updateTime: record.updateTime
      };
    }
  }, [board, currentPlayer, gameOver, winner, gameMode, isAiThinking]);

  // 游戏结束时清除定时器，停止自动更新
  useEffect(() => {
    if (gameOver && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      console.log(`[五子棋] ✅ 游戏结束，停止1秒自动同步`);
    }
  }, [gameOver]);

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

  // 重置游戏（前端+后端同步重置，重启1秒定时器）
  const resetGame = async () => {
    const res = await gobangApi.resetRecord();
    if (res.code === 200) {
      setBoard(res.data.currentBoard);
      setCurrentPlayer(res.data.currentPlayer);
      setGameOver(res.data.gameOver);
      setWinner(res.data.winner);
      setIsAiThinking(false);
      // 重置全局变量
      (window as any).GOBANG_RECORD = {
        board: res.data.currentBoard,
        currentPlayer: res.data.currentPlayer,
        gameOver: res.data.gameOver,
        winner: res.data.winner,
        gameMode,
        updateTime: new Date().toISOString()
      };
      // 重启1秒定时器（游戏结束后重置需要重新启动）
      if (!timerRef.current) {
        timerRef.current = setInterval(syncBoardFromServer, SYNC_INTERVAL);
        console.log(`[五子棋] 🔄 游戏重置，重启1秒自动同步`);
      }
    }
  };

  // 检查是否获胜（五子连珠）
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

  // 检查活四
  const checkFourInLine = (board: ChessType[][], row: number, col: number, player: ChessType): boolean => {
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
      if (count === 4 && blockCount < 2) {
        return true;
      }
    }
    return false;
  };

  // 检查活三
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
      if (count === 3 && blockCount === 0) {
        return true;
      }
    }
    return false;
  };

  // 检查活二
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
      if (count === 2 && blockCount === 0) {
        return true;
      }
    }
    return false;
  };

  // 判定游戏局势
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

  // 检查棋盘是否下满
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

  // AI落子核心逻辑
  const aiMakeMove = () => {
    const newBoard = JSON.parse(JSON.stringify(board));
    let bestMove: { row: number; col: number } | null = null;

    // 优先级：自己赢 > 防对手赢 > 活四 > 防对手活四 > 活三 > 防对手活三 > 活二 > 防对手活二 > 发展 > 随机
    bestMove = findWinningMove(newBoard, 'white');
    if (bestMove) { executeAiMove(newBoard, bestMove); return; }
    bestMove = findWinningMove(newBoard, 'black');
    if (bestMove) { executeAiMove(newBoard, bestMove); return; }
    bestMove = findFourInLineMove(newBoard, 'white');
    if (bestMove) { executeAiMove(newBoard, bestMove); return; }
    bestMove = findFourInLineMove(newBoard, 'black');
    if (bestMove) { executeAiMove(newBoard, bestMove); return; }
    bestMove = findThreeInLineMove(newBoard, 'white');
    if (bestMove) { executeAiMove(newBoard, bestMove); return; }
    bestMove = findThreeInLineMove(newBoard, 'black');
    if (bestMove) { executeAiMove(newBoard, bestMove); return; }
    bestMove = findTwoInLineMove(newBoard, 'white');
    if (bestMove) { executeAiMove(newBoard, bestMove); return; }
    bestMove = findTwoInLineMove(newBoard, 'black');
    if (bestMove) { executeAiMove(newBoard, bestMove); return; }
    bestMove = findBestDevelopMove(newBoard);
    if (bestMove) { executeAiMove(newBoard, bestMove); return; }
    bestMove = getRandomEmptyCell(newBoard);
    if (bestMove) { executeAiMove(newBoard, bestMove); }
  };

  // 执行AI落子并更新状态
  const executeAiMove = (newBoard: ChessType[][], move: { row: number; col: number }) => {
    newBoard[move.row][move.col] = 'white';
    setBoard(newBoard);
    const isAiWin = checkWin(newBoard, move.row, move.col, 'white');
    if (isAiWin) {
      setGameOver(true);
      setWinner('white');
      return;
    }
    if (isBoardFull(newBoard)) {
      setGameOver(true);
      setWinner(null);
      return;
    }
    setCurrentPlayer('black');
  };

  // 寻找致胜落子点
  const findWinningMove = (board: ChessType[][], player: ChessType): { row: number; col: number } | null => {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === null) {
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

  // 寻找活四落子点
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

  // 寻找活三落子点
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

  // 寻找活二落子点
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

  // 寻找最佳发展落子点
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

  // 计算落子位置分数（增强版）
  const calculateEnhancedPositionScore = (board: ChessType[][], row: number, col: number): number => {
    let score = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    // 周边棋子权重
    for (let r = Math.max(0, row - 2); r <= Math.min(BOARD_SIZE - 1, row + 2); r++) {
      for (let c = Math.max(0, col - 2); c <= Math.min(BOARD_SIZE - 1, col + 2); c++) {
        if (board[r][c] !== null) {
          const distance = Math.sqrt(Math.pow(r - row, 2) + Math.pow(c - col, 2));
          score += distance === 0 ? 0 : (20 / distance);
        }
      }
    }
    // 方向棋子权重
    for (const [dr, dc] of directions) {
      let whiteCount = 0;
      let blackCount = 0;
      let whiteBlocked = 0;
      let blackBlocked = 0;
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
      const whiteLiveScore = whiteBlocked === 0 ? 2 : 1;
      const blackLiveScore = blackBlocked === 0 ? 2 : 1;
      score += whiteCount * 15 * whiteLiveScore;
      score += blackCount * 12 * blackLiveScore;
    }
    // 棋盘中心权重
    if (Math.abs(row - 7) <= 5 && Math.abs(col - 7) <= 5) {
      score += 10;
    }
    // 棋盘边缘惩罚
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

  // 棋盘格子点击事件
  const handleCellClick = (row: number, col: number) => {
    if (gameOver || board[row][col] !== null || isAiThinking || (gameMode === 'ai' && currentPlayer !== 'black')) {
      return;
    }
    const newBoard = JSON.parse(JSON.stringify(board));
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);
    const isPlayerWin = checkWin(newBoard, row, col, currentPlayer);
    if (isPlayerWin) {
      setGameOver(true);
      setWinner(currentPlayer);
      return;
    }
    if (isBoardFull(newBoard)) {
      setGameOver(true);
      setWinner(null);
      return;
    }
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