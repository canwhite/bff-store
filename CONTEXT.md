# Domain Context

## Core Concepts

### Store (协调者)
The central coordinator that manages multiple persisted atoms. Created via `createStore()`, it holds:
- `entityId` - the unique identifier for this store instance
- `config` - the atom configuration array
- `atoms` - map of key → WritableAtom
- `loadingAtoms` - map of key → loading state atom

### Atom Config (原子配置)
Configuration for a single persisted state field:
- `key` - unique identifier within the store
- `defaultValue` - initial value before loading from storage
- `type` - optional type hint ('string' | 'number' | 'boolean' | 'array' | 'object')
- `immediate` - if true, save immediately without debouncing

### Storage Adapter (存储适配器)
The seam between the store and the underlying persistence layer. Implements the `Storage` interface and provides:
- `storage` - the Storage implementation
- `name` - identifier for the adapter type
- Optional lifecycle methods: `setEntityId()`, `close()`

### Storage (存储接口)
The minimal interface for persistence:
- `get<T>(key)` - load value by key
- `set<T>(key, value)` - save value
- `remove(key)` - delete value
- Optional: `getMultiple()`, `setMultiple()` for batch operations

### Debouncer (防抖器)
Manages delayed execution of save operations. Prevents excessive writes by:
- Buffering rapid changes
- Saving after a quiet period (default 800ms)
- Supporting immediate mode for critical data

## Relationships

```
Store (coordinates)
  ├── config: AtomConfig[]
  ├── atoms: Map<key, WritableAtom>
  └── storage: StorageAdapter (seam to persistence)
      └── storage: Storage (data interface)
```

## Setter Naming Convention

For an atom config with key `theme`:
- Value access: `store.atoms.theme.get()`
- Setter name: `setTheme` (derived via capitalize)
- Via hook: `{ theme, setTheme } = useStore(store)`
