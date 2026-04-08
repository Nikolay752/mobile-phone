import React from 'react';
import './styles.css';

interface FogBackgroundProps {
  opacity?: number; // 透明度 0-1
  isHaze?: boolean; // 是否为霾 (更厚重)
}

export const FogBackground: React.FC<FogBackgroundProps> = ({ opacity = 0.8, isHaze = false }) => {
  return (
    <div 
      className={`weather-bg fog ${isHaze ? 'haze' : ''}`}
      style={{ 
        opacity,
        // 霾的背景由styles.css的haze类控制，避免样式覆盖
        background: !isHaze ? 'linear-gradient(180deg, #e0f7fa 0%, #b2ebf2 100%)' : 'unset',
      }}
    >
      {/* 多层雾层动画 */}
      <div className="fog-layer layer-1"></div>
      <div className="fog-layer layer-2"></div>
      {isHaze && <div className="fog-layer layer-3"></div>}
    </div>
  );
};