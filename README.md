# logr.run

一个轻量的日志上传与查看平台，支持匿名日志与账号关联日志。前端为单页应用，后端提供上传、查看、仪表盘管理与权限控制。

## 功能概览
- 支持日志文件或纯文本上传（支持 gzip 文件）
- 公开日志可直接访问，关联账号日志需登录且为本人
- 仪表盘管理项目与日志，生成后端 Token 关联日志
- 日志查看器支持搜索/筛选/分享链接
- 访问限流与匿名日志定期清理

## 技术栈
- 前端：React + Vite + TailwindCSS
- 后端：Node.js + Express
- 存储：PostgreSQL


## 环境要求
- Node.js 22+
- Docker / Docker Compose（后端 + PostgreSQL）

## 部署

```
docker compose up -d --build
```
