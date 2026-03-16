import React, { useState, useEffect } from "react";
import { useNavigate } from 'umi';
import Mainstyle from '../layouts/Mainstyle_teacher.less';
import button from '../layouts/button_back.less';
import Hello from "@/layouts/Hello";
import TeacherCreditChart from "@/layouts/Charts/TeacherCreditChart";
import TeacherScheduleChart from "@/layouts/Charts/TeacherScheduleChart";
import Collage from "@/layouts/Charts/Collage";
import ClassDistribution from "@/layouts/Charts/ClassDistribution";
import { classScheduleMap, mockCreditMap, mockCollage, mockClassDistribution } from "@/mockData/teacherData";
import Refresh from "@/layouts/Refresh";

export default function SystemPage() {
    const [currentTime, setCurrentTime] = useState<string>('');
    const [userRole, setUserRole] = useState<string>('');
    const [username, setUsername] = useState<string>('');
    const [userClass, setUserClass] = useState<string>(''); // 新增：存储教师授课班级
    const [scheduleData, setScheduleData] = useState<any[]>([]);
    const [creditData, setCreditData] = useState<any[]>([]);
    const [collageData, setCollageData] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true); // 新增：加载状态
    const [error, setError] = useState<string>(''); // 新增：错误状态
    const [classDistributionData, setClassDistributionData] = useState<any[]>([]);
    const navigate = useNavigate();
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [chartsLoading, setChartsLoading] = useState<boolean>(false);

    // 时间格式化（和学生系统保持一致）
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

    // 按班级匹配课表（对齐学生系统逻辑）
    // system_teacher.tsx 中 fetchChartData 函数修改部分
    const fetchChartData = (userClass: string) => {
        try {
            setLoading(true);
            setError('');
            const targetSchedule = classScheduleMap[userClass as keyof typeof classScheduleMap] || [];
            // 匹配对应班级的成绩数据（新增：和课表逻辑一致）
            const targetCredit = mockCreditMap[userClass as keyof typeof mockCreditMap] || [];

            // 3. 校验所有数据格式（增强容错）
            if (!Array.isArray(targetSchedule)) throw new Error('课表数据格式错误');
            if (!Array.isArray(targetCredit)) throw new Error('学分数据格式错误'); // 校验成绩数据
            if (!Array.isArray(mockCollage)) throw new Error('院系数据格式错误');
            if (!Array.isArray(mockClassDistribution)) throw new Error('班级分布数据格式错误');

            // 4. 设置所有图表数据
            setScheduleData(targetSchedule);
            setCreditData(targetCredit); // 赋值匹配后的成绩数据
            setCollageData(mockCollage);
            setClassDistributionData(mockClassDistribution);

            console.log(`加载${userClass}班级授课课表和成绩数据成功`);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : '数据加载失败';
            setError(errMsg);
            console.error('图表数据加载失败:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // 初始化实时时间
        setCurrentTime(formatTime());
        const timer = setInterval(() => setCurrentTime(formatTime()), 1000);

        // 校验登录状态和角色（对齐学生系统逻辑）
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        const name = localStorage.getItem('username');
        const teacherClass = localStorage.getItem('class'); // 新增：读取教师授课班级

        // 未登录：跳转登录页（提前清定时器）
        if (!token) {
            clearInterval(timer);
            alert('登录状态已失效，请重新登录！');
            navigate('/login');
            return;
        }

        // 非教师角色：返回系统首页
        if (role !== 'teacher') {
            clearInterval(timer);
            alert('无教师权限，即将返回系统首页！');
            navigate('/system');
            return;
        }

        // 初始化用户信息
        setUserRole(role);
        setUsername(name || '老师');
        setUserClass(teacherClass || '物联2301'); // 存储班级
        // 加载对应班级的图表数据
        fetchChartData(teacherClass || '物联2301');

        // 清除定时器
        return () => clearInterval(timer);
    }, [navigate]);

    // 加载中/错误兜底（和学生系统保持一致）
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
                <Hello username={username || '老师'} />
                <div onClick={handleRefreshCharts} style={{ cursor: 'pointer', margin: '0 10px' }}>
                    <Refresh />
                    {refreshing && <span style={{ fontSize: '12px', color: '#409eff' }}>刷新中...</span>}
                </div>
                <div className={button.button} onClick={() => navigate('/')}>
                    logout
                </div>
                <div className={button.button} onClick={() => navigate('/system')}>
                    back
                </div>
            </div>
            <div className={Mainstyle.body}>
                {/* 重构：课表模块 - 显示班级名称 + 对应课表（对齐学生系统） */}
                <div className={Mainstyle.chartWrapper}>
                    <h3 className={Mainstyle.chartTitle}>{userClass} - 授课课表</h3>
                    {chartsLoading ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>课表刷新中...</div>
                    ) : scheduleData.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>暂无课表数据</div>
                    ): (
                        <TeacherScheduleChart scheduleData={scheduleData} />
                    )}
                </div>

                {/* 其他模块保留，补充空数据兜底 */}
                <div className={Mainstyle.chartWrapper}>
                    <h3 className={Mainstyle.chartTitle}>学生分数情况(人次)</h3>
                    {chartsLoading ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>分数刷新中...</div>
                    ) : creditData.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>暂无分数数据</div>
                    ) : (
                        <TeacherCreditChart creditData={creditData} />
                    )}
                </div>
                <div className={Mainstyle.chartWrapper}>
                    <h3 className={Mainstyle.chartTitle}>院系分布</h3>
                    {chartsLoading ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>院系刷新中...</div>
                    ) : (
                        <Collage collageData={collageData} />
                    )}
                </div>
                <div className={Mainstyle.chartWrapper}>
                    <h3 className={Mainstyle.chartTitle}>学院内人数分布</h3>
                    {chartsLoading ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>人数刷新中...</div>
                    ) : (
                        <ClassDistribution classDistributionData={classDistributionData} />
                    )}
                </div>
            </div>
            {/* 新增：页脚显示实时时间（对齐学生系统） */}
            <div className={Mainstyle.footer}>
                <span className={Mainstyle.currentTime}>{currentTime}</span>
            </div>
        </div>
    );
}