/**
 * PageAgent 五子棋棋盘数据读取脚本
 * 功能：优先读全局变量 → 兜底调接口 → 1秒定时轮询（和棋盘更新频率一致）
 * 修复：重复请求限制、数据统一解析、详细日志
 */
let isRequesting = false; // 防止重复请求
const POLL_INTERVAL = 1000; // 核心修改：改为1秒轮询，和棋盘自动更新频率一致
// 统一解析棋盘数据（全局变量/接口返回数据通用）
const parseBoardData = (rawData) => {
  if (!rawData || (!rawData.currentBoard && !rawData.board)) return null;
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
    updateTime: rawData.updateTime || new Date().getTime(), // 修复：无更新时间时兜底
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
      boardData = { ...window.GOBANG_RECORD }; // 深拷贝避免污染原全局变量
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

// ==============================================
// 五子棋棋盘可视化渲染逻辑（核心修复区）
// ==============================================
(function initGobangRender() {
  // 标记是否已初始化渲染器，避免重复创建DOM
  let isRenderInited = false;
  // 缓存DOM节点，避免重复查询
  let cacheDom = {
    statusPanel: null,
    boardContainer: null
  };

  // 1. 创建棋盘容器DOM（单例模式：只创建一次）
  function createBoardDom() {
    if (isRenderInited) return cacheDom;

    // 创建状态面板
    let statusPanel = document.getElementById('gobang-reader-status');
    if (!statusPanel) {
      statusPanel = document.createElement('div');
      statusPanel.id = 'gobang-reader-status';
      statusPanel.style.cssText = `text-align:center;font-size:18px;margin:20px 0;color:#333;`;
      document.body.appendChild(statusPanel);
    }

    // 创建棋盘容器
    let boardContainer = document.getElementById('gobang-reader-board');
    if (!boardContainer) {
      boardContainer = document.createElement('div');
      boardContainer.id = 'gobang-reader-board';
      boardContainer.style.cssText = `display:grid;grid-template:repeat(15,40px)/repeat(15,40px);gap:1px;background:#f0d9b5;padding:10px;border:8px solid #b58863;margin:0 auto;width:fit-content;`;
      document.body.appendChild(boardContainer);
      // 初始化15x15棋盘格子（只初始化一次）
      for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
          const cell = document.createElement('div');
          cell.className = 'gobang-reader-cell';
          cell.dataset.row = row;
          cell.dataset.col = col;
          cell.style.cssText = `width:40px;height:40px;display:flex;align-items:center;justify-content:center;`;
          boardContainer.appendChild(cell);
        }
      }
    }

    // 缓存DOM并标记初始化完成
    cacheDom = { statusPanel, boardContainer };
    isRenderInited = true;
    return cacheDom;
  }

  // 2. 根据解析后的棋盘数据，渲染棋子+更新状态
  function renderGobangBoard(parsedData) {
    const { statusPanel, boardContainer } = createBoardDom();
    if (!parsedData) {
      statusPanel.innerHTML = `<p style="color:red;">❌ 暂无棋盘数据</p>`;
      return;
    }

    // 更新顶部状态信息
    statusPanel.innerHTML = `
      <h3>五子棋实时数据（1秒自动更新）</h3>
      <p>游戏状态：${parsedData.gameStatus} | 当前回合：${parsedData.currentPlayer}</p>
      <p>获胜方：${parsedData.winner} | 游戏模式：${parsedData.gameMode}</p>
      <p>棋子数量：黑棋${parsedData.chessCount.black}颗 | 白棋${parsedData.chessCount.white}颗</p>
      <p style="font-size:14px;color:#666;">最后更新：${new Date(parsedData.updateTime).toLocaleString()} | 数据来源：${parsedData.source}</p>
    `;

    // 清空原有棋子（优化：避免重复DOM操作）
    document.querySelectorAll('.gobang-reader-chess').forEach(el => el.remove());

    // 遍历棋盘数据，渲染黑棋/白棋
    const board = parsedData.currentBoard;
    board.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell === 'black' || cell === 'white') {
          const chessCell = document.querySelector(`.gobang-reader-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`);
          if (chessCell) {
            const chess = document.createElement('div');
            chess.className = 'gobang-reader-chess';
            chess.style.cssText = `width:36px;height:36px;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.3);${cell === 'black' ? 'background:#000;' : 'background:#fff;border:1px solid #ccc;'}`;
            chessCell.appendChild(chess);
          }
        }
      });
    });
  }

  // 3. 增强版轮询逻辑：避免重复定时器
  let pollTimer = null; // 缓存定时器实例
  function startAutoPolling() {
    // 先清除旧定时器，防止重复
    if (pollTimer) clearInterval(pollTimer);

    // 立即执行一次读取+渲染
    const executeReadAndRender = async () => {
      const parsedData = await pageAgentReadGlobalBoard();
      renderGobangBoard(parsedData);
    };
    executeReadAndRender();

    // 启动新的定时轮询
    pollTimer = setInterval(executeReadAndRender, POLL_INTERVAL);
    console.log(`[PageAgent-${new Date().toLocaleTimeString()}] 🚀 棋盘数据读取+渲染脚本已加载，1秒自动轮询最新数据`);
  }

  // 页面加载完成后启动（兼容异步加载）
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    startAutoPolling();
  } else {
    document.addEventListener('DOMContentLoaded', startAutoPolling);
  }

  // 暴露全局方法（保留原方法，新增渲染能力）
  window.pageAgentReadGlobalBoard = pageAgentReadGlobalBoard;
  window.renderGobangBoard = renderGobangBoard; // 暴露渲染方法，方便手动调试
})();