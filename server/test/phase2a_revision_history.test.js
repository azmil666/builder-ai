import "dotenv/config";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Project } from "../models/Project.js";
import {
  recordSnapshot,
  getProjectVersions,
  restoreProjectVersion,
  waitForClientVisualVerification,
  handleVisualVerification,
} from "../controllers/projectController.js";
import { chat } from "../controllers/chatController.js";
import { setAiGeneratorOverride, resetAiGeneratorOverride } from "../services/ai.js";
import { RevisionResultSchema } from "../services/aiSchemas.js";
import * as codeValidator from "../services/codeValidator.js";

describe("Phase 2A: Project Revision History & Snapshots", () => {
  const ownerId = "507f191e810c19729de86001";
  const nonOwnerId = "507f191e810c19729de86002";
  const validProjectId = "507f191e810c19729de860aa";

  function createMockRes() {
    let statusCode = 200;
    let jsonBody = null;
    return {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
      getStatus() {
        return statusCode;
      },
      getBody() {
        return jsonBody;
      },
    };
  }

  describe("Task 1: Mongoose Schema Validation for Project History", () => {
    it("ProjectSchema includes history array with correct subdocument structure", () => {
      const historyPath = Project.schema.path("history");
      assert.ok(historyPath, "history must be defined on ProjectSchema");

      const subSchema = historyPath.schema;
      assert.ok(subSchema, "history subdocument schema must exist");
      assert.ok(subSchema.path("version"), "history entry must have version field");
      assert.strictEqual(subSchema.path("version").instance, "Number");
      assert.ok(subSchema.path("label"), "history entry must have label field");
      assert.strictEqual(subSchema.path("label").instance, "String");
      assert.ok(subSchema.path("files"), "history entry must have files field");
      assert.strictEqual(subSchema.path("files").instance, "Mixed");
      assert.ok(subSchema.path("createdAt"), "history entry must have createdAt field");
      assert.strictEqual(subSchema.path("createdAt").instance, "Date");
    });

    it("Preserves existing Project hooks (currentFile / CurrentFile sync)", async () => {
      const project = new Project({
        name: "Sync Test",
        owner: ownerId,
        currentFile: "/App.js",
        history: [
          {
            version: 1,
            label: "Initial generation",
            files: { "/App.js": { content: "console.log('test')" } },
          },
        ],
      });

      // Pre-save hook test
      if (project.currentFile !== undefined) {
        project.CurrentFile = project.currentFile;
      }
      assert.strictEqual(project.CurrentFile, "/App.js");
      assert.strictEqual(project.history.length, 1);
      assert.strictEqual(project.history[0].version, 1);
    });
  });

  describe("Task 2: Snapshot Creation & Immutability", () => {
    it("recordSnapshot creates a deep-cloned immutable point-in-time snapshot", () => {
      const initialFiles = {
        "/App.js": { content: "export default function App() { return <div>V1</div>; }", hash: "hash1" },
        "/styles.css": { content: "body { background: #fff; }", hash: "hash2" },
      };

      const mockProject = {
        version: 1,
        files: initialFiles,
        history: [],
        markModified() {},
      };

      const snapshot = recordSnapshot(mockProject, "Initial generation");

      assert.strictEqual(mockProject.history.length, 1);
      assert.strictEqual(snapshot.version, 1);
      assert.strictEqual(snapshot.label, "Initial generation");
      assert.deepStrictEqual(snapshot.files, initialFiles);
      assert.ok(snapshot.createdAt instanceof Date);

      // Verify deep clone immutability: mutating original project files must not mutate snapshot
      mockProject.files["/App.js"].content = "MUTATED CONTENT";
      mockProject.files["/NewFile.js"] = { content: "new" };

      assert.strictEqual(
        snapshot.files["/App.js"].content,
        "export default function App() { return <div>V1</div>; }",
        "Snapshot files must be deep cloned and immutable against subsequent project mutations"
      );
      assert.strictEqual(snapshot.files["/NewFile.js"], undefined);
    });

    it("truncates snapshot label to 100 characters max", () => {
      const longPrompt = "A".repeat(150);
      const mockProject = {
        version: 2,
        files: {},
        history: [],
        markModified() {},
      };

      const snapshot = recordSnapshot(mockProject, longPrompt);
      assert.strictEqual(snapshot.label.length, 100);
      assert.strictEqual(snapshot.label, "A".repeat(100));
    });

    it("captures initial generation snapshot on generation completion (timeout/skipped verification)", async () => {
      const originalFindById = Project.findById;

      const projectDoc = new Project({
        _id: validProjectId,
        owner: ownerId,
        name: "Gen Test",
        version: 1,
        status: "visual_verifying",
        files: {
          "/App.js": { content: "export default () => <div>App</div>", hash: "h1" },
        },
        history: [],
        messages: [],
      });

      let saveCalled = false;
      projectDoc.save = async function () {
        saveCalled = true;
        return this;
      };

      Project.findById = async () => projectDoc;

      try {
        process.env.VISUAL_VERIFICATION_TIMEOUT_MS = "10";
        await waitForClientVisualVerification(validProjectId, projectDoc);

        assert.strictEqual(saveCalled, true);
        assert.strictEqual(projectDoc.status, "completed");
        assert.strictEqual(projectDoc.history.length, 1, "Must record initial generation snapshot");
        assert.strictEqual(projectDoc.history[0].version, 1);
        assert.strictEqual(projectDoc.history[0].label, "Initial generation");
        assert.deepStrictEqual(projectDoc.history[0].files, projectDoc.files);
      } finally {
        Project.findById = originalFindById;
        delete process.env.VISUAL_VERIFICATION_TIMEOUT_MS;
      }
    });

    it("captures initial generation snapshot on visual verification completion", async () => {
      const originalFindById = Project.findById;

      const projectDoc = new Project({
        _id: validProjectId,
        owner: ownerId,
        name: "Gen Test",
        version: 1,
        status: "visual_verifying",
        files: {
          "/App.js": { content: "export default () => <div>App</div>", hash: "h1" },
        },
        history: [],
        messages: [],
      });

      let saveCalled = false;
      projectDoc.save = async function () {
        saveCalled = true;
        return this;
      };

      Project.findById = async () => projectDoc;

      try {
        const req = {
          params: { id: validProjectId },
          user: { userID: ownerId },
          body: {
            viewportResults: [
              {
                viewport: { name: "desktop", width: 1440, height: 900 },
                metrics: { hasHorizontalOverflow: false, maxHorizontalOverflowPx: 0 },
                errors: [],
              },
              {
                viewport: { name: "mobile", width: 375, height: 812 },
                metrics: { hasHorizontalOverflow: false, maxHorizontalOverflowPx: 0 },
                errors: [],
              },
            ],
          },
        };
        const res = createMockRes();

        await handleVisualVerification(req, res);

        assert.strictEqual(saveCalled, true);
        assert.strictEqual(projectDoc.status, "completed");
        assert.strictEqual(projectDoc.history.length, 1, "Must record initial snapshot on verification pass");
        assert.strictEqual(projectDoc.history[0].version, 1);
        assert.strictEqual(projectDoc.history[0].label, "Initial generation");
        assert.deepStrictEqual(projectDoc.history[0].files, projectDoc.files);
      } finally {
        Project.findById = originalFindById;
      }
    });

    it("chat revision success captures a new snapshot with incremented version and prompt label", async () => {
      const originalFindOne = Project.findOne;

      let savedProject = null;
      const initialFiles = {
        "/App.js": { content: "export default function App() { return <div>Original</div>; }", hash: "orig1" },
      };

      const projectDoc = new Project({
        _id: validProjectId,
        owner: ownerId,
        name: "Test Revision Project",
        version: 1,
        status: "completed",
        files: initialFiles,
        history: [
          {
            version: 1,
            label: "Initial generation",
            files: initialFiles,
            createdAt: new Date(),
          },
        ],
        messages: [],
      });

      projectDoc.save = async function () {
        savedProject = this;
        return this;
      };

      Project.findOne = async () => projectDoc;

      // Mock AI revision succeeding with a replacement operation
      setAiGeneratorOverride(async ({ schema }) => {
        if (schema === RevisionResultSchema) {
          return {
            object: {
              operations: [
                {
                  op: "update",
                  path: "/App.js",
                  search: "Original",
                  replace: "V2 Revised",
                },
              ],
              description: "Updated App title to V2",
            },
          };
        }
        return { object: {} };
      });

      try {
        const req = {
          params: { id: validProjectId },
          user: { userID: ownerId },
          body: { prompt: "Change title to V2 Revised in App.js" },
        };
        const res = createMockRes();

        await chat(req, res);

        assert.strictEqual(res.getStatus(), 200);
        assert.ok(savedProject, "Project must be saved");
        assert.strictEqual(savedProject.version, 2, "Project version must be incremented to 2");
        assert.strictEqual(savedProject.history.length, 2, "History must contain 2 snapshots");

        const latestSnapshot = savedProject.history[1];
        assert.strictEqual(latestSnapshot.version, 2);
        assert.strictEqual(latestSnapshot.label, "Change title to V2 Revised in App.js");
        assert.ok(
          latestSnapshot.files["/App.js"].content.includes("V2 Revised"),
          "Latest snapshot must contain revised file content"
        );
      } finally {
        Project.findOne = originalFindOne;
        resetAiGeneratorOverride();
      }
    });

    it("chat revision failure (regression rollback) does NOT push any snapshot or increment version", async () => {
      const originalFindOne = Project.findOne;

      let savedProject = null;
      const initialFiles = {
        "/App.js": { content: "export default function App() { return <div>Original</div>; }", hash: "orig1" },
      };

      const projectDoc = new Project({
        _id: validProjectId,
        owner: ownerId,
        version: 1,
        status: "completed",
        files: initialFiles,
        history: [
          {
            version: 1,
            label: "Initial generation",
            files: initialFiles,
            createdAt: new Date(),
          },
        ],
        messages: [],
      });

      projectDoc.save = async function () {
        savedProject = this;
        return this;
      };

      Project.findOne = async () => projectDoc;

      // Mock revision failure (no operations applied)
      setAiGeneratorOverride(async ({ schema }) => {
        if (schema === RevisionResultSchema) {
          return {
            object: {
              operations: [],
              description: "Failed revision",
            },
          };
        }
        return { object: {} };
      });

      try {
        const req = {
          params: { id: validProjectId },
          user: { userID: ownerId },
          body: { prompt: "Make an invalid revision" },
        };
        const res = createMockRes();

        await chat(req, res);

        assert.strictEqual(res.getStatus(), 422, "Failed revision must return 422");
        assert.strictEqual(savedProject.version, 1, "Version must NOT increment on rollback");
        assert.strictEqual(savedProject.history.length, 1, "History must NOT have new snapshot on rollback");
        assert.strictEqual(savedProject.history[0].version, 1);
      } finally {
        Project.findOne = originalFindOne;
        resetAiGeneratorOverride();
      }
    });
  });

  describe("Task 3: 15-Snapshot Cap Enforcement", () => {
    it("caps stored snapshots at the most recent 15 versions ($slice: -15)", () => {
      const mockProject = {
        version: 0,
        files: { "/App.js": { content: "initial" } },
        history: [],
        markModified() {},
      };

      // Add 20 snapshots sequentially
      for (let v = 1; v <= 20; v++) {
        mockProject.version = v;
        mockProject.files = { "/App.js": { content: `Version ${v}` } };
        recordSnapshot(mockProject, `Revision ${v}`);
      }

      assert.strictEqual(mockProject.history.length, 15, "History array must strictly cap at 15 items");

      // Verify that the oldest 5 versions (1-5) were dropped, and versions 6-20 are preserved
      const storedVersions = mockProject.history.map((h) => h.version);
      assert.deepStrictEqual(
        storedVersions,
        [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        "History must retain strictly the most recent 15 versions in order"
      );
      assert.strictEqual(
        mockProject.history[14].files["/App.js"].content,
        "Version 20",
        "Most recent snapshot must correspond to latest version"
      );
    });
  });

  describe("Task 4: Version History Endpoint (GET /api/projects/:id/versions)", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const req = { params: { id: validProjectId }, user: null };
      const res = createMockRes();

      await getProjectVersions(req, res);
      assert.strictEqual(res.getStatus(), 401);
      assert.match(res.getBody().error, /Unauthorized/i);
    });

    it("rejects invalid project ObjectId with 404", async () => {
      const req = { params: { id: "invalid-id" }, user: { userID: ownerId } };
      const res = createMockRes();

      await getProjectVersions(req, res);
      assert.strictEqual(res.getStatus(), 404);
      assert.match(res.getBody().error, /Project not found/i);
    });

    it("enforces strict owner authorization and rejects non-owner with 403", async () => {
      const originalFindById = Project.findById;
      Project.findById = async () => ({
        _id: validProjectId,
        owner: ownerId,
        history: [],
      });

      try {
        const req = {
          params: { id: validProjectId },
          user: { userID: nonOwnerId },
        };
        const res = createMockRes();

        await getProjectVersions(req, res);
        assert.strictEqual(res.getStatus(), 403);
        assert.match(res.getBody().error, /Access denied/i);
      } finally {
        Project.findById = originalFindById;
      }
    });

    it("returns project history metadata sorted newest-first and omits raw files payloads", async () => {
      const originalFindById = Project.findById;
      const historyEntries = [
        {
          version: 1,
          label: "Initial generation",
          files: { "/App.js": { content: "v1 code" }, "/styles.css": { content: "css" } },
          createdAt: new Date("2026-11-13T09:00:00Z"),
        },
        {
          version: 2,
          label: "Added Hero section",
          files: { "/App.js": { content: "v2 code" }, "/Hero.js": { content: "hero" }, "/styles.css": { content: "css" } },
          createdAt: new Date("2026-11-13T09:30:00Z"),
        },
        {
          version: 3,
          label: "Added Contact form",
          files: { "/App.js": { content: "v3" }, "/Hero.js": { content: "hero" }, "/Contact.js": { content: "contact" }, "/styles.css": { content: "css" } },
          createdAt: new Date("2026-11-13T10:00:00Z"),
        },
      ];

      Project.findById = async () => ({
        _id: validProjectId,
        owner: ownerId,
        history: historyEntries,
      });

      try {
        const req = {
          params: { id: validProjectId },
          user: { userID: ownerId },
        };
        const res = createMockRes();

        await getProjectVersions(req, res);
        assert.strictEqual(res.getStatus(), 200);

        const list = res.getBody();
        assert.ok(Array.isArray(list), "Response must be an array of versions");
        assert.strictEqual(list.length, 3);

        // Verify sorted newest-first (v3, v2, v1)
        assert.strictEqual(list[0].version, 3);
        assert.strictEqual(list[0].fileCount, 4);
        assert.strictEqual(list[0].label, "Added Contact form");
        assert.strictEqual(list[0].files, undefined, "Raw files map must be omitted from list endpoint");

        assert.strictEqual(list[1].version, 2);
        assert.strictEqual(list[1].fileCount, 3);
        assert.strictEqual(list[1].files, undefined);

        assert.strictEqual(list[2].version, 1);
        assert.strictEqual(list[2].fileCount, 2);
        assert.strictEqual(list[2].files, undefined);
      } finally {
        Project.findById = originalFindById;
      }
    });
  });

  describe("Task 5: Version Restore Endpoint (POST /api/projects/:id/versions/:version/restore)", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const req = { params: { id: validProjectId, version: "1" }, user: null };
      const res = createMockRes();

      await restoreProjectVersion(req, res);
      assert.strictEqual(res.getStatus(), 401);
    });

    it("rejects non-owner restore attempt with 403", async () => {
      const originalFindById = Project.findById;
      Project.findById = async () => ({
        _id: validProjectId,
        owner: ownerId,
        history: [{ version: 1, files: {} }],
      });

      try {
        const req = {
          params: { id: validProjectId, version: "1" },
          user: { userID: nonOwnerId },
        };
        const res = createMockRes();

        await restoreProjectVersion(req, res);
        assert.strictEqual(res.getStatus(), 403);
        assert.match(res.getBody().error, /Access denied/i);
      } finally {
        Project.findById = originalFindById;
      }
    });

    it("returns 404 when requested version is not in project history", async () => {
      const originalFindById = Project.findById;
      Project.findById = async () => ({
        _id: validProjectId,
        owner: ownerId,
        history: [{ version: 1, label: "Initial", files: {} }],
      });

      try {
        const req = {
          params: { id: validProjectId, version: "99" },
          user: { userID: ownerId },
        };
        const res = createMockRes();

        await restoreProjectVersion(req, res);
        assert.strictEqual(res.getStatus(), 404);
        assert.match(res.getBody().error, /not found/i);
      } finally {
        Project.findById = originalFindById;
      }
    });

    it("restores older version: overwrites project.files, increments project.version, and pushes 'Restored from v<version>' snapshot", async () => {
      const originalFindById = Project.findById;

      const v1Files = {
        "/App.js": { content: "export default () => <div>Version 1</div>", hash: "v1hash" },
      };
      const v2Files = {
        "/App.js": { content: "export default () => <div>Version 2 Changed</div>", hash: "v2hash" },
        "/Feature.js": { content: "export const Feature = () => <div>Feature</div>", hash: "fhash" },
      };

      const projectDoc = new Project({
        _id: validProjectId,
        owner: ownerId,
        name: "Restore Target Project",
        version: 2,
        files: v2Files,
        history: [
          {
            version: 1,
            label: "Initial generation",
            files: v1Files,
            createdAt: new Date("2026-11-13T09:00:00Z"),
          },
          {
            version: 2,
            label: "Added Feature component",
            files: v2Files,
            createdAt: new Date("2026-11-13T09:30:00Z"),
          },
        ],
        messages: [],
      });

      let saveCalled = false;
      projectDoc.save = async function () {
        saveCalled = true;
        return this;
      };

      Project.findById = async () => projectDoc;

      try {
        const req = {
          params: { id: validProjectId, version: "1" },
          user: { userID: ownerId },
        };
        const res = createMockRes();

        await restoreProjectVersion(req, res);

        assert.strictEqual(res.getStatus(), 200);
        assert.strictEqual(saveCalled, true, "Project must be saved to DB");

        // 1. Version incremented from 2 to 3
        assert.strictEqual(projectDoc.version, 3, "Restoring must increment project.version");

        // 2. Overwrote project.files with deep clone of v1 snapshot
        assert.deepStrictEqual(
          projectDoc.files,
          v1Files,
          "project.files must match snapshot of restored version 1"
        );
        assert.strictEqual(projectDoc.files["/Feature.js"], undefined, "Files not in v1 must be gone");

        // 3. New snapshot pushed into history labeled 'Restored from v1'
        assert.strictEqual(projectDoc.history.length, 3, "New snapshot must be recorded for the restore");
        const restoreEntry = projectDoc.history[2];
        assert.strictEqual(restoreEntry.version, 3, "New snapshot version must match incremented version 3");
        assert.strictEqual(restoreEntry.label, "Restored from v1", "Snapshot label must be 'Restored from v1'");
        assert.deepStrictEqual(restoreEntry.files, v1Files);

        // 4. Response returns updated project document
        const responseBody = res.getBody();
        assert.strictEqual(responseBody.version, 3);
        assert.deepStrictEqual(responseBody.files, v1Files);
      } finally {
        Project.findById = originalFindById;
      }
    });

    it("respects 15-snapshot cap when restore is performed on a project with 15 existing snapshots", async () => {
      const originalFindById = Project.findById;

      const history = [];
      for (let v = 1; v <= 15; v++) {
        history.push({
          version: v,
          label: `Version ${v}`,
          files: { "/App.js": { content: `v${v}` } },
          createdAt: new Date(),
        });
      }

      const projectDoc = new Project({
        _id: validProjectId,
        owner: ownerId,
        version: 15,
        files: { "/App.js": { content: "v15" } },
        history,
        messages: [],
      });
      projectDoc.save = async function () {
        return this;
      };

      Project.findById = async () => projectDoc;

      try {
        const req = {
          params: { id: validProjectId, version: "5" },
          user: { userID: ownerId },
        };
        const res = createMockRes();

        await restoreProjectVersion(req, res);

        assert.strictEqual(res.getStatus(), 200);
        assert.strictEqual(projectDoc.version, 16);
        assert.strictEqual(projectDoc.history.length, 15, "History must stay capped at 15 items");

        // The oldest version (v1) was capped out; v2 is now the first
        assert.strictEqual(projectDoc.history[0].version, 2);
        // The newest version is v16 labeled 'Restored from v5'
        const lastEntry = projectDoc.history[14];
        assert.strictEqual(lastEntry.version, 16);
        assert.strictEqual(lastEntry.label, "Restored from v5");
        assert.strictEqual(lastEntry.files["/App.js"].content, "v5");
      } finally {
        Project.findById = originalFindById;
      }
    });
  });
});
