// src/services/request.ts
import request from 'umi-request'; // 修正导入路径（Umi 4+ 推荐）

// 请求拦截器：统一添加 token 到请求头
export const requestInterceptor = (url: string, options: any) => {
  /*const token = localStorage.getItem('token');
  if (token) {
    // 安全处理：确保 options.headers 存在
    options.headers = options.headers || {};
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };
  }
    */
  return { url, options };
};

// 响应拦截器：统一处理错误
export const responseInterceptor = (response: any) => { // 修正类型为 any 或 ResponseLike
  if (response.data?.code === 401 || response.status === 401) { // 兼容不同后端返回格式
    // 未登录，跳转到登录页
    localStorage.removeItem('token');
    window.location.href = '/';
  }
  return response;
};

// 导出封装好的 request 方法
export default async function <T = any>(url: string, options: any): Promise<T> {
  return request(url, {
    ...options,
    requestInterceptors: [requestInterceptor],
    responseInterceptors: [responseInterceptor],
  }) as unknown as T; // ✅ 类型断言解决不兼容问题
}