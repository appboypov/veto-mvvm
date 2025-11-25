import React, { useState, useRef, useEffect, useCallback, useReducer } from 'react';

/**
 * Base interface for ViewModels.
 * ViewModels hold state and business logic for views.
 *
 * @template A - The type of arguments passed to the ViewModel
 *
 * @example
 * ```tsx
 * interface UserProfileViewModel extends ViewModel<{ userId: string }> {
 *   user: User | null;
 *   isLoading: boolean;
 *   loadUser: () => Promise<void>;
 * }
 * ```
 */
export interface ViewModel<A = void> {
  /** Arguments passed to the ViewModel */
  readonly arguments: A;
  /** Whether the ViewModel has completed initialization */
  readonly isInitialised: boolean;
  /** Whether the ViewModel is currently mounted (component in DOM) */
  readonly isMounted: boolean;
}

/**
 * Options for configuring the useViewModel hook.
 *
 * @template T - The ViewModel type extending ViewModel<A>
 * @template A - The type of arguments passed to the ViewModel
 */
export interface UseViewModelOptions<T, A = void> {
  /** Factory function to create the ViewModel state and actions */
  create: (args: A) => T;
  /** Arguments to pass to the ViewModel */
  arguments?: A;
  /** Called after the ViewModel is created (initialization logic) */
  onInitialise?: (vm: T) => void | Promise<void>;
  /** Called when the component unmounts (cleanup logic) */
  onDispose?: (vm: T) => void;
}

/**
 * Hook for implementing the ViewModel pattern in React.
 *
 * Creates a ViewModel instance, manages its lifecycle, and provides
 * a rebuild function for manual re-renders when needed.
 *
 * The hook ensures proper initialization and cleanup:
 * - Calls `onInitialise` after the ViewModel is created
 * - Calls `onDispose` when the component unmounts
 * - Tracks mounted state to prevent updates after unmount
 * - Provides a `rebuild` function to force re-renders
 *
 * @template T - The ViewModel type extending ViewModel<A>
 * @template A - The type of arguments passed to the ViewModel
 *
 * @param options - Configuration options for the ViewModel
 * @returns The ViewModel instance with an additional `rebuild` function
 *
 * @example
 * Basic usage with no arguments:
 * ```tsx
 * interface CounterViewModel extends ViewModel {
 *   count: number;
 *   increment: () => void;
 * }
 *
 * function CounterView() {
 *   const vm = useViewModel<CounterViewModel>({
 *     create: () => {
 *       const [count, setCount] = useState(0);
 *
 *       return {
 *         arguments: undefined,
 *         isInitialised: false,
 *         isMounted: true,
 *         count,
 *         increment: () => setCount(c => c + 1),
 *       };
 *     },
 *     onInitialise: async (vm) => {
 *       console.log('Counter initialized');
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       <p>Count: {vm.count}</p>
 *       <button onClick={vm.increment}>Increment</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * With arguments and async initialization:
 * ```tsx
 * interface UserListViewModel extends ViewModel<{ teamId: string }> {
 *   users: User[];
 *   isLoading: boolean;
 *   loadUsers: () => Promise<void>;
 * }
 *
 * function UserListView({ teamId }: { teamId: string }) {
 *   const vm = useViewModel<UserListViewModel, { teamId: string }>({
 *     arguments: { teamId },
 *     create: (args) => {
 *       const [users, setUsers] = useState<User[]>([]);
 *       const [isLoading, setIsLoading] = useState(false);
 *
 *       const loadUsers = async () => {
 *         setIsLoading(true);
 *         try {
 *           const data = await fetchTeamUsers(args.teamId);
 *           setUsers(data);
 *         } finally {
 *           setIsLoading(false);
 *         }
 *       };
 *
 *       return {
 *         arguments: args,
 *         isInitialised: false,
 *         isMounted: true,
 *         users,
 *         isLoading,
 *         loadUsers,
 *       };
 *     },
 *     onInitialise: async (vm) => {
 *       await vm.loadUsers();
 *     },
 *     onDispose: (vm) => {
 *       console.log('Cleanup on unmount');
 *     },
 *   });
 *
 *   if (!vm.isInitialised || vm.isLoading) {
 *     return <div>Loading...</div>;
 *   }
 *
 *   return (
 *     <div>
 *       {vm.users.map(user => (
 *         <div key={user.id}>{user.name}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * Using rebuild for manual re-renders:
 * ```tsx
 * function TodoListView() {
 *   const vm = useViewModel<TodoListViewModel>({
 *     create: () => {
 *       let todos: Todo[] = [];
 *
 *       return {
 *         arguments: undefined,
 *         isInitialised: false,
 *         isMounted: true,
 *         todos,
 *         addTodo: (text: string) => {
 *           todos = [...todos, { id: Date.now(), text }];
 *           // Manual rebuild needed when not using React state
 *         },
 *       };
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       {vm.todos.map(todo => (
 *         <div key={todo.id}>{todo.text}</div>
 *       ))}
 *       <button onClick={() => {
 *         vm.addTodo('New todo');
 *         vm.rebuild(); // Force re-render
 *       }}>Add Todo</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useViewModel<T extends ViewModel<A>, A = void>(
  options: UseViewModelOptions<T, A>
): T & { rebuild: () => void } {
  const { create, arguments: args, onInitialise, onDispose } = options;

  const isMountedRef = useRef(true);
  const [isInitialised, setIsInitialised] = useState(false);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // Create the ViewModel instance (only once)
  const viewModelRef = useRef<T | null>(null);
  if (viewModelRef.current === null) {
    viewModelRef.current = create(args as A);
  }

  const viewModel = viewModelRef.current;

  // Update the ViewModel properties
  (viewModel as any).arguments = args;
  (viewModel as any).isInitialised = isInitialised;
  (viewModel as any).isMounted = isMountedRef.current;

  // Rebuild function to force re-renders
  const rebuild = useCallback(() => {
    forceUpdate();
  }, []);

  // Handle initialization and cleanup
  useEffect(() => {
    isMountedRef.current = true;

    // Initialize the ViewModel
    const initialize = async () => {
      if (onInitialise) {
        await onInitialise(viewModel);
      }
      if (isMountedRef.current) {
        setIsInitialised(true);
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      if (onDispose) {
        onDispose(viewModel);
      }
    };
  }, []); // Empty dependency array - only run once

  return {
    ...viewModel,
    rebuild,
  };
}

/**
 * Hook that tracks whether the component is mounted.
 * Useful for preventing state updates after unmount.
 *
 * @returns A function that returns true if the component is mounted, false otherwise
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isMounted = useIsMounted();
 *
 *   const loadData = async () => {
 *     const data = await fetchData();
 *     if (isMounted()) {
 *       setState(data);
 *     }
 *   };
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback(() => isMountedRef.current, []);
}

/**
 * Hook that returns a function to force a re-render.
 * Similar to Flutter's notifyListeners() / setState().
 *
 * Use this when you need to manually trigger a re-render,
 * typically when working with non-React state management.
 *
 * @returns A function that forces a re-render when called
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const forceUpdate = useForceUpdate();
 *   let count = 0; // Non-React state
 *
 *   const increment = () => {
 *     count++;
 *     forceUpdate(); // Trigger re-render
 *   };
 *
 *   return (
 *     <div>
 *       <p>Count: {count}</p>
 *       <button onClick={increment}>Increment</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useForceUpdate(): () => void {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  return forceUpdate;
}

/**
 * Hook for tracking initialization state.
 * Returns [isInitialised, setInitialised] tuple.
 *
 * Useful for managing async initialization logic in ViewModels
 * or components that need to track their initialization status.
 *
 * @returns A tuple containing the initialization state and setter function
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [isInitialised, setInitialised] = useInitialised();
 *
 *   useEffect(() => {
 *     const init = async () => {
 *       await loadData();
 *       setInitialised(true);
 *     };
 *     init();
 *   }, []);
 *
 *   if (!isInitialised) {
 *     return <div>Loading...</div>;
 *   }
 *
 *   return <div>Initialized!</div>;
 * }
 * ```
 */
export function useInitialised(): [boolean, (value: boolean) => void] {
  const [isInitialised, setIsInitialised] = useState(false);
  return [isInitialised, setIsInitialised];
}

/**
 * Props for the ViewModelProvider component.
 *
 * @template T - The ViewModel type extending ViewModel<A>
 * @template A - The type of arguments passed to the ViewModel
 */
export interface ViewModelProviderProps<T extends ViewModel<A>, A = void> {
  /** Factory function to create the ViewModel */
  create: () => T;
  /** Arguments to pass to the ViewModel */
  arguments?: A;
  /** Called after initialization */
  onInitialise?: (vm: T) => void | Promise<void>;
  /** Called on unmount */
  onDispose?: (vm: T) => void;
  /** Child render function that receives the ViewModel and initialization state */
  children: (vm: T, isInitialised: boolean) => React.ReactNode;
}

/**
 * Component wrapper for ViewModel pattern.
 * Alternative to using the useViewModel hook directly.
 *
 * This component handles the ViewModel lifecycle and provides
 * the ViewModel instance to its children via a render prop.
 *
 * @template T - The ViewModel type extending ViewModel<A>
 * @template A - The type of arguments passed to the ViewModel
 *
 * @param props - The component props
 * @returns A React element
 *
 * @example
 * Basic usage:
 * ```tsx
 * function App() {
 *   return (
 *     <ViewModelProvider
 *       create={() => createUserListViewModel()}
 *       onInitialise={async (vm) => {
 *         await vm.loadUsers();
 *       }}
 *     >
 *       {(vm, isInitialised) => (
 *         isInitialised ? (
 *           <UserList users={vm.users} />
 *         ) : (
 *           <div>Loading...</div>
 *         )
 *       )}
 *     </ViewModelProvider>
 *   );
 * }
 * ```
 *
 * @example
 * With arguments:
 * ```tsx
 * function TeamView({ teamId }: { teamId: string }) {
 *   return (
 *     <ViewModelProvider
 *       arguments={{ teamId }}
 *       create={() => createTeamViewModel()}
 *       onInitialise={async (vm) => {
 *         await vm.loadTeam();
 *       }}
 *       onDispose={(vm) => {
 *         vm.cleanup();
 *       }}
 *     >
 *       {(vm, isInitialised) => (
 *         <div>
 *           {isInitialised && vm.team && (
 *             <div>{vm.team.name}</div>
 *           )}
 *         </div>
 *       )}
 *     </ViewModelProvider>
 *   );
 * }
 * ```
 */
export function ViewModelProvider<T extends ViewModel<A>, A = void>(
  props: ViewModelProviderProps<T, A>
): React.ReactElement {
  const { create, arguments: args, onInitialise, onDispose, children } = props;

  const vm = useViewModel<T, A>({
    create: () => create(),
    arguments: args,
    onInitialise,
    onDispose,
  });

  return <>{children(vm, vm.isInitialised)}</>;
}
