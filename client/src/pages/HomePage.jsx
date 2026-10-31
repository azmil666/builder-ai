import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FolderKanbanIcon,
  GlobeIcon,
  GridIcon,
  LayersIcon,
  ListIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header */}
      <DashboardHeader user={user} onLogout={logout} />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
        {/* Hero Prompt Section */}
        <section className="relative flex flex-col items-center text-center max-w-3xl mx-auto">
          {/* Subtle ambient glow behind hero */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-48 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full" />

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 mb-4 shadow-sm">
            <span className="flex size-2 rounded-full bg-indigo-500" />
            <span className="font-medium">DesignSpec Engine Active</span>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-400">12 Archetypes</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-white leading-tight">
            Design & launch production websites with AI
          </h1>

          <p className="mt-3.5 text-sm sm:text-base text-zinc-400 max-w-xl leading-relaxed">
            Describe your idea. Builder AI plans architecture, pairs custom design archetypes, and crafts full multi-file React apps.
          </p>

          {/* Prompt Console */}
          <div className="w-full mt-7 text-left">
            <Promptinput
              onSubmit={handleGenerate}
              loading={generatingProject}
              placeholder="E.g., Modern AI developer observability platform with dark-mode hero, live interactive code snippet, metric graphs, and enterprise pricing cards..."
              variant="dashboard"
              value={promptValue}
              onChange={setPromptValue}
              autoFocus
            />
          </div>

          {/* Example Prompts Shelf */}
          <div className="w-full mt-5">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2 px-1">
              <span className="flex items-center gap-1.5 font-medium text-zinc-400">
                <SparklesIcon size={12} className="text-indigo-400" /> Starter Prompts
              </span>
              <span className="text-zinc-400 text-[11px]">Click to load into composer</span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
              {curatedPrompts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectExamplePrompt(item.prompt)}
                  disabled={generatingProject}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800/80 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white transition-all duration-150 shrink-0 cursor-pointer shadow-sm group"
                >
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 group-hover:text-indigo-400 transition-colors">
                    {item.tag}
                  </span>
                  <span>{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Projects Workspace Section */}
        <section className="space-y-6 pt-4 border-t border-zinc-900">
          {/* Section Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Title & Count */}
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <FolderKanbanIcon size={18} className="text-indigo-400" />
                <span>Projects</span>
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                {projects.length}
              </span>
            </div>

            {/* Controls: Search, Tabs, View Toggle */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 sm:w-64">
                <SearchIcon
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects or archetypes..."
                  className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-9 pr-8 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-indigo-500/20 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
                    title="Clear search"
                  >
                    <XIcon size={13} />
                  </button>
                )}
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center p-0.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterTab === 'all'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  All ({projects.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('published')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                    filterTab === 'published'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <GlobeIcon size={11} className="text-emerald-400" />
                  <span>Live ({publishedCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('drafts')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterTab === 'drafts'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Drafts ({draftsCount})
                </button>
              </div>

              {/* Grid / List View Toggle */}
              <div className="flex items-center p-0.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-zinc-800 text-white'
                      : 'hover:text-zinc-200'
                  }`}
                  title="Grid View"
                >
                  <GridIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-zinc-800 text-white'
                      : 'hover:text-zinc-200'
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-4 space-y-3 animate-pulse"
                >
                  <div className="w-full aspect-[16/10] rounded-xl bg-zinc-850" />
                  <div className="h-4 w-2/3 rounded bg-zinc-800" />
                  <div className="h-3 w-4/5 rounded bg-zinc-850" />
                  <div className="h-3 w-1/3 rounded bg-zinc-850 pt-2" />
                </div>
              ))}
            </div>
          )}

          {/* Empty State: Workspace has 0 projects */}
          {!loadingProjects && projects.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center flex flex-col items-center justify-center">
              <div className="size-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4 shadow-inner">
                <LayersIcon size={22} className="text-indigo-400" />
              </div>
              <h3 className="text-base font-semibold text-zinc-200">
                No projects created yet
              </h3>
              <p className="mt-1 text-sm text-zinc-400 max-w-sm leading-relaxed">
                Describe your website vision in the console above or pick a starter prompt to build your first app.
              </p>
              <button
                type="button"
                onClick={() =>
                  handleSelectExamplePrompt(curatedPrompts[0].prompt)
                }
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-white text-xs font-medium transition cursor-pointer"
              >
                <SparklesIcon size={13} className="text-indigo-400" />
                <span>Try "{curatedPrompts[0].title}"</span>
              </button>
            </div>
          )}

          {/* Empty State: Search query returned 0 results */}
          {!loadingProjects &&
            projects.length > 0 &&
            filteredProjects.length === 0 && (
              <div className="rounded-2xl border border-zinc-850 bg-zinc-900/30 p-10 text-center flex flex-col items-center justify-center">
                <SearchIcon size={24} className="text-zinc-500 mb-3" />
                <h3 className="text-sm font-semibold text-zinc-200">
                  No projects match "{searchQuery}"
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Try checking for typos or searching by a different name, prompt, or archetype.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-4 px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            )}

          {/* Projects Render: Grid Mode */}
          {!loadingProjects &&
            filteredProjects.length > 0 &&
            viewMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
              </div>
            )}

          {/* Projects Render: List Mode */}
          {!loadingProjects &&
            filteredProjects.length > 0 &&
            viewMode === 'list' && (
              <div className="space-y-2.5">
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
              </div>
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
