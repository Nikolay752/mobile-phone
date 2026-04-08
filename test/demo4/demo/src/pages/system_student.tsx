import React, { useState, useEffect } from "react";
import { useNavigate } from 'umi';
import Mainstyle from '@/layouts/Mainstyle_student.less';
import button from '@/layouts/button_back.less';
import Hello from "@/layouts/Hello";
import StudentCreditChart from "@/layouts/Charts/StudentCreditChart";
import StudentScheduleChart from "@/layouts/Charts/StudentScheduleChart";
import Collage from "@/layouts/Charts/Collage";
import { classScheduleMap, mockCredit, mockCollage } from "@/mockData/studentData";
import Refresh from "@/layouts/Refresh";

export default function SystemPage() {
  // 基础状态（不参与刷新）
  const [currentTime, setCurrentTime] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [userClass, setUserClass] = useState<string>('');
  // 图表数据状态（仅这三个参与局部刷新）
  const [scheduleData, setScheduleData] = useState<any[]>([]);
  const [creditData, setCreditData] = useState<any[]>([]);
  const [collageData, setCollageData] = useState<any[]>([]);
  // 单独的图表加载状态（仅控制三个模块的加载提示）
  const [chartsLoading, setChartsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  // 刷新状态（控制按钮的加载提示）
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const navigate = useNavigate();

  // 1. 核心：仅刷新图表数据的方法
  const handleRefreshCharts = async () => {
    if (refreshing) return; // 防止重复点击
    setRefreshing(true);
    setChartsLoading(true); // 仅让图表模块显示加载中
    try {
      // 重新加载图表数据（可替换为真实API请求）
      await fetchChartData(userClass);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '刷新失败';
      setError(errMsg);
      alert(`刷新失败：${errMsg}`);
    } finally {
      setRefreshing(false);
      setChartsLoading(false); // 关闭图表加载提示
    }
  };

  // 2. 图表数据加载函数（仅更新三个图表状态）
  const fetchChartData = async (targetClass: string) => {
    // 模拟异步请求（真实场景替换为后端接口）
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 仅更新课表/学分/院系数据
    const newScheduleData = classScheduleMap[targetClass as keyof typeof classScheduleMap] || [];
    const newCreditData = [...mockCredit]; // 浅拷贝，触发状态更新
    const newCollageData = [...mockCollage]; // 浅拷贝，触发状态更新

    // 校验数据格式
    if (!Array.isArray(newScheduleData)) throw new Error('课表数据格式错误');
    if (!Array.isArray(newCreditData)) throw new Error('学分数据格式错误');
    if (!Array.isArray(newCollageData)) throw new Error('院系数据格式错误');

    // 仅更新这三个状态 → 仅触发对应模块渲染
    setScheduleData(newScheduleData);
    setCreditData(newCreditData);
    setCollageData(newCollageData);
  };

  // 时间格式化（不变）
  const formatTime = () => {
    const date = new Date();
    return `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
  };

  // 初始化逻辑（不变）
  useEffect(() => {
    // 时间定时器
    setCurrentTime(formatTime());
    const timer = setInterval(() => setCurrentTime(formatTime()), 1000);

    // 登录校验
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const name = localStorage.getItem('username');
    const classInfo = localStorage.getItem('class');

    if (!token) {
      clearInterval(timer);
      alert('登录失效，请重新登录！');
      navigate('/login');
      return;
    }
    if (role !== 'student') {
      clearInterval(timer);
      alert('无学生权限！');
      navigate('/system');
      return;
    }

    // 初始化用户信息（不参与刷新）
    setUserRole(role);
    setUsername(name || '');
    setUserClass(classInfo || '');

    // 首次加载图表数据
    fetchChartData(classInfo || '').catch(err => console.error('初始化数据失败:', err));

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className={Mainstyle.main}>
      {/* Header（不刷新） */}
      <div className={Mainstyle.header}>
        <Hello username={username || '同学'} />
        {/* 刷新按钮：仅绑定图表刷新方法 */}
        <div onClick={handleRefreshCharts} style={{ cursor: 'pointer', margin: '0 10px' }}>
          <Refresh />
          {refreshing }
        </div>
        <div className={button.button} onClick={() => navigate('/system')}>
          back
          </div>
      </div>

      {/* Body：仅这部分参与局部刷新 */}
      <div className={Mainstyle.body}>
        {/* 1. 个人课表模块（仅刷新） */}
        <div className={Mainstyle.chartWrapper}>
          <h3 className={Mainstyle.chartTitle}>{userClass} - 个人课表</h3>
          {chartsLoading ? (
            <div className={Mainstyle.span}>课表刷新中...</div>
          ) : scheduleData.length === 0 ? (
            <div className={Mainstyle.span}>暂无课表数据</div>
          ) : (
            <StudentScheduleChart scheduleData={scheduleData} />
          )}
        </div>

        {/* 2. 课程学分分布模块（仅刷新） */}
        <div className={Mainstyle.chartWrapper}>
          <h3 className={Mainstyle.chartTitle}>课程学分分布</h3>
          {chartsLoading ? (
            <div className={Mainstyle.span}>学分数据刷新中...</div>
          ) : creditData.length === 0 ? (
            <div className={Mainstyle.span}>暂无学分数据</div>
          ) : (
            <StudentCreditChart creditData={creditData} />
          )}
        </div>

        {/* 3. 院系分布模块（仅刷新） */}
        <div className={Mainstyle.chartWrapper}>
          <h3 className={Mainstyle.chartTitle}>院系分布</h3>
          {chartsLoading ? (
            <div className={Mainstyle.span}>院系数据刷新中...</div>
          ) : collageData.length === 0 ? (
            <div className={Mainstyle.span}>暂无院系数据</div>
          ) : (
            <Collage collageData={collageData} />
          )}
        </div>
      </div>

      {/* Footer（不刷新） */}
      <div className={Mainstyle.footer}>
        <span className={Mainstyle.currentTime}>{currentTime}</span>
      </div>
    </div>
  );
}