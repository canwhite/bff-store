# 前端/后端隔离机制

## 概述

bff-store 通过构建配置和 package.json exports 条件导出实现前端/后端隔离，确保 Node.js 特有模块（fs、mongodb）不会进入前端 bundle。

---

## 1. 构建层面隔离（tsup）

tsup.config.ts 定义了 5 个独立的构建入口：

| 入口 | 输出 | external |
|------|------|----------|
| `src/index.ts` | `dist/index.mjs` | `react, jotai, mongodb` |
| `src/storage/jsonl-entry.ts` | `dist/storage/jsonl-entry.mjs` | `react, jotai` |
| `src/storage/mongodb-entry.ts` | `dist/storage/mongodb-entry.mjs` | `react, jotai` |
| `src/server/entry.ts` | `dist/server/entry.mjs` | `react, jotai` |
| `src/server/cli.ts` | `dist/cli.js` | `react, jotai` + noExternal: mongodb |

**关键**：主入口的 tsup external 里标了 `mongodb`，所以 `dist/index.mjs` 不会打包 mongodb。fs 同理。

---

## 2. package.json 条件导出

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.js"
  },
  "./jsonl": {
    "types": "./dist/storage/jsonl-entry.d.ts",
    "import": "./dist/storage/jsonl-entry.mjs",
    "require": "./dist/storage/jsonl-entry.js"
  },
  "./mongodb": {
    "types": "./dist/storage/mongodb-entry.d.ts",
    "import": "./dist/storage/mongodb-entry.mjs",
    "require": "./dist/storage/mongodb-entry.js"
  },
  "./server": {
    "types": "./dist/server/entry.d.ts",
    "import": "./dist/server/entry.mjs",
    "require": "./dist/server/entry.js"
  }
}
```

用户不主动 `import from 'bff-store/jsonl'` 或 `bff-store/mongodb'`，就拿不到包含 fs/mongodb 的模块。

---

## 3. 主入口 index.ts 干净

`src/index.ts` 只导出前端安全的模块：

- `createStore`, `useStore`, `createPersistedAtom`
- `memoryStorage`, `remoteStorage`
- `isNode`, `isBrowser`, `createNodeStore`

**没有**引用 `jsonl.ts` 或 `mongodb.ts`。

---

## 4. 引用 fs/mongodb 的文件

| 文件 | 引用 |
|------|------|
| `src/storage/jsonl.ts` | `import * as fs from 'fs'` |
| `src/storage/mongodb.ts` | `import { MongoClient } from 'mongodb'` |
| `src/server/index.ts` | `import { mongodbStorage } from '../storage/mongodb'` |

这些文件**只会被** `jsonl-entry.ts`、`mongodb-entry.ts`、`server/entry.ts` 引用，不会被主入口 `index.ts` 引用。

---

## 5. createNodeStore 的安全性

`createNodeStore` 在 `src/nodeStore.ts` 中实现，它的 import：

```typescript
import { getDefaultStore } from 'jotai';
import { createStore } from './createStore';
import type { AtomConfigs, StoreAtoms, StoreLoadingAtoms } from './types';
import type { StorageAdapter } from './storage/base';
```

**没有**引用 fs 或 mongodb，所以即使在 index.ts 中导出，前端也不会被打包进去。

---

## 6. 之前 mongodb 进 next_test 的原因

不是代码问题，是 **package.json dependencies** 的问题。

```json
// 原先的 package.json
{
  "dependencies": {
    "mongodb": "^6.21.0"  // ← 问题在这里
  }
}
```

next_test 通过 `file:../../dist` 安装 bff-store 时，npm install 会安装 `dependencies` 中的包，导致 mongodb 被装进 next_test/node_modules，即使用不到也会被 Next.js bundler 解析到。

**修复**：将 mongodb 移到 `devDependencies`，因为 tsup 构建时会把它打包进 `dist/storage/mongodb-entry.js`，不需要作为独立依赖安装。

---

## 验证方法

### 检查主入口是否干净
```bash
grep -c "mongodb" dist/index.mjs  # 应为 0
grep -c "fs" dist/index.mjs        # 应为 0
```

### 检查子入口是否包含目标模块
```bash
grep -c "mongodb" dist/storage/mongodb-entry.mjs  # 应 > 0
grep -c "fs" dist/storage/jsonl-entry.mjs          # 应 > 0
```

### 检查 next_test 是否被安装 mongodb
```bash
ls node_modules/mongodb  # 应不存在
```
