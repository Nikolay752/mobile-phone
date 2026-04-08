import React from 'react';
import './styles.css';

interface SunnyBackgroundProps {
  isCloudy?: boolean; // 是否多云
}

export const SunnyBackground: React.FC<SunnyBackgroundProps> = ({ isCloudy = false }) => {
  return (
    <div className="weather-bg sunny">
      {/* 太阳光晕 */}
      <div className="sun"></div>
      {/* 太阳射线：增加span节点，显示8条射线 */}
      <div className="sun-rays">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
      {/* 多云效果 */}
      {isCloudy && (
        <>
          <div className="cloud cloud-1"></div>
          <div className="cloud cloud-2"></div>
        </>
      )}
    </div>
  );
};