import { Router } from "express";
import {
  clipStreamAccess,
  deleteClip,
  downloadClip,
  listClips,
  previewStream,
  previewStreamUrl,
  resolveClip,
  saveClip,
  streamClip,
} from "../controllers/clip.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/resolve", resolveClip);
router.post("/download", downloadClip);
router.get("/preview/stream-url", previewStreamUrl);
router.get("/preview/stream", previewStream);
router.post("/save", requireAuth, saveClip);
router.get("/", requireAuth, listClips);
router.get("/:id/stream-access", requireAuth, clipStreamAccess);
router.get("/:id/stream", streamClip);
router.delete("/:id", requireAuth, deleteClip);

export default router;
