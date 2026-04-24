<p align="center">
  <img src="public/logo.png" alt="Neko Study Logo" width="160" />
</p>

<h1 align="center">Neko Study</h1>

<p align="center">
  一个用于刷题、背题、考试与题库管理的学习系统
</p>

## 项目简介

Neko Study 是一个前后端一体的刷题学习系统，支持管理员管理题库与用户，支持普通用户按题库进行刷题、背题、考试、错题复习，并提供数据备份恢复能力。

## 主要功能

### 管理员功能

- 账户管理：新增用户、修改角色、重置密码、删除账户
- 题库管理：创建题库合集、编辑题库、删除题库
- 题目管理：新增、编辑、删除、搜索题目
- 题目导入：上传 JSON 文件批量导入题目
- 数据备份：手动导出、导入、生成服务器备份

### 普通用户功能

- 刷题：按题库选择顺序或乱序练习
- 背题：直接查看答案与解析，并支持继续上次位置
- 考试：按题型随机组卷并提交评分
- 错题本：自动收集错题并支持按题库筛选
- 进度记忆：支持刷题与背题进度恢复

## 技术栈

- 前端：React + Vite
- 后端：Express
- 数据库：SQLite（通过 `sql.js` 持久化）
- 认证：JWT

## 默认账户

- 管理员：`neko / neko123`

## 本地开发

安装依赖：

```bash
npm install
```

开发模式启动：

```bash
npm run dev
```

开发模式端口：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

## 单端口启动

项目支持单端口运行，前端静态资源和后端 API 均由 `3001` 提供。

### Windows

```powershell
.\start-windows.ps1
```

### Linux / macOS

```bash
chmod +x ./start-linux.sh
./start-linux.sh
```

### 手动启动

```bash
npm run build
npm start
```

访问地址：

- 本机：`http://localhost:3001`
- 局域网：`http://你的主机IP:3001`

## Docker 部署

启动：

```bash
docker-compose up -d --build
```

访问：

- 本机：`http://localhost:3001`
- 局域网 / 服务器：`http://服务器IP:3001`

说明：

- 容器默认监听 `0.0.0.0:3001`
- `docker-compose.yml` 已显式映射 `0.0.0.0:3001:3001`
- 数据目录会持久化到宿主机 `data/`

停止：

```bash
docker compose down
```

## 题目导入格式

管理员可在题库管理中上传 JSON 文件导入题目，示例格式如下：

```json
[
  {
    "type": "single_choice",
    "stem": "Vue 中用于双向绑定的指令是？",
    "options": ["v-if", "v-for", "v-model", "v-bind"],
    "answer": "C",
    "analysis": "v-model 常用于表单元素的双向绑定。"
  },
  {
    "type": "multiple_choice",
    "stem": "以下哪些属于面向对象特性？",
    "options": ["封装", "继承", "多态", "编译优化"],
    "answer": ["A", "B", "C"],
    "analysis": "封装、继承、多态是面向对象的核心特性。"
  },
  {
    "type": "true_false",
    "stem": "HTTPS 默认端口通常是 443。",
    "answer": true,
    "analysis": "HTTPS 默认端口是 443。"
  },
  {
    "type": "short_answer",
    "stem": "请简述什么是数据库索引。",
    "answer": {
      "keywords": ["查询", "速度", "性能"],
      "reference": "数据库索引用于提升数据检索效率，减少全表扫描，提高查询性能。"
    },
    "analysis": "简答题会根据关键词进行自动判定。"
  }
]
```

## 数据存储

- 主数据库：`data/study.sqlite`
- 备份目录：`data/backups/`

## 自动备份说明

- 系统每天自动生成 1 份服务器备份
- 最多保留最近 5 份备份文件
- 管理员可在 `题库管理 -> 数据备份` 中：
  - 立即导出完整数据
  - 上传备份文件覆盖恢复
  - 生成服务器备份
  - 在最近备份列表中快速恢复

## 项目结构

```text
.
├─ public/              # 静态资源
├─ src/                 # 前端代码
├─ server/              # 后端代码
├─ data/                # SQLite 数据与备份目录
├─ item_bank/           # 题库整理文件
├─ Dockerfile
├─ docker-compose.yml
└─ README.md
```

## 生产环境建议

- 放行端口 `3001`
- 定期备份 `data/` 目录
- 使用反向代理时，将 `3001` 代理到公网域名

## License

仅供学习与内部使用。
