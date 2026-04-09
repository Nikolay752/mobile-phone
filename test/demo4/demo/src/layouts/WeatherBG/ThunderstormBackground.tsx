import React, { useRef, useEffect, useState } from 'react';
import './styles.css';

export const ThunderstormBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number | null>(null);
  const [flash, setFlash] = useState(false);

  // 兼容视窗尺寸
  const getViewportSize = () => {
    const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    const height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    return { width, height };
  };

  // 随机触发闪电：增加概率+多段闪烁，更真实
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.6) { // 40%概率触发
        setFlash(true);
        // 多段闪烁：模拟闪电余辉
        setTimeout(() => setFlash(false), 80);
        setTimeout(() => setFlash(true), 120);
        setTimeout(() => setFlash(false), 180);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

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

    // 增加雨滴数量，提升雷阵雨效果
    const raindrops = 300;
    const dropArray: { x: number; y: number; speed: number; length: number }[] = [];

    for (let i = 0; i < raindrops; i++) {
      dropArray.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        speed: Math.random() * 7 + 4,
        length: Math.random() * 25 + 15
      });
    }

    const animate = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制雨夜背景
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0f2027');
      gradient.addColorStop(0.5, '#203a43');
      gradient.addColorStop(1, '#2c5364');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制闪电：增加亮度，更明显
      if (flash) {
        // 主闪电（随机分支）
        const drawLightning = () => {
          ctx.beginPath();
          let x = canvas.width * 0.3 + Math.random() * canvas.width * 0.4;
          let y = 0;
          ctx.moveTo(x, y);
          // 随机分支绘制
          for (let i = 0; i < 20; i++) {
            const stepX = (Math.random() - 0.5) * 30;
            const stepY = Math.random() * 40 + 20;
            x += stepX;
            y += stepY;
            ctx.lineTo(x, y);
            // 绘制分支
            if (Math.random() > 0.7) {
              const branchX = x + (Math.random() - 0.5) * 20;
              const branchY = y + Math.random() * 30;
              ctx.moveTo(x, y);
              ctx.lineTo(branchX, branchY);
            }
            if (y > canvas.height) break;
          }
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 3 + Math.random() * 2;
          ctx.stroke();
          // 闪电辉光
          ctx.filter = 'blur(5px)';
          ctx.strokeStyle = 'rgba(100, 180, 255, 0.6)';
          ctx.stroke();
          ctx.filter = 'none';
        };
        drawLightning();
        // 全局闪光明暗
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 绘制雨滴
      ctx.strokeStyle = 'rgba(173, 216, 230, 0.7)';
      ctx.lineWidth = 1.5;
      dropArray.forEach(drop => {
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x, drop.y + drop.length);
        ctx.stroke();

        drop.y += drop.speed;
        if (drop.y > canvas.height) {
          drop.y = -drop.length;
          drop.x = Math.random() * canvas.width;
        }
      });

      animationIdRef.current = requestAnimationFrame(animate);
    };

    animationIdRef.current = requestAnimationFrame(animate);

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
  }, [flash]);

  return (
    <canvas
      ref={canvasRef}
      className="weather-bg"
    />
  );
};