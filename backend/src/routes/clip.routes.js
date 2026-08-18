import { Router } from "express";
import {
  clipStreamAccess,
  deleteClip,
  downloadClip,
  listClips,
  listDiscover,
  previewStream,
  previewStreamUrl,
  resolveClip,
  saveClip,
  searchYoutube,
  streamClip,
} from "../controllers/clip.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/resolve", resolveClip);
router.get("/search", searchYoutube);
router.get("/discover", listDiscover);
router.post("/download", downloadClip);
router.get("/preview/stream-url", previewStreamUrl);
router.get("/preview/stream", previewStream);
router.post("/save", requireAuth, saveClip);
router.get("/", requireAuth, listClips);
router.get("/:id/stream-access", optionalAuth, clipStreamAccess);
router.get("/:id/stream", streamClip);
router.delete("/:id", requireAuth, deleteClip);

export default router;
