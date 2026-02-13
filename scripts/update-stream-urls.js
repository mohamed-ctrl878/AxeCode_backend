/**
 * Utility script to update existing live stream playback URLs
 * Replaces 'localhost' with the actual network IP.
 */
module.exports = async ({ strapi }) => {
  const targetIp = '192.168.1.5';
  
  strapi.log.info(`[Migration] Starting update of playback URLs to ${targetIp}...`);
  
  const streams = await strapi.documents('api::live-stream.live-stream').findMany();
  
  let updatedCount = 0;
  
  for (const stream of streams) {
    if (stream.playbackUrl && stream.playbackUrl.includes('localhost')) {
      const newUrl = stream.playbackUrl.replace('localhost', targetIp);
      
      await strapi.documents('api::live-stream.live-stream').update({
        documentId: stream.documentId,
        data: { playbackUrl: newUrl }
      });
      
      strapi.log.info(`[Migration] Updated stream ${stream.documentId}: ${newUrl}`);
      updatedCount++;
    }
  }
  
  strapi.log.info(`[Migration] Finished. Updated ${updatedCount} streams.`);
};
