import { detectPlatform, sanitizeFormatId } from "./platform.js";
import { isTikTokFormat, resolveTikTokPlayUrl } from "./tiktok.js";
import { isTwitterFormat, resolveTwitterPlayUrl } from "./twitter.js";
import {
  isRapidApiPlatform,
  resolveSocialMediaPlayUrl,
} from "./rapidApi/socialMediaDownloader.js";
import { resolveYtdlpPlayUrl, ytdlpFallbackFormat } from "./ytdlp.js";

export async function resolvePlayUrl(sourceUrl, formatId) {
  const { platform, url } = detectPlatform(sourceUrl);
  const id = sanitizeFormatId(formatId);
  if (!id) return "";

  if (isTikTokFormat(id)) {
    return resolveTikTokPlayUrl(url, id);
  }
  if (isTwitterFormat(id)) {
    return resolveTwitterPlayUrl(url, id);
  }
  if (isRapidApiPlatform(platform)) {
    if ((platform === "youtube" || platform === "instagram") && !id.startsWith("rap:")) {
      return resolveYtdlpPlayUrl(url, ytdlpFallbackFormat(id));
    }
    try {
      return await resolveSocialMediaPlayUrl(url, id, platform);
    } catch (err) {
      if (platform === "youtube" || platform === "instagram") {
        return resolveYtdlpPlayUrl(url, ytdlpFallbackFormat(id));
      }
      throw err;
    }
  }
  return resolveYtdlpPlayUrl(url, id);
}
