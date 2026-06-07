import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert';
import { configureConsoleLogging, resolveLogLevel } from './logger.js';

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
};

afterEach(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

describe('logger', () => {
  test('defaults LOG_LEVEL to info', () => {
    assert.strictEqual(resolveLogLevel(undefined), 'info');
    assert.strictEqual(resolveLogLevel('invalid'), 'info');
  });

  test('mutes console.log at warn level while preserving warn and error', () => {
    let logCalls = 0;
    let warnCalls = 0;
    let errorCalls = 0;

    console.log = () => {
      logCalls += 1;
    };
    console.warn = () => {
      warnCalls += 1;
    };
    console.error = () => {
      errorCalls += 1;
    };

    configureConsoleLogging('warn');

    console.log('hidden');
    console.warn('visible');
    console.error('visible');

    assert.strictEqual(logCalls, 0);
    assert.strictEqual(warnCalls, 1);
    assert.strictEqual(errorCalls, 1);
  });

  test('keeps console.log enabled at debug level', () => {
    let logCalls = 0;

    console.log = () => {
      logCalls += 1;
    };

    configureConsoleLogging('debug');
    console.log('visible');

    assert.strictEqual(logCalls, 1);
  });
});
