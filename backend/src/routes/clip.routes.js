import { Router } from "express";
import {
  deleteClip,
  downloadClip,
  listClips,
  resolveClip,
  saveClip,
} from "../controllers/clip.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/resolve", resolveClip);
router.post("/download", downloadClip);
router.post("/save", requireAuth, saveClip);
router.get("/", requireAuth, listClips);
router.delete("/:id", requireAuth, deleteClip);

export default router;
