import mongoose from "mongoose";

const ProjectVersionSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
    index: true,
  },
  version: {
    type: Number,
    required: true,
  },
  label: {
    type: String,
    trim: true,
    maxlength: 120,
    default: "",
  },
  files: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

ProjectVersionSchema.index({ project: 1, version: -1 });

export const ProjectVersion =
  mongoose.models.ProjectVersion ||
  mongoose.model("ProjectVersion", ProjectVersionSchema);
