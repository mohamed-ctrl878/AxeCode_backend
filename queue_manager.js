const EventEmitter = require("events");

class QueueManager extends EventEmitter {
  constructor(maxConcurrent = 5, maxQueueSize = 100) {
    super();
    this.maxConcurrent = maxConcurrent;
    this.maxQueueSize = maxQueueSize;
    this.queue = [];
    this.running = 0;
    this.completed = 0;
    this.failed = 0;
    this.totalWaitTime = 0;
    this.totalExecutionTime = 0;
  }

  // إضافة مهمة للطابور
  async addTask(task, priority = 0) {
    return new Promise((resolve, reject) => {
      // فحص حجم الطابور
      if (this.queue.length >= this.maxQueueSize) {
        reject(new Error("Queue is full"));
        return;
      }

      const queueItem = {
        id: Date.now() + Math.random(),
        task,
        priority,
        resolve,
        reject,
        addedAt: Date.now(),
      };

      // إضافة المهمة مع الأولوية
      this.insertWithPriority(queueItem);

      // محاولة تشغيل المهام
      this.processQueue();

      this.emit("taskAdded", queueItem);
    });
  }

  // إدراج مهمة مع الأولوية
  insertWithPriority(item) {
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (item.priority > this.queue[i].priority) {
        this.queue.splice(i, 0, item);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.queue.push(item);
    }
  }

  // معالجة الطابور
  async processQueue() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift();
      this.running++;

      const waitTime = Date.now() - item.addedAt;
      this.totalWaitTime += waitTime;

      this.emit("taskStarted", item);

      try {
        const startTime = Date.now();
        const result = await item.task();
        const executionTime = Date.now() - startTime;

        this.totalExecutionTime += executionTime;
        this.completed++;
        this.running--;

        item.resolve(result);
        this.emit("taskCompleted", { ...item, result, executionTime });
      } catch (error) {
        this.failed++;
        this.running--;

        item.reject(error);
        this.emit("taskFailed", { ...item, error });
      }

      // معالجة المهام التالية
      setImmediate(() => this.processQueue());
    }
  }

  // إيقاف مهمة
  cancelTask(taskId) {
    const index = this.queue.findIndex((item) => item.id === taskId);
    if (index !== -1) {
      const item = this.queue.splice(index, 1)[0];
      item.reject(new Error("Task cancelled"));
      this.emit("taskCancelled", item);
      return true;
    }
    return false;
  }

  // تنظيف المهام القديمة
  cleanupOldTasks(maxAge = 30000) {
    // 30 ثانية
    const now = Date.now();
    const initialLength = this.queue.length;

    this.queue = this.queue.filter((item) => {
      if (now - item.addedAt > maxAge) {
        item.reject(new Error("Task timeout"));
        this.emit("taskTimeout", item);
        return false;
      }
      return true;
    });

    const removed = initialLength - this.queue.length;
    if (removed > 0) {
      this.emit("cleanup", { removed, remaining: this.queue.length });
    }

    return removed;
  }

  // الحصول على إحصائيات الطابور
  getStats() {
    const totalTasks =
      this.completed + this.failed + this.running + this.queue.length;
    const avgWaitTime = totalTasks > 0 ? this.totalWaitTime / totalTasks : 0;
    const avgExecutionTime =
      this.completed > 0 ? this.totalExecutionTime / this.completed : 0;

    return {
      queueLength: this.queue.length,
      running: this.running,
      completed: this.completed,
      failed: this.failed,
      totalTasks,
      avgWaitTime,
      avgExecutionTime,
      maxConcurrent: this.maxConcurrent,
      maxQueueSize: this.maxQueueSize,
      utilization: (this.running / this.maxConcurrent) * 100,
    };
  }

  // إيقاف الطابور
  async shutdown(timeout = 10000) {
    this.emit("shutdown", { timeout });

    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkShutdown = () => {
        if (this.running === 0 && this.queue.length === 0) {
          this.emit("shutdownComplete");
          resolve();
        } else if (Date.now() - startTime > timeout) {
          // إلغاء جميع المهام المتبقية
          this.queue.forEach((item) => {
            item.reject(new Error("Shutdown timeout"));
          });
          this.queue = [];
          this.emit("shutdownTimeout");
          resolve();
        } else {
          setTimeout(checkShutdown, 100);
        }
      };

      checkShutdown();
    });
  }

  // إعادة تعيين الإحصائيات
  resetStats() {
    this.completed = 0;
    this.failed = 0;
    this.totalWaitTime = 0;
    this.totalExecutionTime = 0;
    this.emit("statsReset");
  }
}

// إنشاء مثيل عالمي
const queueManager = new QueueManager(3, 50); // 3 مهام متزامنة، 50 في الطابور

// تنظيف دوري للمهام القديمة
setInterval(() => {
  queueManager.cleanupOldTasks();
}, 10000); // كل 10 ثواني

module.exports = queueManager;
