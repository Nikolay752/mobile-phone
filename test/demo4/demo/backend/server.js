function getBeijingTimeISO() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString();
}

const PLAYER_LOCK_TIMEOUT = 5000;
let currentLock = {
  player: null,
  lockTime: null,
  clientId: null
}

//高德API配置
const AMAP_KEY = 'b52061872e123ac6b92b675264093fb9';
const AMAP_WEATHER_URL = 'https://restapi.amap.com/v3/weather/weatherInfo';
const AMAP_IP_LOCATION_URL = 'https://restapi.amap.com/v3/ip';
const AMap_BASE_URL = 'https://restapi.amap.com';

const getLocationByIP = async () => {
  try {
    const ipRes = await new Promise((resolve, reject) => {
      https.get(`${AMAP_IP_LOCATION_URL}?key=${AMAP_KEY}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
        res.on('error', reject);
      });
    });

    console.log('IP定位结果:', ipRes); // 日志：查看定位是否成功
    // 优先返回adcode，兜底北京adcode 110000
    if (ipRes.status !== '1') {
      console.warn('高德IP定位失败，状态码:', ipRes.status);
      return '110000';
    }
    return ipRes.adcode || '110000';
  } catch (err) {
    console.error('IP定位失败，默认北京:', err);
    return '110000'; // 强制兜底，绝不返回空
  }
};

async function getRegeoByLatLng(lng, lat) {
  const AMAP_KEY = "b52061872e123ac6b92b675264093fb9";
  // 校验经纬度
  const longitude = Number(lng);
  const latitude = Number(lat);
  if (isNaN(longitude) || isNaN(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    console.warn('经纬度无效，返回北京');
    return { fullCityName: "北京市", province: "北京市", city: "", district: "北京市", adcode: "110000" };
  }

  try {
    // Node环境必须用https.get，不能用fetch！
    const regeoRes = await new Promise((resolve, reject) => {
      https.get(
        `${AMap_BASE_URL}/v3/geocode/regeo?key=${AMAP_KEY}&location=${longitude},${latitude}&output=json`,
        (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(JSON.parse(data)));
          res.on('error', reject);
        }
      );
    });

    if (regeoRes.status !== '1' || !regeoRes.regeocode) {
      console.error('逆地理失败', regeoRes);
      return { fullCityName: "北京市", province: "北京市", city: "", district: "北京市", adcode: "110000" };
    }

    const { province, city, district } = regeoRes.regeocode.addressComponent;
    const adcode = regeoRes.regeocode.addressComponent.adcode || '110000';
    console.log("📊 逆地理数据:", { province, city, district, adcode });

    let fullCityName = "";
    const municipalityList = ["北京市", "上海市", "天津市", "重庆市"];
    if (municipalityList.includes(province?.trim())) {
      fullCityName = `${province.trim()}${district?.trim() || ""}`;
    } else if (city?.trim()) {
      fullCityName = `${city.trim()}${district?.trim() || ""}`;
    } else {
      fullCityName = `${province?.trim() || ""}${district?.trim() || ""}`;
    }
    fullCityName = fullCityName.trim() || "北京市";

    return {
      fullCityName,
      province: province || "",
      city: city || "",
      district: district || "",
      adcode: adcode // 关键：返回正确adcode
    };
  } catch (err) {
    console.error('逆地理请求异常:', err);
    return { fullCityName: "北京市", province: "北京市", city: "", district: "北京市", adcode: "110000" };
  }
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
const { resolve } = require('dns');
const { rejects } = require('assert');

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
  updateTime: getBeijingTimeISO(),
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
      highestScore: 0,
      lastLocation: null
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
    const { currentBoard, currentPlayer, gameOver, winner, gameMode, clientId } = req.body;
    const newRecord = {
      currentBoard: currentBoard || Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
      currentPlayer: currentPlayer || 'black',
      gameOver: gameOver ?? false,
      winner: winner ?? null,
      gameMode: gameMode ?? 'human',
      updateTime: getBeijingTimeISO()
    };

    fs.writeFileSync(GOBANG_RECORD_PATH, JSON.stringify(newRecord, null, 2), 'utf8');

    //骡子后释放锁
    if (clientId && currentLock.clientId === clientId) {
      currentLock = { player: null, lockTime: null, clientId: null };
    }
    res.json({ code: 200, msg: '更新成功', data: newRecord });
  } catch (err) {
    res.json({ code: 500, msg: '更新失败', error: err.message });
  }
});

//定时清理过期锁
setInterval(() => {
  const now = Date.now();
  if (currentLock.lockTime && (now - currentLock.lockTime) > PLAYER_LOCK_TIMEOUT) {
    currentLock = { player: null, lockTime: null, clientId: null };
  }
}, 1000);

// 更新用户最高分
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

//获取落子锁接口
app.post('/api/gobang/getChessLock', (req, res) => {
  try {
    const { clientId, targetPlayer } = req.body;
    const now = Date.now();

    //检查锁是否过期
    if (currentLock.lockTime && (now - currentLock.lockTime) > PLAYER_LOCK_TIMEOUT) {
      currentLock = { player: null, lockTime: null, clientId: null };
    }

    //检查目标玩家是否可锁定
    const record = JSON.parse(fs.readFileSync(GOBANG_RECORD_PATH, 'utf8'));
    if (record.gameOver) {
      return res.json({ code: 400, msg: '游戏已结束，无法获取锁' });
    }
    if (record.currentPlayer === targetPlayer) {
      if (!currentLock.player || currentLock.clientId === clientId) {
        currentLock = {
          player: targetPlayer,
          lockTime: now,
          clientId
        };
        return res.json({ code: 200, msg: '获取锁成功', data: { hasLock: true } });
      } else {
        return res.json({ code: 403, msg: '当前回合被其他玩家占用', data: { hasLock: false } });
      }
    } else {
      return res.json({ code: 400, msg: '非当前回合，无法获取锁', data: { hasLock: false } });
    }
  } catch (err) {
    res.json({ code: 500, msg: '获取锁失败', error: err.message });
  }
});

app.post('/api/updateUserLocation', async (req, res) => {
  try {
    const { username, location } = req.body;
    if (!username || !location) {
      return res.json({ success: false, message: '用户名和定位不能为空' });
    }
    const FILE_LOCK_TIMEOUT = 5000;
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
    if (!users) {
      return res.json({ success: false, message: '读取用户文件超时' });
    }
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex === -1) {
      return res.json({ success: false, message: '用户不存在' });
    }
    user[userIndex].lastLocation = location;
    let writeSuccess = false;
    const writeStart = Date.now();
    while (!writeSuccess && Date.now() - writeStart < FILE_LOCK_TIMEOUT) {
      try {
        fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
        writeSuccess = true;
      } catch (e) {
        if (e.code === 'EBUSY' || e, code === 'EACCES') {
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
      message: '更新用户定位成功',
      data: { username, lastLocation: location }
    });
  } catch (err) {
    res.json({
      success: false,
      message: '更新定位失败',
      error: err.message
    })
  }
})


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

// 天气查询接口（最终修复：实时天气+地址正确+字段完全匹配前端）
app.get('/api/weather', async (req, res) => {
  try {
    const { city, lng, lat } = req.query;
    console.log('天气请求参数:', { lng, lat });
    let adcode = '110000';
    let fullCityName = '北京市';

    // 1. 经纬度→逆地理(拿adcode+城市)
    if (lng && lat) {
      const regeoData = await getRegeoByLatLng(lng, lat);
      adcode = regeoData.adcode;
      fullCityName = regeoData.fullCityName;
    }
    // 2. IP定位兜底
    else {
      adcode = await getLocationByIP();
      fullCityName = '定位城市';
    }

    // 2. 请求高德实时天气（唯一正确方式）
    const weatherRes = await new Promise((resolve, reject) => {
      https.get(
        `${AMAP_WEATHER_URL}?key=${AMAP_KEY}&city=${adcode}&extensions=base&output=json`,
        (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(JSON.parse(data)));
          res.on('error', reject);
        }
      );
    });

    // 3. 失败兜底
    if (weatherRes.status !== '1' || !weatherRes.lives || weatherRes.lives.length === 0) {
      return res.json({
        success: true,
        data: {
          data: [{
            city: fullCityName,
            tem1: '20',
            tem2: '15',
            wea: '多云',
            win: '东北风',
            win_speed: '2级',
            humidity: '60%',
            update_time: new Date().toLocaleString()
          }]
        }
      });
    }

    // 4. 实时数据映射
    const live = weatherRes.lives[0];
    const formattedData = {
      data: [{
        city: fullCityName,
        tem1: live.temperature || '20',
        tem2: live.temperature || '15',
        wea: live.weather || '晴',
        win: live.winddirection || '无风',
        win_speed: live.windpower ? `${live.windpower}级` : '2级',
        humidity: live.humidity ? `${live.humidity}%` : '60%',
        update_time: live.reporttime || new Date().toLocaleString()
      }]
    };

    res.json({ success: true, data: formattedData });
  } catch (err) {
    console.error('天气接口异常:', err);
    res.json({
      success: true,
      data: {
        data: [{
          city: '杭州市余杭区',
          tem1: '20', tem2: '15', wea: '多云', win: '东北风', win_speed: '2级', humidity: '60%',
          update_time: new Date().toLocaleString()
        }]
      }
    });
  }
});

app.get('/api/geo/regeo', async (req, res) => {
  try {
    const { lng, lat } = req.query;
    console.log('逆地理编码请求:', { lng, lat });
    const regeoData = await getRegeoByLatLng(lng, lat);
    res.json({
      success: true,
      data: {
        city: regeoData.fullCityName, // 核心：返回地级市+区
        adcode: regeoData.adcode,
        address: regeoData.fullCityName
      }
    });
  } catch (err) {
    console.error('逆地理编码接口异常:', err);
    res.json({
      success: true,
      data: { city: '杭州市余杭区', adcode: '110000', address: '杭州市余杭区' }
    });
  }
});

//获取城市，默认北京
const getCity = async () => {
  try {
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();
    return data.city || "北京";
  } catch {
    console.error("定位失败，默认北京");
    return "北京";
  }
}

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