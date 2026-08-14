import { Router } from "express";
import { proxyImage } from "../controllers/media.controller.js";

const router = Router();

router.get("/image", proxyImage);

export default router;
