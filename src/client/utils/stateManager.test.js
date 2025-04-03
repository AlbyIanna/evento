import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from './stateManager.js';

describe('StateManager', () => {
  let stateManager;

  beforeEach(() => {
    stateManager = new StateManager({
      testKey: 'initialValue',
      counter: 0
    });
  });

  it('should initialize with the provided state', () => {
    expect(stateManager.getState('testKey')).toBe('initialValue');
    expect(stateManager.getState('counter')).toBe(0);
  });

  it('should return the entire state when no key is provided', () => {
    const state = stateManager.getState();
    expect(state).toEqual({
      testKey: 'initialValue',
      counter: 0
    });

    // Ensure returned state is a copy, not a reference
    state.testKey = 'modified';
    expect(stateManager.getState('testKey')).toBe('initialValue');
  });

  it('should update state with setState', () => {
    stateManager.setState({ testKey: 'newValue' });
    expect(stateManager.getState('testKey')).toBe('newValue');
  });

  it('should update multiple state keys at once', () => {
    stateManager.setState({
      testKey: 'newValue',
      counter: 42
    });

    expect(stateManager.getState('testKey')).toBe('newValue');
    expect(stateManager.getState('counter')).toBe(42);
  });

  it('should notify subscribers when state changes', () => {
    const callback = vi.fn();
    stateManager.subscribe('testKey', callback);

    stateManager.setState({ testKey: 'newValue' });

    expect(callback).toHaveBeenCalledWith('newValue');
  });

  it("should not notify subscribers when state doesn't change", () => {
    const callback = vi.fn();
    stateManager.subscribe('testKey', callback);

    stateManager.setState({ testKey: 'initialValue' });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should allow unsubscribing from state changes', () => {
    const callback = vi.fn();
    const unsubscribe = stateManager.subscribe('testKey', callback);

    unsubscribe();
    stateManager.setState({ testKey: 'newValue' });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle multiple subscribers for the same key', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    stateManager.subscribe('testKey', callback1);
    stateManager.subscribe('testKey', callback2);

    stateManager.setState({ testKey: 'newValue' });

    expect(callback1).toHaveBeenCalledWith('newValue');
    expect(callback2).toHaveBeenCalledWith('newValue');
  });

  it('should only notify subscribers for changed keys', () => {
    const testKeyCallback = vi.fn();
    const counterCallback = vi.fn();

    stateManager.subscribe('testKey', testKeyCallback);
    stateManager.subscribe('counter', counterCallback);

    stateManager.setState({ testKey: 'newValue' });

    expect(testKeyCallback).toHaveBeenCalledWith('newValue');
    expect(counterCallback).not.toHaveBeenCalled();
  });

  it('should return the StateManager instance from setState for chaining', () => {
    const result = stateManager.setState({ testKey: 'newValue' });
    expect(result).toBe(stateManager);

    // Test chaining
    result.setState({ counter: 42 });
    expect(stateManager.getState('counter')).toBe(42);
  });
});
