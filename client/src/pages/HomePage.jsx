import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import {
  GridIcon,
  LayersIcon,
  ListIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';
import { useAppContext } from '../context/useAppContext';
import Promptinput from '../components/Promptinput';
import { curatedPrompts } from '../assets/assets';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import ProjectCard from '../components/dashboard/ProjectCard';
import ProjectDeleteModal from '../components/dashboard/ProjectDeleteModal';

const HomePage = () => {
  const navigate = useNavigate();
  const {
    user,
    projects,
    loadingProjects,
    generatingProject,
    loadProjects,
    handleGenerate,
    handleDelete,
    logout,
  } = useAppContext();

  const [promptValue, setPromptValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'published' | 'drafts'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Copy link helper
  const handleCopyLink = (project) => {
    const isPub = Boolean(project?.published);
    const url = `${window.location.origin}${isPub ? '/publish/' : '/preview/'}${project._id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast.success(isPub ? 'Live website link copied!' : 'Preview link copied!');
      })
      .catch(() => {
        toast.error('Failed to copy link to clipboard');
      });
  };

  // Preview helper
  const handlePreview = (project) => {
    const isPub = Boolean(project?.published);
    const url = `${isPub ? '/publish/' : '/preview/'}${project._id}`;
    window.open(url, '_blank');
  };

  // Delete confirm helper
  const handleDeleteConfirm = async (id) => {
    await handleDelete(id);
    setDeleteTarget(null);
  };

  // Curated prompt select helper
  const handleSelectExamplePrompt = (promptText) => {
    setPromptValue(promptText);
    toast('Prompt loaded into composer', { icon: '✨' });
  };

  // Filter & search logic
  const filteredProjects = useMemo(() => {
    if (!projects || !Array.isArray(projects)) return [];

    return projects.filter((project) => {
      // Tab filter
      if (filterTab === 'published' && !project.published) return false;
      if (filterTab === 'drafts' && project.published) return false;

      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = (project.name || '').toLowerCase();
      const desc = (project.description || '').toLowerCase();
      const archetype = (project.designSpec?.archetype || '').toLowerCase();
      const category = (project.designSpec?.category || '').toLowerCase();

      return (
        name.includes(q) ||
        desc.includes(q) ||
        archetype.includes(q) ||
        category.includes(q)
      );
    });
  }, [projects, filterTab, searchQuery]);

  const publishedCount = useMemo(() => {
    return (projects || []).filter((p) => p.published).length;
  }, [projects]);

  const draftsCount = useMemo(() => {
    return (projects || []).filter((p) => !p.published).length;
  }, [projects]);

  const tabs = [
    { id: 'all', label: 'All', count: projects.length },
    { id: 'published', label: 'Live', count: publishedCount },
    { id: 'drafts', label: 'Drafts', count: draftsCount },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink font-sans">
      {/* Top Header */}
      <DashboardHeader user={user} onLogout={logout} />

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16">
        {/* Centered Command Center Hero */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1 font-mono text-[11px] text-ink-secondary">
            <span className="size-1.5 rounded-full bg-ink" />
            <span>DesignSpec Engine</span>
            <span className="text-ink-subtle">·</span>
            <span className="text-ink-muted">12 Archetypes</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl font-medium tracking-tight text-ink">
            What do you want to build?
          </h1>

          <p className="mt-3.5 max-w-lg text-sm sm:text-base leading-relaxed text-ink-secondary">
            Describe your product or landing page. Builder AI plans the architecture and crafts a complete multi-file React application.
          </p>

          {/* Command Console */}
          <div className="mt-8 w-full text-left">
            <Promptinput
              onSubmit={handleGenerate}
              loading={generatingProject}
              placeholder="E.g., Minimalist AI developer observability platform with live metric charts and pricing..."
              variant="dashboard"
              value={promptValue}
              onChange={setPromptValue}
              autoFocus
            />
          </div>

          {/* Starter Prompts */}
          <div className="mt-5 flex w-full items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {curatedPrompts.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectExamplePrompt(item.prompt)}
                disabled={generatingProject}
                className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-hairline bg-surface/70 px-3.5 py-1.5 text-xs text-ink-secondary transition-colors hover:border-hairline-strong hover:bg-surface-elevated hover:text-ink cursor-pointer"
              >
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted group-hover:text-ink-secondary">
                  {item.tag}
                </span>
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </motion.section>

        {/* Projects Workspace */}
        <section className="space-y-8">
          {/* Airbnb-inspired Pill Search & Filter Toolbar */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-baseline gap-3">
              <h2 className="font-display text-lg font-medium text-ink">
                Projects
              </h2>
              <span className="font-mono text-xs text-ink-muted">
                {projects.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Pill Search Bar */}
              <div className="group relative flex-1 sm:w-64 sm:flex-none">
                <SearchIcon
                  size={14}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted transition-colors group-focus-within:text-ink"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full rounded-full border border-hairline bg-surface/80 backdrop-blur-md py-2 pl-9 pr-8 text-xs text-ink placeholder:text-ink-subtle outline-none transition-all duration-200 focus:w-full sm:focus:w-72 focus:border-white/30 focus:bg-surface-elevated"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-ink-muted hover:text-ink cursor-pointer"
                    title="Clear search"
                  >
                    <XIcon size={13} />
                  </button>
                )}
              </div>

              {/* Pill Filter Tabs with Framer Motion layoutId */}
              <div className="flex items-center rounded-full border border-hairline bg-surface/80 p-1 backdrop-blur-md">
                {tabs.map((tab) => {
                  const isActive = filterTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterTab(tab.id)}
                      className={`relative rounded-full px-3.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        isActive ? 'text-canvas' : 'text-ink-secondary hover:text-ink'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="dashboard-filter-pill"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          className="absolute inset-0 rounded-full bg-ink"
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <span>{tab.label}</span>
                        <span
                          className={`font-mono text-[10px] ${
                            isActive ? 'text-canvas/70' : 'text-ink-muted'
                          }`}
                        >
                          {tab.count}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center rounded-full border border-hairline bg-surface/80 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`rounded-full p-1.5 transition-colors cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-surface-active text-ink'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                  title="Grid View"
                >
                  <GridIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`rounded-full p-1.5 transition-colors cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-surface-active text-ink'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                  title="List View"
                >
                  <ListIcon size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Loading Skeletons */}
          {loadingProjects && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-hairline bg-surface/50 p-4 space-y-3 animate-pulse"
                >
                  <div className="w-full aspect-[16/10] rounded-xl bg-surface-elevated" />
                  <div className="h-4 w-2/3 rounded bg-surface-active" />
                  <div className="h-3 w-1/3 rounded bg-surface-elevated" />
                </div>
              ))}
            </div>
          )}

          {/* Empty State: Workspace has 0 projects */}
          {!loadingProjects && projects.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-surface/30 px-6 py-16 text-center"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-hairline bg-surface-elevated text-ink-secondary">
                <LayersIcon size={18} />
              </div>
              <h3 className="font-display text-base font-medium text-ink">
                No projects yet
              </h3>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-ink-muted">
                Describe your idea in the command bar above or load a starter prompt to generate your first application.
              </p>
              <button
                type="button"
                onClick={() => handleSelectExamplePrompt(curatedPrompts[0].prompt)}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-elevated px-4 py-2 text-xs font-medium text-ink transition-colors hover:border-hairline-strong hover:bg-surface-hover cursor-pointer"
              >
                <SparklesIcon size={13} />
                <span>Try &ldquo;{curatedPrompts[0].title}&rdquo;</span>
              </button>
            </motion.div>
          )}

          {/* Empty State: Search query returned 0 results */}
          {!loadingProjects &&
            projects.length > 0 &&
            filteredProjects.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center rounded-2xl border border-hairline bg-surface/30 px-6 py-14 text-center"
              >
                <SearchIcon size={20} className="mb-3 text-ink-muted" />
                <h3 className="font-display text-sm font-medium text-ink">
                  No matching projects
                </h3>
                <p className="mt-1 text-xs text-ink-muted">
                  No results found for the current filter or search query.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterTab('all');
                  }}
                  className="mt-4 rounded-full border border-hairline bg-surface-elevated px-4 py-1.5 text-xs font-medium text-ink transition-colors hover:border-hairline-strong cursor-pointer"
                >
                  Reset filters
                </button>
              </motion.div>
            )}

          {/* Projects Render: Grid Mode */}
          {!loadingProjects &&
            filteredProjects.length > 0 &&
            viewMode === 'grid' && (
              <motion.div
                layout
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                <AnimatePresence mode="popLayout">
                  {filteredProjects.map((project) => (
                    <ProjectCard
                      key={project._id}
                      project={project}
                      onOpen={(id) => navigate(`/builder/${id}`)}
                      onPreview={handlePreview}
                      onCopyLink={handleCopyLink}
                      onDelete={setDeleteTarget}
                      viewMode="grid"
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

          {/* Projects Render: List Mode */}
          {!loadingProjects &&
            filteredProjects.length > 0 &&
            viewMode === 'list' && (
              <motion.div layout className="space-y-2.5">
                <AnimatePresence mode="popLayout">
                  {filteredProjects.map((project) => (
                    <ProjectCard
                      key={project._id}
                      project={project}
                      onOpen={(id) => navigate(`/builder/${id}`)}
                      onPreview={handlePreview}
                      onCopyLink={handleCopyLink}
                      onDelete={setDeleteTarget}
                      viewMode="list"
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
        </section>
      </main>

      {/* Delete Confirmation Modal */}
      <ProjectDeleteModal
        project={deleteTarget}
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default HomePage;
