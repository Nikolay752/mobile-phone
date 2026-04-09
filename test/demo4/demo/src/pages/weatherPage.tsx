import React, { useState, useEffect } from 'react';
import { useNavigate } from 'umi';
import { WeatherBackground, WeatherIconMap } from '../layouts/WeatherBG/weather'; // 引入天气图标映射
import styles from '../layouts/weatherPage.less';
import { getRegeoByLatLng, updateUserLocation } from '../services/api';

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
            // 🔴 修复：$(lng) → ${lng}，模板字符串语法错误
            if (lng && lat) {
                url += `?lng=${lng}&lat=${lat}`;
            }
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
        const init = async () => {
            const location = await getDeviceLocation();
            const currentUser = localStorage.getItem('currentUser');
            let cityName = '';
            if (location) {
                const regeoRes = await getRegeoByLatLng(location);
                cityName = regeoRes.data.city;
                console.log('当前定位城市：', cityName);
                await fetchWeather(location.lng, location.lat);
                if (currentUser && cityName) {
                    await updateUserLocation({
                        username: currentUser,
                        location: cityName,
                    });
                }
            } else {
                await fetchWeather();
            }

            const timer = setInterval(() => {
                fetchWeather(location?.lng, location?.lat);
            }, 5 * 60 * 1000);
            return () => clearInterval(timer);
        };
        init();
    }, []);

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
            <h1 style={{
                textAlign: 'center',
                paddingTop: '50px',
                color: '#000000',
                textShadow: '0 0 8px #000',
                position: 'relative',
                zIndex: 1
            }}>实时天气</h1>

            <button className={styles.backButton} onClick={handleBackClick}>
                back
            </button>
        </div>
    );
}

export default WeatherPage;