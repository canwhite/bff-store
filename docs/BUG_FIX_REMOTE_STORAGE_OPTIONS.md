# Bug Fix: `'backend' does not exist in type 'RemoteStorageOptions'`

## 现象

`tests/next_test` 中使用 `"bff-store": "file:../../dist"` 时，TypeScript 报错：

```
Object literal may only specify known properties, and 'backend' does not exist in type 'RemoteStorageOptions'.ts(2353)
```

## 根因

### 因素一（主因）：dist/package.json 路径错误

根目录 `package.json` 的 `main`/`module`/`types`/`exports` 字段路径都带有 `./dist/` 前缀：

```json
"main": "dist/index.js",
"exports": { ".": { "types": "./dist/index.d.ts", ... } }
```

当通过 `"file:../../dist"` 本地安装时，包根目录就是 `dist/` 本身，`./dist/index.d.ts` 解析为 `dist/dist/index.d.ts` —— 该文件不存在。

| 场景 | 包根目录 | `./dist/index.d.ts` 解析结果 | 存在? |
|------|----------|---------------------------|------|
| npm 发布 | 项目根 | `项目根/dist/index.d.ts` | 是 |
| `file:../../dist` | `dist/` | `dist/dist/index.d.ts` | 否 |

### 因素二（助推）：全局安装了旧版本

本地 symlink 解析失败后，TypeScript 沿目录树向上查找，在 `/Users/Admin/node_modules/bff-store/` 找到全局安装的旧版本（v0.1.1），该版本 `RemoteStorageOptions` 没有 `backend` 等新字段。

## 修复方案

1. **新增** `scripts/adapt-dist-package.js` — 构建后将 `dist/package.json` 中的路径从"相对于项目根"改写为"相对于 dist/"：
   - `dist/index.js` → `index.js`
   - `./dist/index.d.ts` → `./index.d.ts`
   - `./dist/storage/...` → `./storage/...`
   - `./dist/server/...` → `./server/...`

2. **修改** `package.json` 的 `build` 脚本：
   ```
   "build": "tsup && cp package.json dist/package.json && node scripts/adapt-dist-package.js && for f in dist/*.d.mts; do cp \"$f\" \"${f%.d.mts}.d.ts\"; done"
   ```
   完整流程：
   - `tsup` — 构建到 dist/
   - `cp package.json dist/package.json` — 复制配置到 dist
   - `node scripts/adapt-dist-package.js` — 改写路径
   - shell 循环 — 复制 `.d.mts` → `.d.ts`（主入口 tsup 只生成 `.d.mts`）

## 修复文件

| 文件 | 操作 |
|------|------|
| `scripts/adapt-dist-package.js` | 新增 — 路径改写脚本 |
| `package.json` | 修改 — build 脚本 |
| `tests/next_test/test-regression-remote-storage.ts` | 新增 — jsonl/mongodb/默认三种场景类型回归测试 |
| `tests/next_test/src/app/test-regression-store.tsx` | 新增 — createStore + storage 的 .tsx 回归测试 |

## 验证

- `npm run build`：构建成功，dist/package.json 路径正确
- `npx tsc --noEmit` in `tests/next_test`：0 errors
