# 本地包链接策略

## 背景

开发 bff-store 时，需要在项目中测试自己的包。常见的链接方式有三种。

---

## 方式一：`file:` 路径（当前使用）

### 配置

```json
// tests/next_test/package.json
{
  "dependencies": {
    "bff-store": "file:../../dist"
  }
}
```

npm install 后会创建 symlink：

```
tests/next_test/node_modules/bff-store -> bff-store/dist
```

### 优点
- 简单直接，改完 `npm run build` 就生效
- 无需额外命令

### 缺点
- 不是真实 npm 安装行为，可能有边界情况
- 路径固定，不够灵活

---

## 方式二：`npm link`（推荐本地开发）

### 配置

```bash
# 1. 在 bff-store 目录注册全局链接
cd bff-store
npm link

# 2. 在目标项目链接全局包
cd tests/next_test
npm link bff-store
```

### 原理

```
bff-store/ (全局注册的包)
    ↓
tests/next_test/node_modules/bff-store -> 全局包的 symlink
```

### 优点
- 更接近真实 npm 安装行为
- 全局一份，多个项目共用
- 可同时开发多个相互依赖的包

### 缺点
- 需要两条命令
- 全局状态管理可能混乱

### 清理

```bash
cd tests/next_test
npm unlink bff-store

cd bff-store
npm link remove bff-store
```

---

## 方式三：发布到 npm（正式发布）

### 配置

```bash
# 1. 登录 npm
npm login

# 2. 发布（需要 package.json 的 name 是唯一的）
npm publish

# 3. 在项目中使用
npm install bff-store
```

### 优点
- 真实用户安装方式
- 版本管理规范

### 缺点
- 需要 npm 账号
- 版本管理，每次改动都要发版
- 发布后不能即时生效

---

## 总结

| 方式 | 即时生效 | 配置复杂度 | 接近真实安装 |
|------|---------|-----------|------------|
| `file:` | ✅ | 简单 | 一般 |
| `npm link` | ✅ | 中等 | ✅ |
| `npm publish` | ❌ | 需要版本管理 | ✅ |

**本地开发推荐**：`npm link` 或保持 `file:`

**正式发布**：用 `npm publish`
