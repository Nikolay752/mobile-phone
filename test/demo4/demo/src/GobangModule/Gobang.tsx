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
      gameMode: 'ai' | 'human' | 'online';
      chessCount: { black: number; white: number };
      updateTime: string;
    }>;
    checkGobangWin: (board: ChessType[][], row: number, col: number, player: ChessType) => boolean;
  }
}

import React, { useState, useEffect, useRef } from 'react';
import styles from './Gobang.less';
import button from './button.less';

// 基础配置
const BOARD_SIZE = 15;
type ChessType = 'black' | 'white' | null;
// 核心修改：适配本机+局域网访问（优先局域网，本机备用）
const API_BASE = '/api/gobang';
// 轮询间隔（毫秒）
const POLLING_INTERVAL = 500;

// 棋盘数据结构
interface GobangRecord {
  currentBoard: ChessType[][];
  currentPlayer: 'black' | 'white';
  gameOver: boolean;
  winner: ChessType;
  gameMode: 'ai' | 'human' | 'online';
  updateTime: string;
}

// AI落子延迟（毫秒），模拟思考过程
const AI_DELAY = 800;

// 生成客户端唯一标识
const generateClientId = () => {
  return localStorage.getItem('gobang_client_id') || Math.random().toString(36).substring(2, 15);
};

// 接口请求封装
const gobangApi = {
  getRecord: async (): Promise<GobangRecord> => {
    try {
      const res = await fetch(`${API_BASE}/getRecord`);
      const data = await res.json();
      return data.code === 200 ? data.data : initDefaultRecord();
    } catch (err) {
      console.error('❌ getRecord接口调用失败：', (err as Error).message);
      return initDefaultRecord();
    }
  },
  updateRecord: async (record: Partial<GobangRecord> & { clientId?: string }) => {
    try {
      const clientId = generateClientId();
      const res = await fetch(`${API_BASE}/updateRecord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...record, clientId })
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
  },
  getChessLock: async (targetPlayer: ChessType) => {
    try {
      const clientId = generateClientId();
      const res = await fetch(`${API_BASE}/getChessLock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, targetPlayer })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('❌ getChessLock接口调用失败：', (err as Error).message);
      return { code: 500, msg: '获取锁失败' };
    }
  }
};

// 初始默认数据
const initDefaultRecord = (): GobangRecord => ({
  currentBoard: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
  currentPlayer: 'black',
  gameOver: false,
  winner: null,
  gameMode: 'online',
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
  const [gameMode, setGameMode] = useState<'ai' | 'human' | 'online'>('online');
  // AI相关状态
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  // 在线对战状态
  const [playerRole, setPlayerRole] = useState<ChessType | 'viewer'>('viewer');
  const [hasLock, setHasLock] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>('正在同步状态...');
  // 轮询定时器
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化客户端ID
  useEffect(() => {
    const clientId = generateClientId();
    localStorage.setItem('gobang_client_id', clientId);
  }, []);

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

  // 选择玩家角色
  const choosePlayerRole = async (role: ChessType | 'viewer') => {
    setPlayerRole(role);
    if (role === 'viewer') {
      setSyncStatus('观战模式');
      setHasLock(false);
    } else {
      setSyncStatus(`已选择${role === 'black' ? '黑棋' : '白棋'}，正在申请落子权限...`);
      // 选择角色后立即申请锁
      const lockRes = await gobangApi.getChessLock(role);
      setHasLock(lockRes.data?.hasLock || false);
      if (lockRes.data?.hasLock) {
        setSyncStatus(`已选择${role === 'black' ? '黑棋' : '白棋'}，已获取落子权限`);
      } else {
        setSyncStatus(`已选择${role === 'black' ? '黑棋' : '白棋'}，${lockRes.msg || '等待落子权限'}`);
      }
    }
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
      // 新增：如果初始模式是online且当前玩家是黑棋，自动申请锁
      if (record.gameMode === 'online' && record.currentPlayer === 'black' && !record.gameOver) {
        const lockRes = await gobangApi.getChessLock('black');
        setHasLock(lockRes.data?.hasLock || false);
        setSyncStatus(lockRes.data?.hasLock ? '已获取落子权限' : lockRes.msg || '等待落子权限');
      }
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

  // 在线对战：实时轮询同步状态
  useEffect(() => {
    if (gameMode === 'online') {

      const requestLock = async (targetPlayer: ChessType) => {
        let retryCount = 0;
        const maxRetry = 3;
        while (retryCount < maxRetry) {
          try {
            const lockRes = await gobangApi.getChessLock(targetPlayer);
            if (lockRes.data?.hasLock) {
              setHasLock(true);
              setSyncStatus('已获取落子权限');
              return true;
            } else {
              setHasLock(false);
              setSyncStatus(lockRes.msg || '等待落子权限');
            }
          } catch (err) {
            setSyncStatus(`获取锁失败(重试${retryCount + 1}/${maxRetry}) : $((err as Error).message)`);
          }
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        setSyncStatus('多次获取锁失败，请刷新页面');
        return false;
      };
      // 启动轮询
      pollingRef.current = setInterval(async () => {
        try {
          const record = await gobangApi.getRecord();
          // 只在数据有变化时更新
          if (record.updateTime !== (window as any).GOBANG_RECORD?.updateTime) {
            setBoard(record.currentBoard);
            setCurrentPlayer(record.currentPlayer);
            setGameOver(record.gameOver);
            setWinner(record.winner);
            (window as any).GOBANG_RECORD = getFullBoardData();
            setSyncStatus('已同步最新状态');
          }

          // 如果是当前玩家回合，尝试获取锁
          if (playerRole === record.currentPlayer && !gameOver && !hasLock) {
            await requestLock(record.currentPlayer);
          } else if (playerRole !== record.currentPlayer && !gameOver) {
            setHasLock(false);
            setSyncStatus(`当前是${record.currentPlayer === 'black' ? '黑棋' : '白棋'}回合`);
          }
        } catch (err) {
          setSyncStatus('同步失败：' + (err as Error).message);
        }
      }, POLLING_INTERVAL);

      // 新增：模式切换为online时，立即为选中的角色申请锁
      if (playerRole !== 'viewer') {
        requestLock(playerRole as ChessType);
      }
    } else {
      // 非online模式清空轮询、重置状态
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setSyncStatus(gameMode === 'human' ? '本地双人对战模式' : '人机对战模式');
      setHasLock(false);
      setPlayerRole('viewer');
    }

    // 清理定时器
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [gameMode, playerRole, hasLock]);

  // 状态变化同步后端（非在线模式）
  useEffect(() => {
    if (gameMode !== 'online') {
      gobangApi.updateRecord({
        currentBoard: board,
        currentPlayer,
        gameOver,
        winner,
        gameMode
      });
      (window as any).GOBANG_RECORD = getFullBoardData();
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

  // 核心修改：重置游戏（前端+后端同步重置）
  const resetGame = async () => {
    const res = await gobangApi.resetRecord();
    if (res.code === 200) {
      setBoard(res.data.currentBoard);
      setCurrentPlayer(res.data.currentPlayer);
      setGameOver(res.data.gameOver);
      setWinner(res.data.winner);
      setIsAiThinking(false);
      setHasLock(false);
      setSyncStatus('游戏已重置');
      // 更新全局变量
      (window as any).GOBANG_RECORD = {
        currentBoard: res.data.currentBoard,
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

  // 检查活二/冲二（AI发展策略）
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

  // 检查棋盘是否下满（平局判断）
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

    // 优先级7：AI形成活二的位置（发展优势）
    bestMove = findTwoInLineMove(newBoard, 'white');
    if (bestMove) {
      executeAiMove(newBoard, bestMove);
      return;
    }

    // 优先级8：堵截玩家活二的位置（限制发展）
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

  // 执行AI落子并更新状态
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

    // 检查是否平局
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

  // 寻找形成二子的落子位置
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

  // 落子逻辑（核心修改：支持在线对战）
  const handleCellClick = async (row: number, col: number) => {
    // 基础校验
    if (gameOver || board[row][col] !== null || isAiThinking) {
      return;
    }

    // 在线对战模式校验
    if (gameMode === 'online') {
      // 观众不能落子
      if (playerRole === 'viewer') {
        setSyncStatus('观战模式不能落子，请选择玩家角色');
        return;
      }
      // 不是当前玩家回合不能落子
      if (playerRole !== currentPlayer) {
        setSyncStatus(`当前是${currentPlayer === 'black' ? '黑棋' : '白棋'}回合，不能落子`);
        return;
      }
      // 没有获取到锁不能落子
      if (!hasLock) {
        setSyncStatus('未获取落子权限，请等待');
        const lockRes = await gobangApi.getChessLock(currentPlayer);
        setHasLock(lockRes.data?.hasLock || false);
        if (!lockRes.data?.hasLock) {
          setSyncStatus(`获取落子权限失败:${lockRes.msg || '锁被占用'}`)
          return;
        } else {
          setSyncStatus('已获取落子权限，可落子')
        }
      }
    }

    // 非在线模式校验
    if (gameMode === 'ai' && currentPlayer !== 'black') {
      return;
    }

    const newBoard = JSON.parse(JSON.stringify(board));
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);

    // 检查是否获胜
    const isWin = checkWin(newBoard, row, col, currentPlayer);
    if (isWin) {
      setGameOver(true);
      setWinner(currentPlayer);
      // 同步到后端
      if (gameMode === 'online') {
        await gobangApi.updateRecord({
          currentBoard: newBoard,
          currentPlayer,
          gameOver: true,
          winner: currentPlayer,
          gameMode
        });
      }
      return;
    }

    // 检查是否平局
    if (isBoardFull(newBoard)) {
      setGameOver(true);
      setWinner(null);
      if (gameMode === 'online') {
        await gobangApi.updateRecord({
          currentBoard: newBoard,
          currentPlayer,
          gameOver: true,
          winner: null,
          gameMode
        });
      }
      return;
    }

    // 切换玩家
    const nextPlayer = currentPlayer === 'black' ? 'white' : 'black';
    setCurrentPlayer(nextPlayer);

    // 在线模式同步到后端
    if (gameMode === 'online') {
      await gobangApi.updateRecord({
        currentBoard: newBoard,
        currentPlayer: nextPlayer,
        gameOver,
        winner,
        gameMode
      });
      // 释放锁
      setHasLock(false);
    }
  };

  return (
    <div className={styles.gobangContainer} id="gobang-root">
      <h2 className={styles.gameTitle}>
        五子棋 {
          gameMode === 'ai' ? '【人机对战】' :
            gameMode === 'human' ? '【双人对战】' : '【局域网对战】'
        }
      </h2>

      {/* 模式选择 */}
      <div className={styles.gameControl} id="gobang-control-bar">
        <button
          id="gobang-btn-ai"
          onClick={() => {
            setGameMode('ai');
            setPlayerRole('viewer');
            setSyncStatus('人机对战模式');
          }}
          className={`${button.button} ${gameMode === 'ai' ? styles.activeBtn : ''}`}
        >
          人机对战
        </button>
        <button
          id="gobang-btn-human"
          onClick={() => {
            setGameMode('human');
            setPlayerRole('viewer');
            setSyncStatus('本地双人对战模式');
          }}
          className={`${button.button} ${gameMode === 'human' ? styles.activeBtn : ''}`}
        >
          本地双人
        </button>
        <button
          id="gobang-btn-online"
          onClick={() => {
            setGameMode('online');
            setSyncStatus('局域网对战模式，等待同步...');
          }}
          className={`${button.button} ${gameMode === 'online' ? styles.activeBtn : ''}`}
        >
          局域网对战
        </button>
        <button
          id="gobang-btn-reset"
          onClick={resetGame}
          className={button.button}
        >
          重置游戏
        </button>
      </div>

      {/* 局域网对战角色选择 */}
      {gameMode === 'online' && (
        <div className={styles.roleSelector} id="gobang-role-selector">
          <p className={styles.syncStatus}>{syncStatus}</p>
          <div className={styles.roleButtons}>
            <button
              onClick={() => choosePlayerRole('black')}
              className={`${button.button} ${playerRole === 'black' ? styles.activeBtn : ''}`}
            >
              选择黑棋
            </button>
            <button
              onClick={() => choosePlayerRole('white')}
              className={`${button.button} ${playerRole === 'white' ? styles.activeBtn : ''}`}
            >
              选择白棋
            </button>
            <button
              onClick={() => choosePlayerRole('viewer')}
              className={`${button.button} ${playerRole === 'viewer' ? styles.activeBtn : ''}`}
            >
              仅观战
            </button>
          </div>
        </div>
      )}

      {/* 游戏状态 */}
      <div id="gobang-game-status" className={styles.gameStatus}>
        {gameOver ? (
          <span id="gobang-winner-text" className={styles.winnerText}>
            {winner ? `${winner === 'black' ? '黑棋' : '白棋'}获胜！` : '游戏平局！'}
          </span>
        ) : (
          <>
            <span id="gobang-current-player">当前回合：{currentPlayer === 'black' ? '黑棋' : '白棋'}</span>
            {isAiThinking && <span className={styles.aiThinking}>AI正在思考...</span>}
            {gameMode === 'online' && playerRole !== 'viewer' && (
              <span className={styles.playerRole}>
                你的角色：{playerRole === 'black' ? '黑棋' : '白棋'}
                {hasLock ? ' ✅ 可落子' : ' ⏳ 等待'}
              </span>
            )}
          </>
        )}
      </div>

      {/* 棋盘 */}
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