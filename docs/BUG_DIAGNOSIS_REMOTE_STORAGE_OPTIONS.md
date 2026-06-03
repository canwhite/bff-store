# Bug 诊断：`'backend' does not exist in type 'RemoteStorageOptions'`

## 现象

在 `tests/next_test` 中使用 `bff-store`（通过 `"file:../../dist"` 安装）时，TypeScript 报错：

```
Object literal may only specify known properties, and 'backend' does not exist in type 'RemoteStorageOptions'.ts(2353)
```

触发代码：

```typescript
import { remoteStorage } from 'bff-store';

const adapter = remoteStorage({
  backend: 'jsonl',
  jsonlDir: '/tmp/test',
});
```

## 根因分析

问题由**两个因素叠加**导致：

### 因素一（主因）：`dist/package.json` 路径错误

构建脚本 `npm run build` 直接将项目根目录的 `package.json` 复制到 `dist/`。根目录的 `package.json` 中，`exports`、`main`、`module`、`types` 字段的路径都带有 `./dist/` 前缀：

```json
{
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  }
}
```

这些路径在 npm 发布时是正确的（因为 `dist/` 是项目根目录的子目录）。但当通过 `"file:../../dist"` 本地安装时，**包根目录就是 `dist/` 本身**，`./dist/index.d.ts` 就会解析为 `dist/dist/index.d.ts` —— 该文件不存在。

| 场景 | 包根目录 | `./dist/index.d.ts` 解析结果 | 存在? |
|------|----------|---------------------------|------|
| npm 发布 | 项目根目录 | `项目根/dist/index.d.ts` | 是 |
| `file:../../dist` | `dist/` | `dist/dist/index.d.ts` | **否** |

因此 TypeScript 无法通过本地 symlink 解析到正确的类型声明文件。

### 因素二（助推）：全局安装了旧版本

由于本地 symlink 解析失败，TypeScript 沿目录树向上查找，最终在 `/Users/Admin/node_modules/bff-store/` 找到了全局安装的 **v0.1.1**（当前项目版本为 v0.1.3）。

该旧版本的 `RemoteStorageOptions` 接口**没有** `backend` 等新增字段：

- v0.1.1（旧）:
  ```typescript
  interface RemoteStorageOptions {
      baseUrl?: string;
      entityId?: string;
      transport?: TransportAdapter;
      protocol?: StorageHttpProtocol;
  }
  ```

- v0.1.3（当前源码/dist）:
  ```typescript
  interface RemoteStorageOptions {
      baseUrl?: string;
      entityId?: string;
      transport?: TransportAdapter;
      protocol?: StorageHttpProtocol;
      backend?: 'mongodb' | 'jsonl';   // 新增
      mongoUrl?: string;                // 新增
      mongoDb?: string;                 // 新增
      jsonlDir?: string;                // 新增
  }
  ```

## 修复方案

新增 `scripts/adapt-dist-package.js`，在构建时将 `dist/package.json` 中的路径从"相对于项目根目录"改写为"相对于 dist/"：

- `./dist/index.d.ts` → `./index.d.ts`
- `./dist/index.mjs` → `./index.mjs`
- `./dist/index.js` → `./index.js`
- `./dist/storage/...` → `./storage/...`
- `./dist/server/...` → `./server/...`

同时更新 `package.json` 的 `build` 脚本，在 `tsup` 和 `cp` 之间插入该脚本。

## 修复文件

- **新增**: `scripts/adapt-dist-package.js` — 路径改写脚本
- **修改**: `package.json` — build 脚本中调用 `node scripts/adapt-dist-package.js`

## 验证

- `npx tsc --noEmit` in `tests/next_test`：**0 errors**（修复前 4 errors）
- `npx vitest run`：68/69 通过（1 个 pre-existing failure，与本 bug 无关）
