import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import { generateProject } from "../services/ai.js";
import { validateProject, validateAndFixCode, compileModuleCode } from "../services/codeValidator.js";
import { deriveFeatureChecklist, validateFeatureChecklist } from "../services/featureValidator.js";

const PROMPT = "Create a premium modern e-commerce storefront for a lifestyle and fashion brand. Include a responsive navigation bar, hero section, product categories, product grid, product cards, product filtering, shopping cart, quantity controls, subtotal and total calculations, and a professional footer. Make the interactions functional.";

async function run() {
  console.log("=== STARTING REAL OPENROUTER GENERATION TEST ===");
  console.log("Prompt:", PROMPT);
  console.log("Model:", process.env.OPENROUTER_MODEL);

  const telemetry = {
    prompt: PROMPT,
    model: process.env.OPENROUTER_MODEL,
    startTime: new Date().toISOString(),
    designSpec: null,
    filesPlanned: [],
    filesGenerated: [],
    repairAttempts: 0,
    repairRounds: [],
    validationErrorsInitial: [],
    validationErrorsFinal: [],
    featureChecklistReport: null,
    finalStatus: "in_progress",
    error: null,
    generatedFiles: {},
  };

  const callbacks = {
    onDesignSpec: async (spec) => {
      console.log(`[Telemetry] DesignSpec generated. Archetype: ${spec.archetype}, Category: ${spec.category}`);
      telemetry.designSpec = spec;
    },
    onPlan: async (plan) => {
      console.log(`[Telemetry] File plan created. Total files planned: ${plan.files.length}`);
      telemetry.filesPlanned = plan.files.map((f) => ({
        path: f.path,
        description: f.description,
        isEntry: f.isEntry,
        mandatory: f.mandatory,
      }));
      console.log("Planned files:\n" + plan.files.map((f) => `  - ${f.path}: ${f.description}`).join("\n"));
    },
    onFileStart: async (filePath) => {
      console.log(`[Telemetry] Generating file: ${filePath}...`);
    },
    onFileComplete: async (filePath, code) => {
      console.log(`[Telemetry] Generated file: ${filePath} (${code.length} bytes)`);
      if (!telemetry.filesGenerated.includes(filePath)) {
        telemetry.filesGenerated.push(filePath);
      }
      telemetry.generatedFiles[filePath] = code;
    },
    onValidationStart: async () => {
      console.log(`[Telemetry] Entering project validation phase...`);
    },
    onRepairStart: async (errors) => {
      telemetry.repairAttempts += 1;
      telemetry.validationErrorsInitial = errors;
      console.log(`[Telemetry] Repair loop initiated. Identified ${errors.length} validation errors:`);
      errors.forEach((e) => console.log(`  - [${e.type}] ${e.file}: ${e.message}`));
    },
    onRepairRound: async (roundInfo) => {
      telemetry.repairRounds.push(roundInfo);
      console.log(`[Telemetry] Repair round ${roundInfo.attempt}/${roundInfo.maxAttempts}: targets ${roundInfo.brokenFiles.join(", ")}`);
    },
  };

  try {
    const result = await generateProject(PROMPT, callbacks);
    telemetry.finalStatus = "completed";
    telemetry.generatedFiles = result.files;
    telemetry.endTime = new Date().toISOString();

    console.log("=== GENERATION SUCCEEDED ===");
    console.log(`Total files generated: ${Object.keys(result.files).length}`);

    // Audit final validation state
    const finalVal = validateProject(result.files, telemetry.filesPlanned);
    telemetry.validationErrorsFinal = finalVal.errors;
    console.log(`Final validation: valid=${finalVal.valid}, errors=${finalVal.errors.length}`);

    // Audit feature checklist
    const checklist = deriveFeatureChecklist(PROMPT, result.designSpec);
    const featureReport = validateFeatureChecklist(result.files, checklist);
    telemetry.featureChecklistReport = featureReport;
    console.log(`Feature Checklist: score=${featureReport.score}%, allMandatoryPassed=${featureReport.allMandatoryPassed}`);
  } catch (err) {
    telemetry.finalStatus = "failed";
    telemetry.error = err.message;
    telemetry.endTime = new Date().toISOString();
    console.error("=== GENERATION FAILED ===");
    console.error("Error:", err.message);
  }

  // Save telemetry and generated files to disk for verification
  const outputPath = "../docs/real_generation_telemetry.json";
  fs.writeFileSync(outputPath, JSON.stringify(telemetry, null, 2));
  console.log(`Telemetry saved to ${outputPath}`);
  return telemetry;
}

run();

