import mongoose from "mongoose";

const shareSchema = new mongoose.Schema(
  {
    clipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clip",
      required: true,
      index: true,
    },
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

shareSchema.index({ clipId: 1, toUserId: 1 }, { unique: true });
shareSchema.index({ toUserId: 1, createdAt: -1 });

export default mongoose.model("Share", shareSchema);
