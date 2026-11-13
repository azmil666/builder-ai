import mongoose, {Schema} from 'mongoose'

const MessageSchema = new Schema({
   role: {type: String, enum: ["user", "assistant"], required: true},
   content: { type: String, required: true},
   timestamp: { type: Date, default: Date.now},
},{_id: false})

const PlannedFileSchema = new Schema({
    path: {type: String, required: true},
    description: { type: String, required: true},
},{_id: false})

const HistoryEntrySchema = new Schema({
    version: { type: Number, required: true },
    label: { type: String, required: true, maxlength: 100 },
    files: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
}, { _id: false });


const ProjectSchema = new Schema({
    name: {type: String, required: true, default: "Untitled Project" },
    description : {type: String, default: "" },
    files: { type: Schema.Types.Mixed, default: {}}, 
    framework: { type: String, enum: ["vanilla", "react"], default: "vanilla" },
    messages: { type: [MessageSchema], default: []},
    version: { type: Number, default: 0 },
    history: { type: [HistoryEntrySchema], default: [] },
    owner: {type: Schema.Types.ObjectId, ref: "User", required: true},
    published: { type: Boolean, default: false},
    status: {type: String, enum: ["pending", "generating", "validating", "repairing", "revising", "visual_verifying", "completed", "failed"], default: "pending"},
    filesPlanned: {type: [PlannedFileSchema], default: []},
    filesGenerated: {type: [String], default: []},
    currentFile: {type: String, default: null},
    CurrentFile: {type: String, default: null},
    designSpec: {type: Schema.Types.Mixed, default: null},
    requirementContract: {type: Schema.Types.Mixed, default: null},
    requirementVerification: {type: Schema.Types.Mixed, default: null},
    selfRepair: {type: Schema.Types.Mixed, default: null},
    visualVerification: {type: Schema.Types.Mixed, default: null},
    error: {type: String, default: null},
},{timestamps: true})

// Backward compatibility: keep currentFile and legacy CurrentFile in sync, and detect framework for legacy projects
ProjectSchema.post('init', function(doc) {
    if (!doc.currentFile && doc.CurrentFile) {
        doc.currentFile = doc.CurrentFile;
    }
    // Backward compatibility: treat legacy projects with /App.js or /App.jsx as "react" when needed
    if (!doc.framework || doc.framework === "vanilla") {
        if (doc.files && (doc.files["/App.js"] || doc.files["/App.jsx"])) {
            doc.framework = "react";
        }
    }
});

ProjectSchema.pre('save', function() {
    if (this.currentFile !== undefined) {
        this.CurrentFile = this.currentFile;
    } else if (this.CurrentFile !== undefined) {
        this.currentFile = this.CurrentFile;
    }
});

export const Project = mongoose.model('Project', ProjectSchema)