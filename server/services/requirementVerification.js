import {
  RequirementVerificationSummarySchema,
  RequirementVerificationItemSchema,
  AiVerificationBatchSchema,
} from "./aiSchemas.js";
import { parseModuleAst } from "./codeValidator.js";
import { generateStructuredObject } from "./ai.js";

/**
 * ============================================================================
 * Generation Quality Engine V2 — Phase 3: Evidence-Based Requirement Verification
 * ============================================================================
 * Inspects generated React code for concrete implementation evidence rather
 * than lexical presence alone. Evaluates across 4 distinct evidence layers:
 * Layer A: File and Component Evidence
 * Layer B: Functional Implementation Evidence (Search, Forms, Nav, Cart, Filters)
 * Layer C: Design and Responsive Evidence
 * Layer D: Contract and FilePlan Consistency
 */

// ----------------------------------------------------------------------------
// Static Code & AST Analysis Helpers
// ----------------------------------------------------------------------------

/**
 * Traverses an AST node recursively, calling visitor callback for each node.
 */
function traverseAst(node, visitor, parent = null) {
  if (!node || typeof node !== "object") return;
  visitor(node, parent);
  for (const key of Object.keys(node)) {
    if (key === "parent") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object") {
          traverseAst(item, visitor, node);
        }
      }
    } else if (child && typeof child === "object") {
      traverseAst(child, visitor, node);
    }
  }
}

/**
 * Recursively collects identifier names from an AST node, avoiding non-computed property keys.
 */
function collectNodeIdentifiers(node, ids = new Set()) {
  if (!node || typeof node !== "object") return ids;
  if (node.type === "Identifier" && typeof node.name === "string") {
    ids.add(node.name);
  }
  for (const key of Object.keys(node)) {
    if (key === "parent") continue;
    // Don't treat non-computed member expression property names as free identifiers
    if (node.type === "MemberExpression" && key === "property" && !node.computed) continue;
    // Don't treat object property keys as free identifiers unless computed
    if (node.type === "Property" && key === "key" && !node.computed) continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object") collectNodeIdentifiers(item, ids);
      }
    } else if (child && typeof child === "object") {
      collectNodeIdentifiers(child, ids);
    }
  }
  return ids;
}

/**
 * Recursively collects property access names (e.g. item.price -> 'price') from an AST node.
 */
function collectNodePropertyAccesses(node, props = new Set()) {
  if (!node || typeof node !== "object") return props;
  if (node.type === "MemberExpression") {
    if (node.property?.type === "Identifier" && node.property?.name) {
      props.add(node.property.name);
    } else if (node.property?.type === "Literal" && typeof node.property?.value === "string") {
      props.add(node.property.value);
    }
  }
  for (const key of Object.keys(node)) {
    if (key === "parent") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object") collectNodePropertyAccesses(item, props);
      }
    } else if (child && typeof child === "object") {
      collectNodePropertyAccesses(child, props);
    }
  }
  return props;
}

/**
 * Inspects a function handler node (ArrowFunctionExpression, FunctionExpression, FunctionDeclaration)
 * to evaluate whether it performs meaningful form submission behavior and triggers feedback.
 */
function analyzeHandlerNode(fnNode) {
  const result = {
    hasPreventDefault: false,
    hasStopPropagation: false,
    calledFunctions: [],
    mutatedStates: [],
    hasFeedbackCall: false,
    hasDataCollection: false,
    isMeaningful: false,
  };

  if (!fnNode || typeof fnNode !== "object") return result;

  traverseAst(fnNode, (node) => {
    if (node.type === "CallExpression") {
      const calleeName = node.callee?.name || "";
      const memberProp = node.callee?.property?.name || "";
      const memberObj = node.callee?.object?.name || "";

      if (memberProp === "preventDefault") {
        result.hasPreventDefault = true;
      } else if (memberProp === "stopPropagation") {
        result.hasStopPropagation = true;
      } else if (calleeName.startsWith("set") || memberProp.startsWith("set")) {
        const setterName = calleeName || memberProp;
        result.mutatedStates.push(setterName);
        result.calledFunctions.push(setterName);
      } else if (calleeName === "dispatch" || memberProp === "dispatch") {
        result.mutatedStates.push("dispatch");
        result.calledFunctions.push("dispatch");
      } else if (
        calleeName === "alert" ||
        calleeName === "toast" ||
        memberProp === "alert" ||
        memberProp === "toast" ||
        memberProp === "success" ||
        memberProp === "error"
      ) {
        result.hasFeedbackCall = true;
        result.calledFunctions.push(calleeName || `${memberObj}.${memberProp}`);
      } else if (calleeName === "fetch" || memberProp === "post" || memberProp === "send") {
        result.calledFunctions.push(calleeName || `${memberObj}.${memberProp}`);
      } else {
        const fullCall = calleeName || (memberProp ? `${memberObj}.${memberProp}` : "call");
        result.calledFunctions.push(fullCall);
      }
    } else if (node.type === "NewExpression") {
      if (node.callee?.name === "FormData") {
        result.hasDataCollection = true;
      }
    } else if (node.type === "AssignmentExpression") {
      result.isMeaningful = true;
    }
  });

  // A handler is meaningful if it does anything beyond preventDefault / stopPropagation
  const meaningfulCalls = result.calledFunctions.filter(
    (c) => !c.includes("preventDefault") && !c.includes("stopPropagation")
  );

  result.isMeaningful =
    meaningfulCalls.length > 0 ||
    result.mutatedStates.length > 0 ||
    result.hasFeedbackCall ||
    result.hasDataCollection;

  return result;
}

/**
 * Analyzes a single JavaScript/JSX file, extracting concrete AST artifacts:
 * - imports / exports
 * - state hooks (useState, useReducer, custom hooks)
 * - JSX elements and their attributes
 * - CallExpressions (.filter, .map, .reduce, etc.) with detailed callback inspection
 * - Event handler attributes (onSubmit, onChange, onClick, etc.) with AST body inspection
 * - Computed member expressions, switch statements, and conditional expressions
 */
export async function analyzeFileCode(filePath, code, options = {}) {
  const analysis = {
    filePath,
    rawCode: code || "",
    hasParseError: false,
    parseErrorMessage: null,
    astFallback: false,
    parseWarning: null,
    imports: [],
    exports: [],
    stateHooks: [], // e.g. { name: 'query', setter: 'setQuery', type: 'useState' }
    jsxElements: [], // e.g. { tag: 'input', attributes: { type: 'search', value: ... } }
    callExpressions: [], // e.g. 'filter', 'reduce'
    detailedCalls: [], // rich call info
    eventHandlers: [], // legacy format
    detailedEventHandlers: [], // handler info with AST analysis
    functionDefinitions: {}, // map fnName -> AST node
    derivedVariables: {}, // map varName -> Set of referenced identifiers
    computedMemberExpressions: [], // e.g. { object: 'TABS', property: 'activeTab' }
    switchStatements: [], // e.g. { discriminant: 'activeTab', casesCount: 3 }
    conditionalExpressions: [], // test expressions for ternary/conditionals
    reducers: [], // e.g. { state: 'cartState', dispatch: 'dispatch' }
    customHookCalls: [], // e.g. { hookName: 'useCart', vars: [...] }
    cssClasses: new Set(),
  };

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return analysis;
  }

  // Extract Tailwind / CSS classes from raw code (broad heuristic to support Layer C)
  const classMatches = code.match(/className\s*=\s*["'`]([^"'`]+)["'`]|className\s*=\s*{([^}]+)}/g) || [];
  for (const m of classMatches) {
    const rawVal = m.replace(/^className\s*=\s*["'`{]?/, "").replace(/["'`}]?$/, "");
    for (const cls of rawVal.split(/\s+/)) {
      if (cls) analysis.cssClasses.add(cls);
    }
  }

  // Parse AST
  if (options.parserAvailable === false) {
    analysis.hasParseError = true;
    analysis.parseErrorMessage = "Parser unavailable";
    return analysis;
  }

  try {
    const ast = await parseModuleAst(code, filePath);
    if (!ast || ast.fallback) {
      analysis.astFallback = true;
      analysis.parseWarning = "AST parser fallback invoked";
      if (options.failOnFallback) {
        analysis.hasParseError = true;
        analysis.parseErrorMessage = "AST parser fallback invoked";
      }
      return analysis;
    }

    traverseAst(ast, (node) => {
      // 1. Imports
      if (node.type === "ImportDeclaration") {
        analysis.imports.push({
          source: node.source?.value || "",
          specifiers: (node.specifiers || []).map((s) => s.local?.name || s.imported?.name || ""),
        });
      }

      // 2. Exports
      if (node.type === "ExportDefaultDeclaration") {
        analysis.exports.push("default");
      }
      if (node.type === "ExportNamedDeclaration") {
        if (node.declaration?.id?.name) {
          analysis.exports.push(node.declaration.id.name);
        }
      }

      // 2b. Function declarations
      if (node.type === "FunctionDeclaration" && node.id?.name) {
        analysis.functionDefinitions[node.id.name] = node;
      }

      // 3. Variable declarations (useState, useReducer, custom hooks, handlers, derived vars)
      if (node.type === "VariableDeclarator" && node.id) {
        if (node.id.name) {
          if (node.init?.type === "ArrowFunctionExpression" || node.init?.type === "FunctionExpression") {
            analysis.functionDefinitions[node.id.name] = node.init;
          }
          if (node.init) {
            analysis.derivedVariables[node.id.name] = collectNodeIdentifiers(node.init);
          }
        }

        // Array destructuring: const [val, setVal] = useState(...) or useReducer(...)
        if (node.id.type === "ArrayPattern" && node.init?.type === "CallExpression") {
          const calleeName = node.init.callee?.name || node.init.callee?.property?.name;
          if (calleeName === "useState") {
            const varName = node.id.elements?.[0]?.name;
            const setterName = node.id.elements?.[1]?.name;
            if (varName) {
              analysis.stateHooks.push({
                name: varName,
                setter: setterName || null,
                type: "useState",
              });
            }
          } else if (calleeName === "useReducer") {
            const stateName = node.id.elements?.[0]?.name;
            const dispatchName = node.id.elements?.[1]?.name;
            if (stateName) {
              analysis.stateHooks.push({
                name: stateName,
                setter: dispatchName || null,
                type: "useReducer",
              });
              analysis.reducers.push({
                state: stateName,
                dispatch: dispatchName || "dispatch",
              });
            }
          } else if (
            calleeName &&
            calleeName.startsWith("use") &&
            !["useEffect", "useMemo", "useCallback", "useRef", "useContext", "useId"].includes(calleeName)
          ) {
            const varName = node.id.elements?.[0]?.name;
            const setterName = node.id.elements?.[1]?.name;
            if (varName) {
              analysis.stateHooks.push({
                name: varName,
                setter: setterName || null,
                type: "customHook",
                hookName: calleeName,
              });
              analysis.customHookCalls.push({ hookName: calleeName, boundVars: [varName] });
            }
          }
        }

        // Object destructuring: const { cart, addToCart } = useCart()
        if (node.id.type === "ObjectPattern" && node.init?.type === "CallExpression") {
          const calleeName = node.init.callee?.name || node.init.callee?.property?.name;
          if (
            calleeName &&
            calleeName.startsWith("use") &&
            !["useEffect", "useMemo", "useCallback", "useRef", "useContext", "useId"].includes(calleeName)
          ) {
            const boundVars = [];
            for (const prop of node.id.properties || []) {
              const propName = prop.value?.name || prop.key?.name;
              if (propName) {
                boundVars.push(propName);
                analysis.stateHooks.push({
                  name: propName,
                  setter:
                    boundVars.find((v) => v.startsWith("set") || v.startsWith("add") || v.startsWith("remove")) ||
                    "customHook",
                  type: "customHook",
                  hookName: calleeName,
                });
              }
            }
            analysis.customHookCalls.push({ hookName: calleeName, boundVars });
          }
        }

        // Single identifier from custom hook: const cart = useCart()
        if (node.id.type === "Identifier" && node.init?.type === "CallExpression") {
          const calleeName = node.init.callee?.name || node.init.callee?.property?.name;
          if (
            calleeName &&
            calleeName.startsWith("use") &&
            !["useEffect", "useMemo", "useCallback", "useRef", "useContext", "useId"].includes(calleeName)
          ) {
            analysis.stateHooks.push({
              name: node.id.name,
              setter: "customHook",
              type: "customHook",
              hookName: calleeName,
            });
            analysis.customHookCalls.push({ hookName: calleeName, boundVars: [node.id.name] });
          }
        }
      }

      // 4. CallExpressions (e.g. .filter, .reduce, .map)
      if (node.type === "CallExpression") {
        if (node.callee?.type === "MemberExpression") {
          const propName = node.callee.property?.name;
          const calleeObj =
            node.callee.object?.name || (node.callee.object?.type === "CallExpression" ? "chained" : null);
          if (propName) {
            analysis.callExpressions.push(propName);
            analysis.detailedCalls.push({
              method: propName,
              calleeObject: calleeObj,
              calleeNode: node.callee,
              callbackNode: node.arguments?.[0] || null,
              callbackIdentifiers: collectNodeIdentifiers(node.arguments?.[0]),
              callbackProperties: collectNodePropertyAccesses(node.arguments?.[0]),
              node,
            });
          }
        }
      }

      // 4b. Computed Member Expressions (e.g. TABS[activeTab], VIEWS[currentView])
      if (node.type === "MemberExpression" && node.computed) {
        const objName = node.object?.name;
        const propName = node.property?.name;
        if (objName && propName) {
          analysis.computedMemberExpressions.push({ object: objName, property: propName });
        }
      }

      // 4c. Switch Statements (e.g. switch(activeTab) { ... })
      if (node.type === "SwitchStatement") {
        const discName = node.discriminant?.name;
        if (discName) {
          analysis.switchStatements.push({
            discriminant: discName,
            casesCount: (node.cases || []).length,
          });
        }
      }

      // 4d. Conditional & Logical Expressions (for feedback checks and view switches)
      if (node.type === "ConditionalExpression" || node.type === "LogicalExpression") {
        const testNode = node.type === "ConditionalExpression" ? node.test : node.left;
        const testIds = collectNodeIdentifiers(testNode);
        analysis.conditionalExpressions.push({ testIds: Array.from(testIds), node });
      }

      // 5. JSX Elements & Attributes
      if (node.type === "JSXElement" || node.type === "JSXOpeningElement") {
        const opening = node.type === "JSXElement" ? node.openingElement : node;
        const tagName = opening?.name?.name || opening?.name?.property?.name || "unknown";
        const attrMap = {};

        for (const attr of opening?.attributes || []) {
          if (attr.type === "JSXAttribute" && attr.name?.name) {
            const attrName = attr.name.name;
            let attrVal = true;
            let handlerNode = null;
            let handlerName = null;

            if (attr.value) {
              if (attr.value.type === "Literal" || attr.value.type === "StringLiteral") {
                attrVal = attr.value.value;
              } else if (attr.value.type === "JSXExpressionContainer") {
                const expr = attr.value.expression;
                attrVal = expr?.name || expr?.type || "expression";
                if (expr?.type === "ArrowFunctionExpression" || expr?.type === "FunctionExpression") {
                  handlerNode = expr;
                } else if (expr?.type === "Identifier") {
                  handlerName = expr.name;
                }
              }
            }
            attrMap[attrName] = attrVal;

            if (attrName.startsWith("on") && attrName.length > 2) {
              analysis.eventHandlers.push({
                event: attrName,
                tag: tagName,
                val: attrVal,
              });
              analysis.detailedEventHandlers.push({
                event: attrName,
                tag: tagName,
                handlerName,
                handlerNode,
                attrVal,
              });
            }
          }
        }

        analysis.jsxElements.push({
          tag: tagName,
          attributes: attrMap,
        });
      }
    });

    // Post-traversal resolution of handler bodies
    for (const h of analysis.detailedEventHandlers) {
      if (!h.handlerNode && h.handlerName && analysis.functionDefinitions[h.handlerName]) {
        h.handlerNode = analysis.functionDefinitions[h.handlerName];
      }
      if (h.handlerNode) {
        h.summary = analyzeHandlerNode(h.handlerNode);
      } else {
        h.summary = { isMeaningful: false, mutatedStates: [], hasFeedbackCall: false, calledFunctions: [] };
      }
    }
  } catch (err) {
    analysis.hasParseError = true;
    analysis.parseErrorMessage = err.message;
  }

  return analysis;
}

/**
 * Builds an analysis map for all project files.
 */
export async function buildProjectAnalysisMap(files = {}, options = {}) {
  const map = {};
  for (const [p, code] of Object.entries(files)) {
    const content = typeof code === "string" ? code : code?.content || "";
    map[p] = await analyzeFileCode(p, content, options);
  }

  // Cross-file custom hook verification
  for (const [p, analysis] of Object.entries(map)) {
    for (const hookCall of analysis.customHookCalls || []) {
      const hookName = hookCall.hookName;
      let hookDefFound = false;
      let hookHasState = false;
      for (const [otherPath, otherAnalysis] of Object.entries(map)) {
        if (otherAnalysis.functionDefinitions[hookName] || otherAnalysis.exports.includes(hookName)) {
          hookDefFound = true;
          if (otherAnalysis.stateHooks.length > 0 || otherAnalysis.reducers.length > 0) {
            hookHasState = true;
          }
          break;
        }
      }
      hookCall.verified = hookDefFound && hookHasState;
    }
  }

  return map;
}

// ----------------------------------------------------------------------------
// Layer A — File and Component Evidence
// ----------------------------------------------------------------------------

export function verifyFileAndComponentEvidence(contract, files, plan, analysisMap) {
  const items = [];
  const allPaths = Object.keys(files || {});
  const appAnalysis = analysisMap["/App.js"];
  const appImports = appAnalysis?.imports?.map((i) => i.source) || [];

  // Check 1: Mandatory Pages / Views
  for (const page of contract?.pages || []) {
    const pageId = page.id || page.viewId || "page";
    const reqId = `page_${pageId}`;
    const isPrimary = Boolean(page.isPrimary);

    let status = "FAIL";
    let confidence = 0.95;
    const evidence = [];
    const missingEvidence = [];
    let explanation = "";
    let affectedFiles = [];

    // Is there a dedicated component matching the page?
    const dedicatedFile = allPaths.find((p) => {
      const lower = p.toLowerCase();
      return (
        lower.includes(`/${pageId.toLowerCase()}`) ||
        lower.includes(`/${page.name?.toLowerCase().replace(/\s+/g, "")}`)
      );
    });

    if (dedicatedFile) {
      affectedFiles.push(dedicatedFile);
      // Verify if the dedicated file is actually imported and reachable
      const isImportedInApp = appImports.some((src) => src.includes(dedicatedFile.replace(/\.jsx?$/, "")));
      const appCode = files["/App.js"] || "";
      const isRenderedInApp = isImportedInApp && new RegExp(`<[A-Z][A-Za-z0-9]*`, "i").test(appCode);

      if (isImportedInApp && isRenderedInApp) {
        status = "PASS";
        evidence.push(`Page component created at ${dedicatedFile}`);
        evidence.push(`Component is imported in /App.js and integrated into component tree`);
        explanation = `Page "${page.name}" has dedicated file ${dedicatedFile} connected to application entry.`;
      } else if (!isImportedInApp && !appCode.toLowerCase().includes(pageId.toLowerCase())) {
        status = "PARTIAL";
        confidence = 0.7;
        evidence.push(`Dedicated file exists at ${dedicatedFile}`);
        missingEvidence.push(`File ${dedicatedFile} is not imported in /App.js component tree`);
        explanation = `Page file ${dedicatedFile} exists on disk but is unlinked and unreachable from /App.js.`;
      } else {
        status = "PASS";
        evidence.push(`Page component referenced in /App.js`);
        explanation = `Page "${page.name}" is represented in main app structure.`;
      }
    } else if (allPaths.includes("/App.js")) {
      // In single-page architectures (or interactive tools), page may be directly in /App.js
      affectedFiles.push("/App.js");
      const appCode = files["/App.js"] || "";
      const representsPage =
        pageId === "home" ||
        pageId === "app" ||
        appCode.toLowerCase().includes(pageId.toLowerCase()) ||
        (page.name && appCode.toLowerCase().includes(page.name.toLowerCase()));

      if (representsPage) {
        status = "PASS";
        evidence.push(`Page structure implemented directly in /App.js`);
        explanation = `Primary view "${page.name}" is mounted in /App.js.`;
      } else {
        status = isPrimary ? "PARTIAL" : "FAIL";
        missingEvidence.push(`No dedicated file or explicit view representation for "${page.name}"`);
        explanation = `Page "${page.name}" lacks dedicated file and is not explicitly mapped in /App.js.`;
      }
    } else {
      status = "FAIL";
      missingEvidence.push("Missing /App.js entry point");
      explanation = `Page "${page.name}" cannot be mounted because /App.js does not exist.`;
    }

    items.push({
      requirementId: reqId,
      requirementText: `Page: ${page.name} (${page.path || "/"})`,
      requirementType: "page_view",
      priority: isPrimary ? "mandatory" : "optional",
      status,
      confidence,
      evidence,
      missingEvidence,
      explanation,
      affectedFiles,
      recommendedAction:
        status === "PASS"
          ? "None"
          : `Ensure page view "${page.name}" has a dedicated component imported in /App.js.`,
      source: "deterministic_static",
    });
  }

  // Check 2: Mandatory Sections
  for (const page of contract?.pages || []) {
    for (const sec of page.sections || []) {
      const reqId = `section_${sec.id || sec.name?.toLowerCase().replace(/\s+/g, "_")}`;
      const isMandatory = sec.priority === "mandatory";
      let status = "FAIL";
      let confidence = 0.9;
      const evidence = [];
      const missingEvidence = [];
      let explanation = "";
      const affectedFiles = [];

      const secKey = (sec.name || "").toLowerCase().split(" ")[0];
      const secId = (sec.id || "").toLowerCase();
      const isComplex = /(catalog|grid|shop|store|cart|table|booking|reservation|checkout|dashboard|products)/i.test(
        `${sec.name} ${sec.id}`
      );

      // Search all files for section representation
      const matchingFile = allPaths.find((p) => {
        if (p === "/styles.css") return false;
        const lower = p.toLowerCase();
        return lower.includes(secId) || lower.includes(secKey);
      });

      if (matchingFile) {
        affectedFiles.push(matchingFile);
        const fAnalysis = analysisMap[matchingFile];
        const hasContent = fAnalysis?.jsxElements?.length > 0 || (files[matchingFile] || "").length > 80;

        if (hasContent) {
          status = "PASS";
          evidence.push(`Section implemented in dedicated component ${matchingFile}`);
          explanation = `Section "${sec.name}" is implemented in ${matchingFile}.`;
        } else {
          status = "PARTIAL";
          missingEvidence.push(`Component ${matchingFile} is empty or lacks JSX body`);
          explanation = `Section file ${matchingFile} exists but contains minimal implementation.`;
        }
      } else {
        // Fallback check inside /App.js
        const appCode = files["/App.js"] || "";
        const appHasSec =
          appCode.toLowerCase().includes(secKey) || appCode.toLowerCase().includes(secId);

        if (appHasSec) {
          affectedFiles.push("/App.js");
          if (isComplex) {
            // Complex section implemented inside /App.js without dedicated component
            status = "PARTIAL";
            confidence = 0.7;
            evidence.push(`Section references found in /App.js`);
            missingEvidence.push(`Complex section "${sec.name}" lacks a dedicated component`);
            explanation = `Complex section "${sec.name}" is implemented directly in /App.js rather than a modular component.`;
          } else {
            status = "PASS";
            evidence.push(`Section content integrated in /App.js`);
            explanation = `Section "${sec.name}" is assembled inside /App.js.`;
          }
        } else {
          status = "FAIL";
          missingEvidence.push(`No component or JSX block implementing section "${sec.name}"`);
          explanation = `Required section "${sec.name}" is completely missing from generated code.`;
        }
      }

      items.push({
        requirementId: reqId,
        requirementText: `Section: ${sec.name} (${sec.purpose || "Content block"})`,
        requirementType: "section",
        priority: isMandatory ? "mandatory" : "optional",
        status,
        confidence,
        evidence,
        missingEvidence,
        explanation,
        affectedFiles,
        recommendedAction:
          status === "PASS"
            ? "None"
            : `Implement section "${sec.name}" in a dedicated component or inside /App.js.`,
        source: "deterministic_static",
      });
    }
  }

  return items;
}

// ----------------------------------------------------------------------------
// Layer B — Functional Implementation Evidence
// ----------------------------------------------------------------------------

export function verifyFunctionalEvidence(contract, files, analysisMap) {
  const items = [];
  const allAnalysis = Object.values(analysisMap || {});
  const combinedCode = Object.values(files || {}).join("\n");

  for (const fn of contract?.functionalRequirements || []) {
    const reqId = `fn_${fn.id || fn.name?.toLowerCase().replace(/\s+/g, "_")}`;
    const category = fn.category || "interactive_controls";
    const isMandatory = fn.priority === "mandatory";

    let status = "FAIL";
    let confidence = 0.95;
    const evidence = [];
    const missingEvidence = [];
    let explanation = "";
    const affectedFiles = [];
    let source = "deterministic_static";

    // Identify target file if specified
    if (fn.implementationTarget && files[fn.implementationTarget]) {
      affectedFiles.push(fn.implementationTarget);
    }

    // Check if target file or candidate files encountered AST parser fallback
    const targetFile = fn.implementationTarget;
    const isTargetFallback = targetFile && analysisMap[targetFile]?.astFallback;
    const allFallback = allAnalysis.length > 0 && allAnalysis.every((a) => a.astFallback);

    if (category === "search_filtering") {
      // Functional Pattern: Search input + state + query-connected filtering + results rendering
      let hasSearchInput = false;
      let hasControlledInput = false;
      let hasStateHook = false;
      let hasFilterCall = false;
      let hasConnectedFilterCall = false;
      let hasRenderedResults = false;

      const searchStateVars = new Set();

      for (const a of allAnalysis) {
        // 1. Identify search state hooks (useState, useReducer, custom hooks)
        for (const s of a.stateHooks) {
          if (/search|query|term|filter|keyword/i.test(s.name)) {
            hasStateHook = true;
            searchStateVars.add(s.name);
            affectedFiles.push(a.filePath);
          }
        }

        // 2. Add derived variables connected to search state (e.g. const lower = query.toLowerCase())
        for (const [varName, sourceIds] of Object.entries(a.derivedVariables || {})) {
          if ([...sourceIds].some((id) => searchStateVars.has(id))) {
            searchStateVars.add(varName);
          }
        }

        // 3. Find search input in JSX elements
        for (const el of a.jsxElements) {
          const isSearchType = el.tag === "input" && el.attributes?.type === "search";
          const isSearchText =
            (el.tag === "input" || el.tag === "textarea") &&
            /search|query|filter|find/i.test(String(el.attributes?.placeholder || el.attributes?.name || ""));

          if (isSearchType || isSearchText) {
            hasSearchInput = true;
            affectedFiles.push(a.filePath);
            if (el.attributes?.value && el.attributes?.onChange) {
              hasControlledInput = true;
              if (typeof el.attributes.value === "string") {
                searchStateVars.add(el.attributes.value);
              }
            }
          }
        }

        // 4. Inspect .filter() calls: must reference searchStateVars in callback
        for (const call of a.detailedCalls || []) {
          if (call.method === "filter") {
            hasFilterCall = true;
            const refsQuery = [...call.callbackIdentifiers].some((id) => searchStateVars.has(id));
            if (refsQuery) {
              hasConnectedFilterCall = true;
              affectedFiles.push(a.filePath);
            }
          }
          if (call.method === "map") {
            hasRenderedResults = true;
          }
        }
      }

      if (
        hasSearchInput &&
        hasControlledInput &&
        (hasStateHook || searchStateVars.size > 0) &&
        hasConnectedFilterCall &&
        hasRenderedResults
      ) {
        status = "PASS";
        evidence.push("Search input element with controlled state (value + onChange)");
        evidence.push("React state hook capturing query/search term");
        evidence.push("Array.prototype.filter() actively filtering data against search state variable");
        evidence.push("Filtered results dynamically mapped to JSX elements");
        explanation = "Search functionality is fully implemented with controlled state and dynamic data filtering.";
      } else if (hasSearchInput && (hasStateHook || hasControlledInput) && hasFilterCall && !hasConnectedFilterCall) {
        // Targeted False PASS Fix: Unrelated filtering without query binding
        status = "PARTIAL";
        confidence = 0.9;
        evidence.push("Search input element with controlled state binding");
        evidence.push("Array .filter() found, but it filters by unrelated criteria and does not use search query state");
        missingEvidence.push("Array .filter() actively referencing search query state variable");
        explanation = "Search input collects query state, but the filtering operation does not use the search query.";
      } else if (hasSearchInput && (hasStateHook || hasControlledInput) && !hasFilterCall) {
        status = "PARTIAL";
        confidence = 0.85;
        evidence.push("Search input element exists with state binding");
        missingEvidence.push("Array .filter() or data filtering logic connected to search state");
        explanation = "Search input collects query state, but does not filter any rendered data collection.";
      } else if (hasSearchInput && !hasControlledInput && !hasFilterCall) {
        status = "FAIL";
        confidence = 0.95;
        evidence.push("Static search <input> found in JSX");
        missingEvidence.push("Controlled input handler (onChange)");
        missingEvidence.push("State hook capturing query");
        missingEvidence.push("Data filtering logic (.filter)");
        explanation = "Search input is a purely cosmetic element without event handling, state, or filtering behavior.";
      } else if (isTargetFallback || allFallback) {
        status = "UNVERIFIABLE";
        confidence = 0.5;
        missingEvidence.push("Deterministic AST parse of component implementation");
        explanation = `Search component in ${targetFile || "project"} could not be parsed into a verified AST due to parser fallback; functional behavior cannot be verified statically.`;
        source = "static_analysis_unverifiable";
      } else {
        status = "FAIL";
        missingEvidence.push("Search input element");
        missingEvidence.push("Search state management");
        missingEvidence.push("Dynamic filtering computation");
        explanation = "Search and filtering functionality is completely missing from the generated code.";
      }
    } else if (category === "forms_validation") {
      // Functional Pattern: Inputs + submit handler + meaningful submission behavior + connected feedback
      let hasFormOrInputs = false;
      let hasSubmitHandler = false;
      let hasMeaningfulSubmission = false;
      let hasConnectedFeedback = false;
      const handlerMutatedStates = [];

      for (const a of allAnalysis) {
        const hasFormTag = a.jsxElements.some((el) => el.tag === "form");
        const hasInputs = a.jsxElements.some((el) => el.tag === "input" || el.tag === "textarea");

        if (hasFormTag || hasInputs) {
          hasFormOrInputs = true;
          affectedFiles.push(a.filePath);
        }

        // Detailed submit handler inspection
        const submitHandlers = (a.detailedEventHandlers || []).filter(
          (h) => h.event === "onSubmit" || (h.event === "onClick" && /submit|send/i.test(String(h.attrVal || "")))
        );

        if (submitHandlers.length > 0) {
          hasSubmitHandler = true;
          affectedFiles.push(a.filePath);

          for (const h of submitHandlers) {
            if (h.summary?.isMeaningful) {
              hasMeaningfulSubmission = true;
            }
            if (h.summary?.hasFeedbackCall) {
              hasConnectedFeedback = true;
            }
            if (h.summary?.mutatedStates) {
              handlerMutatedStates.push(...h.summary.mutatedStates);
            }
          }
        }

        // Verify connected feedback: check if mutated setter controls conditional rendering
        const stateVarNames = new Set();
        for (const s of a.stateHooks) {
          if (
            handlerMutatedStates.includes(s.setter) ||
            /submitted|status|success|sent/i.test(s.name)
          ) {
            stateVarNames.add(s.name);
          }
        }

        for (const cond of a.conditionalExpressions || []) {
          if (cond.testIds.some((id) => stateVarNames.has(id))) {
            hasConnectedFeedback = true;
          }
        }
      }

      if (hasFormOrInputs && hasSubmitHandler && hasMeaningfulSubmission && hasConnectedFeedback) {
        status = "PASS";
        evidence.push("Form inputs and submission event handler with meaningful state mutation / data handling");
        evidence.push("Submission feedback conditionally displayed or triggered via alert/toast");
        explanation = "Form functionality has complete submission handling and feedback.";
      } else if (hasFormOrInputs && hasSubmitHandler && hasMeaningfulSubmission && !hasConnectedFeedback) {
        status = "PARTIAL";
        confidence = 0.8;
        evidence.push("Form submission handler executes meaningful state mutation");
        missingEvidence.push("User submission confirmation, error validation, or feedback toast tied to submission state");
        explanation = "Form has a working submit handler but lacks explicit user confirmation or feedback tied to submission.";
      } else if (hasFormOrInputs && hasSubmitHandler && !hasMeaningfulSubmission) {
        // Targeted False PASS Fix: Empty handler or e.preventDefault() only
        status = "PARTIAL";
        confidence = 0.9;
        evidence.push("Form element exists with submit handler attached");
        missingEvidence.push(
          "Meaningful submission logic (state mutation, data collection, or feedback dispatch) in onSubmit handler"
        );
        explanation = "Form has an onSubmit handler, but it only prevents default and does not handle or submit data.";
      } else if (hasFormOrInputs && !hasSubmitHandler) {
        status = "FAIL";
        confidence = 0.95;
        evidence.push("Form inputs exist in JSX");
        missingEvidence.push("Submission handler (onSubmit or submit button handler)");
        missingEvidence.push("Submission feedback mechanism");
        explanation = "Form contains input fields but has no submission handling or data collection.";
      } else if (isTargetFallback || allFallback) {
        status = "UNVERIFIABLE";
        confidence = 0.5;
        missingEvidence.push("Deterministic AST parse of component implementation");
        explanation = `Form component in ${targetFile || "project"} could not be parsed into a verified AST due to parser fallback; functional behavior cannot be verified statically.`;
        source = "static_analysis_unverifiable";
      } else {
        status = "FAIL";
        missingEvidence.push("Form element and input fields");
        missingEvidence.push("Submission handler");
        explanation = "Form submission functionality is missing from generated files.";
      }
    } else if (category === "ecommerce_cart") {
      // Functional Pattern: Cart state + Add to cart handler + Cart UI + Cart-item-tied totals computation
      let hasCartState = false;
      let hasAddToCartHandler = false;
      let hasCartUi = false;
      let hasTotalsComputation = false;

      const cartStateNames = new Set(["cart", "cartitems", "bag", "basket"]);

      for (const a of allAnalysis) {
        // 1. Check state hooks and reducers
        for (const s of a.stateHooks) {
          if (/cart|bag|basket/i.test(s.name)) {
            hasCartState = true;
            cartStateNames.add(s.name.toLowerCase());
            affectedFiles.push(a.filePath);
          }
        }
        for (const r of a.reducers || []) {
          if (/cart|bag|basket/i.test(r.state)) {
            hasCartState = true;
            cartStateNames.add(r.state.toLowerCase());
            affectedFiles.push(a.filePath);
          }
        }

        // 2. Add to cart handler
        if (
          a.eventHandlers.some((h) => /addtocart|setcart|additem/i.test(String(h.val || ""))) ||
          /addToCart|setCart\s*\(|setBag\s*\(|dispatch\s*\(\s*\{.*(?:add|cart)/i.test(a.rawCode)
        ) {
          hasAddToCartHandler = true;
          affectedFiles.push(a.filePath);
        }

        // 3. Cart UI
        if (
          /cart\.map|bag\.map|cartItems\.map/i.test(a.rawCode) ||
          /cart_drawer|cartdrawer|shoppingbag/i.test(a.filePath.toLowerCase())
        ) {
          hasCartUi = true;
          affectedFiles.push(a.filePath);
        }

        // 4. Totals computation: MUST operate on cart items with price/quantity
        for (const call of a.detailedCalls || []) {
          if (call.method === "reduce") {
            const calleeObj = String(call.calleeObject || "").toLowerCase();
            const isCartCallee = cartStateNames.has(calleeObj) || /cart|bag|items/i.test(calleeObj);
            const hasPriceAccess =
              call.callbackProperties.has("price") ||
              call.callbackProperties.has("cost") ||
              call.callbackProperties.has("amount");
            const hasQtyAccess =
              call.callbackProperties.has("quantity") || call.callbackProperties.has("qty");
            const isUnrelatedArray = /ratings|reviews|stars|scores|tags|comments/i.test(calleeObj);

            if (
              (isCartCallee && hasPriceAccess) ||
              (hasPriceAccess && hasQtyAccess) ||
              (isCartCallee && !isUnrelatedArray && hasPriceAccess)
            ) {
              hasTotalsComputation = true;
            }
          }
        }

        if (/\.reduce\s*\(\s*\([^)]*\)\s*=>.*(?:item\.)?price/i.test(a.rawCode)) {
          hasTotalsComputation = true;
        }
      }

      if (hasCartState && hasAddToCartHandler && hasCartUi && hasTotalsComputation) {
        status = "PASS";
        evidence.push("Cart state hook managing cart item collection");
        evidence.push("Add-to-cart click handler updating cart state");
        evidence.push("Cart drawer / UI component rendering cart line items");
        evidence.push("Price computation calculating totals via .reduce on cart items with price/quantity");
        explanation = "Shopping cart state, item management, UI drawer, and price calculation are fully implemented.";
      } else if (hasCartState && hasAddToCartHandler && (!hasCartUi || !hasTotalsComputation)) {
        status = "PARTIAL";
        confidence = 0.8;
        evidence.push("Cart state and add-to-cart handler are implemented");
        if (!hasCartUi) missingEvidence.push("Cart drawer or line items UI display");
        if (!hasTotalsComputation)
          missingEvidence.push("Price subtotal/total calculation (.reduce on cart items with price/quantity)");
        explanation = "Cart updates state but lacks full UI presentation or price total calculation.";
      } else if (!hasCartState && /add to (?:bag|cart)/i.test(combinedCode)) {
        status = "FAIL";
        confidence = 0.95;
        evidence.push("'Add to Bag' button found in JSX text");
        missingEvidence.push("Reactive cart state hook");
        missingEvidence.push("Add-to-cart state updater");
        missingEvidence.push("Cart total calculation");
        explanation = "Add to Cart button is purely visual and not connected to any cart state.";
      } else if (isTargetFallback || allFallback) {
        status = "UNVERIFIABLE";
        confidence = 0.5;
        missingEvidence.push("Deterministic AST parse of component implementation");
        explanation = `Cart component in ${targetFile || "project"} could not be parsed into a verified AST due to parser fallback; functional behavior cannot be verified statically.`;
        source = "static_analysis_unverifiable";
      } else {
        status = "FAIL";
        missingEvidence.push("Cart state management");
        missingEvidence.push("Add to cart interaction");
        explanation = "Cart functionality is completely missing.";
      }
    } else if (category === "navigation_routing") {
      // Functional Pattern: Navigation buttons + state switch + reachable destination view
      let hasNavControls = false;
      let hasViewSwitchHandler = false;
      let hasDestinationView = false;

      const candidateNavVars = new Set([
        "activeview",
        "currentview",
        "view",
        "activetab",
        "currenttab",
        "tab",
        "screen",
        "page",
        "activepage",
        "currentscreen",
      ]);

      for (const a of allAnalysis) {
        if (a.jsxElements.some((el) => el.tag === "nav" || el.tag === "header")) {
          hasNavControls = true;
          affectedFiles.push(a.filePath);
        }

        // Add state hook names that look like nav state
        for (const s of a.stateHooks) {
          if (/view|tab|screen|page|route/i.test(s.name)) {
            candidateNavVars.add(s.name.toLowerCase());
          }
        }

        if (
          a.eventHandlers.some((h) => /setview|settab|navigate|onnavigate/i.test(String(h.val || ""))) ||
          /setActiveView|setActiveTab|setView|setTab|setScreen|setPage|dispatch\s*\(\s*\{.*navigate/i.test(a.rawCode)
        ) {
          hasViewSwitchHandler = true;
        }

        // 1. Dictionary / Object map pattern: TABS[activeTab], VIEWS[currentView], screens[screen]
        for (const member of a.computedMemberExpressions || []) {
          if (candidateNavVars.has(String(member.property).toLowerCase())) {
            hasDestinationView = true;
          }
        }
        if (/([A-Z0-9_]+)\[(activeTab|currentView|view|tab|activeView|screen|page|currentScreen)\]/.test(a.rawCode)) {
          hasDestinationView = true;
        }

        // 2. Switch statement pattern: switch (activeTab) { ... }
        for (const sw of a.switchStatements || []) {
          if (candidateNavVars.has(String(sw.discriminant).toLowerCase()) && sw.casesCount >= 2) {
            hasDestinationView = true;
          }
        }

        // 3. Conditional / equality pattern: activeView === 'home' && <Home />
        if (
          /activeView\s*===|currentView\s*===|view\s*===|activeTab\s*===|currentTab\s*===|tab\s*===|screen\s*===|page\s*===/i.test(
            a.rawCode
          )
        ) {
          hasDestinationView = true;
        }
      }

      if (hasNavControls && hasViewSwitchHandler && hasDestinationView) {
        status = "PASS";
        evidence.push("Navigation controls with active state switch handlers");
        evidence.push(
          "Destination view dynamically rendered based on navigation state (dictionary map, switch, or conditional)"
        );
        explanation = "Single-page reactive navigation switches and renders target views.";
      } else if (hasNavControls && hasViewSwitchHandler && !hasDestinationView) {
        status = "PARTIAL";
        confidence = 0.8;
        evidence.push("Navigation buttons trigger view state updates");
        missingEvidence.push(
          "Conditional rendering of target destination views based on state (dictionary map, switch, or conditional)"
        );
        explanation = "Navigation updates state, but target destination views are not rendered.";
      } else if (hasNavControls && !hasViewSwitchHandler) {
        status = "PARTIAL";
        confidence = 0.85;
        evidence.push("Navigation bar and links are present in DOM");
        missingEvidence.push("Click handlers updating reactive view state");
        explanation = "Navigation bar exists but uses static links without reactive view state handlers.";
      } else if (isTargetFallback || allFallback) {
        status = "UNVERIFIABLE";
        confidence = 0.5;
        missingEvidence.push("Deterministic AST parse of component implementation");
        explanation = `Navigation component in ${targetFile || "project"} could not be parsed into a verified AST due to parser fallback; functional behavior cannot be verified statically.`;
        source = "static_analysis_unverifiable";
      } else {
        status = "FAIL";
        missingEvidence.push("Navigation component and active view switches");
        explanation = "Navigation routing is missing.";
      }
    } else if (category === "tabs_accordions") {
      // Functional Pattern: Click toggle + active index state + conditional content
      let hasTabState = false;
      let hasToggleHandler = false;
      let hasConditionalDisplay = false;

      for (const a of allAnalysis) {
        if (a.stateHooks.some((s) => /tab|active|open|expanded|accordion|faq/i.test(s.name))) {
          hasTabState = true;
          affectedFiles.push(a.filePath);
        }

        if (
          a.eventHandlers.some((h) => /settab|setactive|toggle|setopen/i.test(String(h.val || ""))) ||
          /setActiveTab|setOpenIndex|toggleItem|setActive\s*\(/i.test(a.rawCode)
        ) {
          hasToggleHandler = true;
        }

        if (
          /activeTab\s*===|openIndex\s*===|isOpen\s*\?|isExpanded\s*\?/i.test(a.rawCode) ||
          /expandedIndex\s*===/i.test(a.rawCode)
        ) {
          hasConditionalDisplay = true;
        }
      }

      if (hasTabState && hasToggleHandler && hasConditionalDisplay) {
        status = "PASS";
        evidence.push("Tab/accordion state hook tracking active item");
        evidence.push("Toggle click handler updating active index");
        evidence.push("Conditional rendering displaying active tab/accordion content");
        explanation = "Interactive tabs / accordions dynamically toggle and render active content.";
      } else if (hasTabState && hasToggleHandler && !hasConditionalDisplay) {
        status = "PARTIAL";
        confidence = 0.8;
        evidence.push("State toggle handler exists");
        missingEvidence.push("Conditional content display tied to tab state");
        explanation = "Tabs toggle state, but content does not conditionally react.";
      } else if (!hasTabState && /faq|accordion|tab/i.test(combinedCode)) {
        status = "FAIL";
        confidence = 0.9;
        evidence.push("Text mentions tabs/FAQ in markup");
        missingEvidence.push("Active state hook");
        missingEvidence.push("Toggle click handler");
        explanation = "Tabs or accordion markup is present but lacks interactive toggle state.";
      } else if (isTargetFallback || allFallback) {
        status = "UNVERIFIABLE";
        confidence = 0.5;
        missingEvidence.push("Deterministic AST parse of component implementation");
        explanation = `Tabs/accordion component in ${targetFile || "project"} could not be parsed into a verified AST due to parser fallback; functional behavior cannot be verified statically.`;
        source = "static_analysis_unverifiable";
      } else {
        status = "FAIL";
        missingEvidence.push("Interactive tab/accordion component");
        explanation = "Tab / accordion functionality is not implemented.";
      }
    } else {
      // General interactive controls / game logic / utility
      let hasState = false;
      let hasHandlers = false;

      for (const a of allAnalysis) {
        if (a.stateHooks.length > 0) hasState = true;
        if (a.eventHandlers.length > 0) hasHandlers = true;
      }

      if (hasState && hasHandlers) {
        status = "PASS";
        evidence.push("Interactive state hook and event handlers detected in component");
        explanation = `Functional requirement "${fn.name}" has active state and handlers.`;
      } else if (isTargetFallback || allFallback) {
        status = "UNVERIFIABLE";
        confidence = 0.5;
        missingEvidence.push("Deterministic AST parse of component implementation");
        explanation = `Component in ${targetFile || "project"} could not be parsed into a verified AST due to parser fallback; functional behavior cannot be verified statically.`;
        source = "static_analysis_unverifiable";
      } else {
        status = "FAIL";
        missingEvidence.push("Interactive state hook or event handlers");
        explanation = `Functional requirement "${fn.name}" lacks stateful interaction.`;
      }
    }

    items.push({
      requirementId: reqId,
      requirementText: `${fn.name}: ${fn.description || fn.expectedBehavior}`,
      requirementType: "functional",
      priority: isMandatory ? "mandatory" : "optional",
      status,
      confidence,
      evidence,
      missingEvidence,
      explanation,
      affectedFiles: [...new Set(affectedFiles)],
      recommendedAction:
        status === "PASS"
          ? "None"
          : `Implement missing behavioral evidence for "${fn.name}": ${missingEvidence.join("; ")}`,
      source: source || "deterministic_static",
    });
  }

  return items;
}

// ----------------------------------------------------------------------------
// Layer C — Design and Responsive Evidence
// ----------------------------------------------------------------------------

export function verifyDesignAndResponsiveEvidence(contract, files, analysisMap) {
  const items = [];
  const stylesCode = files["/styles.css"] || "";
  const combinedCode = Object.values(files || {}).join("\n");
  const allAnalysis = Object.values(analysisMap || {});

  // Check 1: Color / Theme Treatment
  const requestedTheme = contract?.design?.colorPreferences?.theme || "light";
  const reqThemeId = "design_color_theme";
  let themeStatus = "FAIL";
  const themeEvidence = [];
  const themeMissing = [];
  let themeExplanation = "";

  if (requestedTheme === "dark") {
    const hasDarkClasses =
      /dark|bg-zinc-950|bg-zinc-900|bg-black|bg-slate-950|bg-slate-900|#09090b|#030712|text-zinc-100|text-white/.test(
        combinedCode
      ) || stylesCode.includes("#09090b");

    if (hasDarkClasses) {
      themeStatus = "PASS";
      themeEvidence.push("Dark palette tokens and dark background classes found in JSX/CSS");
      themeExplanation = "Dark theme design requirement is implemented with dark styling tokens.";
    } else {
      themeStatus = "FAIL";
      themeMissing.push("Dark mode utility classes (e.g. bg-zinc-950, text-white, #09090b)");
      themeExplanation = "Requested dark theme is missing dark background and text classes.";
    }
  } else {
    // Light or custom theme
    const hasLightClasses =
      /bg-white|bg-zinc-50|bg-slate-50|text-zinc-900|text-slate-900|#ffffff/.test(combinedCode);
    if (hasLightClasses || stylesCode.length > 20) {
      themeStatus = "PASS";
      themeEvidence.push("Light styling tokens and background classes found in code");
      themeExplanation = "Light theme design requirement is satisfied.";
    } else {
      themeStatus = "PARTIAL";
      themeMissing.push("Explicit light theme root variables");
      themeExplanation = "Standard light theme classes detected without explicit root variables.";
    }
  }

  items.push({
    requirementId: reqThemeId,
    requirementText: `Design Theme: ${requestedTheme.toUpperCase()} color mode`,
    requirementType: "design",
    priority: "mandatory",
    status: themeStatus,
    confidence: 0.9,
    evidence: themeEvidence,
    missingEvidence: themeMissing,
    explanation: themeExplanation,
    affectedFiles: ["/styles.css", "/App.js"].filter((p) => files[p]),
    recommendedAction:
      themeStatus === "PASS"
        ? "None"
        : `Apply ${requestedTheme} background and text classes to /App.js and /styles.css.`,
    source: "deterministic_static",
  });

  // Check 2: Responsive Breakpoints & Mobile Adaptation
  const reqRespId = "responsive_adaptation";
  const allCssClasses = new Set();
  for (const a of allAnalysis) {
    for (const c of a.cssClasses) allCssClasses.add(c);
  }

  const hasBreakpointClasses = [...allCssClasses].some((c) =>
    /^(sm:|md:|lg:|xl:|2xl:)/.test(c)
  );
  const hasMobileHidingOrDrawer = [...allCssClasses].some((c) =>
    /^(md:hidden|hidden\s*md:|sm:hidden|md:flex)/.test(c)
  ) || /hamburger|mobile-menu|isMobile/i.test(combinedCode);

  let respStatus = "FAIL";
  const respEvidence = [];
  const respMissing = [];
  let respExplanation = "";

  if (hasBreakpointClasses && hasMobileHidingOrDrawer) {
    respStatus = "PASS";
    respEvidence.push("Tailwind responsive breakpoint prefixes (sm:, md:, lg:) found in layout");
    respEvidence.push("Mobile-adaptive visibility classes (md:hidden / hidden md:flex) or drawer toggles");
    respExplanation = "Responsive layouts and mobile navigation adaptations are implemented.";
  } else if (hasBreakpointClasses && !hasMobileHidingOrDrawer) {
    respStatus = "PARTIAL";
    respEvidence.push("Responsive multi-column grid/flex breakpoints found in layout");
    respMissing.push("Mobile-specific navigation drawer or conditional mobile toggles");
    respExplanation = "Responsive breakpoints exist, but mobile-specific drawer controls are absent.";
  } else {
    respStatus = "FAIL";
    respMissing.push("Responsive Tailwind breakpoint classes (md:, lg:)");
    respMissing.push("Mobile layout adaptation");
    respExplanation = "No responsive breakpoint classes or mobile adaptations found in project.";
  }

  items.push({
    requirementId: reqRespId,
    requirementText: `Responsive: Desktop multi-column and mobile adaptations`,
    requirementType: "responsive",
    priority: "mandatory",
    status: respStatus,
    confidence: 0.9,
    evidence: respEvidence,
    missingEvidence: respMissing,
    explanation: respExplanation,
    affectedFiles: Object.keys(files || {}).filter((p) => p.endsWith(".js") || p.endsWith(".jsx")),
    recommendedAction:
      respStatus === "PASS"
        ? "None"
        : "Add responsive Tailwind prefixes (md:grid-cols-3, md:hidden) to support mobile viewports.",
    source: "deterministic_static",
  });

  // Check 3: Subjective Visual Quality (UNVERIFIABLE Boundary Rule)
  const visualAtmosphereReq = contract?.design?.visualStyle;
  if (visualAtmosphereReq) {
    items.push({
      requirementId: "design_subjective_atmosphere",
      requirementText: `Visual Aesthetic: ${visualAtmosphereReq}`,
      requirementType: "design",
      priority: "inferred",
      status: "UNVERIFIABLE",
      confidence: 0,
      evidence: ["Found layout styling and color tokens in code"],
      missingEvidence: ["Static code inspection cannot verify subjective visual atmosphere or render beauty"],
      explanation: "Subjective visual atmosphere and layout aesthetics cannot be reliably verified statically; runtime visual QA is required.",
      affectedFiles: ["/styles.css"],
      recommendedAction: "Verify visual aesthetic and atmosphere in client Sandpack preview.",
      source: "deterministic_static",
    });
  }

  return items;
}

// ----------------------------------------------------------------------------
// Layer D — Contract and FilePlan Consistency
// ----------------------------------------------------------------------------

export function verifyContractFilePlanConsistency(contract, files, plan, analysisMap) {
  const items = [];
  const allPaths = Object.keys(files || {});
  const plannedFiles = plan?.files || [];

  // Check 1: Missing Referenced FilePlan Files
  for (const pf of plannedFiles) {
    if (pf.mandatory && !files[pf.path]) {
      items.push({
        requirementId: `plan_file_missing_${pf.path.replace(/[^a-zA-Z0-9]/g, "_")}`,
        requirementText: `Planned File: ${pf.path} (${pf.description})`,
        requirementType: "consistency",
        priority: "mandatory",
        status: "FAIL",
        confidence: 1.0,
        evidence: [],
        missingEvidence: [`File ${pf.path} was planned as mandatory but was never generated`],
        explanation: `Mandatory planned file ${pf.path} is missing from the project files.`,
        affectedFiles: [pf.path],
        recommendedAction: `Generate the missing file ${pf.path}.`,
        source: "deterministic_static",
      });
    }
  }

  // Check 2: Requirements mapped to unrelated or missing files
  for (const fn of contract?.functionalRequirements || []) {
    if (fn.implementationTarget) {
      const target = fn.implementationTarget;
      if (!files[target]) {
        items.push({
          requirementId: `consistency_target_missing_${fn.id}`,
          requirementText: `Target Mapping: ${fn.name} -> ${target}`,
          requirementType: "consistency",
          priority: fn.priority === "mandatory" ? "mandatory" : "optional",
          status: "FAIL",
          confidence: 1.0,
          evidence: [],
          missingEvidence: [`Designated implementation target file ${target} does not exist`],
          explanation: `Requirement "${fn.name}" is assigned to ${target}, but that file does not exist in the project.`,
          affectedFiles: [target],
          recommendedAction: `Create file ${target} or remap the requirement to an existing component.`,
          source: "deterministic_static",
        });
      }
    }
  }

  // Check 3: Top-level Mandatory Contract Requirements Coverage
  for (let i = 0; i < (contract?.mandatoryRequirements || []).length; i++) {
    const rawMand = contract.mandatoryRequirements[i];
    const mandText = typeof rawMand === "string" ? rawMand : (rawMand?.description || rawMand?.id || "");
    const reqId = typeof rawMand === "object" && rawMand?.id ? rawMand.id : `mandatory_req_${i}`;
    const lower = (mandText || "").toLowerCase();
    const keyWords = lower.split(/\s+/).filter((w) => w.length >= 3 && !/^(the|and|for|with)$/.test(w));

    // Check if covered by sections, functional, or code
    let isCovered = false;
    let matchingFile = null;

    for (const [p, code] of Object.entries(files || {})) {
      if (p === "/styles.css") continue;
      const matches = keyWords.filter((w) => code.toLowerCase().includes(w));
      if (matches.length >= Math.min(2, keyWords.length)) {
        isCovered = true;
        matchingFile = p;
        break;
      }
    }

    if (isCovered) {
      items.push({
        requirementId: reqId,
        requirementText: `Mandatory: ${mandText}`,
        requirementType: "mandatory",
        priority: "mandatory",
        status: "PASS",
        confidence: 0.9,
        evidence: [`Implementation evidence found in ${matchingFile}`],
        missingEvidence: [],
        explanation: `Mandatory requirement "${mandText}" has implementation in ${matchingFile}.`,
        affectedFiles: matchingFile ? [matchingFile] : [],
        recommendedAction: "None",
        source: "deterministic_static",
      });
    } else {
      const candidateByPath = allPaths.find((p) => {
        if (p === "/styles.css" || p === "/package.json") return false;
        const lowerPath = p.toLowerCase();
        return keyWords.some((kw) => lowerPath.includes(kw));
      });
      items.push({
        requirementId: reqId,
        requirementText: `Mandatory: ${mandText}`,
        requirementType: "mandatory",
        priority: "mandatory",
        status: "FAIL",
        confidence: 0.95,
        evidence: [],
        missingEvidence: [`No code or component evidence for mandatory requirement "${mandText}"`],
        explanation: `Mandatory requirement "${mandText}" is not satisfied in generated project.`,
        affectedFiles: candidateByPath ? [candidateByPath] : ["/App.js"],
        recommendedAction: `Implement the missing mandatory requirement: ${mandText}.`,
        source: "deterministic_static",
      });
    }
  }

  return items;
}

// ----------------------------------------------------------------------------
// Optional AI-Assisted Verification Fallback
// ----------------------------------------------------------------------------

export async function verifyWithAiFallback(unresolvedItems, files, prompt, options = {}) {
  if (!unresolvedItems || unresolvedItems.length === 0) {
    return [];
  }

  try {
    const filesSummary = Object.entries(files)
      .slice(0, 4)
      .map(([p, code]) => `File ${p}:\n${String(code).slice(0, 500)}`)
      .join("\n\n");

    const requirementsList = unresolvedItems
      .map((item) => `- ID: ${item.requirementId} | Text: "${item.requirementText}" | Current: ${item.status}`)
      .join("\n");

    const aiPrompt = `Verify whether the following unresolved requirements are implemented in the project code:\n${requirementsList}\n\nProject Code Summary:\n${filesSummary}`;

    const { object: result } = await generateStructuredObject({
      schema: AiVerificationBatchSchema,
      system: "You are an Evidence-Based Code Verification Auditor. Verify each requirement strictly based on verifiable code implementation. Never return PASS without identifying concrete code evidence.",
      prompt: aiPrompt,
      maxRetries: 1,
    });

    if (result && Array.isArray(result.evaluations)) {
      return result.evaluations;
    }
  } catch (err) {
    console.warn(`[RequirementVerification] AI-assisted verification fallback failed (${err.message}). Retaining static assessments.`);
  }

  return [];
}

// ----------------------------------------------------------------------------
// Overall Summary & Diagnostics Calculation
// ----------------------------------------------------------------------------

export function calculateVerificationSummary(requirements = []) {
  let passed = 0;
  let partial = 0;
  let failed = 0;
  let unverifiable = 0;

  let mandatoryPassed = 0;
  let mandatoryFailed = 0;
  let mandatoryUnverifiable = 0;

  const warnings = [];

  for (const item of requirements) {
    const isMandatory = item.priority === "mandatory";

    if (item.status === "PASS") {
      passed++;
      if (isMandatory) mandatoryPassed++;
    } else if (item.status === "PARTIAL") {
      partial++;
      warnings.push(`Partial implementation for "${item.requirementText}": ${item.missingEvidence?.join(", ") || item.explanation}`);
    } else if (item.status === "FAIL") {
      failed++;
      if (isMandatory) {
        mandatoryFailed++;
        warnings.push(`Mandatory requirement FAILED: "${item.requirementText}". ${item.explanation}`);
      } else {
        warnings.push(`Optional requirement failed: "${item.requirementText}".`);
      }
    } else if (item.status === "UNVERIFIABLE") {
      unverifiable++;
      if (isMandatory) {
        mandatoryUnverifiable++;
        warnings.push(`Mandatory requirement UNVERIFIABLE statically: "${item.requirementText}".`);
      }
    }
  }

  // Determine overall status
  let overallStatus = "VERIFIED";
  if (mandatoryFailed > 0) {
    overallStatus = "FAILED";
  } else if (mandatoryUnverifiable > 0) {
    overallStatus = "UNVERIFIABLE";
  } else if (partial > 0 || failed > 0) {
    overallStatus = "PARTIAL";
  } else if (unverifiable > 0) {
    overallStatus = "PARTIAL";
  } else {
    overallStatus = "VERIFIED";
  }

  return {
    totalRequirements: requirements.length,
    passed,
    partial,
    failed,
    unverifiable,
    mandatoryPassed,
    mandatoryFailed,
    mandatoryUnverifiable,
    overallStatus,
    verificationWarnings: warnings,
    requirements,
    evaluatedAt: new Date().toISOString(),
    diagnosticLimitations:
      "Static code analysis inspects AST structures, event bindings, and responsive classes. It does not replace live browser visual and interaction QA.",
  };
}

// ----------------------------------------------------------------------------
// Main Verification Engine Entry Point
// ----------------------------------------------------------------------------

/**
 * Verifies generated React website files against a structured Requirement Contract.
 *
 * @param {Record<string, string>} files - Generated project file map
 * @param {object} contract - RequirementContractSchema object
 * @param {object|null} plan - FilePlanSchema object
 * @param {object} [options] - Options (e.g. enableAiFallback, parserAvailable)
 * @returns {Promise<object>} RequirementVerificationSummarySchema report
 */
export async function verifyProjectRequirements(files = {}, contract = null, plan = null, options = {}) {
  // Handle empty or malformed files
  if (!files || typeof files !== "object" || Object.keys(files).length === 0) {
    const emptySummary = {
      totalRequirements: 1,
      passed: 0,
      partial: 0,
      failed: 1,
      unverifiable: 0,
      mandatoryPassed: 0,
      mandatoryFailed: 1,
      mandatoryUnverifiable: 0,
      overallStatus: "FAILED",
      verificationWarnings: ["Project contains no files or empty file collection"],
      requirements: [
        {
          requirementId: "project_files_empty",
          requirementText: "Project files must exist and contain code",
          requirementType: "consistency",
          priority: "mandatory",
          status: "FAIL",
          confidence: 1.0,
          evidence: [],
          missingEvidence: ["No files provided to verification engine"],
          explanation: "Project file map is empty.",
          affectedFiles: [],
          recommendedAction: "Ensure code generation creates project files before verification.",
          source: "infrastructure_fallback",
        },
      ],
      evaluatedAt: new Date().toISOString(),
      diagnosticLimitations: "Verification aborted: empty project files.",
    };
    return RequirementVerificationSummarySchema.parse(emptySummary);
  }

  // Handle empty or malformed contract
  if (!contract || typeof contract !== "object") {
    const invalidSummary = {
      totalRequirements: 1,
      passed: 0,
      partial: 0,
      failed: 0,
      unverifiable: 1,
      mandatoryPassed: 0,
      mandatoryFailed: 0,
      mandatoryUnverifiable: 1,
      overallStatus: "UNVERIFIABLE",
      verificationWarnings: ["Requirement contract is missing or malformed"],
      requirements: [
        {
          requirementId: "contract_missing",
          requirementText: "Requirement contract must be provided",
          requirementType: "consistency",
          priority: "mandatory",
          status: "UNVERIFIABLE",
          confidence: 0,
          evidence: [],
          missingEvidence: ["Valid RequirementContract object"],
          explanation: "Cannot verify project requirements because no requirement contract was supplied.",
          affectedFiles: [],
          recommendedAction: "Establish a requirement contract before running verification.",
          source: "infrastructure_fallback",
        },
      ],
      evaluatedAt: new Date().toISOString(),
      diagnosticLimitations: "Verification aborted: missing requirement contract.",
    };
    return RequirementVerificationSummarySchema.parse(invalidSummary);
  }

  // Build AST Analysis Map
  const analysisMap = await buildProjectAnalysisMap(files, options);

  // If compiler/parser threw an infrastructure error across all files and failOnInfrastructure is set
  const parseErrors = Object.values(analysisMap).filter((a) => a.hasParseError);
  if (parseErrors.length > 0 && parseErrors.length === Object.keys(files).length && options.failOnInfrastructure) {
    const infraSummary = {
      totalRequirements: 1,
      passed: 0,
      partial: 0,
      failed: 0,
      unverifiable: 1,
      mandatoryPassed: 0,
      mandatoryFailed: 0,
      mandatoryUnverifiable: 1,
      overallStatus: "UNVERIFIABLE",
      verificationWarnings: ["Parser or compilation infrastructure failure across all files"],
      requirements: [
        {
          requirementId: "infrastructure_parser_failure",
          requirementText: "Code parser and compiler must be available",
          requirementType: "consistency",
          priority: "mandatory",
          status: "UNVERIFIABLE",
          confidence: 0,
          evidence: [],
          missingEvidence: ["Working AST parser / compiler runtime"],
          explanation: `Infrastructure error: ${parseErrors[0].parseErrorMessage || "AST parser failed"}`,
          affectedFiles: Object.keys(files),
          recommendedAction: "Verify parser dependencies.",
          source: "infrastructure_fallback",
        },
      ],
      evaluatedAt: new Date().toISOString(),
      diagnosticLimitations: "Verification aborted: compiler infrastructure error.",
    };
    return RequirementVerificationSummarySchema.parse(infraSummary);
  }

  // Execute Layer A: File and Component Evidence
  const layerA = verifyFileAndComponentEvidence(contract, files, plan, analysisMap);

  // Execute Layer B: Functional Implementation Evidence
  const layerB = verifyFunctionalEvidence(contract, files, analysisMap);

  // Execute Layer C: Design and Responsive Evidence
  const layerC = verifyDesignAndResponsiveEvidence(contract, files, analysisMap);

  // Execute Layer D: Contract and FilePlan Consistency
  const layerD = verifyContractFilePlanConsistency(contract, files, plan, analysisMap);

  // Combine results
  const allRequirements = [...layerA, ...layerB, ...layerC, ...layerD];

  // Optional AI-assisted fallback for ambiguous/unresolved items if explicitly enabled
  if (options.enableAiFallback) {
    const unresolved = allRequirements.filter((r) => r.status === "UNVERIFIABLE" || r.status === "PARTIAL");
    if (unresolved.length > 0) {
      const aiResults = await verifyWithAiFallback(unresolved, files, contract.identity?.purpose || "", options);
      for (const evalItem of aiResults) {
        const targetReq = allRequirements.find((r) => r.requirementId === evalItem.requirementId);
        if (targetReq && evalItem.status && evalItem.evidence?.length > 0) {
          // AI can only override with verifiable code evidence
          targetReq.status = evalItem.status;
          targetReq.confidence = evalItem.confidence || 0.8;
          targetReq.evidence.push(...(evalItem.evidence || []));
          targetReq.explanation = `AI-assisted evaluation: ${evalItem.explanation || targetReq.explanation}`;
          targetReq.source = "ai_assisted";
        }
      }
    }
  }

  const summary = calculateVerificationSummary(allRequirements);
  return RequirementVerificationSummarySchema.parse(summary);
}

