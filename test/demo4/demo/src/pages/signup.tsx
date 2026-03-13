import React, { useState, useEffect, KeyboardEvent} from "react";
import { useNavigate } from 'umi';
import Mainstyle from '@/layouts/Mainstyle_system.less';
import button from '../layouts/button_back.less';
import spanstyle from '../layouts/span_title.less';
import button_Stu from '../layouts/button_Stu.less';
import { signup } from '../services/api';

export default function SignupPage() {
    // 时间状态
    const [currentTime, setCurrentTime] = useState<string>('');
    // 注册表单状态
    const [username, setUsername] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [confirmPwd, setConfirmPwd] = useState<string>('');
    const [userRole, setUserRole] = useState<string>('student'); // 默认学生角色
    const [loading, setLoading] = useState<boolean>(false);
    const [className, setClassName] = useState<string>('');

    const navigate = useNavigate();

    // 复用时间格式化逻辑
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

    // 初始化时间
    useEffect(() => {
        setCurrentTime(formatTime());
        const timer = setInterval(() => setCurrentTime(formatTime()), 1000);
        return () => clearInterval(timer);
    }, []);

    // 返回登录页
    const handleBackClick = () => {
        navigate('/');
    };

    // 回车触发注册
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSignup();
        }
    };

    // 注册逻辑（核心修改：移除仅学生校验班级的逻辑）
    const handleSignup = async () => {
        // 表单校验：所有角色都校验班级
        if (!username.trim()) { alert('请输入用户名！'); return; }
        if (password.length < 6) { alert('密码长度不能少于6位！'); return; }
        if (password !== confirmPwd) { alert('两次输入的密码不一致！'); return; }
        // 所有角色都校验班级（删除原有的学生角色判断）
        if (!className.trim()) {
            alert('请选择班级！');
            return;
        }

        setLoading(true);

        try {
            // 构造请求体：所有角色都传class
            const requestBody = {
                username,
                password,
                role: userRole,
                class: className, // 关键修改：把className改为class，和后端字段统一
            };
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });
            const data = await response.json();
            if (response.ok && data.success) {
                alert('注册成功！即将跳转到登录页');
                navigate('/');
            } else {
                alert(data.message || '注册失败，请重试！');
            }
        } catch (error) {
            console.error('注册请求失败:', error);
            alert('网络异常，注册失败！');
        } finally {
            setLoading(false);
        }
    };

    const classOptions = [
        { label: '请选择班级', value: '' },
        { label: '物联2301', value: '物联2301' },
        { label: '物联2302', value: '物联2302' },
        { label: '网络2301', value: '网络2301' },
        { label: '网络2302', value: '网络2302' },
        { label: '云计算2301', value: '云计算2301' },
        { label: '大数据2301', value: '大数据2301' }
    ];

    return (
        <div className={Mainstyle.main}>
            <div className={Mainstyle.header}>
                <span className={spanstyle.span_title}>User Sign Up</span>
                <div className={button.button} onClick={handleBackClick}>
                    Back
                </div>
            </div>

            <div className={Mainstyle.body}>
                {/* 用户名 */}
                <input
                    className={Mainstyle.input}
                    type="text"
                    placeholder="请设置用户名"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                />
                {/* 密码 */}
                <input
                    className={Mainstyle.input}
                    type="password"
                    placeholder="请设置密码（不少于6位）"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                />
                {/* 确认密码 */}
                <input
                    className={Mainstyle.input}
                    type="password"
                    placeholder="请确认密码"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                />
                {/* 角色选择 */}
                <div className={Mainstyle.roleSelect}>
                    <label>
                        <input
                            type="radio"
                            name="role"
                            value="student"
                            checked={userRole === 'student'}
                            onChange={() => setUserRole('student')}
                            disabled={loading}
                        />
                        学生
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="role"
                            value="teacher"
                            checked={userRole === 'teacher'}
                            onChange={() => setUserRole('teacher')}
                            disabled={loading}
                        />
                        教师
                    </label>
                </div>

                {/* 班级选择框：所有角色都显示（删除原有的学生角色判断） */}
                <select
                    className={`${Mainstyle.input} ${Mainstyle.classSelect}`}
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    disabled={loading}
                >
                    {classOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>

                {/* 注册按钮 */}
                <button
                    className={button_Stu.button}
                    onClick={handleSignup}
                    disabled={loading}
                >
                    {loading ? '注册中...' : 'Sign Up'}
                </button>
            </div>

            <div className={Mainstyle.footer}>
                <span className={Mainstyle.currentTime}>{currentTime}</span>
            </div>
        </div>
    );
}