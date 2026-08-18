import type { FeedClip, YoutubeSearchVideo } from "@/types/clip";

export function youtubeVideoToFeedClip(video: YoutubeSearchVideo): FeedClip {
  return {
    id: video.videoId || video.url,
    platform: "youtube",
    sourceUrl: video.url,
    title: video.title,
    author: video.author?.name || "",
    thumbnail: video.thumbnail,
    formatId: "",
    mediaType: "video",
    createdAt: new Date().toISOString(),
    origin: "youtube",
  };
}
