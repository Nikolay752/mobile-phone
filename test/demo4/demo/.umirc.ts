import { defineConfig } from "umi";

export default defineConfig({
  routes: [
    { path: "/", component: "index" },
    { path: "/system", component: "system" },
    { path: "signup", component: "signup" },
    { path: "/system/teacher", component: "system_teacher" },
    { path: "/system/student", component: "system_student" },
    { path: "/game", component: "game" }
  ],
  npmClient: 'pnpm',
  proxy: {
    '/api': {
      target: 'https://localhost:8443', // 主代理（HTTPS）
      changeOrigin: true,
      secure: false,
    },
    '/api-http': { // 新增HTTP代理（可选）
      target: 'http://localhost:8000',
      changeOrigin: true,
      pathRewrite: { '^/api-http': '/api' },
    },
  },
});