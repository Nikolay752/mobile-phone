import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'umi';
import { WeatherBackground, WeatherIconMap } from '../layouts/WeatherBG/weather'; // 引入天气图标映射
import styles from '../layouts/weatherPage.less';
import { getRegeoByLatLng, updateUserLocation, resetUserLoadingStatus, logout } from '../services/api';
import { useAutoLogout } from '@/Hook/useAutoLogout';
//自动登出修改点1

// 定义接口返回数据的类型（TS类型校验）
interface WeatherResData {
    city: string;
    tem1: string; // 最高温
    tem2: string; // 最低温
    wea: string;  // 天气状况
    win: string;  // 风向
    win_speed: string; // 风速
    humidity: string; // 湿度
    update_time: string; // 更新时间
}
interface WeatherRes {
    success: boolean;
    data: {
        data: WeatherResData[];
    };
}

function WeatherPage() {
    const navigate = useNavigate();
    const handleBackClick = () => {
        navigate('/')
    }

    //自动登出第一部分
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('isLoggedIn'));

    const { resetLogoutTimer, clearLogoutTimer } = useAutoLogout({
        isLoggedIn,
        onLogout: () => {
            setIsLoggedIn(false);
            localStorage.clear();
            navigate('/');
        }
    })

    // 保存完整的天气数据（替代仅保存weather），初始化兜底值
    const [weatherData, setWeatherData] = useState<WeatherResData>({
        city: '未知城市',
        tem1: '0°',
        tem2: '0°',
        wea: '晴',
        win: '无风',
        win_speed: '0km/h',
        humidity: '0%',
        update_time: new Date().toLocaleTimeString(),
    });
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [deviceLocation, setDeviceLocation] = useState<{ lng: number, lat: number } | null>(null);

    const getDeviceLocation = async (): Promise<{ lng: number; lat: number } | null> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                console.warn('浏览器不支持地理定位');
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { longitude: lng, latitude: lat } = position.coords;
                    resolve({ lng, lat });
                },
                (err) => {
                    console.error('获取设备定位失败:', err);
                    resolve(null);
                },
                { timeout: 5000, enableHighAccuracy: true }
            );
        });
    };

    const fetchWeather = async (lng?: number, lat?: number) => {
        try {
            setIsLoading(true);
            let url = '/api/weather';
            const currentUser = localStorage.getItem('currentUser');
            const Params = new URLSearchParams();
            if (currentUser) Params.append('username', currentUser);
            if (lng && lat) {
                Params.append('lng', lng.toString());
                Params.append('lat', lat.toString());
            }

            url += Params.toString() ? `?${Params.toString()}` : ''
            const res = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            const data: WeatherRes = await res.json();
            const resData = data?.data?.data?.[0] || { ...weatherData };
            resData.city = resData.city?.trim() || '北京';
            setWeatherData(resData);
        } catch (err) {
            console.error('请求天气接口失败：', err);
            setWeatherData(prev => ({ ...prev, city: '北京' }));
        } finally {
            setIsLoading(false);
        }
    };

    // 生命周期钩子：请求天气接口
    useEffect(() => {
        let weatherTimer: NodeJS.Timeout | null = null;
        const init = async () => {
            const location = await getDeviceLocation();
            if (location) {
                const currentUser = localStorage.getItem('currentUser');
                if (currentUser) {
                    try {
                        const regeoRes = await getRegeoByLatLng({ lng: location.lng, lat: location.lat });
                        await updateUserLocation({ username: currentUser, location: regeoRes.data.city });
                    } catch (err) {
                        console.error('更新lastLcation失败', err)
                    }
                }
            }
            // 首次请求
            location ? await fetchWeather(location.lng, location.lat) : await fetchWeather();
            // 5秒轮询（赋值给外部变量）
            weatherTimer = setInterval(() => {
                fetchWeather(location?.lng, location?.lat); // 传定位，不触发IP
            }, 15 * 60 * 1000);
        };
        init();

        // 组件卸载→清理定时器（退出页面彻底停请求）
        return () => {
            if (weatherTimer) clearInterval(weatherTimer);
            clearLogoutTimer();
        };
    }, [clearLogoutTimer]);

    if (isLoading) {
        return (
            <div className='styles.loadWeather'>
                <div style={{ color: '#fff', fontSize: 18 }}>加载天气中...</div>
            </div>
        );
    }

    // 处理天气图标（容错）
    const getWeatherIcon = () => {
        const validWeather = (Object.keys(WeatherIconMap) as Array<keyof typeof WeatherIconMap>).includes(weatherData.wea as any)
            ? weatherData.wea
            : '晴';
        return WeatherIconMap[validWeather as keyof typeof WeatherIconMap];
    };

    return (
        <div className="App" style={{ minHeight: '100vh' }}>
            {/* 天气背景 */}
            <WeatherBackground weather={weatherData.wea} />

            {/* 核心：天气信息卡片 */}
            <div className={styles.weatherCard}>
                {/* 城市名称 */}
                <div className={styles.city}>
                    {weatherData.city}
                </div>

                {/* 天气图标 + 天气类型 */}
                <div className={styles.city}>
                    <span className={styles.weatherIcon}>{getWeatherIcon()}</span>
                    <span className={styles.weather}>{weatherData.wea}</span>
                </div>

                {/* 温度信息 */}
                <div className={styles.temp}>
                    {weatherData.tem1} 度
                </div>

                {/* 详细信息网格 */}
                <div className={styles.detailInfo}>
                    <div className={styles.wind}>
                        <span>🌬️ 风向：</span>
                        <span>{weatherData.win} {weatherData.win_speed}</span>
                    </div>
                    <div className={styles.humidity}>
                        <span>💧 湿度：</span>
                        <span>{weatherData.humidity}</span>
                    </div>
                    <div className={styles.updateTime}>
                        <span>⏰ 更新时间：</span>
                        <span>{weatherData.update_time}</span>
                    </div>
                </div>
            </div>

            {/* 页面标题（可选保留） */}
            <h1 className={styles.title}>实时天气</h1>

            <button className={styles.backButton} onClick={handleBackClick}>
                back
            </button>
        </div>
    );
}

export default WeatherPage;