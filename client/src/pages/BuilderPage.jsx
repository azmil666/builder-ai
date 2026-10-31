import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FolderTreeIcon,
  MessageSquareIcon,
  PaletteIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Loading from '../components/Loading';
import BuilderHeader from '../components/BuilderHeader';
import ChatPanel from '../components/ChatPanel';
import FileExplorer from '../components/FileExplorer';
import PreviewPanel from '../components/PreviewPanel';
import DesignSpecPanel from '../components/DesignSpecPanel';
import ProjectSettingsPanel from '../components/ProjectSettingsPanel';
import VisualQAPanel from '../components/VisualQAPanel';
import AgentProgressDashboard from '../components/AgentProgressDashboard';
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
    activeProject.status === 'failed';

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden text-zinc-100 relative font-sans">
      {/* Top Bar Header */}
      <BuilderHeader
        projectName={activeProject.name}
        version={activeProject.version}
        showCode={showCode}
        deviceViewport={deviceViewport}
        syncStatus={syncStatus}
        publishing={publishing}
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
        <div className="w-12 shrink-0 bg-zinc-950 border-r border-zinc-850 flex flex-col items-center justify-between py-3 z-20 select-none">
          <div className="flex flex-col items-center gap-1.5 w-full px-1">
            {/* Chat Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('chat')}
              className={`p-2.5 rounded-xl transition cursor-pointer ${
                leftTab === 'chat' && !sidebarCollapsed
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
              title="AI Revisions & Chat"
            >
              <MessageSquareIcon size={17} />
            </button>

            {/* Files Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('files')}
              className={`p-2.5 rounded-xl transition cursor-pointer ${
                leftTab === 'files' && !sidebarCollapsed
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
              title="Project Files"
            >
              <FolderTreeIcon size={17} />
            </button>

            {/* Visual QA Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('qa')}
              className={`p-2.5 rounded-xl transition cursor-pointer ${
                leftTab === 'qa' && !sidebarCollapsed
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
              title="Visual QA Engine"
            >
              <ShieldCheckIcon size={17} />
            </button>

            {/* Design Information Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('design')}
              className={`p-2.5 rounded-xl transition cursor-pointer ${
                leftTab === 'design' && !sidebarCollapsed
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
              title="Design Intelligence & Archetype"
            >
              <PaletteIcon size={17} />
            </button>

            {/* Project Settings Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('settings')}
              className={`p-2.5 rounded-xl transition cursor-pointer ${
                leftTab === 'settings' && !sidebarCollapsed
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
              title="Project Settings"
            >
              <SettingsIcon size={17} />
            </button>
          </div>

          {/* Toggle Sidebar Collapse */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition cursor-pointer"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpenIcon size={16} />
            ) : (
              <PanelLeftCloseIcon size={16} />
            )}
          </button>
        </div>

        {/* Left Drawer Panel */}
        {!sidebarCollapsed && (
          <div className="w-[310px] shrink-0 h-full overflow-hidden bg-zinc-950 transition-all duration-200 z-10">
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
        )}

        {/* Center Preview & Editor Canvas */}
        <div className="flex-1 h-full min-w-0 min-h-0 overflow-hidden flex flex-col bg-zinc-950">
          {isOngoingBuild ? (
            <AgentProgressDashboard project={activeProject} />
          ) : (
            <PreviewPanel
              project={activeProject}
              activeFile={activeFile}
              showCode={showCode}
              deviceViewport={deviceViewport}
            />
          )}
        </div>
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
