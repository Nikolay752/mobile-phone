import React, { useRef, useEffect } from 'react';
import './styles.css'; // 补充样式导入

type RainIntensity = 'light' | 'medium' | 'heavy' | 'storm';

export const RainBackground: React.FC<{ rainIntensity: RainIntensity }> = ({ rainIntensity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 保存动画ID，避免内存泄漏
  const animationIdRef = useRef<number | null>(null);

  // 雨滴配置：根据强度调整数量、速度、长度
  const getRainConfig = () => {
    switch (rainIntensity) {
      case 'light': return { count: 80, speed: 2, length: 20, opacity: 0.4 };
      case 'medium': return { count: 200, speed: 4, length: 30, opacity: 0.6 };
      case 'heavy': return { count: 400, speed: 6, length: 40, opacity: 0.8 };
      case 'storm': return { count: 600, speed: 9, length: 50, opacity: 1 };
      default: return { count: 100, speed: 3, length: 25, opacity: 0.5 };
    }
  };

  // 获取视窗尺寸：兼容所有浏览器（解决window.innerWidth为0的问题）
  const getViewportSize = () => {
    const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    const height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    return { width, height };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Canvas 2D上下文获取失败，请检查浏览器是否支持');
      return;
    }

    // 初始化Canvas尺寸
    const { width, height } = getViewportSize();
    canvas.width = width;
    canvas.height = height;

    const { count, speed, length, opacity } = getRainConfig();
    // 初始化雨滴
    const raindrops = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      speed: speed + Math.random() * 2,
      length: length + Math.random() * 10,
      opacity: opacity - Math.random() * 0.2,
    }));

    // 雨滴动画
    const animateRain = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      raindrops.forEach(drop => {
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x, drop.y + drop.length);
        ctx.strokeStyle = `rgba(173, 216, 230, ${drop.opacity})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 雨滴下落
        drop.y += drop.speed;
        if (drop.y > canvas.height) {
          drop.y = -drop.length;
          drop.x = Math.random() * canvas.width;
        }
      });
      animationIdRef.current = requestAnimationFrame(animateRain);
    };

    // 启动动画
    animationIdRef.current = requestAnimationFrame(animateRain);

    // resize防抖：50ms内只执行一次，避免卡顿
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const { width, height } = getViewportSize();
        canvas.width = width;
        canvas.height = height;
      }, 50);
    };
    window.addEventListener('resize', handleResize);

    // 销毁：取消动画+移除监听，避免内存泄漏
    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [rainIntensity]);

  return (
    <canvas
      ref={canvasRef}
      className="weather-bg" // 使用共享样式，统一层级
      style={{
        background: 'linear-gradient(to bottom, #1a2a6c, #2c5364, #1a2a6c)', // 优化雨夜渐变
      }}
    />
  );
};