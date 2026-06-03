# BUG: child_process / mongodb 错误

**日期**: 2026-06-03

## 问题现象

Next.js 构建时报错：
```
Module not found: Can't resolve 'child_process'
./tests/next_test/node_modules/mongodb/lib/client-side-encryption/mongocryptd_manager.js:38
const { spawn } = require('child_process');
```

## 根因分析

**不是本次改动引起的，是之前就存在的依赖架构问题。**

### 1. bff-store 的 `package.json` 把 mongodb 放在 `dependencies`

```json
// bff-store/package.json
{
  "dependencies": {
    "mongodb": "^6.21.0"
  }
}
```

### 2. next_test 通过 `file:` 路径安装 bff-store

```json
// next_test/package.json
{
  "bff-store": "file:../../dist"
}
```

### 3. npm install 时把 mongodb 也装进了 next_test/node_modules

```
next_test/node_modules/mongodb/   ← 被安装了
```

### 4. Next.js/Webpack 在静态分析时解析到了 mongodb

即使 `dist/index.mjs` 实际不引用 mongodb（`tsup external: ['mongodb']`），但 Next.js 的 bundler 在分析依赖时看到了 `node_modules/mongodb`，尝试解析它，然后触发了 `child_process` 的引用。

## 验证

- `dist/index.mjs` 实际 bundle：干净（0 个 mongodb 引用）
- tsup 的 external 配置：正确（mongodb 被 external）
- 清理 next_test 的 `node_modules` 和 `package-lock.json` 后重装，mongodb 没再被安装，构建成功

## 结论

| 环节 | 状态 |
|------|------|
| 本次新增代码（environment.ts、nodeStore.ts）| 无问题 |
| `dist/index.mjs` 实际 bundle | 干净（0 个 mongodb 引用）|
| tsup 的 external 配置 | 正确（mongodb 被 external）|
| **根本原因** | `package.json` 的 `dependencies` 里有 mongodb |

这是之前就存在的问题，只是以前 next_test 可能没走到触发这个解析的代码路径。

## 修复（2026-06-03）

已将 `mongodb` 从 `package.json` 的 `dependencies` 移到 `devDependencies`。

**原因**：
- `tsup` 构建 `mongodb-entry.ts` 时会将 mongodb 打包进 `dist/storage/mongodb-entry.js`
- 根 `package.json` 的 `dependencies` 不需要 mongodb
- npm install 时不会为消费者安装 devDependencies，所以 next_test 不再被强制安装 mongodb

**修复后验证**：
- next_test 重新 `npm install` 后，`node_modules/mongodb` 不存在
- Next.js 构建成功，无 `child_process` 错误

---

## 问题二：Can't resolve 'bff-store'

**日期**: 2026-06-03

### 问题现象

Next.js dev 时报错：
```
Module not found: Can't resolve 'bff-store'
import { createStore, useStore, remoteStorage } from 'bff-store';
```

### 根因分析

`package.json` exports 的 `require` 字段指向不存在的文件：

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.js"  // ← 这个文件不存在！
  }
}
```

tsup 只生成 ESM（`.mjs`），没有生成 CJS（`.js`）。但 exports 里写了 `require` 字段指向 `index.js`，Node.js CJS resolver 尝试解析时找不到文件就报错了。

### 修复

移除 exports 中的 `require` 字段（ESM-only 库）：

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs"
  }
}
```

### ESM-only 的影响

| 方式 | 支持 |
|------|------|
| `import from 'bff-store'` | ✅ 正常 |
| `node --input-type=module` + import | ✅ 正常 |
| `const x = require('bff-store')` | ❌ 报错 |

bff-store 主打 React + 新项目，用 ESM 语法不受影响。老项目用 `require` 的场景暂不支持。
