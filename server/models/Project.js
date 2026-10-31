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


const ProjectSchema = new Schema({
    name: {type: String, required: true, default: "Untitled Project" },
    description : {type: String, default: "" },
    files: { type: Schema.Types.Mixed, default: {}}, 
    messages: { type: [MessageSchema], default: []},
    version: { type: Number, default: 0 },
    owner: {type: Schema.Types.ObjectId, ref: "User", required: true},
    published: { type: Boolean, default: false},
    status: {type: String, enum: ["pending", "generating", "validating", "repairing", "revising", "completed", "failed"], default: "pending"},
    filesPlanned: {type: [PlannedFileSchema], default: []},
    filesGenerated: {type: [String], default: []},
    currentFile: {type: String, default: null},
    CurrentFile: {type: String, default: null},
    designSpec: {type: Schema.Types.Mixed, default: null},
    error: {type: String, default: null},
},{timestamps: true})

// Backward compatibility: keep currentFile and legacy CurrentFile in sync
ProjectSchema.post('init', function(doc) {
    if (!doc.currentFile && doc.CurrentFile) {
        doc.currentFile = doc.CurrentFile;
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