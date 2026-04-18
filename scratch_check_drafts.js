
async function test() {
  const courseDocId = 'cp9en0jmkfeo8wtzmd6n1uts'; // From previous log
  
  // Try finding published lessons
  const publishedCount = await strapi.documents('api::lesson.lesson').findMany({
    filters: { week: { course: { documentId: courseDocId } } },
    status: 'published'
  });
  
  // Try finding draft lessons
  const draftCount = await strapi.documents('api::lesson.lesson').findMany({
    filters: { week: { course: { documentId: courseDocId } } },
    status: 'draft'
  });
  
  console.log('RESULTS:', JSON.stringify({
    published: publishedCount.length,
    draft: draftCount.length
  }, null, 2));
}

test();
