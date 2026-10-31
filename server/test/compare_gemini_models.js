import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import fs from "fs";
import { generateProject } from "../services/ai.js";
import { validateProject, compileModuleCode } from "../services/codeValidator.js";
import { deriveFeatureChecklist, validateFeatureChecklist } from "../services/featureValidator.js";
import { analyzeProjectVisualQuality } from "../services/visualQa.js";

const FRESH_PROMPT = "Create a premium, modern e-commerce storefront for a contemporary lifestyle and fashion brand. It should have a distinctive visual identity, refined typography, a responsive navigation bar, a strong hero section, product categories, an attractive product grid, product cards, functional product filtering, a shopping cart drawer, quantity controls, subtotal and total calculations, and a polished footer. Use a cohesive design system, thoughtful spacing, high-quality imagery, subtle animations, and a professional responsive layout. All visible interactions must work.";

async function runModelGeneration(modelName) {
  console.log(`\n======================================================`);
  console.log(`STARTING GENERATION TEST FOR MODEL: ${modelName}`);
  console.log(`======================================================`);

  process.env.GEMINI_MODEL = modelName;
  process.env.AI_PROVIDER = "gemini";

  const telemetry = {
    model: modelName,
    prompt: FRESH_PROMPT,
    startTime: new Date().toISOString(),
    startMs: Date.now(),
    durationMs: 0,
    designSpec: null,
    filesPlanned: [],
    filesGenerated: [],
    repairAttempts: 0,
    repairRounds: [],
    validationErrorsInitial: [],
    validationErrorsFinal: [],
    compilationResults: {},
    featureChecklistReport: null,
    visualQaReport: null,
    finalStatus: "in_progress",
    error: null,
    generatedFiles: {},
  };

  const callbacks = {
    onDesignSpec: async (spec) => {
      console.log(`[${modelName}] DesignSpec generated. Archetype: ${spec.archetype}, Category: ${spec.category}`);
      telemetry.designSpec = spec;
    },
    onPlan: async (plan) => {
      console.log(`[${modelName}] File plan created with ${plan.files.length} files.`);
      telemetry.filesPlanned = plan.files.map((f) => ({
        path: f.path,
        description: f.description,
        isEntry: f.isEntry,
        mandatory: f.mandatory,
      }));
    },
    onFileStart: async (filePath) => {
      console.log(`[${modelName}] Generating file: ${filePath}...`);
    },
    onFileComplete: async (filePath, code) => {
      console.log(`[${modelName}] Completed file: ${filePath} (${code.length} chars)`);
      if (!telemetry.filesGenerated.includes(filePath)) {
        telemetry.filesGenerated.push(filePath);
      }
      telemetry.generatedFiles[filePath] = code;
    },
    onValidationStart: async () => {
      console.log(`[${modelName}] Validating project...`);
    },
    onRepairStart: async (errors) => {
      telemetry.repairAttempts += 1;
      telemetry.validationErrorsInitial = errors;
      console.log(`[${modelName}] Repair loop triggered: ${errors.length} validation issues.`);
    },
    onRepairRound: async (roundInfo) => {
      telemetry.repairRounds.push(roundInfo);
      console.log(`[${modelName}] Repair round ${roundInfo.attempt}/${roundInfo.maxAttempts}`);
    },
  };

  try {
    const result = await generateProject(FRESH_PROMPT, callbacks);
    telemetry.finalStatus = "completed";
    telemetry.durationMs = Date.now() - telemetry.startMs;
    telemetry.endTime = new Date().toISOString();
    telemetry.generatedFiles = result.files;

    // 1. Semantic Project Validation
    const finalVal = validateProject(result.files, telemetry.filesPlanned);
    telemetry.validationErrorsFinal = finalVal.errors;

    // 2. Real Module JSX Compilation Checks
    for (const [filePath, content] of Object.entries(result.files)) {
      if (filePath.endsWith(".js") || filePath.endsWith(".jsx")) {
        const comp = await compileModuleCode(content, filePath);
        telemetry.compilationResults[filePath] = {
          success: comp.success,
          errorCount: comp.errors.length,
          errors: comp.errors,
        };
      }
    }

    // 3. Feature Checklist Evaluation
    const checklist = deriveFeatureChecklist(FRESH_PROMPT, result.designSpec);
    telemetry.featureChecklistReport = validateFeatureChecklist(result.files, checklist);

    // 4. Automated Visual QA Analysis
    telemetry.visualQaReport = analyzeProjectVisualQuality(result.files, result.designSpec);

    console.log(`[${modelName}] SUCCESS in ${(telemetry.durationMs / 1000).toFixed(1)}s! Files: ${Object.keys(result.files).length}`);
    console.log(`[${modelName}] Validation: valid=${finalVal.valid}, errors=${finalVal.errors.length}`);
    console.log(`[${modelName}] Feature Score: ${telemetry.featureChecklistReport.score}%`);
    console.log(`[${modelName}] Visual QA: score=${telemetry.visualQaReport.score}, status=${telemetry.visualQaReport.status}`);
  } catch (err) {
    telemetry.finalStatus = "failed";
    telemetry.durationMs = Date.now() - telemetry.startMs;
    telemetry.error = err.message;
    telemetry.endTime = new Date().toISOString();
    console.error(`[${modelName}] FAILED after ${(telemetry.durationMs / 1000).toFixed(1)}s:`, err.message);
  }

  return telemetry;
}

async function runComparison() {
  const comparison = {
    prompt: FRESH_PROMPT,
    timestamp: new Date().toISOString(),
    results: {},
  };

  // Test 1: gemini-3.5-flash
  comparison.results["gemini-3.5-flash"] = await runModelGeneration("gemini-3.5-flash");

  // Pause 10 seconds between model runs to allow free-tier rate limit quotas to settle
  console.log("\nWaiting 10s for rate limit window to settle before testing gemini-3.8-flash...");
  await new Promise((r) => setTimeout(r, 10000));

  // Test 2: gemini-3.8-flash
  comparison.results["gemini-3.8-flash"] = await runModelGeneration("gemini-3.8-flash");

  const outputPath = path.resolve(__dirname, "../../docs/gemini_models_comparison_telemetry.json");
  fs.writeFileSync(outputPath, JSON.stringify(comparison, null, 2));
  console.log(`\nComparison telemetry saved to: ${outputPath}`);
}

runComparison();

