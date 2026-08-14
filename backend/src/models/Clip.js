import mongoose from "mongoose";

const clipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    title: { type: String, default: "" },
    author: { type: String, default: "" },
    thumbnail: { type: String, default: "" },
    formatId: { type: String, default: "" },
    mediaType: {
      type: String,
      enum: ["video", "image", "audio", "mixed"],
      default: "video",
    },
  },
  { timestamps: true }
);

clipSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("Clip", clipSchema);
