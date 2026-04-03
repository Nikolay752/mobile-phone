// src/services/api.ts
import request from './request';

// 登录响应类型
export interface LoginResponse {
  success: boolean;
  message?: string;
  userInfo: {
    id: number;
    username: string;
    role: string;
    class: string;
    isLoading: boolean;
    loginTime: string | null;
    logoutTime: string | null;
    highestScore?: number;
  };
}

// 分数相关响应类型
export interface ScoreResponse {
  success: boolean;
  message: string;
  data: {
    username: string;
    highestScore: number;
    oldScore?: number;
    newScore?: number;
    currentScore?: number;
    [key: string]: any;
  };
}

export const API_BASE_URL = '/api';

/**
 * 登录接口
 * @param params { username, password }
 */
export async function login(params: { username: string; password: string }): Promise<LoginResponse> {
  return request<LoginResponse>(`${API_BASE_URL}/login`, {
    method: 'POST',
    data: params,
  });
}

/**
 * 注册接口
 * @param params { username, password, role, class }
 */
export async function signup(params: {
  username: string;
  password: string;
  role: string;
  class: string;
}): Promise<{
  success: boolean;
  message: string;
  userInfo?: any;
}> {
  return request(`${API_BASE_URL}/signup`, {
    method: 'POST',
    data: params,
  });
}

/**
 * 退出登录接口
 * @param params { username }
 */
export async function logout(params: { username: string }): Promise<{
  success: boolean;
  message: string;
  data?: { username: string; isLogin: boolean };
}> {
  return request(`${API_BASE_URL}/logout`, {
    method: 'POST',
    data: params,
  });
}

/**
 * 更新最高分接口
 * @param params { username, score }
 */
export async function updateHighestScore(params: {
  username: string;
  score: number
}): Promise<ScoreResponse> {
  return request<ScoreResponse>(`${API_BASE_URL}/updateHighestScore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: params,
  });
}

/**
 * 获取最高分接口
 * @param params { username }
 */
export async function getHighestScore(params: { username: string }): Promise<ScoreResponse> {
  try {
    return await request<ScoreResponse>(`${API_BASE_URL}/getHighestScore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: params,
    });
  } catch (err) {
    console.error('getHighestScore接口调用失败:', err);
    // 接口失败时返回兜底数据
    return {
      success: false,
      message: '接口调用失败',
      data: { username: params.username, highestScore: 0 }
    };
  }
}