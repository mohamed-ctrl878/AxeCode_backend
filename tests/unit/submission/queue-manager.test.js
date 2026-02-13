import { describe, it, expect, vi } from 'vitest';

const queueManager = require('../../../src/api/submission/services/queue-manager');

describe('QueueManager', () => {
  it('should execute tasks sequentially', async () => {
    const sequence = [];
    const task1 = async () => {
        await new Promise(r => setTimeout(r, 50));
        sequence.push(1);
        return 'res1';
    };
    const task2 = async () => {
        sequence.push(2);
        return 'res2';
    };

    const [r1, r2] = await Promise.all([
        queueManager.addTask(task1),
        queueManager.addTask(task2)
    ]);

    expect(sequence).toEqual([1, 2]);
    expect(r1).toBe('res1');
    expect(r2).toBe('res2');
  });

  it('should handle task errors without breaking the queue', async () => {
    const taskErr = async () => { throw new Error('fail'); };
    const taskOk = async () => 'ok';

    await expect(queueManager.addTask(taskErr)).rejects.toThrow('fail');
    const result = await queueManager.addTask(taskOk);
    expect(result).toBe('ok');
  });
});
