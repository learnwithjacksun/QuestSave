import { Router } from "express";
import { logout, me, requestOtp, verifyOtp } from "../controllers/auth.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtp);
router.get("/me", optionalAuth, me);
router.post("/logout", requireAuth, logout);

export default router;
