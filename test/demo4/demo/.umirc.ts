import { defineConfig } from "umi";

export default defineConfig({
  routes: [
    { path: "/", component: "index" },
    { path: "/system", component: "system" },
    { path: "signup", component: "signup" },
    { path: "/system/teacher", component: "system_teacher" },
    { path: "/system/student", component: "system_student" },
    { path: "/game", component: "game" },
    { path: "/map",component: "map"},
    { path: "/game/GobangPage",component:"GobangPage"},
    { path: "/game/TetrisPage",component:"TetrisPage"}
  ],
  npmClient: 'pnpm',
  scripts: [
  'https://a.amap.com/jsapi/maps?v=2.0&key=eb0b2f185a12b9596a3c1bfa28481f07',
],
  proxy: {
    '/api': {
      target: 'https://localhost:8443', // 主代理（HTTPS）
      changeOrigin: true,
      secure: false,
    },
    '/api-http': { 
      target: 'http://localhost:8000',
      changeOrigin: true,
      pathRewrite: { '^/api-http': '/api' },
    },
  },
});