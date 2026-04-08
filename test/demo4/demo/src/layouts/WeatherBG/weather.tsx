// src/layouts/WeatherBG/weather.tsx
import React from 'react';
import { SunnyBackground } from './SunnyBackground';
import { RainBackground } from './RainBackground';
import { SnowBackground } from './SnowBackground';
import { ThunderstormBackground } from './ThunderstormBackground';
import { FogBackground } from './FogBackground';
import { SandHazeBackground } from './SandHazeBackground';

// 合法天气类型
type WeatherType = '晴' | '多云' | '阴' | '小雨' | '中雨' | '大雨' | '暴雨' | '雷阵雨' | '小雪' | '中雪' | '大雪' | '雾' | '霾' | '扬沙';

// 天气图标映射（保留你的原有配置）
export const WeatherIconMap: Record<WeatherType, string> = {
  晴: '☀️',
  多云: '⛅',
  阴: '☁️',
  小雨: '🌧️',
  中雨: '🌧️🌧️',
  大雨: '🌧️🌧️🌧️',
  暴雨: '⛈️',
  雷阵雨: '⛈️🌧️',
  小雪: '❄️',
  中雪: '❄️❄️',
  大雪: '❄️❄️❄️',
  雾: '🌫️',
  霾: '≋',
  扬沙: '←→',
};

// 天气背景组件（带**非法值容错+兜底**，核心修复）
export const WeatherBackground: React.FC<{ weather: WeatherType | string }> = ({ weather }) => {
  // 容错：非法天气值自动兜底为「晴」
  const validWeather = (Object.keys(WeatherIconMap) as WeatherType[]).includes(weather as WeatherType)
    ? (weather as WeatherType)
    : '晴';

  const backgroundMap: Record<WeatherType, React.ReactNode> = {
    晴: <SunnyBackground />,
    多云: <SunnyBackground isCloudy={true} />,
    阴: <FogBackground opacity={0.6} />,
    小雨: <RainBackground rainIntensity="light" />,
    中雨: <RainBackground rainIntensity="medium" />,
    大雨: <RainBackground rainIntensity="heavy" />,
    暴雨: <RainBackground rainIntensity="storm" />,
    雷阵雨: <ThunderstormBackground />,
    小雪: <SnowBackground snowIntensity="light" />,
    中雪: <SnowBackground snowIntensity="medium" />,
    大雪: <SnowBackground snowIntensity="heavy" />,
    雾: <FogBackground opacity={0.8} />,
    霾: <FogBackground opacity={1} isHaze={true} />,
    扬沙: <SandHazeBackground />,
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: -1, // 背景置底，不遮挡页面内容
      overflow: 'hidden',
      pointerEvents: 'none', // 不拦截页面点击/滚动等交互
    }}>
      {backgroundMap[validWeather] || <SunnyBackground />}
    </div>
  );
};