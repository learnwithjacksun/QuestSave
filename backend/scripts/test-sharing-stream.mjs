/**
 * Integration tests for sharing + streaming APIs.
 * Run: node --env-file=.env scripts/test-sharing-stream.mjs
 */
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import env from "../src/config/env.js";
import User from "../src/models/User.js";
import Clip from "../src/models/Clip.js";
import Share from "../src/models/Share.js";

const BASE = `http://127.0.0.1:${env.port}`;

function cookieFor(userId) {
  const token = jwt.sign({ userId: String(userId) }, env.jwtSecret, { expiresIn: "1h" });
  return `token=${token}`;
}

async function api(path, { method = "GET", body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers };
}

async function main() {
  await mongoose.connect(env.mongoUri);
  await Promise.all([User.deleteMany({}), Clip.deleteMany({}), Share.deleteMany({})]);

  const alice = await User.create({ email: "alice@test.com", username: "alice" });
  const bob = await User.create({ email: "bob@test.com", username: "bob" });
  const aliceCookie = cookieFor(alice._id);
  const bobCookie = cookieFor(bob._id);

  console.log("1) Save clip as Alice...");
  const save = await api("/api/clips/save", {
    method: "POST",
    cookie: aliceCookie,
    body: {
      url: "https://www.tiktok.com/@scout2015/video/6718339390846457349",
      platform: "tiktok",
      title: "Test clip",
      author: "scout2015",
      thumbnail: "https://p16-sign.tiktokcdn-us.com/obj/tos-useast5-p-0068-tx/placeholder.jpg",
      formatId: "tikwm:hd",
      mediaType: "video",
    },
  });
  if (save.status !== 201) {
    console.error("SAVE FAILED", save.status, save.json);
    process.exit(1);
  }
  const clipId = save.json.clip.id;
  console.log("   saved clip", clipId, "playUrl:", save.json.clip.playUrl ? "yes" : "no");

  const samplePlayUrl =
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
  await Clip.findByIdAndUpdate(clipId, { playUrl: samplePlayUrl });
  console.log("   seeded playUrl for stream test");

  console.log("2) Share clip with Bob...");
  const share = await api("/api/shares", {
    method: "POST",
    cookie: aliceCookie,
    body: { clipId, username: "bob" },
  });
  if (share.status !== 201) {
    console.error("SHARE FAILED", share.status, share.json);
    process.exit(1);
  }
  console.log("   shared with @bob");

  console.log("3) Bob lists received shares...");
  const received = await api("/api/shares/received", { cookie: bobCookie });
  if (received.status !== 200 || received.json.shares?.length !== 1) {
    console.error("RECEIVED FAILED", received.status, received.json);
    process.exit(1);
  }
  const shareId = received.json.shares[0].shareId;
  console.log("   Bob sees 1 shared clip from @alice");

  console.log("4) Bob gets stream access...");
  const access = await api(`/api/clips/${clipId}/stream-access`, { cookie: bobCookie });
  if (access.status !== 200 || !access.json.src) {
    console.error("STREAM ACCESS FAILED", access.status, access.json);
    process.exit(1);
  }
  console.log("   stream URL issued");

  console.log("5) Stream video bytes (HEAD)...");
  const streamRes = await fetch(access.json.src, { method: "GET", headers: { Range: "bytes=0-1023" } });
  const contentType = streamRes.headers.get("content-type") || "";
  const okStream = streamRes.status === 200 || streamRes.status === 206;
  if (!okStream || !contentType.includes("video") && !contentType.includes("octet")) {
    console.error("STREAM FAILED", streamRes.status, contentType);
    const errText = await streamRes.text();
    console.error(errText.slice(0, 200));
    process.exit(1);
  }
  const bytes = await streamRes.arrayBuffer();
  console.log(`   streamed ${bytes.byteLength} bytes (${contentType})`);

  console.log("6) Preview stream URL...");
  const previewUrl = await api(
    `/api/clips/preview/stream-url?url=${encodeURIComponent("https://www.youtube.com/watch?v=jNQXAC9IVRw")}&formatId=best`
  );
  if (previewUrl.status !== 200 || !previewUrl.json.src) {
    console.error("PREVIEW URL FAILED", previewUrl.status, previewUrl.json);
    process.exit(1);
  }
  console.log("   preview stream URL issued");

  console.log("7) Bob removes share...");
  const removed = await api(`/api/shares/${shareId}`, { method: "DELETE", cookie: bobCookie });
  if (removed.status !== 200) {
    console.error("REMOVE SHARE FAILED", removed.status, removed.json);
    process.exit(1);
  }
  const after = await api("/api/shares/received", { cookie: bobCookie });
  if (after.json.shares?.length !== 0) {
    console.error("SHARE STILL LISTED", after.json);
    process.exit(1);
  }
  console.log("   share removed");

  console.log("\nAll sharing + streaming API tests passed.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
