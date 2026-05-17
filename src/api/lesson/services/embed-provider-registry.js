'use strict';

/**
 * Embed Provider Registry
 * Abstracts video source detection, metadata extraction, and embed URL generation.
 * Adding a new provider = adding a new entry to the providers object.
 * 
 * Design:
 * - Each provider implements: match(), extractId(), getEmbedUrl(), getThumbnail(), fetchMetadata()
 * - resolveUrl() auto-detects the provider from a raw URL
 * - revalidate() re-checks cached metadata for health monitoring
 */

const providers = {
  youtube: {
    name: 'youtube',

    /** Detects if a URL belongs to YouTube */
    match(url) {
      return /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)/.test(url);
    },

    /** Extracts the video ID from various YouTube URL formats */
    extractId(url) {
      const patterns = [
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      ];
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }
      return null;
    },

    /** Generates the embeddable iframe URL with JS API enabled */
    getEmbedUrl(videoId) {
      return `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
    },

    /** Generates a high-quality thumbnail URL (no API key needed) */
    getThumbnail(videoId) {
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    },

    /** Fetches metadata via oEmbed endpoint (no API key required) */
    async fetchMetadata(url) {
      const videoId = this.extractId(url);
      try {
        const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await fetch(oEmbedUrl);
        if (!response.ok) {
          return {
            provider: 'youtube',
            videoId,
            status: 'unavailable',
            fetchedAt: new Date().toISOString(),
            thumbnail: videoId ? this.getThumbnail(videoId) : null,
            embedUrl: videoId ? this.getEmbedUrl(videoId) : null,
          };
        }
        const data = await response.json();
        return {
          provider: 'youtube',
          videoId,
          title: data.title || null,
          author: data.author_name || null,
          authorUrl: data.author_url || null,
          thumbnail: this.getThumbnail(videoId),
          embedUrl: this.getEmbedUrl(videoId),
          fetchedAt: new Date().toISOString(),
          status: 'active',
        };
      } catch (error) {
        return {
          provider: 'youtube',
          videoId,
          status: 'fetch_failed',
          fetchedAt: new Date().toISOString(),
          thumbnail: videoId ? this.getThumbnail(videoId) : null,
          embedUrl: videoId ? this.getEmbedUrl(videoId) : null,
        };
      }
    },
  },

  vimeo: {
    name: 'vimeo',

    match(url) {
      return /vimeo\.com\/\d+/.test(url);
    },

    extractId(url) {
      const match = url.match(/vimeo\.com\/(\d+)/);
      return match ? match[1] : null;
    },

    getEmbedUrl(videoId) {
      return `https://player.vimeo.com/video/${videoId}`;
    },

    getThumbnail() {
      return null; // Vimeo requires API key for thumbnails
    },

    async fetchMetadata(url) {
      const videoId = this.extractId(url);
      try {
        const oEmbedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
        const response = await fetch(oEmbedUrl);
        if (!response.ok) {
          return {
            provider: 'vimeo',
            videoId,
            status: 'unavailable',
            fetchedAt: new Date().toISOString(),
            embedUrl: videoId ? this.getEmbedUrl(videoId) : null,
          };
        }
        const data = await response.json();
        return {
          provider: 'vimeo',
          videoId,
          title: data.title || null,
          author: data.author_name || null,
          thumbnail: data.thumbnail_url || null,
          duration: data.duration || null,
          embedUrl: this.getEmbedUrl(videoId),
          fetchedAt: new Date().toISOString(),
          status: 'active',
        };
      } catch {
        return {
          provider: 'vimeo',
          videoId,
          status: 'fetch_failed',
          fetchedAt: new Date().toISOString(),
          embedUrl: videoId ? this.getEmbedUrl(videoId) : null,
        };
      }
    },
  },

  custom: {
    name: 'custom',

    match() { return false; }, // Only selected explicitly by admin

    extractId(url) { return url; },

    getEmbedUrl(url) { return url; },

    getThumbnail() { return null; },

    async fetchMetadata(url) {
      return {
        provider: 'custom',
        videoId: url,
        embedUrl: url,
        status: 'manual',
        fetchedAt: new Date().toISOString(),
      };
    },
  },
};

module.exports = ({ strapi }) => ({
  /**
   * Detects the provider from a URL and returns enriched metadata.
   * @param {string} url - The raw video URL pasted by the admin
   * @param {string} [forceProvider] - Optional provider override
   * @returns {Promise<{ provider: string, metadata: object }>}
   */
  async resolveUrl(url, forceProvider = null) {
    if (!url) return { provider: null, metadata: null };

    let provider = null;

    if (forceProvider && providers[forceProvider]) {
      provider = providers[forceProvider];
    } else {
      provider = Object.values(providers).find(p => p.match(url));
    }

    if (!provider) {
      provider = providers.custom;
    }

    const metadata = await provider.fetchMetadata(url);
    return { provider: provider.name, metadata };
  },

  /**
   * Re-validates cached metadata for a lesson's embedded content.
   * Returns fresh metadata from the provider.
   * @param {object} lesson - Lesson record with embed_url and embed_source
   * @returns {Promise<object|null>}
   */
  async revalidate(lesson) {
    if (!lesson.embed_url || !lesson.embed_source) return null;
    const provider = providers[lesson.embed_source];
    if (!provider) return null;

    const metadata = await provider.fetchMetadata(lesson.embed_url);
    return metadata;
  },

  /**
   * Exposes a specific provider for direct usage.
   * @param {string} name - Provider name (youtube, vimeo, custom)
   * @returns {object|null}
   */
  getProvider(name) {
    return providers[name] || null;
  },
});
