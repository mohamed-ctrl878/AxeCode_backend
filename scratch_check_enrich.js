
async function test() {
  const courses = await strapi.documents('api::course.course').findMany({
    limit: 5
  });
  
  if (courses.length === 0) {
    console.log('No courses found');
    return;
  }
  
  const course = courses[0];
  const enriched = await strapi.service('api::course.course').enrichCourse(course);
  console.log('ENRICHED_COURSE_SAMPLE:', JSON.stringify({
    title: enriched.title,
    documentId: enriched.documentId,
    lessonCount: enriched.lessonCount,
    duration: enriched.duration
  }, null, 2));
}

test();
