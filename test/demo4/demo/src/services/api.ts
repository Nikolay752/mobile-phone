// src/services/api.ts
import request from './request';

// 【修改1：将接口定义移到最顶部】
export interface LoginResponse {
  success: boolean;
  message?: string;
  userInfo: {
    id: number;
    username: string;
    role: string;
    class: string; // 补充班级字段
  };
}

export const API_BASE_URL = '/api';

/**
 * 登录接口
 * @param params { username, password }
 */
export async function login(params: { username: string; password: string }): Promise<LoginResponse> {
  // 【修改2：调用时指定泛型 <LoginResponse>】
  return request<LoginResponse>(`${API_BASE_URL}/login`, {
    method: 'POST',
    data: params,
  });
}

export async function signup(params: { username: string; password: string; role: string }) {
  // 注册接口也可以加泛型（可选）
  return request(`${API_BASE_URL}/signup`, {
    method: 'POST',
    data: params,
  });
}
/**
 * 退出登录接口（写入 isLogin: false 到 users.json）
 * @param params { username }
 */
export async function logout(params: { username: string }) {
  return request(`${API_BASE_URL}/logout`, {
    method: 'POST',
    data: params,
  });
}