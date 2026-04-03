function getBeijingTimeISO() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString();
}

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');
const app = express();
const { setTimeout } = require('timers/promises');

const HTTPS_PORT = 8443;
const HTTP_PORT = 8000;
const BOARD_SIZE = 15;

// 路径定义
const GOBANG_RECORD_PATH = path.join(__dirname, 'gobang-record.json');
const USERS_PATH = path.join(__dirname, 'users.json');

// 跨域配置
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// 初始化默认棋局记录
const initDefaultRecord = () => ({
  currentBoard: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
  currentPlayer: 'black',
  gameOver: false,
  winner: null,
  gameMode: 'human',
  updateTime: new Date().toISOString()
});

// 定时重置所有用户的登录状态（修复版）
const autoResetLoadingStatus = async () => {
  const FILE_LOCK_TIMEOUT = 5000;

  while (true) {
    try {
      // 1. 读取用户文件（增加超时保护）
      let users;
      const readStart = Date.now();
      while (!users && Date.now() - readStart < FILE_LOCK_TIMEOUT) {
        try {
          users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
        } catch (e) {
          if (e.code === 'EBUSY' || e.code === 'EACCES') {
            await setTimeout(100);
          } else {
            throw e;
          }
        }
      }

      // 3. 写入文件
      let writeSuccess = false;
      const writeStart = Date.now();
      while (!writeSuccess && Date.now() - writeStart < FILE_LOCK_TIMEOUT) {
        try {
          fs.writeFileSync(USERS_PATH, JSON.stringify(updatedUsers, null, 2), 'utf8');
          writeSuccess = true;
        } catch (e) {
          if (e.code === 'EBUSY' || e.code === 'EACCES') {
            await setTimeout(100);
          } else {
            throw e;
          }
        }
      }

    } catch (err) {
    }


    // 固定10秒间隔
    await setTimeout(10 * 1000);
  }
};

// 启动定时任务
autoResetLoadingStatus().catch(err => {
  console.error('定时任务崩溃:', err);
  setTimeout(autoResetLoadingStatus, 5000);
});

// 确保记录文件存在
const ensureRecordFile = () => {
  if (!fs.existsSync(GOBANG_RECORD_PATH)) {
    fs.writeFileSync(GOBANG_RECORD_PATH, JSON.stringify(initDefaultRecord(), null, 2), 'utf8');
  }
  if (!fs.existsSync(USERS_PATH)) {
    fs.writeFileSync(USERS_PATH, JSON.stringify([], null, 2), 'utf8');
  }
};
ensureRecordFile();

// 登录接口
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.json({ success: false, message: '用户名或密码不能为空' });
    }

    const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex === -1) {
      return res.json({ success: false, message: '用户名不存在' });
    }

    // 更新isLoading为true
    users[userIndex].isLoading = true;
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');

    // 验证密码
    const user = users[userIndex];
    if (user.password !== password) {
      // 密码错误时重置状态
      users[userIndex].isLoading = false;
      fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
      return res.json({ success: false, message: '密码错误' });
    }

    // 更新登录时间
    user.loginTime = getBeijingTimeISO();
    user.logoutTime = null;
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');

    res.json({
      success: true,
      message: '登录成功',
      userInfo: {
        id: user.id,
        username: user.username,
        role: user.role,
        class: user.class,
        loginTime: user.loginTime,
        isLoading: user.isLoading,
        logoutTime: user.logoutTime,
        highestScore: user.highestScore || 0
      }
    });
  } catch (err) {
    // 异常时重置状态
    try {
      const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
      const userIndex = users.findIndex(u => u.username === req.body.username);
      if (userIndex !== -1) {
        users[userIndex].isLoading = false;
        fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
      }
    } catch (e) {
      console.error('登录异常重置状态失败:', e);
    }

    res.json({ success: false, message: '登录失败', error: err.message });
  }
});

// 退出登录接口
// 退出登录接口（修复完整版）
app.post('/api/logout', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.json({ success: false, message: '用户名不能为空' });
    }

    // 读取用户列表
    const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    const userIndex = users.findIndex(u => u.username === username);

    if (userIndex === -1) {
      return res.json({ success: false, message: '用户不存在' });
    }

    // 正确更新退出状态：重置登录状态 + 记录退出时间
    users[userIndex].isLoading = false;
    users[userIndex].logoutTime = getBeijingTimeISO();

    // 写入文件
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');

    res.json({
      success: true,
      message: '退出成功',
      data: {
        username: username,
        isLogin: false
      }
    });
  } catch (err) {
    res.json({
      success: false,
      message: '退出失败',
      error: err.message
    });
  }
});

// 注册接口
app.post('/api/signup', (req, res) => {
  try {
    const { username, password, role, class: className } = req.body;
    if (!username || !password || !role || !className) {
      return res.json({ success: false, message: '参数缺失：用户名、密码、角色、班级均为必填项' });
    }
    if (password.length < 6) {
      return res.json({ success: false, message: '密码长度不能少于6位' });
    }

    const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    if (users.some(u => u.username === username)) {
      return res.json({ success: false, message: '用户名已存在' });
    }

    const newUser = {
      id: Date.now(),
      username,
      password,
      role,
      class: className,
      createTime: getBeijingTimeISO(),
      isLoading: false,
      loginTime: null,
      logoutTime: null,
      highestScore: 0
    };

    users.push(newUser);
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');

    res.json({
      success: true,
      message: '注册成功',
      userInfo: {
        id: newUser.id,
        username,
        role,
        class: className,
        isLoading: newUser.isLoading,
        loginTime: null,
        logoutTime: null,
        highestScore: 0
      }
    });
  } catch (err) {
    res.json({ success: false, message: '注册失败', error: err.message });
  }
});

// 获取用户登录状态接口
app.post('/api/getUserLoadingStatus', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.json({ success: false, message: '用户名不能为空' });
    }

    const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.json({ success: false, message: '用户名不存在' });
    }

    res.json({
      success: true,
      isLoading: user.isLoading,
      message: '获取登录状态成功'
    });
  } catch (err) {
    res.json({ success: false, message: '获取状态失败', error: err.message });
  }
});

// 重置用户登录状态接口
app.post('/api/resetUserLoadingStatus', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.json({ success: false, message: '用户名不能为空' });
    }

    const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex === -1) {
      return res.json({ success: false, message: '用户名不存在' });
    }

    users[userIndex].isLoading = false;
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');

    res.json({
      success: true,
      message: '重置登录状态成功',
      isLoading: users[userIndex].isLoading
    });
  } catch (err) {
    res.json({ success: false, message: '重置状态失败', error: err.message });
  }
});

// 获取棋盘
app.get('/api/gobang/getRecord', (req, res) => {
  try {
    const record = JSON.parse(fs.readFileSync(GOBANG_RECORD_PATH, 'utf8'));
    res.json({ code: 200, msg: '获取成功', data: record });
  } catch (err) {
    const defaultData = initDefaultRecord();
    res.json({ code: 500, msg: '获取失败，使用默认数据', error: err.message, data: defaultData });
  }
});

// 重置棋盘
app.post('/api/gobang/resetRecord', (req, res) => {
  try {
    const defaultData = initDefaultRecord();
    fs.writeFileSync(GOBANG_RECORD_PATH, JSON.stringify(defaultData, null, 2), 'utf8');
    res.json({ code: 200, msg: '重置成功', data: defaultData });
  } catch (err) {
    res.json({ code: 500, msg: '重置失败', error: err.message });
  }
});

// 更新棋盘
app.post('/api/gobang/updateRecord', (req, res) => {
  try {
    const { currentBoard, currentPlayer, gameOver, winner, gameMode } = req.body;
    const newRecord = {
      currentBoard: currentBoard || Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
      currentPlayer: currentPlayer || 'black',
      gameOver: gameOver ?? false,
      winner: winner ?? null,
      gameMode: gameMode ?? 'human',
      updateTime: new Date().toISOString()
    };

    fs.writeFileSync(GOBANG_RECORD_PATH, JSON.stringify(newRecord, null, 2), 'utf8');
    res.json({ code: 200, msg: '更新成功', data: newRecord });
  } catch (err) {
    res.json({ code: 500, msg: '更新失败', error: err.message });
  }
});

// 更新用户最高分
// 更新用户最高分（修复版）
app.post('/api/updateHighestScore', async (req, res) => { // 改为async
  try {
    const { username, score } = req.body;
    if (!username || score === undefined || isNaN(score)) {
      return res.json({ success: false, message: '用户名和分数不能为空' });
    }

    const FILE_LOCK_TIMEOUT = 5000;
    let users;
    // 读取文件（增加重试逻辑，兼容文件锁定）
    const readStart = Date.now();
    while (!users && Date.now() - readStart < FILE_LOCK_TIMEOUT) {
      try {
        users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
      } catch (e) {
        if (e.code === 'EBUSY' || e.code === 'EACCES') {
          await setTimeout(100);
        } else {
          throw e;
        }
      }
    }

    if (!users) {
      return res.json({ success: false, message: '读取用户文件超时' });
    }

    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex === -1) {
      return res.json({ success: false, message: '用户不存在' });
    }

    const oldScore = users[userIndex].highestScore || 0;
    if (score > oldScore) {
      users[userIndex].highestScore = score;
      // 写入文件（增加重试逻辑）
      let writeSuccess = false;
      const writeStart = Date.now();
      while (!writeSuccess && Date.now() - writeStart < FILE_LOCK_TIMEOUT) {
        try {
          fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
          writeSuccess = true;
        } catch (e) {
          if (e.code === 'EBUSY' || e.code === 'EACCES') {
            await setTimeout(100);
          } else {
            throw e;
          }
        }
      }

      if (!writeSuccess) {
        return res.json({ success: false, message: '写入用户文件超时' });
      }

      res.json({
        success: true,
        message: '更新最高分成功',
        data: {
          username,
          oldScore: oldScore,
          newScore: score,
          highestScore: score
        }
      });
    } else {
      res.json({
        success: true,
        message: '分数未突破，不更新',
        data: { highestScore: oldScore }
      });
    }
  } catch (err) {
    res.json({
      success: false,
      message: '服务器错误',
      error: err.message
    });
  }
});

// 获取用户最高分接口
app.post('/api/getHighestScore', (req, res) => { // 修复req/res顺序
  try {
    const { username } = req.body;
    if (!username) {
      return res.json({ success: false, message: '用户名不能为空' });
    }

    const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    const user = users.find(u => u.username === username);

    if (!user) {
      return res.json({ success: false, message: '用户不存在' });
    }

    res.json({
      success: true,
      message: '获取最高分成功',
      data: {
        username,
        highestScore: user.highestScore || 0
      }
    });
  } catch (err) {
    res.json({
      success: false,
      message: '获取最高分失败',
      error: err.message
    });
  }
});

// GET 请求提示
app.get('/api/login', (req, res) => {
  res.json({ success: false, message: '该接口仅支持POST请求，请通过表单/接口工具调用' });
});
app.get('/api/signup', (req, res) => {
  res.json({ success: false, message: '该接口仅支持POST请求，请通过表单/接口工具调用' });
});
app.get('/api/gobang/resetRecord', (req, res) => {
  res.json({ code: 405, msg: '该接口仅支持POST请求，请使用POST方式调用' });
});
app.get('/api/gobang/updateRecord', (req, res) => {
  res.json({ code: 405, msg: '该接口仅支持POST请求，请使用POST方式调用' });
});

// 静态文件服务
app.use(express.static(path.join(__dirname, '../dist')));

// SSL证书配置（请确保证书文件路径正确）
const sslOptions = {
  key: fs.existsSync(path.join(__dirname, '192.168.26.48+1-key.pem'))
    ? fs.readFileSync(path.join(__dirname, '192.168.26.48+1-key.pem'))
    : '',
  cert: fs.existsSync(path.join(__dirname, '192.168.26.48+1.pem'))
    ? fs.readFileSync(path.join(__dirname, '192.168.26.48+1.pem'))
    : ''
};

// 获取本地IP地址
const getLocalIp = () => {
  const networkInterfaces = os.networkInterfaces();
  let localIp = '192.168.26.48';
  for (const key of Object.keys(networkInterfaces)) {
    for (const iface of networkInterfaces[key]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address;
        break;
      }
    }
  }
  return localIp;
};
const localIp = getLocalIp();

// 启动HTTP服务
http.createServer(app).listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`✅ HTTP 服务运行在：`);
  console.log(`   - 本机访问：http://localhost:${HTTP_PORT}`);
  console.log(`   - 局域网访问：http://${localIp}:${HTTP_PORT}`);
});

// 启动HTTPS服务（仅当证书存在时）
if (sslOptions.key && sslOptions.cert) {
  https.createServer(sslOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log('✅ HTTPS 服务运行在：');
    console.log(`   - 本机访问：https://localhost:${HTTPS_PORT}`);
    console.log(`   - 局域网访问：https://${localIp}:${HTTPS_PORT}`);
  });
} else {
  console.log('⚠️ HTTPS证书不存在，仅启动HTTP服务');
}