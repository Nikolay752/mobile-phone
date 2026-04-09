import React, { useRef, useEffect } from 'react';
import './styles.css'; // 补充样式导入

type SnowIntensity = 'light' | 'medium' | 'heavy';

export const SnowBackground: React.FC<{ snowIntensity: SnowIntensity }> = ({ snowIntensity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number | null>(null);

  const getSnowConfig = () => {
    switch (snowIntensity) {
      case 'light': return { count: 100, speed: 0.6, size: 2, opacity: 0.6 };
      case 'medium': return { count: 250, speed: 1.2, size: 3, opacity: 0.8 };
      case 'heavy': return { count: 500, speed: 1.8, size: 4, opacity: 1 };
      default: return { count: 150, speed: 0.9, size: 3, opacity: 0.7 };
    }
  };

  // 兼容视窗尺寸
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

    const { width, height } = getViewportSize();
    canvas.width = width;
    canvas.height = height;

    const { count, speed, size, opacity } = getSnowConfig();
    const snowflakes = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: size + Math.random() * 2,
      speed: speed + Math.random() * 0.5,
      opacity: opacity - Math.random() * 0.3,
      sway: Math.random() * 2 - 1,
      rotateSpeed: Math.random() * 1 + 0.5, // 旋转速度
      rotation: 0, // 当前旋转角度
    }));

    const animateSnow = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      snowflakes.forEach(flake => {
        ctx.save(); // 保存画布状态
        // 平移到雪花中心，旋转后绘制
        ctx.translate(flake.x, flake.y);
        ctx.rotate((flake.rotation * Math.PI) / 180);
        // 绘制雪花（从圆形改为六角形更真实，或保留圆形+旋转）
        ctx.beginPath();
        ctx.arc(0, 0, flake.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
        ctx.fill();
        ctx.restore(); // 恢复画布状态

        // 更新雪花状态
        flake.y += flake.speed;
        flake.x += flake.sway * 0.6;
        flake.sway = flake.sway + (Math.random() * 0.2 - 0.1);
        // 旋转更新
        flake.rotation += flake.rotateSpeed;
        if (flake.rotation > 360) flake.rotation = 0;

        // 边界重置
        if (flake.y > canvas.height) {
          flake.y = -flake.size;
          flake.x = Math.random() * canvas.width;
          flake.sway = Math.random() * 2 - 1;
          flake.rotateSpeed = Math.random() * 1 + 0.5;
        }
      });
      animationIdRef.current = requestAnimationFrame(animateSnow);
    };

    animationIdRef.current = requestAnimationFrame(animateSnow);

    // resize防抖
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

    // 销毁
    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [snowIntensity]);

  return (
    <canvas
      ref={canvasRef}
      className="weather-bg"
      style={{
        background: 'linear-gradient(to bottom, #2c3e50, #4ca1af, #2c3e50)', // 优化雪天渐变
      }}
    />
  );
};