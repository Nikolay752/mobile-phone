// system.tsx 修正后代码
import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from 'umi';
import Mainstyle from '@/layouts/Mainstyle_system.less';
import button from '../layouts/button_back.less';
import spanstyle from '../layouts/span_title.less';
import button_Stu from '../layouts/button_Stu.less';
import Hello from "@/layouts/Hello";
import { PageAgent } from 'page-agent';

// 移除无效导入（原clear未使用且路径异常）

export default function SystemPage() {
  const navigate = useNavigate();
  const [agentAnswer, setAgentAnswer] = useState<string>('');
  const [agentLoading, setAgentLoading] = useState<boolean>(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  // 新增缺失的状态声明
  const [currentTime, setCurrentTime] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [username, setUsername] = useState<string>('');

  const panelCloseHandlerRef = useRef<(() => void) | null>(null);

  // 初始化 PageAgent（直接使用硬编码的API Key）
  const agent = new PageAgent({
    model: 'qwen3.5-plus',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: 'sk-39d259240a734b7983b83579a934f1bf', // 直接使用硬编码的Key
    language: 'zh-CN',
    instructions: {
      // 继承上面的 system 全局规则
      system: `# 【课表管理系统】全局核心知识 + 强制规则
## 一、系统通用业务知识（基础认知）
1. 系统身份：仅支持「学生」「教师」两种角色，角色信息存储在localStorage的role字段，无角色/角色不匹配时无对应页面权限。
2. 核心模块：学生端（个人课表）、教师端（授课课表+学生分数+院系分布+人数统计）、系统首页（角色入口）。
3. 通用组件：所有功能页都有「刷新按钮」（用于重置页面数据、重新渲染可视化）、「back按钮」（返回系统首页），无关闭按钮。
4. 数据规则：所有模块数据为空时，需显示「暂无XX数据」友好提示，无报错弹窗；接口异常时页面无显性提示，仅数据不渲染。
5. 可视化规则：课表均为图表可视化（.chart-container），统计信息为卡片式（.stats-section），加载中会显示「加载中」文字提示。

## 二、全局强制操作+日志规则
1. 【DOM快照日志】：每次操作前，必须打印当前页面的关键节点状态。
  格式：[DOM-LOG] 目标元素：[选择器]，可见性：[可见/不可见]，文本内容：[截取前50字]
2. 【流程状态日志】：每完成一步（如点击、验证），必须打印：
  格式：[STEP-LOG] 步骤：[步骤名]，结果：[成功/失败]，耗时：[ms]
3. 【异常兜底日志】：若页面未出现预期元素，必须立即抛出，格式：
  格式：[ERROR-LOG] 缺失模块：[模块名]，原因：[未加载/无数据/接口异常/无权限]
4. 【通用操作原则】：禁止点击页面标题（如「个人课表」「授课课表」）、禁止重复点击按钮（跳转/刷新失败后仅记录，不重复操作）、优先检查DOM元素存在性再执行操作。
`,

      // 页面级动态指导
      getPageInstructions: (url) => {
        // 学生端课表页面
        if (url.includes('/system/student')) {
          return `
# 【学生端-个人课表页面】专属知识与操作指引
## 一、页面专属结构知识
1. 核心DOM选择器：课表图表（.chart-container）、刷新按钮（.refresh-btn）、无数据提示（.empty-tip）。
2. 页面布局：左侧为课表可视化图表，右侧无额外模块，顶部有back按钮，无其他功能按钮。
3. 数据关联：课表数据来自/api/student/course接口，刷新按钮会重新调用该接口。

## 二、核心执行目标
验证个人课表可视化加载状态、刷新功能有效性、无数据场景的友好提示展示。

## 三、精细化操作步骤
1. 前置检查：先通过[DOM-LOG]打印.chart-container、.refresh-btn的状态，确认元素是否可见。
2. 状态验证：检查.chart-container内是否有课表内容，若无则检查.empty-tip是否显示「暂无课表数据」。
3. 刷新测试：点击.refresh-btn，立即检查页面是否出现「加载中」提示，等待1s后重新验证.chart-container的渲染状态。
4. 结果记录：有数据则标记课程名称数量，无数据则记录「暂无课表数据」，元素缺失则抛出[ERROR-LOG]。

## 四、专属异常排查逻辑
1. 若.chart-container不可见：原因优先判定为「接口异常（/api/student/course返回失败）」。
2. 若.chart-container为空但无.empty-tip：原因判定为「页面渲染异常，未加载无数据提示」。
3. 若点击.refresh-btn无反应：原因判定为「按钮绑定事件失效」。

## 五、详细描述
1、课程图标区域就是个人课表，蓝点表示课程，一个蓝点代表一节课。
2、页面内除了按钮请勿多次点击，也不要随便点击按钮。
3、点击刷新按钮后请耐心等待，刷新过程中请勿重复点击。
4、“个人课表”这四个字下有一张表格，是课程表，横坐标对应的是周几，纵坐标对应的是课在第几节，鼠标移入时也会有提示。
5、页面不在加载中，课表显示正常。课表就在"个人课表"这四个字下面，当鼠标移入蓝点时会有提示。
       `;
        }

        // 教师端授课课表页面
        if (url.includes('/system/teacher')) {
          return `
# 【教师端-授课课表页面】专属知识与操作指引
## 一、页面专属结构知识
1. 核心DOM选择器：授课课表（.teacher-chart）、学生分数（.score-card）、院系分布（.dept-chart）、人数统计（.count-stats）、刷新按钮（.refresh-btn）、无数据提示（.empty-tip）。
2. 页面布局：四模块横向排列，顶部有back按钮，所有模块共享一个刷新按钮。
3. 数据关联：授课课表(/api/teacher/course)、分数(/api/teacher/score)、院系(/api/teacher/dept)、人数(/api/teacher/count)，刷新按钮会同时调用4个接口。

## 二、核心执行目标
验证四模块可视化/卡片的加载状态、刷新功能的批量生效性、单个模块无数据的提示展示。

## 三、精细化操作步骤
1. 前置检查：依次打印4个核心模块+刷新按钮的DOM状态，确认所有元素是否可见。
2. 状态验证：逐个检查模块是否有数据，无数据则检查对应模块内是否有.empty-tip及「暂无XX数据」提示。
3. 刷新测试：点击.refresh-btn，检查所有模块是否同时显示「加载中」，等待2s后重新验证所有模块的渲染状态。
4. 结果记录：记录有数据模块的核心信息，无数据模块标记对应提示，元素缺失则抛出[ERROR-LOG]。

## 四、专属异常排查逻辑
1. 若单个模块无数据：仅判定为「该模块接口返回空」，不影响其他模块判定。
2. 若所有模块均无数据：原因优先判定为「教师无授课数据，所有接口返回空」。
3. 若点击刷新后部分模块重新渲染：原因判定为「接口响应速度不一致，页面渲染异步异常」。
       `;
        }

        // 系统首页
        if (url.includes('/system')) {
          return `
# 【系统首页】专属知识与操作指引
## 一、页面专属结构知识
1. 核心DOM选择器：学生系统按钮（.stu-btn）、教师系统按钮（.tea-btn）、用户名展示（.username）、当前时间（.current-time）。
2. 页面布局：两个功能按钮居中，顶部显示用户名和back按钮，底部显示当前时间。
3. 权限规则：按钮跳转前需校验localStorage的role字段，角色与按钮不匹配时会弹出「无XX权限」提示。

## 二、核心执行目标
验证角色权限校验逻辑、两个功能按钮的跳转有效性、未登录/角色缺失的异常处理。

## 三、精细化操作步骤
1. 前置检查：打印两个按钮的DOM状态，检查localStorage的role/token字段是否存在（控制台打印）。
2. 跳转测试：先点击当前角色匹配的按钮，验证是否跳转到对应课表页面；再点击不匹配的按钮，验证是否弹出权限提示。
3. 异常测试：若localStorage无role/token，验证是否弹出「未检测到角色信息/登录状态失效」提示并跳转到/login。
4. 结果记录：记录按钮跳转结果、权限提示是否正常、异常场景的处理逻辑是否生效。

## 四、专属异常排查逻辑
1. 若点击按钮无跳转无提示：原因判定为「按钮点击事件未绑定，或localStorage读取失败」。
2. 若角色匹配但跳转失败：原因判定为「路由配置异常，目标路径（/system/student/teacher）不存在」。
3. 若未登录但未跳转/login：原因判定为「页面初始化的useEffect权限校验逻辑失效」。

## 五、下棋部分
1、不需要多次点击，等待人机下棋，等人机的白棋下好之后，你再点击棋盘下黑棋。
2、那是因为白棋在0.5秒就下好了，如果显示是黑棋玩家回合，你就下。
3、不要下在之前下过的地方和白棋已经下过的地方下棋。
4、下完一步棋之后，等待两秒钟，此时肯定是你的回合，此时可以下棋。
       `;
        }

        // 其他页面：无特殊指导
        return `当前页面非课表管理系统核心页面，无需执行操作，仅打印[DOM-LOG]记录页面URL和核心元素状态即可。`;
      }
    }
  });

  // 修复：合并重复声明的handleAgentChat函数，梳理麦克风逻辑
const handleAgentChat = async () => {
  setAgentLoading(true);
  try {
    // 步骤1：仅保留麦克风权限请求核心逻辑（剥离PageAgent面板依赖）
    const mediaDevices = navigator.mediaDevices || 
      (navigator as any).webkitMediaDevices || 
      (navigator as any).mozMediaDevices;

    if (!mediaDevices || !mediaDevices.getUserMedia) {
      alert("当前浏览器不支持麦克风功能，请更换Chrome/Firefox浏览器");
      setAgentLoading(false);
      return;
    }

    // 步骤2：强制清理旧流（确保弹窗触发）
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }

    // 步骤3：最简权限请求（仅音频，无额外配置）
    console.log("请求麦克风权限...");
    const stream = await mediaDevices.getUserMedia({ audio: true });
    
    // 授权成功回调
    setAudioStream(stream);
    alert("麦克风授权成功！");
    console.log("麦克风流信息：", stream);

    // 步骤4：再初始化PageAgent面板（非必须，先保证权限）
    agent.panel.show();

    // 保留原有的面板关闭清理逻辑
    if (panelCloseHandlerRef.current) {
      (agent.panel as any).off("close", panelCloseHandlerRef.current);
    }
    const handlePanelClose = () => {
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      }
      (agent.panel as any).off("close", handlePanelClose);
      panelCloseHandlerRef.current = null;
      if ((window as any).panelCheckTimer) clearInterval((window as any).panelCheckTimer);
    };
    panelCloseHandlerRef.current = handlePanelClose;
    (agent.panel as any).on("close", handlePanelClose);
    (window as any).panelCheckTimer = setInterval(() => {
      if (!(agent.panel as any).isVisible() && audioStream) handlePanelClose();
    }, 500);

  } catch (error: any) {
    // 步骤5：精准捕获权限错误并引导用户
    console.error("麦克风请求失败：", error);
    if (error.name === "NotAllowedError") {
      alert("麦克风权限被拒绝！请在浏览器地址栏左侧的「锁形图标」→「网站设置」中开启麦克风权限");
    } else if (error.name === "NotFoundError") {
      alert("未检测到麦克风设备，请检查硬件连接");
    } else {
      alert(`麦克风请求异常：${error.message}`);
    }
  } finally {
    setAgentLoading(false);
  }
};

  // 时间格式化
  const formatTime = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  };

  // 角色跳转核心方法（仅保留手动跳转）
  const handleRoleJump = (targetRole: string, targetPath: string) => {
    const currentRole = localStorage.getItem('role');
    console.log('当前角色：', currentRole, '目标角色：', targetRole, '目标路径：', targetPath);

    if (!currentRole) {
      alert('未检测到角色信息，请重新登录！');
      navigate('/login');
      return;
    }

    if (currentRole === targetRole) {
      navigate(targetPath, { replace: true });
      console.log('跳转成功：', targetPath);
    } else {
      alert(`无${targetRole === 'student' ? '学生' : '教师'}权限！`);
    }
  };

  // 修复：合并重复的useEffect，修正语法错误
  useEffect(() => {
    // 初始化时间
    setCurrentTime(formatTime());
    const timer = setInterval(() => setCurrentTime(formatTime()), 1000);

    // 登录状态校验
    const token = localStorage.getItem('token');
    if (!token) {
      clearInterval(timer);
      alert('登录状态已失效，请重新登录！');
      navigate('/login');
      return;
    }

    const checkMicSupport = () => {
    const mediaDevices = navigator.mediaDevices || 
      (navigator as any).webkitMediaDevices || 
      (navigator as any).mozMediaDevices;
    if (!mediaDevices || !mediaDevices.getUserMedia) {
      alert("当前浏览器不支持麦克风，请使用Chrome浏览器访问");
    }
  };
  checkMicSupport();


    // 已登录，初始化用户信息
    const role = localStorage.getItem('role');
    const name = localStorage.getItem('username');
    setUserRole(role || '');
    setUsername(name || '');

    // 组件卸载时的清理逻辑
    return () => {
      clearInterval(timer);
      // 清理麦克风资源
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      }
      // 清理面板监听
      if (panelCloseHandlerRef.current) {
        (agent.panel as any).off('close', panelCloseHandlerRef.current);
        panelCloseHandlerRef.current = null;
      }
      // 清理面板检查定时器
      if ((window as any).panelCheckTimer) {
        clearInterval((window as any).panelCheckTimer);
        (window as any).panelCheckTimer = null;
      }
      // 隐藏面板
      if (agent.panel && (agent.panel as any).isVisible()) {
        agent.panel.hide();
      }
      console.log('组件卸载：麦克风和面板资源已完全清理');
    };
  }, [navigate, audioStream]); // 补充依赖项

  return (
    <div className={Mainstyle.main}>
      <div className={Mainstyle.header}>
        <Hello username={username || '用户'} />
        <div className={button.button} onClick={() => navigate('/')}>
          back
        </div>
      </div>
      <div className={Mainstyle.body}>
        <button
          className={button_Stu.button}
          onClick={() => handleRoleJump('student', '/system/student')}
        >
          学生系统
        </button>
        <button
          className={button_Stu.button}
          onClick={() => handleRoleJump('teacher', '/system/teacher')}
        >
          教师系统
        </button>
        <div>
          <h5 className={spanstyle.span}>系统智能助手</h5>
          <button
            className={button_Stu.button}
            onClick={handleAgentChat}
            disabled={agentLoading}
          >
            {agentLoading ? '思考中...' : '提问'}
          </button>
          {/* 大模型回答展示 */}
          {agentAnswer && (
            <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#f5f7fa', borderRadius: '4px', fontSize: '14px' }}>
              <span style={{ fontWeight: 'bold', color: '#666' }}>助手回答：</span>
              <span>{agentAnswer}</span>
            </div>
          )}
        </div>
      </div>
      <div className={Mainstyle.footer}>
        <span className={Mainstyle.currentTime}>{currentTime}</span>
      </div>
    </div>
  );
}