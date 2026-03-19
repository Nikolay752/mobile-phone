/**
 * PageAgent 五子棋棋盘数据读取脚本
 * 功能：优先读全局变量 → 兜底调接口 → 1秒定时轮询（和棋盘更新频率一致）
 * 修复：重复请求限制、数据统一解析、详细日志
 */
let isRequesting = false; // 防止重复请求
const POLL_INTERVAL = 1000; // 核心修改：改为1秒轮询，和棋盘自动更新频率一致
// 统一解析棋盘数据（全局变量/接口返回数据通用）
const parseBoardData = (rawData) => {
  if (!rawData || !rawData.currentBoard && !rawData.board) return null;
  // 兼容全局变量的board字段和接口的currentBoard字段
  const realBoard = rawData.currentBoard || rawData.board;
  // 统计棋子数量
  const chessCount = realBoard.reduce((cnt, row) => {
    row.forEach(cell => {
      if (cell === 'black') cnt.black++;
      else if (cell === 'white') cnt.white++;
    });
    return cnt;
  }, { black: 0, white: 0 });
  // 封装标准化数据
  return {
    gameStatus: rawData.gameOver ? '已结束' : '进行中',
    currentPlayer: rawData.currentPlayer === 'black' ? '黑棋' : '白棋',
    winner: rawData.winner ? (rawData.winner === 'black' ? '黑棋' : '白棋') : '无',
    gameMode: rawData.gameMode === 'ai' ? '人机对战' : '双人对战',
    chessCount,
    currentBoard: realBoard,
    updateTime: rawData.updateTime,
    source: rawData.source || '未知'
  };
};

// 兜底：调用API获取数据
const fetchBoardFromApi = async () => {
  try {
    const res = await fetch('http://localhost:3001/api/gobang/getRecord', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-cache' // 禁用缓存，确保获取最新1秒同步的数据
    });
    if (!res.ok) throw new Error(`HTTP错误：${res.status} ${res.statusText}`);
    const data = await res.json();
    if (data.code !== 200) throw new Error(data.msg || '接口返回异常');
    // 标记数据来源
    data.data.source = '接口请求';
    return data.data;
  } catch (err) {
    console.error(`[PageAgent-${new Date().toLocaleTimeString()}] ❌ 接口请求失败：`, err.message);
    return null;
  }
};

// 核心方法：读取棋盘数据
const pageAgentReadGlobalBoard = async () => {
  // 防止重复请求
  if (isRequesting) return;
  isRequesting = true;
  try {
    // 前置校验：浏览器环境
    if (typeof window === 'undefined') {
      throw new Error('非浏览器环境，无法执行');
    }
    let boardData = null;
    let parsedData = null;
    // 第一步：读取全局变量（棋盘1秒同步一次，全局变量始终最新）
    if (window.GOBANG_RECORD) {
      boardData = window.GOBANG_RECORD;
      boardData.source = '全局变量（1秒同步）';
      console.log(`[PageAgent-${new Date().toLocaleTimeString()}] ⚡ 从全局变量读取最新棋盘数据`);
    } 
    // 第二步：全局变量无效则调用接口
    else {
      boardData = await fetchBoardFromApi();
    }
    // 解析数据并输出
    if (boardData) {
      parsedData = parseBoardData(boardData);
      if (parsedData) {
        console.log(`[PageAgent-${new Date().toLocaleTimeString()}] ✅ 数据读取成功`, parsedData);
      } else {
        console.warn(`[PageAgent-${new Date().toLocaleTimeString()}] ⚠️  数据解析失败，原始数据：`, boardData);
      }
    } else {
      console.error(`[PageAgent-${new Date().toLocaleTimeString()}] ❌ 全局变量+接口均获取失败`);
    }
    return parsedData;
  } catch (err) {
    console.error(`[PageAgent-${new Date().toLocaleTimeString()}] ❌ 执行失败：`, err.message);
    return null;
  } finally {
    // 释放请求锁
    isRequesting = false;
  }
};

// 初始化执行
pageAgentReadGlobalBoard();

// 定时轮询（和棋盘更新频率一致，1秒一次）
setInterval(() => {
  if (!isRequesting) {
    pageAgentReadGlobalBoard();
  }
}, POLL_INTERVAL);

// 暴露全局方法，方便手动调用
window.pageAgentReadGlobalBoard = pageAgentReadGlobalBoard;
console.log(`[PageAgent-${new Date().toLocaleTimeString()}] 🚀 棋盘数据读取脚本已加载，1秒自动轮询最新数据`);