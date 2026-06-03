# 核心实现详解

## 1. Storage 接口

```typescript
// src/storage/base.ts
export interface Storage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  getMultiple?<T>(keys: string[]): Promise<Map<string, T>>;  // 可选：批量读取
  setMultiple?<T>(entries: Map<string, T>): Promise<void>;    // 可选：批量写入
}
```

所有存储适配器都实现此接口，实现存储层的可插拔。

### 1.1 JSONL 存储

**文件结构**: `{dir}/{entityId}/{key}.jsonl`

每行一条 JSON，方便追溯历史和追加写入：

```jsonl
{"key":"theme","value":"科幻小说","timestamp":1704067200000}
{"key":"theme","value":"奇幻小说","timestamp":1704067201000}
```

读取时取最后一行（最新值），写入时 append。

```typescript
// src/storage/jsonl.ts
export function jsonlStorage(options?: JsonlStorageOptions): JsonlStorageInstance {
  const baseDir = options?.dir ?? './sessions';

  const storage: Storage = {
    async get<T>(key: string): Promise<T | null> {
      const filePath = getFilePath(entityId, key);
      if (!fs.existsSync(filePath)) return null;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      if (lines.length === 0) return null;

      // 取最后一行
      const lastLine = lines[lines.length - 1];
      const entry: JsonlEntry = JSON.parse(lastLine);
      return entry.value as T;
    },

    async set<T>(key: string, value: T): Promise<void> {
      const filePath = getFilePath(entityId, key);
      const entry = { key, value, timestamp: Date.now() };
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(filePath, line, 'utf-8');
    },
  };

  return { storage, name: 'jsonl', setEntityId };
}
```

### 1.2 MongoDB 存储

使用 MongoDB 的 append-only 模式，每次写入插入新文档，读取时取最新：

```typescript
// src/storage/mongodb.ts
const storage: Storage = {
  async get<T>(key: string): Promise<T | null> {
    const entry = await collection.findOne(
      { key },
      { sort: { timestamp: -1 } }  // 按时间倒序，取第一条
    );
    return entry?.value as T ?? null;
  },

  async set<T>(key: string, value: T): Promise<void> {
    await collection.insertOne({
      key,
      value,
      timestamp: Date.now(),
    });
  },
};
```

---

## 2. Atom 创建器

### 2.1 核心逻辑

```typescript
// src/atomCreator.ts
export function createPersistedAtom<T>(
  config: AtomConfig<T>,
  storage: Storage,
  options?: { immediate?: boolean; debounceMs?: number }
): PersistedAtomWithLoading<T> {
  // 1. 创建基础 atom
  const baseAtom = atom<T>(config.defaultValue);
  const loadingAtom = atom<boolean>(true);

  // 2. onMount 时从 storage 加载初始值
  baseAtom.onMount = (setValue) => {
    storage.get<T>(config.key)
      .then((value) => {
        if (value !== null) setValue(value);
      })
      .finally(() => {
        store.set(loadingAtom, false);  // 标记加载完成
      });
  };

  // 3. 创建写 atom，自动持久化
  const writeAtom = atom(
    (get) => get(baseAtom),
    (get, set, update) => {
      const newValue = typeof update === 'function'
        ? update(get(baseAtom))
        : update;

      set(baseAtom, newValue);  // 先更新本地

      // 保存到 storage
      if (options?.immediate) {
        storage.set(config.key, newValue);  // 立即保存
      } else {
        debouncedSave(config.key, newValue);  // 防抖保存
      }
    }
  );

  return { atom: writeAtom, loadingAtom };
}
```

### 2.2 防抖保存

使用 WeakMap 缓存每个 atom 的 debounced 函数：

```typescript
const debouncedSaveMap = new WeakMap<object, { timer: Timer; fn: Function }>();

function debounce(fn: Function, ms: number): Function {
  let timer: Timer | null = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, ms);
  };
}
```

---

## 3. Store 工厂

### 3.1 createStore

批量创建 atoms：

```typescript
// src/createStore.ts
export function createStore(
  entityId: string,
  config: AtomConfigs,
  options?: { storage: Storage; debounceMs?: number }
): Store {
  const storage = options.storage;
  const debounceMs = options.debounceMs ?? 800;

  const atoms = {};
  const loadingAtoms = {};

  for (const atomConfig of config) {
    const result = createPersistedAtom(atomConfig, storage, {
      immediate: atomConfig.immediate,
      debounceMs,
    });
    atoms[atomConfig.key] = result.atom;
    loadingAtoms[atomConfig.key] = result.loadingAtom;
  }

  return { entityId, config, atoms, loadingAtoms };
}
```

### 3.2 原子配置

```typescript
interface AtomConfig<T = unknown> {
  key: string;           // 状态键名
  defaultValue: T;       // 默认值
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  immediate?: boolean;   // 是否立即保存（不用 debounce）
}
```

`immediate: true` 用于 critical data（如 chapterOutline），避免 debounce 延迟。

---

## 4. useStore Hook

### 4.1 核心实现

```typescript
// src/useStore.ts
export function useStore(store: Store): UseStoreReturn {
  const [isLoading, setIsLoading] = useState(true);

  // 订阅所有 loading atoms
  useEffect(() => {
    const storeInstance = getDefaultStore();
    const loadingAtoms = Object.values(store.loadingAtoms);

    const checkLoadingStatus = () => {
      const states = loadingAtoms.map(atom => storeInstance.get(atom));
      setIsLoading(states.some(s => s === true));
    };

    checkLoadingStatus();

    // 订阅变化
    const unsubscribers = loadingAtoms.map(atom =>
      storeInstance.sub(atom, checkLoadingStatus)
    );

    return () => unsubscribers.forEach(unsub => unsub());
  }, [store.loadingAtoms]);

  // 为每个 atom 调用 useAtom
  const result = {};
  for (const config of store.config) {
    const [value, setter] = useAtom(store.atoms[config.key]);
    result[config.key] = value;
    result[`set${capitalize(config.key)}`] = setter;
  }

  return { ...result, isLoading };
}
```

### 4.2 使用示例

```typescript
const config = [
  { key: 'theme', defaultValue: '' },
  { key: 'characters', defaultValue: [] },
] as const;

const store = createStore('novel-123', config, { storage });

function NovelEditor() {
  const { theme, characters, setTheme, setCharacters, isLoading } = useStore(store);

  if (isLoading) return <Loading />;

  return (
    <div>
      <input value={theme} onChange={e => setTheme(e.target.value)} />
      <CharacterList characters={characters} onUpdate={setCharacters} />
    </div>
  );
}
```

---

## 5. 类型系统

### 5.1 类型导出

```typescript
// src/types.ts
export interface Store {
  entityId: string;
  config: AtomConfigs;
  atoms: StoreAtoms;
  loadingAtoms: StoreLoadingAtoms;
}

export type UseStoreReturn = Record<string, any> & { isLoading: boolean };
```

### 5.2 类型安全

虽然使用了 `as const` 和泛型，但由于 JavaScript 动态特性，返回类型使用 `Record<string, any>` 保证灵活性。

---

## 6. 数据流

```
用户操作
    │
    ▼
useStore Hook
    │
    ├── useAtom(store.atoms.xxx) → 更新 React 组件
    │
    ▼
writeAtom (jotai)
    │
    ├── set(baseAtom, newValue) → 立即更新本地状态
    │
    ▼
debouncedSave / storage.set()
    │
    ▼
Storage Adapter (JSONL / MongoDB / Memory)
    │
    ▼
持久化存储
```

---

## 7. 与原系统对比

| 特性 | 原系统 (novel-simple-persist.ts) | 新系统 (bff-store) |
|------|--------------------------------|--------------------------|
| 配置方式 | 硬编码 ATOM_CONFIGS | 数组配置，通用 |
| 存储层 | API 调用 (enhancedNovelClientAPI) | 可插拔 Adapter |
| 单例模式 | NovelAtomsSingleton 强制单例 | 可选，不强制 |
| MongoDB | 通过 API | 直连 |
| JSONL | 无 | 原生支持 |
| 加载状态 | loadingAtoms | loadingAtoms |
| Debounce | 800ms | 可配置 |
