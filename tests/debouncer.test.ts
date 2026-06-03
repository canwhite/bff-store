import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDebouncer, DebouncerMap } from '../src/debouncer';

describe('Debouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should delay function execution', () => {
    const debouncer = createDebouncer(100);
    const fn = vi.fn();

    debouncer.run(fn);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should reset timer on subsequent calls', () => {
    const debouncer = createDebouncer(100);
    const fn = vi.fn();

    debouncer.run(fn);
    vi.advanceTimersByTime(50);
    debouncer.run(fn);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cancel pending execution', () => {
    const debouncer = createDebouncer(100);
    const fn = vi.fn();

    debouncer.run(fn);
    debouncer.cancel();

    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it('should expose ms property', () => {
    const debouncer = createDebouncer(500);
    expect(debouncer.ms).toBe(500);
  });
});

describe('DebouncerMap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should create debouncer for new key', () => {
    const map = new DebouncerMap(100);
    const debouncer1 = map.getDebouncer('key1');
    const debouncer2 = map.getDebouncer('key2');

    expect(debouncer1).not.toBe(debouncer2);
    expect(debouncer1.ms).toBe(100);
  });

  it('should return same debouncer for same key', () => {
    const map = new DebouncerMap(100);
    const debouncer1 = map.getDebouncer('key1');
    const debouncer2 = map.getDebouncer('key1');

    expect(debouncer1).toBe(debouncer2);
  });

  it('should debounce function calls per key', () => {
    const map = new DebouncerMap(100);
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    map.debounce('key1', fn1);
    map.debounce('key2', fn2);

    vi.advanceTimersByTime(100);

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('should cancel debounced call for specific key', () => {
    const map = new DebouncerMap(100);
    const fn = vi.fn();

    map.debounce('key1', fn);
    map.cancel('key1');

    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it('should cancel all pending debounced calls', () => {
    const map = new DebouncerMap(100);
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    map.debounce('key1', fn1);
    map.debounce('key2', fn2);
    map.cancelAll();

    vi.advanceTimersByTime(200);

    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it('should use custom ms per debounce call', () => {
    const map = new DebouncerMap(100);
    const fn = vi.fn();

    map.debounce('key1', fn, 500);

    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
