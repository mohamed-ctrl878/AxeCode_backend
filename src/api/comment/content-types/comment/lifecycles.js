module.exports = {
  async afterDelete(event) {
    console.log("داخل afterDelete:", event);
    const { result } = event;
    if (result && result.documentId) {
      const deleted = await strapi.db.query('api::comment.comment').deleteMany({
        where: { parentId: result.documentId }
      });
      console.log("عدد التعليقات الفرعية المحذوفة:", deleted);
    }
  }
};
