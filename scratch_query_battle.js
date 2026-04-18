
async function test() {
  const courseDocId = 'cp9en0jmkfeo8wtzmd6n1uts';
  
  console.log('--- Method 1: Lesson filter by week.course ---');
  const m1 = await strapi.documents('api::lesson.lesson').findMany({
    filters: { week: { course: { documentId: courseDocId } } },
    status: 'published'
  });
  console.log('M1 Count:', m1.length);

  console.log('--- Method 2: Week filter by course, populate lessons ---');
  const m2 = await strapi.documents('api::week.week').findMany({
    filters: { course: { documentId: courseDocId } },
    populate: ['lessons'],
    status: 'published'
  });
  const m2Lessons = m2.reduce((acc, w) => acc + (w.lessons?.length || 0), 0);
  console.log('M2 Count:', m2Lessons);

  console.log('--- Method 3: DB Query Join ---');
  const m3 = await strapi.db.query('api::lesson.lesson').findMany({
    where: {
      week: {
        course: { documentId: courseDocId }
      }
    }
  });
  console.log('M3 Count:', m3.length);
  
  console.log('--- Method 4: List all lessons to see relations ---');
  const all = await strapi.documents('api::lesson.lesson').findMany({
    populate: { week: { populate: ['course'] } },
    limit: 5
  });
  all.forEach(l => {
      console.log(`Lesson ${l.id}: Week: ${l.week?.id}, Course: ${l.week?.course?.documentId}`);
  });
}

test();
