# veto-mvvm

View/ViewModel pattern implementation and lightweight dependency injection container for React.

## Installation

```bash
npm install veto-mvvm
```

## Features

- **ViewModel pattern** for separating UI from business logic
- **Lightweight DI container** inspired by Flutter's get_it
- **Lifecycle management** with init/dispose hooks
- **Three registration types**: singleton, lazy singleton, factory
- **TypeScript-first** with full type inference
- **Zero dependencies** (peer dependency on React 18+)

## Quick Start

```tsx
import { locator, locate, useService, useViewModel, ViewModel } from 'veto-mvvm';

// Register services at app startup
locator.registerLazySingleton('usersApi', () => new UsersApi());
locator.registerLazySingleton('usersService', () => new UsersService(locate('usersApi')));

// Use in components
function UsersPage() {
  const usersService = useService<UsersService>('usersService');
  // ...
}
```

## API - Dependency Injection

### `LocatorService`

The DI container class. Access via `locator` singleton or `LocatorService.I`.

### `locator`

Singleton instance of the DI container.

```typescript
import { locator } from 'veto-mvvm';
```

### Registration Methods

#### `registerSingleton<T>(key: string, instance: T): T`

Register a pre-created instance. Same instance returned on every `get()`.

```typescript
const api = new UsersApi();
locator.registerSingleton('usersApi', api);
```

#### `registerLazySingleton<T>(key: string, factory: () => T): void`

Register a factory for lazy instantiation. Instance created on first access, then cached.

```typescript
locator.registerLazySingleton('usersApi', () => new UsersApi());
locator.registerLazySingleton('usersService', () =>
  new UsersService(locate('usersApi'))
);
```

#### `registerFactory<T>(key: string, factory: () => T): void`

Register a factory. New instance created on every `get()`.

```typescript
locator.registerFactory('userDto', () => new UserDto());
```

### Retrieval Methods

#### `get<T>(key: string): T`

Get an instance by key.

```typescript
const service = locator.get<UsersService>('usersService');
```

#### `locate<T>(key: string): T`

Shorthand function for `locator.get()`.

```typescript
const service = locate<UsersService>('usersService');
```

#### `useService<T>(key: string): T`

React hook for accessing services. Memoized to prevent re-lookups.

```typescript
function MyComponent() {
  const usersService = useService<UsersService>('usersService');
  // ...
}
```

### Utility Methods

#### `isRegistered(key: string): boolean`

Check if a key is registered.

#### `unregister(key: string): void`

Remove a registration.

#### `reset(): void`

Clear all registrations. Useful for testing.

```typescript
beforeEach(() => {
  locator.reset();
  locator.registerSingleton('mockApi', new MockUsersApi());
});
```

## API - ViewModel Pattern

### `ViewModel<A>` Interface

Base interface for ViewModels.

```typescript
interface ViewModel<A = void> {
  readonly arguments: A;
  readonly isInitialised: boolean;
  readonly isMounted: boolean;
}
```

### `useViewModel<T, A>(options): T & { rebuild: () => void }`

Hook for implementing the ViewModel pattern.

#### Options

| Property | Type | Description |
|----------|------|-------------|
| `create` | `(args: A) => T` | Factory function to create the ViewModel |
| `arguments` | `A` | Arguments passed to the ViewModel |
| `onInitialise` | `(vm: T) => void \| Promise<void>` | Called after creation |
| `onDispose` | `(vm: T) => void` | Called on unmount |

#### Example

```tsx
interface UserListViewModel extends ViewModel<{ teamId: string }> {
  users: User[];
  isLoading: boolean;
  loadUsers: () => Promise<void>;
}

function UserListView({ teamId }: { teamId: string }) {
  const vm = useViewModel<UserListViewModel, { teamId: string }>({
    arguments: { teamId },
    create: (args) => {
      const [users, setUsers] = useState<User[]>([]);
      const [isLoading, setIsLoading] = useState(false);

      const loadUsers = async () => {
        setIsLoading(true);
        const data = await fetchTeamUsers(args.teamId);
        setUsers(data);
        setIsLoading(false);
      };

      return {
        arguments: args,
        isInitialised: false,
        isMounted: true,
        users,
        isLoading,
        loadUsers,
      };
    },
    onInitialise: async (vm) => {
      await vm.loadUsers();
    },
    onDispose: (vm) => {
      console.log('Cleanup');
    },
  });

  if (!vm.isInitialised) return <Loading />;

  return (
    <ul>
      {vm.users.map(user => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}
```

### `ViewModelProvider<T, A>`

Component wrapper alternative to `useViewModel`.

```tsx
function App() {
  return (
    <ViewModelProvider
      create={() => createUserListViewModel()}
      onInitialise={async (vm) => await vm.loadUsers()}
      onDispose={(vm) => vm.cleanup()}
    >
      {(vm, isInitialised) => (
        isInitialised ? <UserList users={vm.users} /> : <Loading />
      )}
    </ViewModelProvider>
  );
}
```

### Utility Hooks

#### `useIsMounted(): () => boolean`

Track component mount state.

```tsx
const isMounted = useIsMounted();

const loadData = async () => {
  const data = await fetchData();
  if (isMounted()) {
    setState(data);
  }
};
```

#### `useForceUpdate(): () => void`

Get a function to force re-render.

```tsx
const forceUpdate = useForceUpdate();
// ... later
forceUpdate(); // Trigger re-render
```

#### `useInitialised(): [boolean, (value: boolean) => void]`

Track initialization state.

```tsx
const [isInitialised, setInitialised] = useInitialised();

useEffect(() => {
  loadData().then(() => setInitialised(true));
}, []);
```

## Patterns

### Service Registration at Startup

```typescript
// services/setup.ts
export function setupServices() {
  // APIs
  locator.registerLazySingleton('usersApi', () => new UsersApi(firestore));
  locator.registerLazySingleton('ordersApi', () => new OrdersApi(firestore));

  // Services (depend on APIs)
  locator.registerLazySingleton('usersService', () =>
    new UsersService(locate('usersApi'))
  );
  locator.registerLazySingleton('ordersService', () =>
    new OrdersService(locate('ordersApi'), locate('usersService'))
  );
}

// main.tsx
setupServices();
ReactDOM.createRoot(root).render(<App />);
```

### Testing with Mock Services

```typescript
describe('UserList', () => {
  beforeEach(() => {
    locator.reset();
    locator.registerSingleton('usersService', new MockUsersService());
  });

  it('renders users', () => {
    render(<UserList />);
    // ...
  });
});
```

## License

MIT
