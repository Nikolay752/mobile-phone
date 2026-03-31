import { useEffect, useRef } from 'react';
import styles from '../layouts/map.less';
import button from "../layouts/button_back.less"
import { useNavigate } from 'umi';

declare global {
  interface Window {
    _AMapSecurityConfig: {
      securityJsCode: string;
    };
    AMapLoader: {
      load: (options: { key: string; version: string; plugins?: string[] }) => Promise<any>;
    };
  }
}

const AmapComponent = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const navigate = useNavigate();
  const handleBackClick = () => {
    navigate('/');
  };

  useEffect(() => {
    // 安全密钥配置
    window._AMapSecurityConfig = {
      securityJsCode: 'fb4cf3e7db26d31bde100ba4210af1be', // 替换为你的安全密钥
    };

    // 动态加载高德地图 Loader
    const script = document.createElement('script');
    script.src = 'https://webapi.amap.com/loader.js';
    script.async = true;
    script.onload = initMap;
    document.body.appendChild(script);

    return () => {
      // 组件卸载时销毁地图
      if (mapRef.current) {
        mapRef.current.destroy();
      }
      // 防止重复移除脚本导致报错
      const scriptElement = document.querySelector('script[src="https://webapi.amap.com/loader.js"]');
      if (scriptElement) {
        document.body.removeChild(scriptElement);
      }
    };
  }, []);

  const initMap = async () => {
    try {
      // 加载地图核心库 + 定位插件
      const AMap = await window.AMapLoader.load({
        key: 'eb0b2f185a12b9596a3c1bfa28481f07',
        version: '2.0',
        plugins: ['AMap.Geolocation'] // 新增定位插件
      });

      // 你要居中的默认坐标
      const defaultCenterLngLat = [120.153224, 30.174116];

      // 初始化地图
      const map = new AMap.Map(mapContainerRef.current, {
        zoom: 16,
        center: defaultCenterLngLat,
      });
      mapRef.current = map;

      // 默认中心标记点
      const defaultMarker = new AMap.Marker({
        position: defaultCenterLngLat,
        title: '默认中心位置'
      });
      map.add(defaultMarker);

      // 默认中心信息窗体
      const defaultInfoWindow = new AMap.InfoWindow({
        isCustom: true,
        content: '<div>中心位置</div>',
        offset: new AMap.Pixel(16, -45),
      });
      defaultMarker.on('click', (e: any) => {
        defaultInfoWindow.open(map, e.target.getPosition());
      });
      map.on('click',(e:any) => {
        const lng = e.lnglat.lng;
        const lat = e.lnglat.lat;
        alert(`选中地点坐标：\n经度：${lng.toFixed(6)}\n纬度：${lat.toFixed(6)}`)
      })

      // ========== 新增：获取当前定位逻辑 ==========
      // 创建定位实例
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true, // 是否使用高精度定位，默认:true
        timeout: 10000, // 超过10秒后停止定位，默认：5s
        maximumAge: 0, // 定位结果缓存0毫秒，默认：0
        convert: true, // 自动偏移坐标，偏移后的坐标为高德坐标，默认：true
        showButton: true, // 显示定位按钮，默认：true
        buttonPosition: 'RB', // 定位按钮停靠位置，默认：'LB'，左下角
        buttonOffset: new AMap.Pixel(10, 20), // 定位按钮与设置的停靠位置的偏移量，默认：Pixel(10,20)
        showMarker: true, // 定位成功后在定位到的位置显示点标记，默认：true
        showCircle: true, // 定位成功后用圆圈表示定位精度范围，默认：true
        panToLocation: true, // 定位成功后将地图视野移动到定位点，默认：true
        zoomToAccuracy: true, // 定位成功后调整地图视野范围使定位精度范围显示在视野中，默认：false
      });

      // 添加定位插件到地图
      map.addControl(geolocation);

      // 手动触发定位（也可以依赖内置的定位按钮）
      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status === 'complete') {
          // 定位成功处理
          console.log('定位成功：', result);
          const { lng, lat } = result.position;

          // 创建当前定位的标记点
          const currentMarker = new AMap.Marker({
            position: [lng, lat],
            title: '我的位置',
            icon: new AMap.Icon({
              // 自定义定位标记图标（可选）
              size: new AMap.Size(30, 30),
              image: 'https://a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png',
              imageSize: new AMap.Size(30, 30)
            })
          });
          map.add(currentMarker);

        } else {
          // 定位失败处理
          console.error('定位失败：', result);
          alert(`定位失败：${result.info}，将显示默认位置`);
        }
      });

      // 强制刷新居中（防止样式遮挡导致不居中）
      setTimeout(() => {
        map.setCenter(defaultCenterLngLat);
        map.setZoom(16);
      }, 300);

    } catch (e) {
      console.error('地图加载失败:', e);
    }
  };

  return (
    <div className={styles.main}>
      <div className={styles.header}>
        Map
        <div className={button.button}
          onClick={handleBackClick}
        >
          back
        </div>
      </div>
      <div className={styles.body}>
        <div
          ref={mapContainerRef}
          style={{
            width: '90vw',
            height: '70vh',
            margin: '0 auto',
            minHeight: '100%',
          }}
        />
      </div>
      <div className={styles.footer}></div>
    </div>
  );
};

export default AmapComponent;