import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FolderTreeIcon,
  MessageSquareIcon,
  PaletteIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import { useAppContext } from '../context/useAppContext';
import Loading from '../components/Loading';
import BuilderHeader from '../components/BuilderHeader';
import ChatPanel from '../components/ChatPanel';
import FileExplorer from '../components/FileExplorer';
import PreviewPanel from '../components/PreviewPanel';
import DesignSpecPanel from '../components/DesignSpecPanel';
import ProjectSettingsPanel from '../components/ProjectSettingsPanel';
import VisualQAPanel from '../components/VisualQAPanel';
import AgentProgressDashboard from '../components/AgentProgressDashboard';
import GenerationFailureView from '../components/GenerationFailureView';
import PublishModal from '../components/PublishModal';
import ProjectDeleteModal from '../components/dashboard/ProjectDeleteModal';
import api from '../api/api';
import { exportProjectZip } from '../utils/exportProject';

const BuilderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Workspace tab states
  const [leftTab, setLeftTab] = useState('chat'); // 'chat' | 'files' | 'design' | 'settings'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [deviceViewport, setDeviceViewport] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'

  const [publishing, setPublishing] = useState(false);
  const [publishUrl, setPublishUrl] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [inspectPartialFiles, setInspectPartialFiles] = useState(false);

  const {
    activeProject,
    loadingActiveProject,
    activeFile,
    showCode,
    openFile,
    saveNow,
    setShowCode,
    loadProject,
    logout,
    chatLoading,
    handleChat,
    handleGenerate,
    handleDelete,
    syncStatus,
    createFile,
    renameFile,
    deleteFile,
    updateProjectName,
  } = useAppContext();

  useEffect(() => {
    if (!id) return;
    loadProject(id);
  }, [id, loadProject]);

  const handleOpenPreview = () => {
    if (!id) return;
    window.open(`/preview/${id}`, '_blank');
  };

  const handlePublish = async () => {
    if (!id) return;
    setPublishing(true);
    try {
      await api.post(`/api/projects/${id}/publish`);
      const url = `${window.location.origin}/publish/${id}`;
      setPublishUrl(url);
      toast.success('Website published live!');
    } catch (err) {
      console.error('Publish failed:', err);
      toast.error(err?.response?.data?.error || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const handleDownload = async () => {
    if (!activeProject) return;
    await saveNow();
    exportProjectZip(activeProject);
  };

  const handleDeleteConfirm = async (projectId) => {
    await handleDelete(projectId);
    setDeleteTarget(null);
    navigate('/');
  };

  const handleTabClick = (tabKey) => {
    if (leftTab === tabKey && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    } else {
      setLeftTab(tabKey);
      setSidebarCollapsed(false);
    }
  };

  if (loadingActiveProject || !activeProject) {
    return <Loading />;
  }

  const isOngoingBuild =
    activeProject.status === 'pending' ||
    activeProject.status === 'generating' ||
    activeProject.status === 'validating' ||
    activeProject.status === 'repairing' ||
    activeProject.status === 'visual_verifying';
  const isFailed = activeProject.status === 'failed';

  const railTabs = [
    { key: 'chat', icon: MessageSquareIcon, title: 'AI Revisions & Chat' },
    { key: 'files', icon: FolderTreeIcon, title: 'Project Files' },
    { key: 'qa', icon: ShieldCheckIcon, title: 'Visual QA Engine' },
    { key: 'design', icon: PaletteIcon, title: 'Design Intelligence & Archetype' },
    { key: 'settings', icon: SettingsIcon, title: 'Project Settings' },
  ];

  return (
    <div className="h-screen flex flex-col bg-canvas overflow-hidden text-ink relative font-sans">
      {/* Top Bar Header */}
      <BuilderHeader
        projectId={activeProject._id}
        projectName={activeProject.name}
        version={activeProject.version}
        isOngoing={isOngoingBuild || chatLoading}
        showCode={showCode}
        deviceViewport={deviceViewport}
        syncStatus={syncStatus}
        publishing={publishing}
        visualVerification={activeProject.visualVerification}
        onToggleViewMode={() => setShowCode(!showCode)}
        onChangeDeviceViewport={setDeviceViewport}
        onOpenPreview={handleOpenPreview}
        onPublish={handlePublish}
        onDownload={handleDownload}
        onBack={() => navigate('/')}
        onLogout={logout}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
        {/* Left Activity Rail (Icon Bar) */}
        <aside className="w-12 shrink-0 bg-canvas border-r border-white/10 flex flex-col items-center justify-between py-3 z-20 select-none">
          <div className="flex flex-col items-center gap-1.5 w-full px-1.5">
            {railTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = leftTab === tab.key && !sidebarCollapsed;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabClick(tab.key)}
                  className={`relative flex size-9 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'text-ink'
                      : 'text-ink-muted hover:text-ink-secondary hover:bg-surface-elevated'
                  }`}
                  title={tab.title}
                >
                  {isActive && (
                    <motion.span
                      layoutId="builder-rail-active"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-surface-active border border-white/10"
                    />
                  )}
                  <Icon size={16} className="relative z-10" />
                </button>
              );
            })}
          </div>

          {/* Toggle Sidebar Collapse */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-elevated transition-colors cursor-pointer"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpenIcon size={15} />
            ) : (
              <PanelLeftCloseIcon size={15} />
            )}
          </button>
        </aside>

        {/* Fluid Collapsible Left Drawer Panel */}
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && (
            <motion.aside
              key="builder-sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 310, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="shrink-0 h-full overflow-hidden bg-surface z-10"
            >
              <div className="w-[310px] h-full overflow-hidden">
                {leftTab === 'chat' && (
                  <ChatPanel
                    messages={activeProject.messages}
                    onSend={handleChat}
                    loading={chatLoading}
                    onFileSelect={(path) => openFile(path)}
                  />
                )}

                {leftTab === 'files' && (
                  <FileExplorer
                    files={activeProject.files}
                    activeFile={activeFile}
                    onFileSelect={(path) => openFile(path)}
                    onCreateFile={createFile}
                    onRenameFile={renameFile}
                    onDeleteFile={deleteFile}
                  />
                )}

                {leftTab === 'qa' && (
                  <VisualQAPanel
                    projectId={activeProject._id}
                    onApplyFix={handleChat}
                    onFileSelect={(path) => openFile(path)}
                  />
                )}

                {leftTab === 'design' && (
                  <DesignSpecPanel designSpec={activeProject.designSpec} />
                )}

                {leftTab === 'settings' && (
                  <ProjectSettingsPanel
                    project={activeProject}
                    onUpdateName={updateProjectName}
                    onDelete={setDeleteTarget}
                  />
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Center Preview & Editor Canvas (Hero) */}
        <motion.main
          layout
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 h-full min-w-0 min-h-0 overflow-hidden flex flex-col bg-canvas"
        >
          {isOngoingBuild ? (
            <AgentProgressDashboard project={activeProject} />
          ) : isFailed && !inspectPartialFiles ? (
            <GenerationFailureView
              project={activeProject}
              onRetry={() => handleGenerate(activeProject.description || activeProject.name)}
              onBack={() => navigate('/')}
              onInspectFiles={
                Object.keys(activeProject.files || {}).length > 0
                  ? () => setInspectPartialFiles(true)
                  : null
              }
            />
          ) : (
            <>
              {isFailed && inspectPartialFiles && (
                <div className="bg-amber-950/80 border-b border-amber-800/80 px-4 py-2 flex items-center justify-between text-xs text-amber-200 shrink-0">
                  <span>Viewing partial files from failed build.</span>
                  <button
                    type="button"
                    onClick={() => setInspectPartialFiles(false)}
                    className="text-xs text-amber-300 hover:text-white underline cursor-pointer"
                  >
                    Back to Error View
                  </button>
                </div>
              )}
              <PreviewPanel
                project={activeProject}
                activeFile={activeFile}
                showCode={showCode}
                deviceViewport={deviceViewport}
              />
            </>
          )}
        </motion.main>
      </div>

      {/* Publish Live Link Modal */}
      {publishUrl && (
        <PublishModal
          publishUrl={publishUrl}
          onClose={() => setPublishUrl(null)}
        />
      )}

      {/* Delete Project Modal */}
      <ProjectDeleteModal
        project={deleteTarget}
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default BuilderPage;
