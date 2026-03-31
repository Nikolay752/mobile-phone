import { useEffect, useRef } from 'react';
import styles from '../layouts/map.less';
import button from "../layouts/button_back.less";
import { useNavigate } from 'umi';

declare global {
  interface Window {
    _AMapSecurityConfig: {
      securityJsCode: string;
    };
    AMapLoader: {
      load: (options: { key: string; version: string; plugins?: string[] }) => Promise<any>;
    };
    AMap?: any; // 新增：缓存AMap全局对象，避免重复加载
  }
}

const AmapComponent = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const geolocationRef = useRef<any>(null); // 新增：定位实例ref，方便卸载清理
  const navigate = useNavigate();
  const handleBackClick = () => {
    navigate('/');
  };

  // 封装地图初始化核心逻辑
  const initMap = async () => {
    try {
      // 若已加载过AMap，直接使用全局对象，避免重复load
      let AMap = window.AMap;
      if (!AMap) {
        AMap = await window.AMapLoader.load({
          key: 'eb0b2f185a12b9596a3c1bfa28481f07',
          version: '2.0',
          plugins: ['AMap.Geolocation', 'AMap.Walking']
        });
        window.AMap = AMap; // 缓存到全局，后续复用
      }

      // 销毁残留的旧地图实例（关键：防止二次初始化冲突）
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }

      const defaultCenterLngLat = [120.153224, 30.174116];
      // 重新初始化地图
      const map = new AMap.Map(mapContainerRef.current, {
        zoom: 16,
        center: defaultCenterLngLat,
        mapStyle: 'amap://styles/ee412d9ac22fbd3d98c6ddfd83d0e765'
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
      map.on('click', (e: any) => {
        const lng = e.lnglat.lng;
        const lat = e.lnglat.lat;
        alert(`选中地点坐标：\n经度：${lng.toFixed(6)}\n纬度：${lat.toFixed(6)}`);
      });

      // 定位逻辑：先清理旧的定位实例，再创建新实例
      if (geolocationRef.current) {
        map.removeControl(geolocationRef.current);
        geolocationRef.current = null;
      }
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
        convert: false,
        useNative: true,
        showButton: true,
        buttonPosition: 'RB',
        buttonOffset: new AMap.Pixel(10, 20),
        showMarker: true,
        showCircle: true,
        panToLocation: false,
        zoomToAccuracy: true,
      });
      geolocationRef.current = geolocation;
      map.addControl(geolocation);

      // 手动触发定位
      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status === 'complete') {
          console.log('定位成功：', result);
          const { lng, lat } = result.position;

          const currentMarker = new AMap.Marker({
            position: [lng, lat],
            title: '我的位置',
            icon: new AMap.Icon({
              size: new AMap.Size(30, 30),
              image: 'https://a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png',
              imageSize: new AMap.Size(30, 30)
            })
          });
          map.add(currentMarker);

          // 步行路线规划
          const targetLingLat = [120.153224, 30.174116];
          const walking = new AMap.Walking({ map: map, autoFitView: true });
          walking.search([lng, lat], targetLingLat, (walkStatus: string, walkResult: any) => {
            if (walkStatus === 'complete') {
              console.log('步行路线规划成功', walkResult);
            } else {
              console.error('步行路线规划失败：', walkResult);
              alert('步行路线规划失败，请检查坐标或网络');
            }
          });
        } else {
          console.error('定位失败：', result);
          alert(`定位失败：${result.info}，将显示默认位置`);
        }
      });

      // 强制刷新居中
      setTimeout(() => {
        map.setCenter(defaultCenterLngLat);
        map.setZoom(16);
      }, 300);

    } catch (e) {
      console.error('地图加载失败:', e);
    }
  };

  useEffect(() => {
    // 1. 安全密钥只配置一次（全局生效）
    if (!window._AMapSecurityConfig) {
      window._AMapSecurityConfig = {
        securityJsCode: 'fb4cf3e7db26d31bde100ba4210af1be',
      };
    }

    // 2. 优化脚本加载逻辑：判断脚本是否已存在，避免重复添加/移除
    const loadMapScript = () => {
      const existingScript = document.querySelector('script[src="https://webapi.amap.com/loader.js"]');
      if (existingScript) {
        // 脚本已存在，直接初始化地图
        initMap();
      } else {
        // 脚本不存在，创建并加载
        const script = document.createElement('script');
        script.src = 'https://webapi.amap.com/loader.js';
        script.async = true;
        script.onload = initMap;
        script.onerror = (err) => {
          console.error('高德地图脚本加载失败', err);
          alert('地图加载失败，请刷新页面重试');
        };
        document.body.appendChild(script);
      }
    };

    loadMapScript();

    // 组件卸载时的清理逻辑（关键：彻底释放资源）
    return () => {
      // 销毁地图实例
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      // 移除定位控件
      if (geolocationRef.current && mapRef.current) {
        mapRef.current.removeControl(geolocationRef.current);
        geolocationRef.current = null;
      }
      // 不再移除loader.js脚本（保留脚本，后续复用）
      // 注：若需极致清理，可保留移除逻辑，但二次进入需重新加载，建议保留脚本
    };
  }, []); // 空依赖：确保只执行一次

  return (
    <div className={styles.main}>
      <div className={styles.header}>
        Map
        <div className={button.button} onClick={handleBackClick}>
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