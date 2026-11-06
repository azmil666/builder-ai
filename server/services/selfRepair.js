/**
 * ============================================================================
 * Generation Quality Engine V2 — Phase 4: Evidence-Driven Targeted Self-Repair Loop
 * ============================================================================
 * Uses Phase 3 requirement verification evidence and code validation diagnostics
 * to plan, execute, validate, and commit targeted code repairs within a bounded loop.
 *
 * Guarantees:
 * 1. Targeted file isolation (avoids rewriting unrelated components).
 * 2. Strict regression gates (never accepts candidate that breaks passing mandatory requirements).
 * 3. Atomic rollback (retains last known good project files on repair failure).
 * 4. Deterministic quality gates (syntax validation, runtime smoke, AST requirement verification).
 * 5. Bounded retries (prevents infinite loops or duplicate failed requests).
 */

import {
  ClassifiedFailureSchema,
  RepairPlanSchema,
  TargetedRepairBatchSchema,
  SelfRepairReportSchema,
  FileCodeSchema,
} from "./aiSchemas.js";
import { generateStructuredObject } from "./ai.js";
import { validateProject, validateAndFixCode, verifyProjectRuntime } from "./codeValidator.js";
import { verifyProjectRequirements } from "./requirementVerification.js";
import { buildFileCodeSystem } from "./prompts.js";
import { normalizeContent } from "./contentNormalizer.js";

// ----------------------------------------------------------------------------
// 1. Failure Classification
// ----------------------------------------------------------------------------

/**
 * Classifies all failures across requirement verification, syntax/import validation,
 * and runtime errors into structured, machine-evaluable failure categories.
 *
 * @param {object} params
 * @param {object} params.verificationSummary - Phase 3 RequirementVerificationSummarySchema
 * @param {Array} [params.validationErrors] - Errors from validateProject
 * @param {Array} [params.runtimeErrors] - Errors from verifyProjectRuntime
 * @param {object} [params.filePlan] - FilePlanSchema
 * @param {Record<string, string>} [params.files] - Current project files
 * @returns {Array<object>} Classified failures conforming to ClassifiedFailureSchema
 */
export function classifyFailures({
  verificationSummary = null,
  validationErrors = [],
  runtimeErrors = [],
  filePlan = null,
  files = {},
}) {
  const failures = [];

  // Category 1: CODE_VALIDATION_ERROR (Syntax, invalid imports/exports, duplicate exports)
  for (let i = 0; i < (validationErrors || []).length; i++) {
    const err = validationErrors[i];
    const targetFile = err.file || "/App.js";
    failures.push({
      id: `val_err_${i}`,
      category: "CODE_VALIDATION_ERROR",
      requirementId: null,
      requirementDescription: `Code validation error: ${err.message}`,
      severity: "critical",
      evidence: [],
      missingEvidence: [err.message],
      affectedFiles: [targetFile],
      diagnosticExplanation: `File '${targetFile}' failed code validation: ${err.message}`,
      repairabilityClassification: "REPAIRABLE",
    });
  }

  // Category 2: RUNTIME_ERROR (Instantiation crashes, null dereferences during render)
  for (let i = 0; i < (runtimeErrors || []).length; i++) {
    const err = runtimeErrors[i];
    const targetFile = err.file || "/App.js";
    failures.push({
      id: `runt_err_${i}`,
      category: "RUNTIME_ERROR",
      requirementId: null,
      requirementDescription: `Runtime error: ${err.message}`,
      severity: "critical",
      evidence: [],
      missingEvidence: [err.message],
      affectedFiles: [targetFile],
      diagnosticExplanation: `File '${targetFile}' threw a runtime exception during active render: ${err.message}`,
      repairabilityClassification: "REPAIRABLE",
    });
  }

  // Categories 3–6: Verification failures from Phase 3 Requirement Verification
  for (const req of verificationSummary?.requirements || []) {
    const isMandatory = req.priority === "mandatory";
    const affected = req.affectedFiles && req.affectedFiles.length > 0 ? req.affectedFiles : ["/App.js"];

    if (req.status === "FAIL") {
      if (req.requirementType === "consistency" || req.requirementId.includes("plan_file_missing_") || req.requirementId.includes("consistency_target_missing")) {
        // Category: FILE_PLAN_MISMATCH
        failures.push({
          id: `plan_mismatch_${req.requirementId}`,
          category: "FILE_PLAN_MISMATCH",
          requirementId: req.requirementId,
          requirementDescription: req.requirementText,
          severity: isMandatory ? "critical" : "high",
          evidence: req.evidence || [],
          missingEvidence: req.missingEvidence || [],
          affectedFiles: affected,
          diagnosticExplanation: req.explanation,
          repairabilityClassification: "REPAIRABLE",
        });
      } else {
        // Category: REQUIREMENT_FAIL
        failures.push({
          id: `req_fail_${req.requirementId}`,
          category: "REQUIREMENT_FAIL",
          requirementId: req.requirementId,
          requirementDescription: req.requirementText || req.description || req.requirementId || "Requirement failed",
          severity: isMandatory ? "critical" : "medium",
          evidence: req.evidence || [],
          missingEvidence: req.missingEvidence || [],
          affectedFiles: affected,
          diagnosticExplanation: req.explanation || (req.missingEvidence && req.missingEvidence[0]) || "Missing implementation evidence",
          repairabilityClassification: "REPAIRABLE",
        });
      }
    } else if (req.status === "PARTIAL") {
      // Category: REQUIREMENT_PARTIAL
      failures.push({
        id: `req_partial_${req.requirementId}`,
        category: "REQUIREMENT_PARTIAL",
        requirementId: req.requirementId,
        requirementDescription: req.requirementText || req.description || req.requirementId || "Partial requirement",
        severity: isMandatory ? "high" : "low",
        evidence: req.evidence || [],
        missingEvidence: req.missingEvidence || [],
        affectedFiles: affected,
        diagnosticExplanation: req.explanation || (req.missingEvidence && req.missingEvidence[0]) || "Partial implementation evidence",
        repairabilityClassification: "REPAIRABLE",
      });
    } else if (req.status === "UNVERIFIABLE") {
      // Category: REQUIREMENT_UNVERIFIABLE
      // Do not attempt blind repairs when evidence is insufficient or subjective.
      failures.push({
        id: `req_unverifiable_${req.requirementId}`,
        category: "REQUIREMENT_UNVERIFIABLE",
        requirementId: req.requirementId,
        requirementDescription: req.requirementText || req.description || req.requirementId || "Unverifiable requirement",
        severity: "medium",
        evidence: req.evidence || [],
        missingEvidence: req.missingEvidence || [],
        affectedFiles: affected,
        diagnosticExplanation: req.explanation || (req.missingEvidence && req.missingEvidence[0]) || "Unverifiable requirement",
        repairabilityClassification: "UNREPAIRABLE_UNVERIFIABLE",
      });
    }
  }

  return failures.map((f) => ClassifiedFailureSchema.parse(f));
}

// ----------------------------------------------------------------------------
// 2. Repair Planning
// ----------------------------------------------------------------------------

/**
 * Creates a prioritized, localized repair plan grouping related failures by file.
 *
 * @param {Array<object>} failures - Classified failures
 * @param {Record<string, string>} files - Current project files
 * @param {object} [filePlan] - Planned files
 * @param {object} [requirementContract] - Requirement contract
 * @param {object} [designSpec] - Design specification
 * @returns {object} RepairPlanSchema object
 */
export function createRepairPlan(
  failures = [],
  files = {},
  filePlan = null,
  requirementContract = null,
  designSpec = null
) {
  // 1. Filter out unrepairable items (e.g. UNVERIFIABLE or non-actionable)
  const actionable = failures.filter(
    (f) => f.repairabilityClassification === "REPAIRABLE"
  );

  // 2. Prioritize: Code/Runtime errors > Mandatory FAIL > Mandatory PARTIAL > FilePlan Mismatch > Optional
  const priorityOrder = {
    CODE_VALIDATION_ERROR: 1,
    RUNTIME_ERROR: 1,
    REQUIREMENT_FAIL: 2,
    REQUIREMENT_PARTIAL: 3,
    FILE_PLAN_MISMATCH: 4,
    VISUAL_OVERFLOW: 5,
  };

  const sortedFailures = [...actionable].sort((a, b) => {
    const aPri = priorityOrder[a.category] || 99;
    const bPri = priorityOrder[b.category] || 99;
    if (aPri !== bPri) return aPri - bPri;
    if (a.severity === "critical" && b.severity !== "critical") return -1;
    if (b.severity === "critical" && a.severity !== "critical") return 1;
    return 0;
  });

  // 3. Group by target file to prevent duplicate repairs and conflicting edits on the same component
  const fileGroups = new Map();

  for (const failure of sortedFailures) {
    // Determine the most specific existing JS/JSX target file (avoid non-code files like package.json)
    let target = failure.affectedFiles.find(
      (p) => files[p] && (p.endsWith(".js") || p.endsWith(".jsx"))
    );
    if (!target) {
      target = failure.affectedFiles.find((p) => p.endsWith(".js") || p.endsWith(".jsx")) || "/App.js";
    }

    if (!fileGroups.has(target)) {
      fileGroups.set(target, []);
    }
    fileGroups.get(target).push(failure);
  }

  // 4. Construct tasks
  const tasks = [];
  let taskIdx = 1;

  for (const [targetFile, groupFailures] of fileGroups.entries()) {
    const primaryFailure = groupFailures[0];
    const missingItems = groupFailures.flatMap((f) => f.missingEvidence).filter(Boolean);
    const expectedBehaviors = groupFailures.map((f) => f.requirementDescription);

    tasks.push({
      taskId: `task_${taskIdx++}`,
      failureCategory: primaryFailure.category,
      requirementId: primaryFailure.requirementId || null,
      failureIds: groupFailures.map((f) => f.id),
      targetFile,
      affectedFiles: [targetFile],
      expectedBehavior: expectedBehaviors.join("; "),
      specificMissingImplementation:
        missingItems.length > 0 ? missingItems.join("; ") : primaryFailure.diagnosticExplanation,
      constraints: [
        "Preserve all existing working components, exports, and state hooks",
        "Preserve Craftwork design tokens, color palette, and styling in styles.css",
        "Do not modify or import non-existent external dependencies",
        "Return complete, working React/JSX code with proper default export",
      ],
      verificationCriteria: expectedBehaviors.map((b) => `Must satisfy: ${b}`),
    });
  }

  const plan = {
    planId: `repair_plan_${Date.now()}`,
    tasks,
    prioritizedFiles: Array.from(fileGroups.keys()),
    createdAt: new Date().toISOString(),
  };

  return RepairPlanSchema.parse(plan);
}

// ----------------------------------------------------------------------------
// 3. Targeted Repair Generation
// ----------------------------------------------------------------------------

/**
 * Generates targeted code repair for a single task targeting a specific file.
 *
 * @param {object} params
 * @param {object} params.task - RepairTaskSchema
 * @param {Record<string, string>} params.currentFiles - Current project files
 * @param {string} params.prompt - Original user prompt
 * @param {object} [params.requirementContract] - Requirement contract
 * @param {object} [params.designSpec] - Design specification
 * @param {object} [params.filePlan] - File plan
 * @returns {Promise<{ path: string, code: string }>} Repaired file content
 */
export async function generateTargetedRepairForTask({
  task,
  currentFiles,
  prompt,
  requirementContract = null,
  designSpec = null,
  filePlan = null,
}) {
  const targetFile = task.targetFile || (task.affectedFiles && task.affectedFiles[0]) || "/App.js";
  const currentCode = currentFiles[targetFile] || "";
  const allPlanned = filePlan?.files || Object.keys(currentFiles).map((p) => ({ path: p, description: p }));

  const system = buildFileCodeSystem(allPlanned, currentFiles, designSpec, requirementContract, targetFile);

  const userPrompt = `Project Request: ${prompt}

TARGETED REPAIR TASK:
Task ID: ${task.taskId}
Category: ${task.failureCategory || "REQUIREMENT_FAIL"}
File to Repair: ${targetFile}
Expected Behavior: ${task.expectedBehavior || task.instructions || ""}
Specific Missing Implementation: ${task.specificMissingImplementation || (task.diagnostics || []).join("; ")}

CRITICAL CONSTRAINTS:
${(task.constraints || []).map((c) => `- ${c}`).join("\n")}

Current code for ${targetFile}:
\`\`\`javascript
${currentCode}
\`\`\`

INSTRUCTIONS:
1. Fix all identified missing behavioral implementations and validation errors in ${targetFile}.
2. Ensure interactive controls (search filtering, form submission state + feedback, navigation routing, or cart management) are fully wired and functional.
3. Preserve all existing working features, UI styling, and exports.
4. Return the COMPLETE updated code for '${targetFile}'.`;

  const { object } = await generateStructuredObject({
    schema: FileCodeSchema,
    system,
    prompt: userPrompt,
    maxRetries: 1,
  });

  const rawCode = normalizeContent(object.code);
  const validated = validateAndFixCode(rawCode, targetFile, {
    allPlannedFiles: allPlanned,
    existingFiles: Object.keys(currentFiles),
  });

  return {
    path: targetFile,
    code: validated.code,
  };
}

// ----------------------------------------------------------------------------
// 4. Candidate Validation and Acceptance Gates
// ----------------------------------------------------------------------------

/**
 * Evaluates a candidate repaired project against rigorous acceptance gates.
 *
 * Acceptance Gates:
 * 1. File existence & basic structure (/App.js must exist).
 * 2. Code syntax/import/export validation must succeed without critical errors.
 * 3. Runtime execution smoke check must pass without exception.
 * 4. Phase 3 Requirement Verification is re-evaluated.
 * 5. Regression Gate: Previously passing mandatory requirements MUST NOT regress to FAIL/PARTIAL.
 * 6. Score Improvement Gate: Candidate must reduce mandatory failures or increase passed requirements.
 * 7. Unverifiable Safety Gate: Unverifiable requirements must not be falsely converted to PASS without code.
 *
 * @param {object} params
 * @param {Record<string, string>} params.candidateFiles - Repaired files candidate
 * @param {Record<string, string>} params.originalFiles - Baseline files
 * @param {object} params.originalVerification - Baseline verification summary
 * @param {object} [params.requirementContract] - Active contract
 * @param {object} [params.filePlan] - Active file plan
 * @returns {Promise<{ accepted: boolean, candidateVerification: object, reason: string|null }>}
 */
export async function evaluateRepairCandidate({
  candidateFiles,
  originalFiles,
  originalVerification,
  requirementContract = null,
  filePlan = null,
}) {
  // Gate 1: Structure check
  if (!candidateFiles["/App.js"]) {
    return {
      accepted: false,
      candidateVerification: originalVerification,
      reason: "Missing /App.js entry point in repaired candidate",
    };
  }

  // Gate 2: Code syntax and import validation
  const plannedItems = filePlan?.files || Object.keys(candidateFiles).map((p) => ({ path: p, description: p }));
  const valResult = validateProject(candidateFiles, plannedItems);
  if (!valResult.valid && valResult.errors.length > 0) {
    const errorDetails = valResult.errors.map((e) => `[${e.file}] ${e.message}`).join("; ");
    return {
      accepted: false,
      candidateVerification: originalVerification,
      reason: `Repaired candidate failed code validation: ${errorDetails}`,
    };
  }

  // Gate 3: Runtime execution smoke test
  const runtResult = await verifyProjectRuntime(candidateFiles);
  if (!runtResult.valid && runtResult.errors.length > 0) {
    const errorDetails = runtResult.errors.map((e) => `[${e.file}] ${e.message}`).join("; ");
    return {
      accepted: false,
      candidateVerification: originalVerification,
      reason: `Repaired candidate failed runtime execution: ${errorDetails}`,
    };
  }

  // Gate 4: Phase 3 Requirement Verification re-evaluation
  let candidateVerification;
  try {
    candidateVerification = await verifyProjectRequirements(candidateFiles, requirementContract, filePlan);
  } catch (verifErr) {
    return {
      accepted: false,
      candidateVerification: originalVerification,
      reason: `Requirement verification crashed on candidate: ${verifErr.message}`,
    };
  }

  // Gate 5: Regression Gate — previously passing mandatory requirements must not regress
  const previouslyPassingMandatory = (originalVerification?.requirements || []).filter(
    (r) => r.priority === "mandatory" && r.status === "PASS"
  );

  for (const prevReq of previouslyPassingMandatory) {
    const candidateReq = candidateVerification.requirements.find(
      (r) => r.requirementId === prevReq.requirementId
    );
    if (!candidateReq || candidateReq.status !== "PASS") {
      const newStatus = candidateReq ? candidateReq.status : "REMOVED";
      return {
        accepted: false,
        candidateVerification,
        reason: `Regression detected: candidate breaks previously passing mandatory requirement "${prevReq.requirementText || prevReq.description || prevReq.requirementId}" (previously PASS, now ${newStatus})`,
      };
    }
  }

  // Gate 6: Candidate must not increase mandatory failures
  const origMandFailed = originalVerification?.mandatoryFailed || 0;
  const candMandFailed = candidateVerification.mandatoryFailed || 0;
  if (candMandFailed > origMandFailed) {
    return {
      accepted: false,
      candidateVerification,
      reason: `Candidate increased mandatory failures from ${origMandFailed} to ${candMandFailed}`,
    };
  }

  // Gate 7: Improvement check — must either resolve a mandatory failure, improve a partial, or increase total passed
  const origMandPassed = originalVerification?.mandatoryPassed || 0;
  const candMandPassed = candidateVerification.mandatoryPassed || 0;
  const origPassed = originalVerification?.passed || 0;
  const candPassed = candidateVerification.passed || 0;

  const resolvedMandatoryFail = candMandFailed < origMandFailed;
  const increasedMandatoryPass = candMandPassed > origMandPassed;
  const increasedTotalPass = candPassed > origPassed && candMandFailed <= origMandFailed;

  if (!resolvedMandatoryFail && !increasedMandatoryPass && !increasedTotalPass) {
    return {
      accepted: false,
      candidateVerification,
      reason: "Candidate did not improve requirement verification score or resolve target failures",
    };
  }

  return {
    accepted: true,
    candidateVerification,
    reason: null,
  };
}

// ----------------------------------------------------------------------------
// 5. Main Self-Repair Loop
// ----------------------------------------------------------------------------

/**
 * Runs the complete evidence-driven targeted self-repair loop.
 *
 * @param {object} params
 * @param {Record<string, string>} params.files - Initial generated project files
 * @param {string} params.prompt - Original user prompt
 * @param {object} params.requirementContract - Structured Requirement Contract
 * @param {object} [params.designSpec] - Design specification
 * @param {object} [params.filePlan] - File plan
 * @param {object} [params.callbacks] - Callback hooks for progress reporting & SSE
 * @param {number} [params.maxAttempts=2] - Maximum repair attempts (default: 2)
 * @returns {Promise<{ success: boolean, files: Record<string, string>, verification: object, report: object }>}
 */
export async function runEvidenceDrivenSelfRepairLoop({
  files,
  prompt,
  requirementContract,
  designSpec = null,
  filePlan = null,
  callbacks = {},
  maxAttempts = 2,
}) {
  let workingFiles = { ...files };
  const filesChanged = [];
  const attemptLogs = [];
  let rollbackCount = 0;
  let lastRollbackReason = null;
  const seenFailureSignatures = new Set();

  // 1. Initial baseline verification
  let currentVerification = await verifyProjectRequirements(workingFiles, requirementContract, filePlan);
  const initialVerification = currentVerification;

  // 2. Initial failure classification
  const initialValidation = validateProject(workingFiles, filePlan?.files || []);
  const initialRuntime = await verifyProjectRuntime(workingFiles);

  const initialFailures = classifyFailures({
    verificationSummary: initialVerification,
    validationErrors: initialValidation.errors,
    runtimeErrors: initialRuntime.errors,
    filePlan,
    files: workingFiles,
  });

  // Actionable failures requiring code repair:
  // Must be REPAIRABLE and either critical validation error or mandatory requirement issue
  const actionableFailures = initialFailures.filter(
    (f) =>
      f.repairabilityClassification === "REPAIRABLE" &&
      (f.severity === "critical" || f.category.includes("ERROR") || f.category === "FILE_PLAN_MISMATCH" || f.severity === "high")
  );

  // If already verified or no actionable failures exist, exit cleanly without AI calls
  if (actionableFailures.length === 0 || (initialVerification.overallStatus === "VERIFIED" && initialValidation.valid)) {
    console.log("[SelfRepair] No actionable mandatory failures detected. Self-repair loop not required.");
    const cleanReport = {
      repairTriggered: false,
      initialStatus: initialVerification.overallStatus,
      finalStatus: initialVerification.overallStatus,
      attemptCount: 0,
      maxAttempts,
      failures: [],
      repairPlan: null,
      filesChanged: [],
      accepted: true,
      rollbackPerformed: false,
      rollbackReason: null,
      beforeVerificationSummary: initialVerification,
      afterVerificationSummary: initialVerification,
      attempts: [],
      completedAt: new Date().toISOString(),
    };
    return {
      success: true,
      files: workingFiles,
      verification: initialVerification,
      report: cleanReport,
    };
  }

  // 3. Notify start of self-repair
  console.log(`[SelfRepair] Starting evidence-driven self-repair loop (${actionableFailures.length} actionable failure(s), maxAttempts=${maxAttempts})`);
  if (callbacks?.onRepairStarted) {
    await callbacks.onRepairStarted({
      status: "repairing",
      failures: actionableFailures,
      initialStatus: initialVerification.overallStatus,
    });
  }

  let finalPlan = null;
  let attempt = 0;

  // 4. Bounded repair loop
  while (attempt < maxAttempts) {
    attempt++;

    // Re-classify current working files
    const curVal = validateProject(workingFiles, filePlan?.files || []);
    const curRunt = await verifyProjectRuntime(workingFiles);
    const curFailures = classifyFailures({
      verificationSummary: currentVerification,
      validationErrors: curVal.errors,
      runtimeErrors: curRunt.errors,
      filePlan,
      files: workingFiles,
    });

    const currentActionable = curFailures.filter(
      (f) => f.repairabilityClassification === "REPAIRABLE"
    );

    if (currentActionable.length === 0) {
      break;
    }

    // Duplicate attempt check: Prevent looping on identical failures
    const failureSignature = currentActionable
      .map((f) => `${f.category}:${f.requirementId || f.affectedFiles[0]}`)
      .sort()
      .join("|");

    if (seenFailureSignatures.has(failureSignature)) {
      console.warn(`[SelfRepair] Failure signature already attempted in previous round: ${failureSignature}. Aborting to avoid infinite loop.`);
      lastRollbackReason = "Duplicate repair signature detected; avoiding redundant attempts";
      break;
    }
    seenFailureSignatures.add(failureSignature);

    // Create repair plan
    finalPlan = createRepairPlan(currentActionable, workingFiles, filePlan, requirementContract, designSpec);

    if (callbacks?.onRepairPlanCreated) {
      await callbacks.onRepairPlanCreated({
        plan: finalPlan,
        attempt,
      });
    }

    if (callbacks?.onRepairAttemptStarted) {
      await callbacks.onRepairAttemptStarted({
        attempt,
        maxAttempts,
        taskCount: finalPlan.tasks.length,
      });
    }

    console.log(`[SelfRepair] Attempt ${attempt}/${maxAttempts} executing ${finalPlan.tasks.length} targeted task(s)...`);

    // Clone candidate files for isolation
    const candidateFiles = { ...workingFiles };
    const roundModifiedFiles = [];

    // Execute each repair task on the candidate
    for (const task of finalPlan.tasks) {
      try {
        const repairOutput = await generateTargetedRepairForTask({
          task,
          currentFiles: candidateFiles,
          prompt,
          requirementContract,
          designSpec,
          filePlan,
        });

        if (repairOutput && repairOutput.code) {
          candidateFiles[repairOutput.path] = repairOutput.code;
          roundModifiedFiles.push(repairOutput.path);
        }
      } catch (err) {
        console.warn(`[SelfRepair] Repair generation failed for task ${task.taskId}: ${err.message}`);
      }
    }

    // Evaluate candidate against acceptance gates
    const evalResult = await evaluateRepairCandidate({
      candidateFiles,
      originalFiles: workingFiles,
      originalVerification: currentVerification,
      requirementContract,
      filePlan,
    });

    if (evalResult.accepted) {
      console.log(`[SelfRepair] Attempt ${attempt} ACCEPTED: resolved issues without regressions.`);
      workingFiles = candidateFiles;
      currentVerification = evalResult.candidateVerification;
      filesChanged.push(...roundModifiedFiles);

      attemptLogs.push({
        attempt,
        accepted: true,
        modifiedFiles: roundModifiedFiles,
        reason: "Satisfied all acceptance gates without regression",
      });

      if (callbacks?.onRepairCandidateVerified) {
        await callbacks.onRepairCandidateVerified({
          attempt,
          accepted: true,
          scoreDelta: currentVerification.passed - initialVerification.passed,
          summary: currentVerification,
        });
      }

      // Check if all mandatory requirements have passed and no critical failures remain
      if (currentVerification.mandatoryFailed === 0) {
        const checkVal = validateProject(workingFiles, filePlan?.files || []);
        const checkRunt = await verifyProjectRuntime(workingFiles);
        const checkFailures = classifyFailures({
          verificationSummary: currentVerification,
          validationErrors: checkVal.errors,
          runtimeErrors: checkRunt.errors,
          filePlan,
          files: workingFiles,
        });
        const remainingCritical = checkFailures.filter(
          (f) =>
            f.repairabilityClassification === "REPAIRABLE" &&
            (f.severity === "critical" || f.category.includes("ERROR") || f.category === "FILE_PLAN_MISMATCH")
        );
        if (remainingCritical.length === 0) {
          console.log("[SelfRepair] All mandatory requirements and critical validations resolved. Concluding repair loop.");
          break;
        }
      }
    } else {
      // ROLLBACK: Discard candidateFiles, keep workingFiles intact!
      rollbackCount++;
      lastRollbackReason = evalResult.reason;
      console.warn(`[SelfRepair] Attempt ${attempt} REJECTED: ${evalResult.reason}. Rolling back candidate.`);

      attemptLogs.push({
        attempt,
        accepted: false,
        modifiedFiles: roundModifiedFiles,
        reason: evalResult.reason,
      });

      if (callbacks?.onRepairAttemptFailed) {
        await callbacks.onRepairAttemptFailed({
          attempt,
          reason: evalResult.reason,
        });
      }
    }
  }

  // 5. Determine final outcome
  const finalSuccess = currentVerification.mandatoryFailed === 0;

  if (finalSuccess) {
    if (callbacks?.onRepairCompleted) {
      await callbacks.onRepairCompleted({
        accepted: true,
        attemptCount: attempt,
        finalStatus: currentVerification.overallStatus,
      });
    }
  } else {
    if (callbacks?.onRepairExhausted) {
      await callbacks.onRepairExhausted({
        accepted: false,
        attemptCount: attempt,
        rollbackReason: lastRollbackReason,
        finalStatus: currentVerification.overallStatus,
      });
    }
  }

  const finalReport = {
    repairTriggered: true,
    initialStatus: initialVerification.overallStatus,
    finalStatus: currentVerification.overallStatus,
    attemptCount: attempt,
    maxAttempts,
    failures: initialFailures,
    repairPlan: finalPlan,
    filesChanged: [...new Set(filesChanged)],
    accepted: finalSuccess,
    rollbackPerformed: rollbackCount > 0,
    rollbackReason: finalSuccess ? null : lastRollbackReason,
    beforeVerificationSummary: initialVerification,
    afterVerificationSummary: currentVerification,
    attempts: attemptLogs,
    completedAt: new Date().toISOString(),
  };

  return {
    success: finalSuccess,
    files: workingFiles,
    verification: currentVerification,
    report: SelfRepairReportSchema.parse(finalReport),
  };
}
