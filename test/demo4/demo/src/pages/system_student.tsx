// system_student.tsx 完整修改后代码
import React, { useState, useEffect } from "react";
import { useNavigate } from 'umi';
import Mainstyle from '@/layouts/Mainstyle_student.less';
import button from '@/layouts/button_back.less';
import Hello from "@/layouts/Hello";
import StudentCreditChart from "@/layouts/Charts/StudentCreditChart";
import StudentScheduleChart from "@/layouts/Charts/StudentScheduleChart";
import Collage from "@/layouts/Charts/Collage";
// 导入重构后的课表数据
import { classScheduleMap, mockCredit, mockCollage } from "@/mockData/studentData";

export default function SystemPage() {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [userClass, setUserClass] = useState<string>('');
  const [scheduleData, setScheduleData] = useState<any[]>([]);
  const [creditData, setCreditData] = useState<any[]>([]);
  const [collageData, setCollageData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  // 时间格式化（不变）
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

  // 加载图表数据（重构：按班级匹配课表）
  const fetchChartData = (userClass: string) => {
    try {
      setLoading(true);
      setError('');
      
      // 1. 匹配班级课表（无匹配则用物联2301兜底）
      const targetSchedule = classScheduleMap[userClass as keyof typeof classScheduleMap] || [];
      // 2. 校验数据格式
      if (!Array.isArray(targetSchedule)) throw new Error('课表数据格式错误');
      if (!Array.isArray(mockCredit)) throw new Error('学分数据格式错误');
      if (!Array.isArray(mockCollage)) throw new Error('院系数据格式错误');
      
      // 3. 设置数据
      setScheduleData(targetSchedule);
      setCreditData(mockCredit);
      setCollageData(mockCollage);
      console.log(`加载${userClass}班级课表成功`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '数据加载失败';
      setError(errMsg);
      console.error('图表数据加载失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 初始化时间
    setCurrentTime(formatTime());
    const timer = setInterval(() => setCurrentTime(formatTime()), 1000);
    
    // 校验登录状态和角色
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const name = localStorage.getItem('username');
    const userClass = localStorage.getItem('class'); // 新增：读取用户班级

    // 未登录：跳转登录页
    if (!token) {
      clearInterval(timer);
      alert('登录状态已失效，请重新登录！');
      navigate('/login');
      return;
    }

    // 非学生角色：返回系统首页
    if (role !== 'student') {
      clearInterval(timer);
      alert('无学生权限，即将返回系统首页！');
      navigate('/system');
      return;
    }

    // 初始化用户信息
    setUserRole(role);
    setUsername(name || '同学');
    setUserClass(userClass || '物联2301'); // 存储班级，兜底为物联2301
    
    // 加载对应班级的图表数据
    fetchChartData(userClass || '物联2301');

    // 清除定时器
    return () => clearInterval(timer);
  }, [navigate]);

  // 加载中/错误兜底（不变）
  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>加载中...</div>;
  }
  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>
        <p>加载失败：{error}</p>
        <button onClick={() => fetchChartData(userClass)} style={{ marginTop: '10px' }}>重试</button>
      </div>
    );
  }

  return (
    <div className={Mainstyle.main}>
      <div className={Mainstyle.header}>
        <Hello username={username || '同学'} />
        <div className={button.button} onClick={() => navigate('/system')}>
          back
        </div>
      </div>
      <div className={Mainstyle.body}>
        {/* 课表模块 - 显示班级名称 + 对应课表 */}
        <div className={Mainstyle.chartWrapper}>
          <h3 className={Mainstyle.chartTitle}>{userClass} - 个人课表</h3>
          {scheduleData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>暂无课表数据</div>
          ) : (
            <StudentScheduleChart scheduleData={scheduleData} />
          )}
        </div>

        {/* 学分模块（不变） */}
        <div className={Mainstyle.chartWrapper}>
          <h3 className={Mainstyle.chartTitle}>课程学分分布</h3>
          {creditData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>暂无学分数据</div>
          ) : (
            <StudentCreditChart creditData={creditData} />
          )}
        </div>

        {/* 院系模块（不变） */}
        <div className={Mainstyle.chartWrapper}>
          <h3 className={Mainstyle.chartTitle}>院系分布</h3>
          {collageData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>暂无院系数据</div>
          ) : (
            <Collage collageData={collageData} />
          )}
        </div>
      </div>
      <div className={Mainstyle.footer}>
        <span className={Mainstyle.currentTime}>{currentTime}</span>
      </div>
    </div>
  );
}