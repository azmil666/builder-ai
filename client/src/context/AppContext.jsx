import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api/api";
import toast from "react-hot-toast"
import { useNavigate } from "react-router-dom";
import debounce from "lodash.debounce";

const AppContext = createContext(undefined);

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
       setActiveProject(data);
       
       //default file selection 

       const files = Object.keys(data.files || {});
       if(files.length > 0){
        setActiveFile((prev)=>{
            if(files.includes(prev)) return prev;
            if(files.includes("/App.js")) return "/App.js";
            return files[0];

        });
       }
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
    // automatically poll active project status
    useEffect(() => {
        const projectId = activeProject?._id;
        const status = activeProject?.status;
        if (!projectId || !user) {
            setChatLoading(false);
            return;
        }

        const isOngoing = status === "generating" || status === "pending" || status === "revising";

        if(isOngoing){
            setChatLoading(true);
            const interval = setInterval(()=>{
                loadProject(projectId, true);
            },2000);
            return () => clearInterval(interval);
        }else{
            setChatLoading(false);
        }
    }, [activeProject?._id, activeProject?.status, loadProject, user]);

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
      } finally {
        setChatLoading(false);
      }
    },
    [activeProject, user],
  );

  const debouncedSave = React.useMemo(
    () =>
      debounce(async (files, id) => {
        setSyncStatus("saving");
        try {
          await api.put(`/api/projects/${id}/files`, { files });
          setSyncStatus("saved");
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

  const updateProjectFiles = useCallback(
    async (files) => {
      if (!activeProject || !user) return;
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
        updateProjectFiles,
        syncStatus,
        createFile,
        renameFile,
        deleteFile,
        updateProjectName,
        }}>
        {children}
       </AppContext.Provider> 
    )
}

export function useAppContext(){
    const context = useContext(AppContext);
    if(context === undefined){
        throw new Error("useAppContext must be used within an AppContextProvider");

    }
    return context;
} 
