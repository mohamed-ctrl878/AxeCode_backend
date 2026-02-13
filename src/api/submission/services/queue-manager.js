'use strict';

/**
 * QueueManager
 * Simple async task queue to ensure sequential execution of tasks.
 */

class QueueManager {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  async addTask(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.processing = false;
      this.process();
    }
  }
}

module.exports = new QueueManager();
