const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path'); // 提前引入path模块
const https = require('https');
const http = require('http');
const os = require('os'); // 提前引入os模块
const app = express();

const HTTPS_PORT = 8443;
const HTTP_PORT = 8000;
const BOARD_SIZE = 15;

// 路径定义（提前定义，避免未定义报错）
const GOBANG_RECORD_PATH = path.join(__dirname, 'gobang-record.json');
const USERS_PATH = path.join(__dirname, 'users.json');

// 跨域配置
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true // 允许携带凭证（如localStorage）
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

// 确保记录文件存在
const ensureRecordFile = () => {
  // 检查并创建棋局记录文件
  if (!fs.existsSync(GOBANG_RECORD_PATH)) {
    fs.writeFileSync(GOBANG_RECORD_PATH, JSON.stringify(initDefaultRecord(), null, 2), 'utf8');
  }
  // 检查并创建用户记录文件
  if (!fs.existsSync(USERS_PATH)) {
    fs.writeFileSync(USERS_PATH, JSON.stringify([], null, 2), 'utf8');
  }
};
ensureRecordFile();

// --- 登录接口 ---
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.json({ success: false, message: '用户名或密码不能为空' });
    }
    const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    const user = users.find(u => u.username === username);
    if (!user) return res.json({ success: false, message: '用户名不存在' });
    if (user.password !== password) return res.json({ success: false, message: '密码错误' });
    res.json({
      success: true,
      message: '登录成功',
      userInfo: { username: user.username, role: user.role, class: user.class }
    });
  } catch (err) {
    res.json({ success: false, message: '登录失败', error: err.message });
  }
});

// --- 注册接口 ---
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
      createTime: new Date().toISOString()
    };
    users.push(newUser);
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
    res.json({ success: true, message: '注册成功', userInfo: { username, role, class: className } });
  } catch (err) {
    res.json({ success: false, message: '注册失败', error: err.message });
  }
});

// --- 获取棋盘 ---
app.get('/api/gobang/getRecord', (req, res) => {
  try {
    const record = JSON.parse(fs.readFileSync(GOBANG_RECORD_PATH, 'utf8'));
    res.json({ code: 200, msg: '获取成功', data: record });
  } catch (err) {
    const defaultData = initDefaultRecord();
    res.json({ code: 500, msg: '获取失败，使用默认数据', error: err.message, data: defaultData });
  }
});

// --- 重置棋盘 ---
app.post('/api/gobang/resetRecord', (req, res) => {
  try {
    const defaultData = initDefaultRecord();
    fs.writeFileSync(GOBANG_RECORD_PATH, JSON.stringify(defaultData, null, 2), 'utf8');
    res.json({ code: 200, msg: '重置成功', data: defaultData });
  } catch (err) {
    res.json({ code: 500, msg: '重置失败', error: err.message });
  }
});

// --- 更新棋盘 ---
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

// --- GET 请求提示（避免误调用）---
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

// 静态文件服务（修复path.json语法错误）
app.use(express.static(path.join(__dirname, '../dist')));

// SSL证书配置（请确保证书文件路径正确）
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, '192.168.26.48+1-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '192.168.26.48+1.pem'))
};

// 获取本地IP地址
const getLocalIp = () => {
  const networkInterfaces = os.networkInterfaces();
  let localIp = '192.168.26.48'; // 默认IP
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

// 启动HTTPS服务
https.createServer(sslOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
  console.log('✅ HTTPS 服务运行在：');
  console.log(`   - 本机访问：https://localhost:${HTTPS_PORT}`);
  console.log(`   - 局域网访问：https://${localIp}:${HTTPS_PORT}`);
});