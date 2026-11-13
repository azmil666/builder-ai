import "dotenv/config";
import {createOpenAI} from '@ai-sdk/openai'
import { generateObject } from 'ai';
import pMap from "p-map";
import { DesignSpecSchema, FileCodeSchema, FilePlanSchema, RevisionResultSchema, RequirementContractSchema } from './aiSchemas.js';
import { buildFileCodeSystem, buildFilePlanSystem, buildReviseSystem, createDefaultDesignSpec, DESIGN_SPEC_SYSTEM, REVISE_SYSTEM } from './prompts.js';
import { normalizeContent } from './contentNormalizer.js';
import { validateAndFixCode, validateRevisionContent, validateProject, verifyProjectRuntime, inferFramework } from './codeValidator.js';
import { deriveFeatureChecklist, validateFeatureChecklist } from './featureValidator.js';
import { generateGeminiObject } from './gemini.js';
import { loadCraftworkSkill } from './craftworkSkill.js';
import {
  generateRequirementContract,
  createDefaultRequirementContract,
  formatContractForDesignSpec,
  verifyFilePlanAlignment,
} from './requirementContract.js';
import { verifyProjectRequirements } from './requirementVerification.js';
import { runEvidenceDrivenSelfRepairLoop } from './selfRepair.js';

// --- AI Provider Resolution & Abstraction ---
export function getActiveAiProvider() {
    if (process.env.AI_PROVIDER) {
        return process.env.AI_PROVIDER.toLowerCase();
    }
    if (process.env.GEMINI_API_KEY) {
        return "gemini";
    }
    return "openrouter";
}

// --- OpenRouter Model Client Setup (Fallback) ---
function getModel() {
    const modelName = process.env.OPENROUTER_MODEL || "openrouter/free";
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY environment variable is missing.");
    }
    const client = createOpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
    });
    return client(modelName);
}

let _aiGeneratorOverride = null;

/**
 * Sets a custom structured object generator mock for testing or isolated execution.
 */
export function setAiGeneratorOverride(fn) {
    _aiGeneratorOverride = fn;
}

/**
 * Resets any active structured object generator mock.
 */
export function resetAiGeneratorOverride() {
    _aiGeneratorOverride = null;
}

/**
 * Universal structured object generator.
 * Automatically delegates to Google Gemini API (primary) or OpenRouter (fallback).
 * Preserves { object } return structure across all callers.
 */
export async function generateStructuredObject({ schema, system, prompt, maxRetries = 2 }) {
    if (_aiGeneratorOverride) {
        return _aiGeneratorOverride({ schema, system, prompt, maxRetries });
    }
    const provider = getActiveAiProvider();
    if (provider === "gemini") {
        return generateGeminiObject({ schema, system, prompt, maxRetries });
    }
    const model = getModel();
    return generateObject({
        model,
        schema,
        system,
        prompt,
        maxRetries,
    });
}

const defaultConcurrency = getActiveAiProvider() === "gemini" ? "2" : "6";
const MAX_CONCURRENCY = parseInt(process.env.AI_MAX_CONCURRENCY || defaultConcurrency, 10);

// Generate a single file's code
async function generateSingleFile(file, allFiles, prompt, alreadyGeneratedFiles, designSpec, contract = null, framework = null){
     const resolvedFw = framework || contract?.framework || (allFiles?.some?.(f => (f?.path || f) === "/index.html") && !allFiles?.some?.(f => (f?.path || f) === "/App.js" || (f?.path || f) === "/App.jsx") ? "vanilla" : "react");
     const system = buildFileCodeSystem(allFiles, alreadyGeneratedFiles, designSpec, contract, file, resolvedFw);

     const userMsg = `Project: ${prompt}\n\nWrite the complete code for: ${file.path}\nPurpose: ${file.description}`;

     console.log(`[AI] Creating file: ${file.path}...`);
     const { object } = await generateStructuredObject({
        schema: FileCodeSchema,
        system,
        prompt: userMsg,
        maxRetries: 2,
     });

     let code = normalizeContent(object.code);

     if(code.trim().length === 0){
        throw new Error("Generated code is empty after normalization");
     }

     // Apply post-generation validation and auto-fixing
     let validation = validateAndFixCode(code, file.path, {allPlannedFiles: allFiles, framework: resolvedFw});

     code = validation.code;

     if(validation.warnings.length > 0){
        console.log(`[Validator] Code adjustments for ${file.path}:\n  - ${validation.warnings.join("\n  - ")}`);
     }

     // If validation failed with syntax, import, or export errors, attempt ONE targeted correction
     if(!validation.valid && validation.errors && validation.errors.length > 0){
        console.warn(`[Validator] ${file.path} has ${validation.errors.length} validation errors. Attempting targeted correction...`);
        const errorList = validation.errors.map(e => `- [${e.type.toUpperCase()}] ${e.message}`).join("\n");
        try {
            const repairMsg = `Project: ${prompt}\n\nThe generated code for ${file.path} failed validation with these errors:\n${errorList}\n\nCurrent code:\n\`\`\`javascript\n${code}\n\`\`\`\n\nPlease fix the syntax, import, or export errors and return the corrected complete code while adhering to Craftwork design guidance and DesignSpec tokens.`;
            const { object: repairedObj } = await generateStructuredObject({
                schema: FileCodeSchema,
                system,
                prompt: repairMsg,
                maxRetries: 1,
            });
            const repairedCode = normalizeContent(repairedObj.code);
            const revalidation = validateAndFixCode(repairedCode, file.path, {allPlannedFiles: allFiles, framework: resolvedFw});
            if(revalidation.valid){
                console.log(`[Validator] Targeted correction SUCCEEDED for ${file.path}`);
                code = revalidation.code;
                validation = revalidation;
            } else {
                console.warn(`[Validator] Targeted correction for ${file.path} did not resolve all errors.`);
                throw new Error(`Validation failed for ${file.path}: ${validation.errors[0]?.message}`);
            }
        } catch (repairErr) {
            console.warn(`[Validator] Targeted repair failed for ${file.path}: ${repairErr.message}`);
            throw new Error(`Validation failed for ${file.path}: ${validation.errors[0]?.message}`);
        }
     }

     console.log(`[AI] Created file: ${file.path} (${code.length} chars)`);
     return {path: file.path, code}
}

/**
 * Targeted AI Self-Repair Loop
 * Repairs only the affected broken files within a bounded retry limit (max 2 attempts).
 * Preserves already valid components, project architecture, and DesignSpec.
 */
export async function repairProjectFiles(
    files,
    allPlannedFiles,
    errors,
    prompt,
    designSpec,
    callbacks = {},
    maxAttempts = 2,
    requirementContract = null,
    framework = null
) {
    const targetFramework = framework || requirementContract?.framework || inferFramework(files);
    let currentFiles = { ...files };
    let currentErrors = [...errors];
    const repairLogs = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (currentErrors.length === 0) break;

        const brokenFiles = [
            ...new Set(
                currentErrors
                    .map((e) => e.file)
                    .filter((f) => f && f !== "/" && currentFiles[f])
            ),
        ];

        if (brokenFiles.length === 0) {
            break;
        }

        console.log(`[AI Repair] Attempt ${attempt}/${maxAttempts} repairing ${brokenFiles.length} file(s): ${brokenFiles.join(", ")}`);

        if (callbacks?.onRepairRound) {
            await callbacks.onRepairRound({
                attempt,
                maxAttempts,
                brokenFiles,
                errorCount: currentErrors.length,
            });
        }

        for (const filePath of brokenFiles) {
            const fileErrors = currentErrors.filter((e) => e.file === filePath);
            const errorSummary = fileErrors.map((e) => `- [${e.type.toUpperCase()}] ${e.message}`).join("\n");
            const currentCode = currentFiles[filePath];
            const system = buildFileCodeSystem(allPlannedFiles, currentFiles, designSpec, requirementContract, filePath);

            const repairPrompt = `Project: ${prompt}\n\nThe file '${filePath}' failed validation with these errors:\n${errorSummary}\n\nCurrent code for ${filePath}:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nRepair only the code for '${filePath}'. Fix all syntax, import, export, and contract errors while preserving visual styling, Craftwork design guidance, and DesignSpec tokens. Return the complete corrected code.`;

            try {
                const { object } = await generateStructuredObject({
                    schema: FileCodeSchema,
                    system,
                    prompt: repairPrompt,
                    maxRetries: 1,
                });

                const repairedCode = normalizeContent(object.code);
                const reval = validateAndFixCode(repairedCode, filePath, {
                    allPlannedFiles,
                    existingFiles: Object.keys(currentFiles),
                    framework: targetFramework,
                });

                currentFiles[filePath] = reval.code;
                repairLogs.push({
                    attempt,
                    file: filePath,
                    resolvedErrors: fileErrors.length,
                    valid: reval.valid,
                });

                if (callbacks?.onFileComplete) {
                    await callbacks.onFileComplete(filePath, reval.code);
                }
            } catch (err) {
                console.warn(`[AI Repair] Attempt ${attempt} failed for ${filePath}: ${err.message}`);
                repairLogs.push({
                    attempt,
                    file: filePath,
                    error: err.message,
                });
            }
        }

        const recheck = validateProject(currentFiles, allPlannedFiles, targetFramework);
        const rerunt = await verifyProjectRuntime(currentFiles, targetFramework);
        currentErrors = [...recheck.errors, ...rerunt.errors];
    }

    const finalCheck = validateProject(currentFiles, allPlannedFiles, targetFramework);
    const finalRunt = await verifyProjectRuntime(currentFiles, targetFramework);
    const combinedFinalErrors = [...finalCheck.errors, ...finalRunt.errors];

    return {
        success: combinedFinalErrors.length === 0,
        files: currentFiles,
        errors: combinedFinalErrors,
        warnings: finalCheck.warnings,
        repairLogs,
    };
}

// Generate project files: RequirementContract first, then DesignSpec, then plan, then build files in order with fallback retries
export async function generateProject(prompt, callbacks = {}, options = {}){
    // Ensure runtime Craftwork design guidance is loaded and available
    loadCraftworkSkill();

    const framework = (typeof options === "string" ? options : options?.framework) || callbacks?.framework || (/\b(react|jsx|tsx|component-based|single[- ]page app|spa)\b/i.test(prompt) ? "react" : "vanilla");

    // Phase 0: Requirement Intelligence - Establish Structured Requirement Contract
    console.log(`[AI] Phase 0: Establishing Requirement Contract for: "${prompt.slice(0, 80)}..." (framework=${framework})`);
    let requirementContract = null;
    try {
        requirementContract = await generateRequirementContract(prompt, { framework });
    } catch (contractErr) {
        console.warn(`[AI] RequirementContract generation failed: ${contractErr.message}. Using intelligent default.`);
        requirementContract = createDefaultRequirementContract(prompt, framework);
    }

    if (callbacks?.onRequirementContract) {
        await callbacks.onRequirementContract(requirementContract);
    }

    // Phase 1: Design Intelligence - Establish visual identity and design tokens informed by Contract
    console.log(`[AI] Phase 1: Generating DesignSpec for: "${prompt.slice(0,80)}..."`);
    let designSpec = null;
    try {
        const contractSpecContext = formatContractForDesignSpec(requirementContract);
        const specPrompt = `Create a comprehensive, production-grade DesignSpec for: ${prompt}\n\n${contractSpecContext}`;
        const { object: spec } = await generateStructuredObject({
            schema: DesignSpecSchema,
            system: DESIGN_SPEC_SYSTEM,
            prompt: specPrompt,
            maxRetries: 2,
        });
        designSpec = spec;
    } catch (err) {
        console.warn(`[AI] DesignSpec generation failed: ${err.message}. Using intelligent default spec.`);
        designSpec = createDefaultDesignSpec(prompt, requirementContract, framework);
    }

    if(callbacks?.onDesignSpec){
        await callbacks.onDesignSpec(designSpec);
    }

    // Phase 2: Technical File Planning informed by DesignSpec & RequirementContract
    console.log(`[AI] Phase 2: Planning file structure for: "${prompt.slice(0,80)}..." (framework=${framework})`);
    const filePlanSystem = buildFilePlanSystem(designSpec, requirementContract, framework);
    const planPrompt = framework === "vanilla"
        ? `Plan a modern semantic Vanilla HTML5, CSS, and JavaScript website for: ${prompt}`
        : `Plan a modern React website for: ${prompt}`;
    const { object: plan } = await generateStructuredObject({
        schema: FilePlanSchema,
        system: filePlanSystem,
        prompt: planPrompt,
        maxRetries: 2,
    });

    // Fallback guarantees: ensure essential entry points exist in FilePlan
    let resolvedFramework = framework;
    if (plan.files?.some((f) => f.path === "/App.js" || f.path === "/App.jsx") && !plan.files?.some((f) => f.path === "/index.html")) {
        resolvedFramework = "react";
    }

    if (resolvedFramework === "vanilla") {
        if (!plan.files.find((f) => f.path === "/index.html")) {
            plan.files.unshift({
                path: "/index.html",
                description: "Main semantic HTML5 entry point linking ./styles.css, Tailwind CDN, and ./script.js",
                exports: "none",
                imports: ["./styles.css", "./script.js"],
            });
        }
        if (!plan.files.find((f) => f.path === "/styles.css")) {
            plan.files.push({
                path: "/styles.css",
                description: "Global CSS: Google Font import, design tokens, keyframe animations, utility classes",
                exports: "none",
                imports: [],
            });
        }
        if (!plan.files.find((f) => f.path === "/script.js")) {
            plan.files.push({
                path: "/script.js",
                description: "Vanilla ES6+ JavaScript handling DOM manipulation, event listeners, and interactive UI logic",
                exports: "none",
                imports: [],
            });
        }
    } else {
        const hasApp = plan.files.find((f) => f.path === "/App.jsx" || f.path === "/App.js");
        if (!hasApp) {
            plan.files.unshift({
                path: "/App.jsx",
                description: "Main application entry point",
                exports: "default App",
                imports: ["./styles.css"],
            });
        }
        if (!plan.files.find((f) => f.path === "/styles.css")) {
            plan.files.push({
                path: "/styles.css",
                description: "Global CSS: Google Font import, design tokens, keyframe animations, utility classes",
                exports: "none",
                imports: [],
            });
        }
    }

    // Consistency Check: Verify FilePlan alignment with Requirement Contract
    const alignmentCheck = verifyFilePlanAlignment(plan, requirementContract);
    if (alignmentCheck.warnings && alignmentCheck.warnings.length > 0) {
        console.log(`[AI Plan Alignment] ${alignmentCheck.warnings.join("; ")}`);
    }

    if(callbacks?.onPlan){
        await callbacks.onPlan(plan)
    }

    let files = {};

    // Phase 3a: Generate foundation /styles.css first if planned, establishing tokens and classes for all other files
    const stylesFile = plan.files.find((f) => f.path === "/styles.css");
    if (stylesFile) {
        console.log(`[AI] Phase 3a: Generating foundation /styles.css before components...`);
        try {
            if (callbacks?.onFileStart) {
                await callbacks.onFileStart(stylesFile.path);
            }
            const stylesResult = await generateSingleFile(stylesFile, plan.files, prompt, files, designSpec, requirementContract, resolvedFramework);
            files[stylesFile.path] = stylesResult.code;
            if (callbacks?.onFileComplete) {
                await callbacks.onFileComplete(stylesFile.path, stylesResult.code);
            }
        } catch (err) {
            console.warn(`[AI] Foundation /styles.css generation deferred to retry loop: ${err.message}`);
        }
    }

    // Phase 3b: Generate remaining components
    let pendingFiles = plan.files.filter((f) => !files[f.path]).map((f) => ({ ...f }));

    console.log(`[AI] Phase 3b: Generating ${pendingFiles.length} files in parallel (concurrency=${MAX_CONCURRENCY}): ${pendingFiles.map((f)=> f.path).join(", ")}`);

    const maxRetryRounds = 2;

    let lastFileError = null;

    for (let round = 0; round <= maxRetryRounds; round++) {
        if(pendingFiles.length === 0) break;

        if(round > 0){
            const backoffMs = Math.min(Math.pow(2, round) * 2000, 8000);
            console.log(
                `[AI] Waiting ${backoffMs}ms before retry round ${round}/${maxRetryRounds} for ${pendingFiles.length} failed files: ${pendingFiles.map((f) => f.path).join(", ")}`,
            );
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }

        const results = await pMap(
            pendingFiles,
            async (file) => {
                try {
                    if (callbacks?.onFileStart){
                        await callbacks.onFileStart(file.path)
                    }

                    const singleResult = await generateSingleFile(file, plan.files, prompt, files, designSpec, requirementContract, resolvedFramework)

                    if(callbacks?.onFileComplete){
                        await callbacks.onFileComplete(file.path, singleResult.code)
                    }
                    return {success: true, file, result: singleResult }
                } catch (err) {
                    return { success: false, file, error: err };
                }
            },
            {concurrency: MAX_CONCURRENCY},
        )

         const failedFiles = [];
         for (const entry of results) {
            if (entry.success) {
                const { path, code } = entry.result;
                files[path.startsWith("/") ? path : "/" + path] = code;
            }else{
                console.warn(`[AI] File ${entry.file.path} failed in round ${round}: ${entry.error?.message || entry.error}`);
                failedFiles.push(entry.file);
                lastFileError = entry.error;
            }
         }
         pendingFiles = failedFiles;
    }

    if(pendingFiles.length > 0){
        const failedPaths = pendingFiles.map((f)=>f.path).join(", ");
        const errorDetail = lastFileError?.message ? ` (${lastFileError.message})` : "";
        console.error(`[AI] Failed to generate ${pendingFiles.length} mandatory files after all retries: ${failedPaths}${errorDetail}`);
        throw new Error(`Failed to generate mandatory planned file(s): ${failedPaths}${errorDetail}`);
    }

    if (resolvedFramework === "vanilla") {
        if (!files["/index.html"]) {
            throw new Error("AI did not generate /index.html entry point");
        }
    } else {
        if (!files["/App.jsx"] && !files["/App.js"]) {
            throw new Error("AI did not generate /App.jsx entry point");
        }
    }

    // Phase 4: Final project-level semantic, contract & active-state runtime validation
    if (callbacks?.onValidationStart) {
        await callbacks.onValidationStart();
    }
    let projectValidation = validateProject(files, plan.files, resolvedFramework);
    let runtimeValidation = await verifyProjectRuntime(files, resolvedFramework);
    let combinedErrors = [...projectValidation.errors, ...runtimeValidation.errors];

    // If validation fails, initiate targeted AI self-repair loop
    if (combinedErrors.length > 0) {
        console.warn(`[Validator] Project validation found ${combinedErrors.length} cross-file and runtime issues. Starting targeted self-repair loop...`);

        if (callbacks?.onRepairStart) {
            await callbacks.onRepairStart(combinedErrors);
        }

        const repairResult = await repairProjectFiles(
            files,
            plan.files,
            combinedErrors,
            prompt,
            designSpec,
            callbacks,
            2,
            requirementContract,
            resolvedFramework
        );

        files = repairResult.files;
        if (!repairResult.success) {
            const errorSummary = repairResult.errors.map(e => `[${e.type}] ${e.file}: ${e.message}`).join("; ");
            throw new Error(`Project validation failed after self-repair attempts: ${errorSummary}`);
        }
    }

    // Phase 4.5: Evidence-Based Requirement Verification (Phase 3 Quality Engine V2)
    let requirementVerification = null;
    try {
        requirementVerification = await verifyProjectRequirements(files, requirementContract, plan, { framework: resolvedFramework });
        console.log(`[RequirementVerification] Completed: status=${requirementVerification.overallStatus}, passed=${requirementVerification.passed}/${requirementVerification.totalRequirements}, mandatoryPassed=${requirementVerification.mandatoryPassed}`);
        if (callbacks?.onRequirementVerification) {
            await callbacks.onRequirementVerification(requirementVerification);
        }
    } catch (verifErr) {
        console.warn(`[RequirementVerification] Verification failed with error: ${verifErr.message}`);
    }

    // Phase 4.6: Evidence-Driven Targeted Self-Repair Loop (Phase 4 Quality Engine V2)
    let selfRepairReport = null;
    if (requirementVerification && (requirementVerification.mandatoryFailed > 0 || requirementVerification.overallStatus === "FAILED")) {
        console.log(`[SelfRepair] Mandatory requirements failed (${requirementVerification.mandatoryFailed} failed). Starting targeted self-repair loop...`);
        try {
            const repairLoopResult = await runEvidenceDrivenSelfRepairLoop({
                files,
                prompt,
                requirementContract,
                designSpec,
                filePlan: plan,
                callbacks,
                maxAttempts: 2,
                framework: resolvedFramework,
            });
            files = repairLoopResult.files;
            requirementVerification = repairLoopResult.verification;
            selfRepairReport = repairLoopResult.report;

            if (callbacks?.onRequirementVerification) {
                await callbacks.onRequirementVerification(requirementVerification);
            }
        } catch (repairErr) {
            console.warn(`[SelfRepair] Self-repair loop encountered error: ${repairErr.message}`);
        }
    }

    // Phase 5: Feature-specific checklist verification informed by Requirement Contract
    const featureChecklist = deriveFeatureChecklist(prompt, designSpec, requirementContract);
    const featureReport = validateFeatureChecklist(files, featureChecklist);
    console.log(`[Validator] Feature checklist verified: score=${featureReport.score}%, allMandatoryPassed=${featureReport.allMandatoryPassed}`);

    return {
        files,
        description: plan.projectDescription,
        designSpec,
        requirementContract,
        requirementVerification,
        selfRepair: selfRepairReport,
        manifest: plan.manifest,
        featureReport,
        framework: resolvedFramework,
    };
}

export async function reviseProject(prompt, manifest, relevantFiles, recentMessages, designSpec, requirementContract = null, framework = null){
    loadCraftworkSkill();
    const targetFramework = framework || requirementContract?.framework || designSpec?.framework || (
        manifest.some((f) => f.path === "/index.html" || f.path === "/script.js") ? "vanilla" : "react"
    );
    const contextParts = [];

    if (requirementContract) {
        contextParts.push("## Active Requirement Contract (PRESERVE UNLESS EXPLICITLY MODIFIED)");
        contextParts.push(`- Framework: ${targetFramework}`);
        contextParts.push(`- Category: ${requirementContract.identity?.category || "saas_landing"}`);
        contextParts.push(`- Purpose: ${requirementContract.identity?.purpose || "Web application"}`);
        if (requirementContract.mandatoryRequirements?.length > 0) {
            contextParts.push(`- Mandatory Requirements to preserve: ${requirementContract.mandatoryRequirements.join("; ")}`);
        }
        contextParts.push("");
    }

    if (designSpec) {
        contextParts.push("## Active Design Specification & Craftwork Guidance (MUST PRESERVE UNLESS EXPLICITLY ASKED TO REDESIGN)");
        contextParts.push(`- Archetype: ${designSpec.archetype}`);
        contextParts.push(`- Theme: ${designSpec.colorPalette?.theme || "light"}`);
        contextParts.push(`- Colors: Background ${designSpec.colorPalette?.bg}, Text ${designSpec.colorPalette?.fg}, Accent ${designSpec.colorPalette?.accent}, Card ${designSpec.colorPalette?.cardBg}`);
        contextParts.push(`- Typography: Heading "${designSpec.typography?.heading?.family}", Body "${designSpec.typography?.body?.family}"`);
        contextParts.push(`- Card Style: ${designSpec.componentStyling?.cardStyle}`);
        contextParts.push(`- Signature Hook: ${designSpec.signature}`);
        contextParts.push("");
    }

    contextParts.push("## Current Project Files (manifest)");
    contextParts.push("```");
    for (const f of manifest) {
        contextParts.push(`${f.path} (${f.hash}, ${f.size}B)`)
    }
    contextParts.push("```");

    if(Object.keys(relevantFiles).length > 0){
        contextParts.push("\n## File Contents (for reference)");
        for (const [path, content] of Object.entries(relevantFiles)) {
        contextParts.push(`\n### ${path}\n\`\`\`\n${content}\n\`\`\``)
    }
    }

    if(recentMessages.length > 0){
        contextParts.push("\n## Recent Conversation");
        for (const msg of recentMessages.slice(-3)) {
        contextParts.push(`${msg.role}: ${msg.content}`)
    }
    }

    contextParts.push(`\n## Revision Request\n${prompt}`);

    console.log(`[AI] Revising project (framework=${targetFramework})...`);

    const system = buildReviseSystem(targetFramework, designSpec);

    const { object: rawParsed } = await generateStructuredObject({
        schema: RevisionResultSchema,
        system,
        prompt: contextParts.join("\n"),
        maxRetries: 2
    });

    if(rawParsed && Array.isArray(rawParsed.operations)){
        rawParsed.operations = rawParsed.operations.map((op)=>{
            if(!op || typeof op !== "object") return op;

            let opStr = String(op.op || op.type || "").trim().toLowerCase();

            if(["create", "add", "new"].includes(opStr)) op.op = "create";
            else if (["update", "edit", "modify", "patch"].includes(opStr)) op.op = "update";
            else if (["delete", "remove", "del", "rm"].includes(opStr)) op.op = "delete";

            if(op.path && typeof op.path === "string" && !op.path.startsWith("/")){
                op.path = "/" + op.path;
            }

            if (op.content) op.content = normalizeContent(op.content);
            if (op.search) op.search = normalizeContent(op.search);
            if (op.replace) op.replace = normalizeContent(op.replace);

            if (op.op === "create" && op.content){
                const validation = validateRevisionContent(op.content, op.path, "create", framework);
                op.content = validation.content;
                if(validation.warnings.length > 0){
                    console.log(`[Validator] Revision Create adjustments for ${op.path}:\n  - ${validation.warnings.join("\n  - ")}`);
                }
            }else if(op.op === "update" && op.content){
                const validation = validateRevisionContent(op.content, op.path, "create", framework);
                op.content = validation.content;
                if(validation.warnings.length > 0){
                    console.log(`[Validator] Revision Update (full content) adjustments for ${op.path}:\n  - ${validation.warnings.join("\n  - ")}`);
                }
            }else if(op.op === "update" && op.replace){
                 const validation = validateRevisionContent(op.replace, op.path, "update", framework);
                 op.replace = validation.content;
                 if(validation.warnings.length > 0){
                    console.log(`[Validator] Revision Update adjustments for ${op.path}:\n  - ${validation.warnings.join("\n  - ")}`);
                 }
            }
            return op;
        })
    }
    return rawParsed;
}

/**
 * Regenerates the full content of a file during project revisions when search/replace fails.
 * Avoids brittle exact-text diff matching and guarantees valid, working component code.
 */
export async function regenerateFileForRevision(filePath, currentCode, prompt, allFiles, designSpec, framework = null) {
    loadCraftworkSkill();
    const targetFramework = framework || (
        Object.keys(allFiles).some((p) => p === "/index.html" || p === "/script.js") ? "vanilla" : "react"
    );
    const plannedList = Object.keys(allFiles).map((p) => ({
        path: p,
        description: `Component/File ${p}`,
    }));

    const system = buildFileCodeSystem(plannedList, allFiles, designSpec, null, filePath, targetFramework);

    const userMsg = `Project Revision Request: ${prompt}

Write the complete updated code for: ${filePath}
Purpose: Apply the requested revisions to '${filePath}' while preserving the rest of the file's functionality, exports, and DesignSpec aesthetic.

Current code for reference:
\`\`\`javascript
${currentCode || ""}
\`\`\`

CRITICAL: Return the COMPLETE updated file code.
- If this is /App.js and dark mode is requested: ensure theme state is declared (const [darkMode, setDarkMode] = useState(false)), passed to <Navbar darkMode={darkMode} setDarkMode={setDarkMode} onToggleDarkMode={() => setDarkMode(prev => !prev)} />, and applied to the root wrapper so the whole page visibly updates.
- If this is /components/Navbar.js and dark mode is requested: ensure props (darkMode = false, setDarkMode = () => {}, onToggleDarkMode) have defensive defaults and clicking the toggle safely updates theme.`;

    const { object } = await generateStructuredObject({
        schema: FileCodeSchema,
        system,
        prompt: userMsg,
        maxRetries: 1,
    });

    let code = normalizeContent(object.code);
    const regFramework = (allFiles["/index.html"] && !allFiles["/App.js"] && !allFiles["/App.jsx"]) ? "vanilla" : "react";
    const validation = validateAndFixCode(code, filePath, {
        allPlannedFiles: plannedList,
        existingFiles: Object.keys(allFiles),
        framework: regFramework,
    });

    return validation.code;
}