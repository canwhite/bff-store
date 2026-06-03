# Plan: 提取 Jotai 状态管理为独立工具包 `bff-store`

## Context

当前项目 `pro_novel` 中有一套基于 jotai 的状态管理系统，分散在 `persist.ts` 和 `novel-simple-persist.ts` 中。存在以下问题：
- 与业务强耦合，难以跨项目复用
- 存储层耦合了 API（`enhancedNovelClientAPI`）
- 单例模式固定，难以按需使用

**目标**: 提取为独立 npm 包，配置驱动批量创建 atoms，存储层可插拔（默认 JSONL）。

---

## 核心 API 设计

```typescript
// 1. 状态配置数组 - 一次定义多个状态
const config = [
  { key: 'theme', defaultValue: '' },
  { key: 'characters', defaultValue: [] },
  { key: 'chapters', defaultValue: [] },
] as const;

// 2. 创建 store 实例
const store = createStore('novel-123', config, {
  storage: jsonlStorage({ dir: './sessions' }),  // 默认
  // storage: mongodbStorage({ url: 'mongodb://...' }),
  debounceMs: 800,
});

// 3. React Hook 使用
function NovelEditor() {
  const { theme, characters, setTheme, setCharacters } = useStore(store);
}

// 4. 非 React 环境直接操作 atoms
store.atoms.theme.set('new theme');
```

---

## 目录结构

```
bff-store/
├── src/
│   ├── index.ts                    # 公共 API 导出
│   ├── types.ts                    # 类型定义
│   ├── createStore.ts              # 核心工厂函数
│   ├── useStore.ts                 # React Hook
│   ├── atomCreator.ts              # 单个 atom 创建逻辑
│   └── storage/
│       ├── base.ts                 # Storage interface
│       ├── memory.ts               # 内存存储（开发用）
│       ├── jsonl.ts                # JSONL 文件存储（默认）
│       └── mongodb.ts              # MongoDB 存储（可选）
├── docs/
│   └── PLAN.md                     # 本文档
├── package.json
└── README.md
```

---

## 实现步骤

### Step 1: 创建基础类型和接口 (`types.ts`, `storage/base.ts`)

- 定义 `AtomConfig` - 单个状态配置 `{ key, defaultValue, type?, immediate? }`
- 定义 `Storage` interface - `get(key)`, `set(key, value)`, `remove(key)`
- 定义 `StoreOptions` - 存储适配器、debounce 配置

### Step 2: 实现存储适配器 (`storage/`)

| 文件 | 职责 |
|------|------|
| `memory.ts` | 内存 Map，简单开发/测试用 |
| `jsonl.ts` | JSONL 文件存储，按 entityId 分文件，`sessions/{entityId}/{key}.jsonl` |
| `mongodb.ts` | MongoDB 存储，collection per entityId |

**JSONL 格式** (每行一条 JSON):
```
{"key":"theme","value":"科幻小说","timestamp":1704067200000}
{"key":"theme","value":"奇幻小说","timestamp":1704067201000}
```

### Step 3: 实现 atom 创建器 (`atomCreator.ts`)

- `createPersistedAtom(config, storage, options)` → 返回 `{ atom, loadingAtom }`
- onMount 时从 storage 加载初始值
- 写入时 debounce 保存到 storage

### Step 4: 实现 store 工厂 (`createStore.ts`)

- 输入: `entityId`, `config[]`, `options`
- 批量创建 atoms，返回 `{ atoms, loadingAtoms }`
- 支持分片并发创建（复用现有 `createAtomsInChunks` 逻辑）

### Step 5: 实现 React Hook (`useStore.ts`)

- `useStore(store)` - 自动订阅所有 atoms
- 返回 `{ ...data, ...setters, isLoading }`
- 优化: useMemo 缓存返回值，避免不必要的 re-render

### Step 6: 导出公共 API (`index.ts`)

```typescript
export { createStore, useStore };
export { jsonlStorage, mongodbStorage, memoryStorage };
export type { AtomConfig, Store, Storage, StoreOptions };
```

---

## 关键文件修改

| 文件 | 操作 |
|------|------|
| `src/app/store/persist.ts` | 保留基础版，工具包独立后可删除 |
| `src/app/store/novel-simple-persist.ts` | 逐步迁移到工具包 |

---

## 验证方案

1. **单元测试**: `vitest` 测试 atom 创建、存储适配器
2. **集成测试**: 创建 mock store，验证 CRUD + Hook 联动
3. **手动验证**: 在现有项目中引入工具包，替换 `novel-simple-persist.ts`

---

## 实现状态

✅ 已完成：
- [x] 项目脚手架 (package.json, tsconfig.json)
- [x] 类型定义 (types.ts)
- [x] 存储接口 (storage/base.ts)
- [x] 存储适配器 (memory.ts, jsonl.ts, mongodb.ts)
- [x] atom 创建器 (atomCreator.ts)
- [x] store 工厂 (createStore.ts)
- [x] React Hook (useStore.ts)
- [x] 公共 API 导出 (index.ts)
- [x] 构建配置和输出
- [x] README.md

---

## 下一步

1. 编写单元测试 (vitest)
2. 在 pro_novel 项目中引入工具包
3. 改造 `novel-simple-persist.ts` 使用新工具包
4. 考虑添加更多存储适配器 (IndexedDB, Redis 等)
