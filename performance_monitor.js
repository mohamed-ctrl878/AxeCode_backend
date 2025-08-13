const os = require("os");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

class PerformanceMonitor {
  constructor() {
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      averageMemoryUsage: 0,
      peakMemoryUsage: 0,
      lastReset: Date.now(),
    };

    this.currentExecutions = new Map();
  }

  // بدء مراقبة تنفيذ
  startMonitoring(executionId) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    this.currentExecutions.set(executionId, {
      startTime,
      startMemory,
      peakMemory: startMemory.heapUsed,
    });

    return executionId;
  }

  // إيقاف مراقبة تنفيذ
  stopMonitoring(executionId, success = true) {
    const execution = this.currentExecutions.get(executionId);
    if (!execution) return null;

    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const executionTime = endTime - execution.startTime;
    const memoryUsed = endMemory.heapUsed - execution.startMemory.heapUsed;

    // تحديث الإحصائيات
    this.stats.totalExecutions++;
    if (success) {
      this.stats.successfulExecutions++;
    } else {
      this.stats.failedExecutions++;
    }

    // حساب المتوسطات
    this.stats.averageExecutionTime =
      (this.stats.averageExecutionTime * (this.stats.totalExecutions - 1) +
        executionTime) /
      this.stats.totalExecutions;

    this.stats.averageMemoryUsage =
      (this.stats.averageMemoryUsage * (this.stats.totalExecutions - 1) +
        memoryUsed) /
      this.stats.totalExecutions;

    // تحديث الذاكرة القصوى
    if (memoryUsed > this.stats.peakMemoryUsage) {
      this.stats.peakMemoryUsage = memoryUsed;
    }

    this.currentExecutions.delete(executionId);

    return {
      executionTime,
      memoryUsed,
      success,
    };
  }

  // فحص استخدام الذاكرة الحالي
  getCurrentMemoryUsage() {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
    };
  }

  // فحص استخدام CPU
  async getCPUUsage() {
    try {
      const { stdout } = await execPromise("wmic cpu get loadpercentage");
      const lines = stdout.trim().split("\n");
      const cpuUsage = parseInt(lines[1]);
      return cpuUsage || 0;
    } catch (error) {
      return 0;
    }
  }

  // فحص مساحة القرص
  async getDiskUsage() {
    try {
      const { stdout } = await execPromise(
        "wmic logicaldisk get size,freespace"
      );
      const lines = stdout.trim().split("\n").slice(1);
      let totalFree = 0;
      let totalSize = 0;

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const free = parseInt(parts[0]);
          const size = parseInt(parts[1]);
          if (!isNaN(free) && !isNaN(size)) {
            totalFree += free;
            totalSize += size;
          }
        }
      }

      return {
        free: totalFree,
        total: totalSize,
        used: totalSize - totalFree,
        percentage: ((totalSize - totalFree) / totalSize) * 100,
      };
    } catch (error) {
      return { free: 0, total: 0, used: 0, percentage: 0 };
    }
  }

  // الحصول على إحصائيات النظام
  getSystemStats() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
    };
  }

  // الحصول على تقرير شامل
  async getFullReport() {
    const cpuUsage = await this.getCPUUsage();
    const diskUsage = await this.getDiskUsage();
    const systemStats = this.getSystemStats();
    const currentMemory = this.getCurrentMemoryUsage();

    return {
      performance: this.stats,
      current: {
        memory: currentMemory,
        cpu: cpuUsage,
        disk: diskUsage,
        activeExecutions: this.currentExecutions.size,
      },
      system: systemStats,
      timestamp: Date.now(),
    };
  }

  // إعادة تعيين الإحصائيات
  resetStats() {
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      averageMemoryUsage: 0,
      peakMemoryUsage: 0,
      lastReset: Date.now(),
    };
  }

  // فحص إذا كان النظام تحت الضغط
  async isSystemOverloaded() {
    const report = await this.getFullReport();
    const memoryUsage =
      (report.current.memory.heapUsed / report.system.totalMemory) * 100;
    const cpuUsage = report.current.cpu;
    const diskUsage = report.current.disk.percentage;

    return {
      overloaded: memoryUsage > 80 || cpuUsage > 80 || diskUsage > 90,
      memory: memoryUsage,
      cpu: cpuUsage,
      disk: diskUsage,
    };
  }
}

// إنشاء مثيل عالمي
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;
