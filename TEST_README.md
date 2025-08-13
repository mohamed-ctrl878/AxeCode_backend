# 🧪 اختبارات Code Execution API

هذا الملف يحتوي على أدوات لاختبار API تنفيذ الكود تلقائياً.

## 📋 الملفات المطلوبة

1. **`test_runner.js`** - الملف الرئيسي لتشغيل الاختبارات
2. **`test_cases_examples.json`** - ملف الاختبارات (30 اختبار مختلف)
3. **`package-test.json`** - ملف التبعيات

## 🚀 التثبيت والإعداد

### 1. تثبيت التبعيات

```bash
npm install axios
```

### 2. التأكد من تشغيل السيرفر

تأكد أن السيرفر يعمل على `http://localhost:1338`

## 🎯 كيفية الاستخدام

### عرض قائمة الاختبارات

```bash
node test_runner.js list
```

### تشغيل جميع الاختبارات

```bash
node test_runner.js all
```

### تشغيل اختبار محدد

```bash
node test_runner.js test 1    # تشغيل الاختبار الأول
node test_runner.js test 5    # تشغيل الاختبار الخامس
node test_runner.js test 15   # تشغيل الاختبار الخامس عشر
```

### تشغيل الاختبار الافتراضي (جميع الاختبارات)

```bash
node test_runner.js
```

## 📊 أنواع الاختبارات المتاحة

### 🔢 العمليات الحسابية الأساسية

1. **الجمع** - `add(int a, int b)`
2. **الضرب** - `multiply(int a, int b)`
3. **حساب القوة** - `power(int base, int exponent)`
4. **حساب المضروب** - `factorial(int n)`
5. **حساب GCD** - `gcd(int a, int b)`

### 📊 المصفوفات والخوارزميات

6. **العثور على أكبر عدد** - `findMax(vector<int> nums)`
7. **مجموع المصفوفة** - `sumArray(vector<int> nums)`
8. **عكس المصفوفة** - `reverseArray(vector<int> nums)`
9. **البحث الثنائي** - `binarySearch(vector<int> nums, int target)`
10. **فرز الفقاعات** - `bubbleSort(vector<int> nums)`
11. **الفرز السريع** - `quickSort(vector<int> nums)`

### 🔤 النصوص

12. **عكس النص** - `reverseString(string str)`
13. **عداد الأحرف** - `countChar(string str, char target)`
14. **التحقق من Palindrome** - `isPalindrome(string str)`
15. **عدد الكلمات** - `countWords(string str)`

### 🔍 التحقق والمنطق

16. **الرقم الزوجي** - `isEven(int num)`
17. **الرقم الأولي** - `isPrime(int n)`
18. **الرقم المثالي** - `isPerfect(int num)`
19. **المربع المثالي** - `isPerfectSquare(int num)`

### 🧮 الأرقام العشرية والإحصائيات

20. **حساب المتوسط** - `average(vector<double> nums)`
21. **المتوسط المتحرك** - `movingAverage(vector<int> nums, int k)`

### 🎲 خوارزميات متقدمة

22. **Fibonacci** - `fibonacci(int n)`
23. **LCM** - `lcm(int a, int b)`
24. **إزالة التكرارات** - `removeDuplicates(vector<int> nums)`
25. **مجموع الأرقام** - `sumOfDigits(int num)`
26. **Armstrong Number** - `isArmstrong(int num)`
27. **Count Primes** - `countPrimes(int n)`
28. **Count Set Bits** - `countSetBits(int num)`
29. **Count Digits** - `countDigits(int num)`
30. **Sum of Series** - `sumOfSeries(int n)`

## 📈 النتائج والتقارير

### المخرجات

- **طباعة تفصيلية** لكل اختبار في Terminal
- **ملف تقرير** `test_report.json` يحتوي على:
  - إحصائيات شاملة
  - تفاصيل كل اختبار
  - وقت التنفيذ
  - الأخطاء إن وجدت

### مثال على النتيجة

```
🧪 تشغيل الاختبار 1: اختبار دالة الجمع البسيطة
============================================================
✅ تم التنفيذ بنجاح في 245ms
📊 عدد الاختبارات: 3
   ✅ الاختبار 101: PASSED
      المتوقع: 8 | الفعلي: 8
      الوقت: 0.12ms
   ✅ الاختبار 102: PASSED
      المتوقع: 30 | الفعلي: 30
      الوقت: 0.15ms
   ✅ الاختبار 103: PASSED
      المتوقع: 3 | الفعلي: 3
      الوقت: 0.18ms
📈 النتيجة: 3/3 نجح
```

## ⚙️ التخصيص

### تغيير عنوان السيرفر

عدل في `test_runner.js`:

```javascript
const SERVER_URL = "http://localhost:1338"; // غير هذا العنوان
```

### إضافة اختبارات جديدة

أضف اختبارات جديدة في `test_cases_examples.json` باتباع نفس التنسيق.

### تغيير مهلة الطلب

عدل في `test_runner.js`:

```javascript
timeout: 30000; // 30 ثانية - غير هذه القيمة
```

## 🐛 استكشاف الأخطاء

### مشاكل شائعة

1. **خطأ في الاتصال**: تأكد من تشغيل السيرفر
2. **خطأ في التجميع**: راجع كود C++ في الاختبار
3. **مهلة زمنية**: زد قيمة timeout
4. **خطأ في axios**: تأكد من تثبيت التبعيات

### رسائل الخطأ

- `❌ خطأ في التجميع`: مشكلة في كود C++
- `❌ خطأ في الاختبار`: مشكلة في الاتصال أو السيرفر
- `⚠️ أخطاء`: مشاكل في الشبكة أو التوقيت

## 📝 ملاحظات مهمة

- تأكد من تشغيل السيرفر قبل تشغيل الاختبارات
- كل اختبار يحتوي على 3 حالات اختبار مختلفة
- يتم انتظار ثانية واحدة بين الاختبارات لتجنب الحمل الزائد
- النتائج تُحفظ في `test_report.json` للتحليل اللاحق
