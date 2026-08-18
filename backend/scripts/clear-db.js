import mongoose from "mongoose";
import env from "../src/config/env.js";
import User from "../src/models/User.js";
import Clip from "../src/models/Clip.js";
import Share from "../src/models/Share.js";
import Otp from "../src/models/Otp.js";

const confirmed = process.argv.includes("--yes");

if (!confirmed) {
  console.error("This will delete all users, clips, shares, and OTPs.");
  console.error("Re-run with --yes to confirm:");
  console.error("  npm run clear-db -- --yes");
  process.exit(1);
}

mongoose.set("strictQuery", true);

try {
  await mongoose.connect(env.mongoUri);
  const [users, clips, shares, otps] = await Promise.all([
    User.deleteMany({}),
    Clip.deleteMany({}),
    Share.deleteMany({}),
    Otp.deleteMany({}),
  ]);

  console.log("Database cleared:");
  console.log(`  users:  ${users.deletedCount}`);
  console.log(`  clips:  ${clips.deletedCount}`);
  console.log(`  shares: ${shares.deletedCount}`);
  console.log(`  otps:   ${otps.deletedCount}`);
} catch (err) {
  console.error("Failed to clear database", err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
