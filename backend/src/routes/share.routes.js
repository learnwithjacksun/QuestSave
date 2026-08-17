import { Router } from "express";
import {
  createShare,
  deleteShare,
  listReceivedShares,
} from "../controllers/share.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/", requireAuth, createShare);
router.get("/received", requireAuth, listReceivedShares);
router.delete("/:id", requireAuth, deleteShare);

export default router;
