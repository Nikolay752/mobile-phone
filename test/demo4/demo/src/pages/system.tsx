// system.tsx 最终修改后代码
import React, { useState, useEffect } from "react";
import { useNavigate } from 'umi';
import Mainstyle from '@/layouts/Mainstyle_system.less';
import button from '../layouts/button_back.less';
import spanstyle from '../layouts/span_title.less';
import button_Stu from '../layouts/button_Stu.less';
import Hello from "@/layouts/Hello";
import { PageAgent } from 'page-agent';


export default function SystemPage() {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const navigate = useNavigate();
  const [agentAnswer, setAgentAnswer] = useState<string>('');
  const [agentLoading, setAgentLoading] = useState<boolean>(false);

  // 初始化 PageAgent（直接使用硬编码的API Key）
  const agent = new PageAgent({
    model: 'qwen3.5-plus',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: 'sk-39d259240a734b7983b83579a934f1bf', // 直接使用硬编码的Key
    language: 'zh-CN'
  })

  // 点击按钮直接开启助手（移除API Key校验，保留loading状态）
  const handleAgentChat = () => {
    setAgentLoading(true);
    // 自动打开PageAgent原生面板（核心逻辑）
    agent.panel.show();
    // 延迟重置loading，避免按钮一直处于加载状态
    setTimeout(() => {setAgentLoading(false);}, 1000);
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

  useEffect(() => {
    setCurrentTime(formatTime());
    const timer = setInterval(() => setCurrentTime(formatTime()), 1000);
    const token = localStorage.getItem('token');

    // 未登录时提前清除定时器+返回
    if (!token) {
      clearInterval(timer);
      alert('登录状态已失效，请重新登录！');
      navigate('/login');
      return;
    }

    // 已登录，初始化信息
    const role = localStorage.getItem('role');
    const name = localStorage.getItem('username');
    setUserRole(role || '');
    setUsername(name || '');

    // 清除定时器
    return () => clearInterval(timer);
  }, [navigate]);

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