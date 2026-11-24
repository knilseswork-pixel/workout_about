/**
 * Нормализация ссылок на медиа (Google Drive и др.)
 */
(function () {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
  }

  function httpUrl(value) {
    try {
      const url = new URL(value);
      if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) return url;
    } catch (error) {
      return null;
    }
    return null;
  }

  function resolveUrl(value) {
    const path = String(value || '').trim();
    const url = httpUrl(path);
    if (url) return url.href;
    if (!path || /^[a-z][a-z0-9+.-]*:|^[/\\]{2}|[\\\u0000-\u001f]/i.test(path)) return '';
    return window.Workout.githubFileUrl(path);
  }

  function extractDriveId(url) {
    if (!url) return null;
    var s = String(url);
    var m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    return null;
  }

  function isDriveUrl(url) {
    return httpUrl(url)?.hostname === 'drive.google.com';
  }

  function driveImageUrl(id) {
    return 'https://drive.google.com/uc?export=view&id=' + id;
  }

  /** Часто стабильнее для <img> (фото с Drive) */
  function driveThumbnailUrl(id) {
    return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1920';
  }

  function driveImageDirectUrl(id) {
    return 'https://lh3.googleusercontent.com/d/' + id;
  }

  function drivePreviewUrl(id) {
    return 'https://drive.google.com/file/d/' + id + '/preview';
  }

  function getDriveImageUrls(sourceUrl) {
    var id = extractDriveId(sourceUrl);
    if (!id) return null;
    return {
      primary: driveThumbnailUrl(id),
      fallback: driveImageUrl(id),
      fallback2: driveImageDirectUrl(id),
      preview: drivePreviewUrl(id),
      open: driveVideoViewUrl(id),
    };
  }

  function driveVideoPreviewUrl(id) {
    return 'https://drive.google.com/file/d/' + id + '/preview';
  }

  function driveVideoViewUrl(id) {
    return 'https://drive.google.com/file/d/' + id + '/view';
  }

  function normalizeImageUrl(url) {
    if (!url) return '';
    var s = String(url).trim();
    if (!isDriveUrl(s)) return s;
    var urls = getDriveImageUrls(s);
    return urls ? urls.primary : s;
  }

  /**
   * @returns {{ type: 'embed'|'src', url: string, openUrl?: string }}
   */
  function normalizeVideo(url) {
    var s = String(url || '').trim();
    var parsed = httpUrl(s);
    if (!parsed) return { type: 'src', url: s };
    var host = parsed.hostname.replace(/^(www\.|m\.)/, '');
    if (host === 'drive.google.com') {
      var driveId = extractDriveId(s);
      if (driveId) return { type: 'embed', url: driveVideoPreviewUrl(driveId), openUrl: driveVideoViewUrl(driveId), provider: 'drive' };
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
      var parts = parsed.pathname.split('/');
      var youtubeId = host === 'youtu.be' || ['embed', 'shorts', 'live'].includes(parts[1])
        ? parts[host === 'youtu.be' ? 1 : 2] : parsed.searchParams.get('v');
      if (/^[\w-]{11}$/.test(youtubeId || '')) {
        return { type: 'embed', url: 'https://www.youtube-nocookie.com/embed/' + youtubeId,
          openUrl: 'https://www.youtube.com/watch?v=' + youtubeId, provider: 'youtube' };
      }
    }
    if (host === 'vk.com' || host === 'vk.ru' || host === 'vkvideo.ru') {
      if (parsed.pathname === '/video_ext.php') return { type: 'embed', url: parsed.href, provider: 'vk' };
      var vkId = (parsed.searchParams.get('z') || parsed.pathname).match(/^\/?video(-?\d+)_(\d+)/);
      if (vkId) {
        return { type: 'embed', url: 'https://vk.com/video_ext.php?oid=' + vkId[1] + '&id=' + vkId[2],
          openUrl: 'https://vk.com/video' + vkId[1] + '_' + vkId[2], provider: 'vk' };
      }
    }
    return { type: 'src', url: s };
  }

  function driveOpenUrl(url) {
    var id = extractDriveId(url);
    return id ? driveVideoViewUrl(id) : url;
  }

  window.WorkoutMedia = {
    escapeHtml: escapeHtml,
    resolveUrl: resolveUrl,
    extractDriveId: extractDriveId,
    isDriveUrl: isDriveUrl,
    normalizeImageUrl: normalizeImageUrl,
    getDriveImageUrls: getDriveImageUrls,
    normalizeVideo: normalizeVideo,
    driveOpenUrl: driveOpenUrl,
  };
})();
