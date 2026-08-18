import { detectPlatform, sanitizeFormatId } from "./platform.js";
import { isTikTokFormat, resolveTikTokPlayUrl } from "./tiktok.js";
import { isTwitterFormat, resolveTwitterPlayUrl } from "./twitter.js";
import {
  isRapidApiPlatform,
  resolveSocialMediaPlayUrl,
} from "./rapidApi/socialMediaDownloader.js";
import { isStreamSaverFormat, resolveStreamSaverPlayUrl } from "./streamSaver.js";
import { resolveYtdlpPlayUrl } from "./ytdlp.js";

export async function resolvePlayUrl(sourceUrl, formatId) {
  const { platform, url } = detectPlatform(sourceUrl);
  const id = sanitizeFormatId(formatId);
  if (!id) return "";

  if (isTikTokFormat(id)) {
    return resolveTikTokPlayUrl(url, id);
  }
  if (isStreamSaverFormat(id)) {
    return resolveStreamSaverPlayUrl(url, id, platform);
  }
  if (isTwitterFormat(id)) {
    return resolveTwitterPlayUrl(url, id);
  }
  if (isRapidApiPlatform(platform)) {
    return resolveSocialMediaPlayUrl(url, id, platform);
  }
  return resolveYtdlpPlayUrl(url, id);
}
