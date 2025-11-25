import { describe, it, expect, beforeEach } from 'vitest';
import { LocatorService, locator, locate } from './LocatorService';

describe('LocatorService', () => {
  beforeEach(() => {
    locator.reset();
  });

  describe('singleton registration', () => {
    it('should register and retrieve a singleton instance', () => {
      const instance = { value: 'test' };
      locator.registerSingleton('test', instance);

      const retrieved = locator.get<typeof instance>('test');
      expect(retrieved).toBe(instance);
    });

    it('should return the same instance on multiple calls', () => {
      const instance = { value: 'test' };
      locator.registerSingleton('test', instance);

      const first = locator.get<typeof instance>('test');
      const second = locator.get<typeof instance>('test');

      expect(first).toBe(second);
    });

    it('should throw error when registering duplicate key', () => {
      const instance = { value: 'test' };
      locator.registerSingleton('test', instance);

      expect(() => {
        locator.registerSingleton('test', { value: 'duplicate' });
      }).toThrow('Service with key "test" is already registered');
    });
  });

  describe('lazy singleton registration', () => {
    it('should create instance on first access', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { value: 'lazy' };
      };

      locator.registerLazySingleton('lazy', factory);
      expect(callCount).toBe(0);

      const instance = locator.get<{ value: string }>('lazy');
      expect(callCount).toBe(1);
      expect(instance.value).toBe('lazy');
    });

    it('should return the same instance on multiple calls', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { value: 'lazy' };
      };

      locator.registerLazySingleton('lazy', factory);

      const first = locator.get<{ value: string }>('lazy');
      const second = locator.get<{ value: string }>('lazy');

      expect(first).toBe(second);
      expect(callCount).toBe(1);
    });

    it('should move to singletons after first creation', () => {
      const factory = () => ({ value: 'lazy' });
      locator.registerLazySingleton('lazy', factory);

      locator.get('lazy');

      expect(locator.isRegistered('lazy')).toBe(true);
    });
  });

  describe('factory registration', () => {
    it('should create a new instance on each call', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { value: callCount };
      };

      locator.registerFactory('factory', factory);

      const first = locator.get<{ value: number }>('factory');
      const second = locator.get<{ value: number }>('factory');

      expect(first.value).toBe(1);
      expect(second.value).toBe(2);
      expect(first).not.toBe(second);
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered services', () => {
      locator.registerSingleton('test', { value: 'test' });
      expect(locator.isRegistered('test')).toBe(true);
    });

    it('should return false for unregistered services', () => {
      expect(locator.isRegistered('nonexistent')).toBe(false);
    });

    it('should return true for lazy singletons before creation', () => {
      locator.registerLazySingleton('lazy', () => ({ value: 'test' }));
      expect(locator.isRegistered('lazy')).toBe(true);
    });

    it('should return true for factories', () => {
      locator.registerFactory('factory', () => ({ value: 'test' }));
      expect(locator.isRegistered('factory')).toBe(true);
    });
  });

  describe('unregister', () => {
    it('should remove a registered service', () => {
      locator.registerSingleton('test', { value: 'test' });
      expect(locator.isRegistered('test')).toBe(true);

      locator.unregister('test');
      expect(locator.isRegistered('test')).toBe(false);
    });

    it('should not throw when unregistering nonexistent key', () => {
      expect(() => {
        locator.unregister('nonexistent');
      }).not.toThrow();
    });
  });

  describe('reset', () => {
    it('should clear all registrations', () => {
      locator.registerSingleton('singleton', { value: 'test' });
      locator.registerLazySingleton('lazy', () => ({ value: 'test' }));
      locator.registerFactory('factory', () => ({ value: 'test' }));

      expect(locator.isRegistered('singleton')).toBe(true);
      expect(locator.isRegistered('lazy')).toBe(true);
      expect(locator.isRegistered('factory')).toBe(true);

      locator.reset();

      expect(locator.isRegistered('singleton')).toBe(false);
      expect(locator.isRegistered('lazy')).toBe(false);
      expect(locator.isRegistered('factory')).toBe(false);
    });
  });

  describe('get', () => {
    it('should throw error for unregistered service', () => {
      expect(() => {
        locator.get('nonexistent');
      }).toThrow('Service with key "nonexistent" is not registered');
    });
  });

  describe('singleton instance', () => {
    it('should return the same LocatorService instance', () => {
      const first = LocatorService.I;
      const second = LocatorService.I;

      expect(first).toBe(second);
    });

    it('should be the same as locator', () => {
      expect(locator).toBe(LocatorService.I);
    });
  });

  describe('locate function', () => {
    it('should retrieve service using locate function', () => {
      const instance = { value: 'test' };
      locator.registerSingleton('test', instance);

      const retrieved = locate<typeof instance>('test');
      expect(retrieved).toBe(instance);
    });
  });
});
