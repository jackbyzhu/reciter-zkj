# 单词记忆游戏平台（reciter-zkj）

纯前端、本地优先、AI 按需生成内容的单词记忆游戏平台。无后端、无服务器，所有数据存储在 IndexedDB，部署时只需静态托管 + 反向代理。

当前版本：**v1.0**

## 功能特性

- **录单词**：输入单词（可填意思），AI 生成词卡内容（词义、幽默解释、词根、谐音记忆、例句），支持预览编辑、重新生成、入库/丢弃
- **回顾单词**：基于 FSRS 间隔重复算法，识别模式 → 卡片模式 → 更新记忆权重
- **单词库**：卡片视图 / 列表视图，支持搜索、标签筛选、批量删除、虚拟滚动
- **刷题游戏**：
  - 完形填空：一段短文，挖空考察队列单词
  - 阅读理解：短文 + 选择题，考察单词高亮
  - 支持生成新题与刷现有题，按 FSRS 稳定性排序
- **导入导出**：单词库 / 题目库 JSON 导出（pako 压缩）与导入还原
- **AI 赋能**：支持直连 / 代理两种模式，兼容 OpenAI 接口，提示词可自定义

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | React 18 + TypeScript |
| 构建 | Vite |
| 数据库 | Dexie.js（IndexedDB） |
| 状态 | Zustand |
| 算法 | ts-fsrs |
| 样式 | Tailwind CSS |
| 路由 | React Router v6 |
| 压缩 | pako |

## 快速开始

```bash
npm install
npm run dev
```

构建与预览：

```bash
npm run build
npm run preview
```

Docker 部署：

```bash
docker compose up -d
```

## 使用说明

1. 首次使用请在「设置」中配置 AI（自填 API Key 或代理地址），可在直连 / 代理两种模式间切换
2. 在「录单词」输入单词，等待 AI 生成词卡后可编辑并录入单词库
3. 单词会按记忆曲线进入「回顾单词」队列，定期复习巩固
4. 「刷题」可将队列中的单词生成完形填空或阅读理解，加深记忆

## 目录结构

```text
src/
├── components/   通用、卡片、游戏、布局组件
├── pages/        Home / AddWord / Review / WordLibrary / Practice / Settings ...
├── db/           Dexie 实例与迁移
├── services/     AI 调用、队列、写入口、导入导出
├── stores/       Zustand 状态
├── algorithms/   FSRS 封装与适配层
├── games/        游戏规则（完形 / 阅读）
├── prompts/      默认提示词与解析
├── types/        类型定义
└── utils/        工具函数
```