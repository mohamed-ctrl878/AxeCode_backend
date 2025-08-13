// إعدادات الأمان والحدود للمحرك
const SECURITY_CONFIG = {
  // حدود الحجم
  MAX_CODE_SIZE: 10000, // حروف
  MAX_OUTPUT_SIZE: 1024 * 1024, // 1 ميجابايت
  MAX_TEST_CASES: 50,
  MAX_INPUT_SIZE: 1000, // عناصر في المصفوفة

  // حدود الوقت
  MAX_COMPILATION_TIME: 5000, // 5 ثواني
  MAX_EXECUTION_TIME: 10000, // 10 ثواني
  MAX_TOTAL_TIME: 15000, // 15 ثانية إجمالي

  // حدود الذاكرة
  MAX_MEMORY_USAGE: 100 * 1024 * 1024, // 100 ميجابايت
  MAX_STACK_SIZE: 8 * 1024 * 1024, // 8 ميجابايت

  // المكتبات المسموحة
  ALLOWED_LIBRARIES: [
    "iostream",
    "vector",
    "string",
    "algorithm",
    "cmath",
    "chrono",
    "queue",
    "stack",
    "map",
    "set",
    "unordered_map",
    "unordered_set",
    "bits/stdc++.h",
    "climits",
    "cfloat",
    "sstream",
    "iomanip",
    "functional",
  ],

  // الكلمات المحظورة
  FORBIDDEN_KEYWORDS: [
    // أوامر النظام
    "system",
    "exec",
    "popen",
    "fork",
    "kill",
    "signal",
    "mmap",
    "shmget",
    "shmat",
    "shmdt",
    "shmctl",

    // الشبكات
    "socket",
    "bind",
    "listen",
    "accept",
    "connect",
    "network",
    "http",
    "curl",
    "wget",
    "ftp",
    "ssh",

    // الملفات والنظام
    "open",
    "creat",
    "unlink",
    "remove",
    "rename",
    "chmod",
    "chown",
    "mkdir",
    "rmdir",
    "link",
    "symlink",
    "mount",
    "umount",
    "reboot",
    "shutdown",
    "halt",

    // قواعد البيانات
    "database",
    "mysql",
    "postgresql",
    "sqlite",

    // العمليات والخيوط
    "process",
    "thread",
    "pipe",
    "semaphore",
    "mutex",
    "condition_variable",
    "atomic",
    "memory_order",

    // أخرى خطيرة
    "volatile",
    "register",
    "asm",
    "inline",
  ],

  // الأنماط المحظورة
  FORBIDDEN_PATTERNS: [
    /system\s*\(/i,
    /exec\s*\(/i,
    /popen\s*\(/i,
    /fork\s*\(/i,
    /socket\s*\(/i,
    /#include\s*<windows\.h>/i,
    /#include\s*<sys\/socket\.h>/i,
    /#include\s*<netinet\/in\.h>/i,
    /#include\s*<arpa\/inet\.h>/i,
  ],

  // حدود التكرار
  MAX_LOOP_ITERATIONS: 1000000,
  MAX_RECURSION_DEPTH: 1000,

  // إعدادات التنظيف
  CLEANUP_TIMEOUT: 5000, // 5 ثواني للتنظيف
  MAX_TEMP_FILES: 100,

  // إعدادات المراقبة
  ENABLE_LOGGING: true,
  LOG_LEVEL: "info", // 'debug', 'info', 'warn', 'error'
  SAVE_FAILED_ATTEMPTS: false,
};

// دوال فحص الأمان
const SecurityUtils = {
  // فحص حجم الكود
  checkCodeSize(code) {
    if (!code || code.length > SECURITY_CONFIG.MAX_CODE_SIZE) {
      throw new Error(
        `Code size exceeds limit of ${SECURITY_CONFIG.MAX_CODE_SIZE} characters`
      );
    }
    return true;
  },

  // فحص الكلمات المحظورة
  checkForbiddenKeywords(code) {
    const codeLower = code.toLowerCase();
    for (const keyword of SECURITY_CONFIG.FORBIDDEN_KEYWORDS) {
      if (codeLower.includes(keyword.toLowerCase())) {
        throw new Error(`Forbidden keyword detected: ${keyword}`);
      }
    }
    return true;
  },

  // فحص الأنماط المحظورة
  checkForbiddenPatterns(code) {
    for (const pattern of SECURITY_CONFIG.FORBIDDEN_PATTERNS) {
      if (pattern.test(code)) {
        throw new Error(`Forbidden pattern detected: ${pattern}`);
      }
    }
    return true;
  },

  // فحص عدد حالات الاختبار
  checkTestCasesCount(testCases) {
    if (!testCases || testCases.length > SECURITY_CONFIG.MAX_TEST_CASES) {
      throw new Error(
        `Number of test cases exceeds limit of ${SECURITY_CONFIG.MAX_TEST_CASES}`
      );
    }
    return true;
  },

  // فحص حجم المدخلات
  checkInputSize(testCases) {
    for (const testCase of testCases) {
      for (const input of testCase.inputs) {
        if (
          Array.isArray(input) &&
          input.length > SECURITY_CONFIG.MAX_INPUT_SIZE
        ) {
          throw new Error(
            `Input size exceeds limit of ${SECURITY_CONFIG.MAX_INPUT_SIZE} elements`
          );
        }
      }
    }
    return true;
  },

  // فحص شامل للكود
  validateCode(code, testCases) {
    this.checkCodeSize(code);
    this.checkForbiddenKeywords(code);
    this.checkForbiddenPatterns(code);
    this.checkTestCasesCount(testCases);
    this.checkInputSize(testCases);
    return true;
  },

  // تنظيف النتيجة
  sanitizeOutput(output) {
    if (!output) return "";
    if (output.length > SECURITY_CONFIG.MAX_OUTPUT_SIZE) {
      throw new Error("Output size exceeds limit");
    }
    return output;
  },

  // إنشاء معرف فريد آمن
  generateSafeId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },
};

module.exports = {
  SECURITY_CONFIG,
  SecurityUtils,
};
