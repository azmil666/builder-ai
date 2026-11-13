import React, { useCallback, useEffect, useState } from "react";
import api from "../api/api";
import toast from "react-hot-toast"
import { useNavigate } from "react-router-dom";
import debounce from "lodash.debounce";
import { AppContext } from "./useAppContext.js";
import { reconcileProjectState } from "../utils/projectReconciliation.js";

export function AppContextProvider({children}){
    
    const navigate = useNavigate()
    // Auth states
    const [user, setUser] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
    
    {/* States */}
    const [projects, setProjects] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [activeProject, setActiveProject] = useState(null);
    const [loadingActiveProject, setLoadingActiveProject] = useState(true);
    const [chatLoading, setChatLoading] = useState(false);
    const [generatingProject, setGeneratingProject] = useState(false);
    const [activeFile, setActiveFile] = useState("/App.js");
    const [openTabs, setOpenTabs] = useState(["/App.js"]);
    const [dirtyFiles, setDirtyFiles] = useState(new Set());
    const [showCode, setShowCode] = useState(false);
    const [syncStatus, setSyncStatus] = useState("saved"); // "saved" | "saving" | "error"
    
    //Auth Actions
    const checkSession = useCallback(async () => {
        try {
            const { data } = await api.get("/api/auth/me");
            setUser(data.user);
        } catch {
            setUser(null);
        } finally {
            setLoadingUser(false);
        }
    }, []);

    useEffect(() => {
        checkSession();
    }, [checkSession]);

    const login = useCallback(async (email, password) => {
       try {
          const { data } = await api.post("/api/auth/login", { email, password });
          setUser(data.user);
          toast.success("Welcome back!");
          navigate("/");
       } catch (error) {
          console.error("Login failed:", error);
          const errMsg = error?.response?.data?.error || "Invalid email or password";
          toast.error(errMsg);
          throw new Error(errMsg);
       }
    }, [navigate]);

    const register = useCallback(async (name, email, password) => {
       try {
          const { data } = await api.post("/api/auth/register", { name, email, password });
          setUser(data.user);
          toast.success("Account Created Sucessfully!");
          navigate("/");
       } catch (error) {
          console.error("Registration failed:", error);
          const errMsg = error?.response?.data?.error || "Registration failed";
          toast.error(errMsg);
          throw new Error(errMsg);
       }
    }, [navigate]);

    const logout = useCallback(async () => {
        try {
           await api.post("/api/auth/logout");
           setUser(null);
           setProjects([]);
           setActiveProject(null);
           toast.success("Logged out sucessfully");
           navigate("/login");
        } catch (err) {
           console.error("Logout failed:", err);
           toast.error("Logout failed");
        }
    }, [navigate]);
    //project actions

    const loadProjects = useCallback(async () => {
       if(!user) return;
       try {
        const { data } = await api.get("/api/projects");
        setProjects(data);
       } catch(err){
         console.error("Failed to list projects:", err);
         toast.error("Failed to load projects list");
       }finally {
        setLoadingProjects(false);
       }
    }, [user]);
    const loadProject = useCallback(async (id, silent = false) => {
       if(!user) return;
       if (!silent) setLoadingActiveProject(true);
        try {
       const { data } = await api.get(`/api/projects/${id}`);
       setActiveProject((prev) => reconcileProjectState(prev, data));
       
       //default file selection 
       const files = Object.keys(data.files || {});
       if(files.length > 0){
        const target = files.includes("/App.js") ? "/App.js" : files[0];
        setActiveFile(target);
        setOpenTabs((prev) => {
          const valid = prev.filter((p) => files.includes(p));
          return valid.length > 0 ? valid : [target];
        });
       }
       return data;
    } catch (err) {
        console.error("Failed to load project:", err);
        if(!silent){
            toast.error("Failed to load project details");
            navigate("/");
        }  
    }finally{
        if(!silent) setLoadingActiveProject(false);
    }
    }, [user, navigate]);
  // Track whether active project is currently in an ongoing generation/revision state
  const isOngoing = Boolean(
    activeProject?._id &&
      (activeProject.status === "generating" ||
        activeProject.status === "pending" ||
        activeProject.status === "validating" ||
        activeProject.status === "repairing" ||
        activeProject.status === "revising" ||
        activeProject.status === "visual_verifying")
  );

  // Stream progress using Server-Sent Events (SSE) with resilient polling fallback
  useEffect(() => {
    const projectId = activeProject?._id;
    if (!projectId || !user || !isOngoing) {
      setChatLoading(false);
      return;
    }

    setChatLoading(true);

    let eventSource = null;
    let fallbackInterval = null;
    let sseFailed = false;
    let pollCount = 0;
    const MAX_POLLS = 60; // 3 minutes maximum
    let isPolling = false;

    // Start fallback polling if SSE fails or is unsupported
    const startFallbackPolling = () => {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(async () => {
        if (isPolling) return; // Prevent overlapping requests
        pollCount++;
        if (pollCount > MAX_POLLS) {
          clearInterval(fallbackInterval);
          fallbackInterval = null;
          setChatLoading(false);
          console.warn("[Polling] Max poll attempts reached without terminal state.");
          return;
        }

        isPolling = true;
        try {
          const proj = await loadProject(projectId, true);
          if (proj && (proj.status === "completed" || proj.status === "failed")) {
            clearInterval(fallbackInterval);
            fallbackInterval = null;
            setChatLoading(false);
          }
        } catch (pollErr) {
          console.warn("[Polling] Poll request error:", pollErr);
        } finally {
          isPolling = false;
        }
      }, 3000);
    };

    // If EventSource is not supported by browser environment
    if (typeof EventSource === "undefined") {
      startFallbackPolling();
      return () => {
        if (fallbackInterval) clearInterval(fallbackInterval);
      };
    }

    try {
      const baseUrl = import.meta.env.VITE_BASE_URL || "";
      const streamUrl = `${baseUrl}/api/projects/${projectId}/stream`;
      eventSource = new EventSource(streamUrl, { withCredentials: true });

      const stopFallbackPolling = () => {
        if (fallbackInterval) {
          clearInterval(fallbackInterval);
          fallbackInterval = null;
        }
        sseFailed = false;
      };

      eventSource.onopen = () => {
        stopFallbackPolling();
      };

      eventSource.addEventListener("initial_state", (e) => {
        stopFallbackPolling();
        try {
          const data = JSON.parse(e.data);
          setActiveProject((prev) => (prev ? { ...prev, ...data } : prev));
        } catch (err) {
          console.error("Failed to parse initial_state SSE event:", err);
        }
      });

      eventSource.addEventListener("requirement_contract", (e) => {
        try {
          const data = JSON.parse(e.data);
          setActiveProject((prev) =>
            prev ? { ...prev, requirementContract: data.requirementContract } : prev,
          );
        } catch (err) {
          console.error("Failed to parse requirement_contract SSE event:", err);
        }
      });

      eventSource.addEventListener("requirement_verification", (e) => {
        try {
          const data = JSON.parse(e.data);
          setActiveProject((prev) =>
            prev ? { ...prev, requirementVerification: data.requirementVerification } : prev,
          );
        } catch (err) {
          console.error("Failed to parse requirement_verification SSE event:", err);
        }
      });

      eventSource.addEventListener("design_spec", (e) => {
        try {
          const data = JSON.parse(e.data);
          setActiveProject((prev) =>
            prev ? { ...prev, designSpec: data.designSpec } : prev,
          );
        } catch (err) {
          console.error("Failed to parse design_spec SSE event:", err);
        }
      });

      eventSource.addEventListener("plan", (e) => {
        try {
          const data = JSON.parse(e.data);
          setActiveProject((prev) =>
            prev
              ? {
                  ...prev,
                  status: "generating",
                  name: data.name || prev.name,
                  filesPlanned: data.filesPlanned || prev.filesPlanned,
                }
              : prev,
          );
        } catch (err) {
          console.error("Failed to parse plan SSE event:", err);
        }
      });

      eventSource.addEventListener("file_start", (e) => {
        try {
          const data = JSON.parse(e.data);
          setActiveProject((prev) =>
            prev ? { ...prev, currentFile: data.currentFile } : prev,
          );
        } catch (err) {
          console.error("Failed to parse file_start SSE event:", err);
        }
      });

      eventSource.addEventListener("file_complete", (e) => {
        try {
          const data = JSON.parse(e.data);
          setActiveProject((prev) => {
            if (!prev) return prev;
            const updatedFiles = { ...(prev.files || {}) };
            if (data.path && data.file) {
              updatedFiles[data.path] = data.file;
            }
            return {
              ...prev,
              files: updatedFiles,
              filesGenerated: data.filesGenerated || prev.filesGenerated,
              currentFile: null,
            };
          });
        } catch (err) {
          console.error("Failed to parse file_complete SSE event:", err);
        }
      });

      eventSource.addEventListener("validating", () => {
        try {
          setActiveProject((prev) =>
            prev ? { ...prev, status: "validating", currentFile: null } : prev,
          );
        } catch (err) {
          console.error("Failed to parse validating SSE event:", err);
        }
      });

      eventSource.addEventListener("repairing", (e) => {
        try {
          const data = JSON.parse(e.data);
          setActiveProject((prev) =>
            prev
              ? {
                  ...prev,
                  status: "repairing",
                  repairAttempt: data.attempt,
                  repairErrors: data.errors,
                }
              : prev,
          );
        } catch (err) {
          console.error("Failed to parse repairing SSE event:", err);
        }
      });

      // Self-Repair Loop Events (Phase 4 Generation Quality Engine V2)
      const selfRepairEventNames = [
        "repair_started",
        "repair_plan_created",
        "repair_attempt_started",
        "repair_attempt_failed",
        "repair_candidate_verified",
        "repair_completed",
        "repair_exhausted",
      ];
      for (const evtName of selfRepairEventNames) {
        eventSource.addEventListener(evtName, (e) => {
          try {
            const data = JSON.parse(e.data);
            setActiveProject((prev) => {
              if (!prev) return prev;
              const currentSelfRepair = prev.selfRepair || {};
              return {
                ...prev,
                selfRepair: {
                  ...currentSelfRepair,
                  lastEvent: evtName,
                  ...data,
                },
              };
            });
          } catch (err) {
            console.error(`Failed to parse ${evtName} SSE event:`, err);
          }
        });
      }

      eventSource.addEventListener("visual_verifying", (e) => {
        try {
          const data = JSON.parse(e.data);
          setActiveProject((prev) =>
            prev
              ? {
                  ...prev,
                  status: "visual_verifying",
                  visualVerification: data.visualVerification || prev.visualVerification,
                  currentFile: null,
                }
              : prev,
          );
        } catch (err) {
          console.error("Failed to parse visual_verifying SSE event:", err);
        }
      });

      eventSource.addEventListener("completed", (e) => {
        try {
          const data = JSON.parse(e.data);
          setActiveProject((prev) =>
            prev
              ? {
                  ...prev,
                  status: "completed",
                  version: data.version || prev.version || 1,
                  name: data.name || prev.name,
                  designSpec: data.designSpec || prev.designSpec,
                  requirementContract: data.requirementContract || prev.requirementContract,
                  visualVerification: data.visualVerification || prev.visualVerification,
                }
              : prev,
          );
          setChatLoading(false);
          eventSource?.close();
          if (fallbackInterval) {
            clearInterval(fallbackInterval);
            fallbackInterval = null;
          }
          loadProject(projectId, true);
        } catch (err) {
          console.error("Failed to parse completed SSE event:", err);
        }
      });

      eventSource.addEventListener("failed", (e) => {
        try {
          const data = JSON.parse(e.data);
          setActiveProject((prev) =>
            prev
              ? {
                  ...prev,
                  status: "failed",
                  error: data.error || "Generation failed",
                }
              : prev,
          );
          setChatLoading(false);
          eventSource?.close();
          if (fallbackInterval) {
            clearInterval(fallbackInterval);
            fallbackInterval = null;
          }
        } catch (err) {
          console.error("Failed to parse failed SSE event:", err);
        }
      });

      eventSource.onerror = (err) => {
        console.warn("[SSE] Stream disconnected or error, activating polling fallback:", err);
        if (!sseFailed) {
          sseFailed = true;
          startFallbackPolling();
        }
      };
    } catch (err) {
      console.error("[SSE] Connection error:", err);
      startFallbackPolling();
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [activeProject?._id, isOngoing, loadProject, user]);

    const handleGenerate = useCallback(
        async (prompt) => {
           if(!user) return;
           setGeneratingProject(true);
           try {
              const { data } = await api.post("/api/projects", { prompt });
              toast.success("AI Agent is planning structure...")
              navigate(`/builder/${data._id}`)
           } catch (err) {
            console.error("Failed to generate project:", err);
            toast.error(err?.response?.data?.error || "Failed to generate project");
           } finally {
            setGeneratingProject(false);
           }
        },[navigate, user]
    )

    const handleDelete = useCallback(
        async (id) => {
           if(!user) return;
           
           try {
              await api.delete(`/api/projects/${id}`);
              setProjects((prev)=>prev.filter((p)=>p._id !== id))
              toast.success("Project deleted sucessfully")

           } catch (err) {
            console.error("Failed to delete project:", err);
            toast.error("Failed to delete project");
           } 
        },[user]
    )

    const handleChat = useCallback(
    async (prompt) => {
      if (!activeProject || !user) return;
      setChatLoading(true);
      try {
        const { data } = await api.post(
          `/api/projects/${activeProject._id}/chat`,
          { prompt },
        );
        setActiveProject(data);
        if (data.errors && data.errors.length > 0) {
          toast.error(`${data.errors.length} revision patch(es) failed`);
        } else {
          toast.success(`Updated to version ${data.version}`);
        }
      } catch (err) {
        console.error("Revision request failed:", err);
        toast.error(err?.response?.data?.error || "Revision request failed");
        loadProject(activeProject._id, true);
      } finally {
        setChatLoading(false);
      }
    },
    [activeProject, user, loadProject],
  );

  const reportVisualVerification = useCallback(
    async (projectId, payload) => {
      try {
        const { data } = await api.post(
          `/api/projects/${projectId}/visual-verification`,
          payload,
        );
        if (data.status === "repairing" && data.files) {
          setActiveProject((prev) =>
            prev
              ? {
                  ...prev,
                  status: "repairing",
                  files: data.files,
                  visualVerification: data.visualVerification,
                }
              : prev,
          );
        } else if (data.completed) {
          setActiveProject((prev) =>
            prev
              ? {
                  ...prev,
                  status: "completed",
                  visualVerification: data.visualVerification,
                }
              : prev,
          );
          loadProject(projectId, true);
        }
        return data;
      } catch (err) {
        console.error("Failed to report visual verification:", err);
        return null;
      }
    },
    [loadProject],
  );

  const fetchProjectVersions = useCallback(
    async (projectId) => {
      if (!projectId || !user) return [];
      try {
        const { data } = await api.get(`/api/projects/${projectId}/versions`);
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.error("Failed to fetch project versions:", err);
        toast.error(err?.response?.data?.error || "Failed to load version history");
        return [];
      }
    },
    [user],
  );

  const restoreProjectVersion = useCallback(
    async (projectId, targetVersion) => {
      if (!projectId || targetVersion === undefined || !user) return null;
      try {
        // Cancel any pending debounced manual file saves so they don't overwrite restored files
        debouncedSave.cancel();

        const { data } = await api.post(
          `/api/projects/${projectId}/versions/${targetVersion}/restore`,
        );

        // Update active project state cleanly
        setActiveProject(data);

        // Reset dirty file flags and sync state
        setDirtyFiles(new Set());
        setSyncStatus("saved");

        // Verify and update active file and open tabs if current file was removed in that snapshot
        const files = Object.keys(data.files || {});
        if (files.length > 0) {
          const fallbackTarget = files.includes("/App.js") ? "/App.js" : files[0];
          setActiveFile((prev) => (files.includes(prev) ? prev : fallbackTarget));
          setOpenTabs((prev) => {
            const valid = prev.filter((p) => files.includes(p));
            return valid.length > 0 ? valid : [fallbackTarget];
          });
        }

        toast.success(`Restored to v${targetVersion}`);

        // Keep local projects list in sync
        setProjects((prev) =>
          prev.map((p) =>
            p._id === data._id ? { ...p, version: data.version, name: data.name } : p,
          ),
        );

        return data;
      } catch (err) {
        console.error("Failed to restore version:", err);
        const errMsg =
          err?.response?.data?.error || `Failed to restore version ${targetVersion}`;
        toast.error(errMsg);
        throw err;
      }
    },
    [user, debouncedSave],
  );

  const debouncedSave = React.useMemo(
    () =>
      debounce(async (files, id) => {
        setSyncStatus("saving");
        try {
          await api.put(`/api/projects/${id}/files`, { files });
          setSyncStatus("saved");
          setDirtyFiles(new Set());
        } catch (err) {
          console.error("Failed to auto-save files:", err);
          setSyncStatus("error");
          toast.error("Failed to save code modifications");
        }
      }, 1000),
    [],
  );

  useEffect(() => {
    return () => {
      debouncedSave.flush();
    };
  }, [debouncedSave]);

  const saveNow = useCallback(async () => {
    debouncedSave.flush();
    setSyncStatus("saved");
    setDirtyFiles(new Set());
    toast.success("Saved project files");
  }, [debouncedSave]);

  const markFileDirty = useCallback((path, isDirty = true) => {
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      if (isDirty) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);

  const openFile = useCallback((path) => {
    setActiveFile(path);
    setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setShowCode(true);
  }, []);

  const closeTab = useCallback(
    (path) => {
      setOpenTabs((prev) => {
        const filtered = prev.filter((p) => p !== path);
        const nextTabs = filtered.length > 0 ? filtered : ["/App.js"];
        if (activeFile === path) {
          const nextActive = nextTabs[nextTabs.length - 1] || "/App.js";
          setActiveFile(nextActive);
        }
        return nextTabs;
      });
    },
    [activeFile],
  );

  const updateProjectFiles = useCallback(
    async (files) => {
      if (!activeProject || !user) return;
      setActiveProject((prev) => (prev ? { ...prev, files } : prev));
      setSyncStatus("saving");
      debouncedSave(files, activeProject._id);
    },
    [activeProject, user, debouncedSave],
  );

  const createFile = useCallback(
    async (path, initialContent = "// New Component\nimport React from 'react';\n\nexport default function Component() {\n  return <div>Component</div>;\n}\n") => {
      if (!activeProject || !user) return;
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const currentFiles = activeProject.files || {};
      if (currentFiles[normalizedPath]) {
        toast.error("File already exists");
        return;
      }
      const updated = {
        ...currentFiles,
        [normalizedPath]: { content: initialContent },
      };
      setActiveProject((prev) => (prev ? { ...prev, files: updated } : prev));
      setActiveFile(normalizedPath);
      setOpenTabs((prev) => (prev.includes(normalizedPath) ? prev : [...prev, normalizedPath]));
      setShowCode(true);
      updateProjectFiles(updated);
      toast.success(`Created ${normalizedPath}`);
    },
    [activeProject, user, updateProjectFiles],
  );

  const renameFile = useCallback(
    async (oldPath, newPath) => {
      if (!activeProject || !user) return;
      if (oldPath === "/App.js") {
        toast.error("Cannot rename primary entry point /App.js");
        return;
      }
      const normalizedNew = newPath.startsWith("/") ? newPath : `/${newPath}`;
      const currentFiles = activeProject.files || {};
      if (currentFiles[normalizedNew]) {
        toast.error("A file with that name already exists");
        return;
      }
      const fileData = currentFiles[oldPath];
      if (!fileData) return;

      const updated = { ...currentFiles };
      delete updated[oldPath];
      updated[normalizedNew] = fileData;

      setActiveProject((prev) => (prev ? { ...prev, files: updated } : prev));
      setActiveFile((prev) => (prev === oldPath ? normalizedNew : prev));
      setOpenTabs((prev) => prev.map((p) => (p === oldPath ? normalizedNew : p)));
      updateProjectFiles(updated);
      toast.success(`Renamed to ${normalizedNew}`);
    },
    [activeProject, user, updateProjectFiles],
  );

  const deleteFile = useCallback(
    async (path) => {
      if (!activeProject || !user) return;
      if (path === "/App.js" || path === "/styles.css") {
        toast.error(`Cannot delete core file ${path}`);
        return;
      }
      const currentFiles = activeProject.files || {};
      if (!currentFiles[path]) return;

      const updated = { ...currentFiles };
      delete updated[path];

      setActiveProject((prev) => (prev ? { ...prev, files: updated } : prev));
      setActiveFile((prev) => (prev === path ? "/App.js" : prev));
      setOpenTabs((prev) => {
        const next = prev.filter((p) => p !== path);
        return next.length > 0 ? next : ["/App.js"];
      });
      updateProjectFiles(updated);
      toast.success(`Deleted ${path}`);
    },
    [activeProject, user, updateProjectFiles],
  );

  const updateProjectName = useCallback(
    async (newName) => {
      if (!activeProject || !user || !newName.trim()) return;
      try {
        setActiveProject((prev) => (prev ? { ...prev, name: newName.trim() } : prev));
        toast.success("Project updated");
      } catch (err) {
        console.error("Failed to update project name:", err);
      }
    },
    [activeProject, user],
  );

    return (
       <AppContext.Provider value={{
        user,
        loadingUser,
        login,
        register,
        projects,
        loadingProjects,
        activeProject,
        loadingActiveProject,
        chatLoading,
        generatingProject,
        activeFile,
        showCode,
        setActiveFile,
        setShowCode,
        loadProjects,
        loadProject,
        handleGenerate,
        handleDelete,
        logout,
        handleChat,
        reportVisualVerification,
        fetchProjectVersions,
        restoreProjectVersion,
        updateProjectFiles,
        syncStatus,
        openTabs,
        dirtyFiles,
        openFile,
        closeTab,
        markFileDirty,
        saveNow,
        createFile,
        renameFile,
        deleteFile,
        updateProjectName,
        }}>
        {children}
       </AppContext.Provider> 
    )
} 
