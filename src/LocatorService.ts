import { useMemo } from 'react';

type Factory<T> = () => T;

/**
 * Lightweight dependency injection container inspired by Flutter's get_it.
 * Supports singletons, lazy singletons, and factory registrations.
 *
 * @example
 * // At app startup, register services:
 * locator.registerLazySingleton('usersApi', () => new UsersApi());
 * locator.registerLazySingleton('usersService', () => new UsersService(locate('usersApi')));
 *
 * // In React components:
 * const usersService = useService<UsersService>('usersService');
 *
 * // In non-React code:
 * const usersService = locate<UsersService>('usersService');
 *
 * @example
 * // Testing pattern:
 * beforeEach(() => {
 *   locator.reset();
 *   locator.registerSingleton('mockApi', new MockUsersApi());
 * });
 */
export class LocatorService {
  private static _instance: LocatorService | null = null;

  private singletons = new Map<string, unknown>();
  private lazySingletonFactories = new Map<string, Factory<unknown>>();
  private factories = new Map<string, Factory<unknown>>();

  /**
   * Singleton access to the container instance.
   * Creates the instance on first access.
   */
  static get I(): LocatorService {
    if (!LocatorService._instance) {
      LocatorService._instance = new LocatorService();
    }
    return LocatorService._instance;
  }

  /**
   * Register a pre-created singleton instance.
   * The same instance will be returned on every call to get().
   *
   * @param key - Unique identifier for the service
   * @param instance - Pre-created instance to register
   * @returns The registered instance
   *
   * @example
   * const api = new UsersApi();
   * locator.registerSingleton('usersApi', api);
   */
  registerSingleton<T>(key: string, instance: T): T {
    if (this.isRegistered(key)) {
      throw new Error(`Service with key "${key}" is already registered`);
    }

    this.singletons.set(key, instance);
    return instance;
  }

  /**
   * Register a lazy singleton factory.
   * The instance will be created on first access and cached.
   * Subsequent calls return the same instance.
   *
   * @param key - Unique identifier for the service
   * @param factory - Factory function to create the instance
   *
   * @example
   * locator.registerLazySingleton('usersApi', () => new UsersApi());
   * locator.registerLazySingleton('usersService', () =>
   *   new UsersService(locate('usersApi'))
   * );
   */
  registerLazySingleton<T>(key: string, factory: Factory<T>): void {
    if (this.isRegistered(key)) {
      throw new Error(`Service with key "${key}" is already registered`);
    }

    this.lazySingletonFactories.set(key, factory as Factory<unknown>);
  }

  /**
   * Register a factory function.
   * A new instance will be created on every call to get().
   *
   * @param key - Unique identifier for the service
   * @param factory - Factory function to create instances
   *
   * @example
   * locator.registerFactory('userDto', () => new UserDto());
   */
  registerFactory<T>(key: string, factory: Factory<T>): void {
    if (this.isRegistered(key)) {
      throw new Error(`Service with key "${key}" is already registered`);
    }

    this.factories.set(key, factory as Factory<unknown>);
  }

  /**
   * Get an instance by key.
   *
   * Resolution order:
   * 1. Check singletons
   * 2. Check lazy singletons (create and cache if not yet created)
   * 3. Check factories (create new instance)
   *
   * @param key - Unique identifier for the service
   * @returns The service instance
   * @throws Error if the key is not registered
   *
   * @example
   * const usersService = locator.get<UsersService>('usersService');
   */
  get<T>(key: string): T {
    // Check singletons first
    if (this.singletons.has(key)) {
      return this.singletons.get(key) as T;
    }

    // Check lazy singletons
    if (this.lazySingletonFactories.has(key)) {
      const factory = this.lazySingletonFactories.get(key)!;
      const instance = factory();

      // Move to singletons and remove factory
      this.singletons.set(key, instance);
      this.lazySingletonFactories.delete(key);

      return instance as T;
    }

    // Check factories
    if (this.factories.has(key)) {
      const factory = this.factories.get(key)!;
      return factory() as T;
    }

    throw new Error(
      `Service with key "${key}" is not registered. ` +
      `Make sure to register it using registerSingleton(), registerLazySingleton(), or registerFactory() ` +
      `before attempting to access it.`
    );
  }

  /**
   * Check if a key is registered in the container.
   *
   * @param key - Unique identifier to check
   * @returns True if the key is registered
   *
   * @example
   * if (locator.isRegistered('usersApi')) {
   *   const api = locator.get<UsersApi>('usersApi');
   * }
   */
  isRegistered(key: string): boolean {
    return (
      this.singletons.has(key) ||
      this.lazySingletonFactories.has(key) ||
      this.factories.has(key)
    );
  }

  /**
   * Unregister a specific key from the container.
   * Removes the service from all registration types.
   *
   * @param key - Unique identifier to unregister
   *
   * @example
   * locator.unregister('usersApi');
   */
  unregister(key: string): void {
    this.singletons.delete(key);
    this.lazySingletonFactories.delete(key);
    this.factories.delete(key);
  }

  /**
   * Reset all registrations.
   * Clears all singletons, lazy singletons, and factories.
   * Useful for testing scenarios.
   *
   * @example
   * beforeEach(() => {
   *   locator.reset();
   *   // Re-register test services
   * });
   */
  reset(): void {
    this.singletons.clear();
    this.lazySingletonFactories.clear();
    this.factories.clear();
  }
}

/**
 * Shorthand for accessing the LocatorService singleton instance.
 *
 * @example
 * locator.registerLazySingleton('usersApi', () => new UsersApi());
 * const api = locator.get<UsersApi>('usersApi');
 */
export const locator = LocatorService.I;

/**
 * Convenience function for getting instances from the container.
 * Provides a shorter syntax for accessing services.
 *
 * @param key - Unique identifier for the service
 * @returns The service instance
 *
 * @example
 * // In non-React code:
 * const usersService = locate<UsersService>('usersService');
 * const result = await usersService.getUsers();
 */
export function locate<T>(key: string): T {
  return locator.get<T>(key);
}

/**
 * React hook for accessing services from the container.
 * Memoizes the lookup to prevent unnecessary re-lookups on re-renders.
 *
 * The service instance is looked up once and remains stable across re-renders,
 * unless the component unmounts and remounts.
 *
 * @param key - Unique identifier for the service
 * @returns The service instance
 *
 * @example
 * function UsersPage() {
 *   const usersService = useService<UsersService>('usersService');
 *
 *   useEffect(() => {
 *     usersService.loadUsers();
 *   }, [usersService]);
 *
 *   return <div>Users List</div>;
 * }
 */
export function useService<T>(key: string): T {
  return useMemo(() => locator.get<T>(key), [key]);
}
