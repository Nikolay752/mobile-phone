const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3001;

// 跨域配置
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '10mb' }));

// 数据文件路径
const GOBANG_RECORD_PATH = path.join(__dirname, 'gobang-record.json');
const USERS_PATH = path.join(__dirname, 'users.json');
const BOARD_SIZE = 15;

// 初始化默认棋盘数据
const initDefaultRecord = () => ({
  currentBoard: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
  currentPlayer: 'black',
  gameOver: false,
  winner: null,
  gameMode: 'human',
  updateTime: new Date().toISOString()
});

// 确保数据文件存在
const ensureRecordFile = () => {
  if (!fs.existsSync(GOBANG_RECORD_PATH)) {
    fs.writeFileSync(GOBANG_RECORD_PATH, JSON.stringify(initDefaultRecord(), null, 2), 'utf8');
  }
  if (!fs.existsSync(USERS_PATH)) {
    fs.writeFileSync(USERS_PATH, JSON.stringify([], null, 2), 'utf8');
  }
};
ensureRecordFile();

// --- 登录接口（无 bcrypt，明文比对）---
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

// --- 注册接口（无 bcrypt，明文存储）---
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
      password, // 明文存储（仅测试用）
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

// --- 五子棋原有接口 ---
app.get('/api/gobang/getRecord', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(GOBANG_RECORD_PATH, 'utf8'));
    res.json({ code: 200, msg: '读取成功', data });
  } catch (err) {
    res.json({ code: 500, msg: '读取失败', data: initDefaultRecord() });
  }
});

app.post('/api/gobang/updateRecord', (req, res) => {
  try {
    const { currentBoard, currentPlayer, gameOver, winner, gameMode } = req.body;
    const newRecord = {
      currentBoard,
      currentPlayer,
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

app.post('/api/gobang/resetRecord', (req, res) => {
  try {
    const defaultData = initDefaultRecord();
    fs.writeFileSync(GOBANG_RECORD_PATH, JSON.stringify(defaultData, null, 2), 'utf8');
    res.json({ code: 200, msg: '重置成功', data: defaultData });
  } catch (err) {
    res.json({ code: 500, msg: '重置失败', error: err.message });
  }
});

// 启动服务
app.listen(PORT, () => {
  console.log(`✅ 服务运行在：http://localhost:${PORT}`);
  console.log(`✅ 可用接口：/api/login、/api/signup、/api/gobang/*`);
});