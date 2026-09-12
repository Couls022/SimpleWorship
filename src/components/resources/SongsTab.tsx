import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus,
  Play,
  Search,
  Music,
  Edit3,
  Trash2,
  GripVertical,
  Copy,
  Tag,
  PlusCircle,
  Sparkles,
  Download,
  Upload,
  ChevronDown,
  FolderUp,
  FolderDown,
  Check,
  RefreshCw,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { Song, PresentationItem } from "../../types";
import { handleRangeSelection } from "../../utils/selectionUtils";
import { BAPTIST_HYMNAL_SONGS } from "../../data/baptistHymnal";
import { HYMNS_OF_PRAISES } from "../../data/hymnsOfPraises";
import { BAPTIST_SPECIAL_NUMBERS } from "../../data/specialNumbers";
import { OfflineSearchEngine } from "../../core/OfflineSearchEngine";
import { PortalDropdown } from "../common/PortalDropdown";

interface SongsTabProps {
  onOpenNewSong: () => void;
  onEditSong: (song: Song) => void;
}

const CATEGORIES = ["All", "Hymns", "Special Number"] as const;
type CategoryType = (typeof CATEGORIES)[number];

export default function SongsTab({ onOpenNewSong, onEditSong }: SongsTabProps) {
  const store = useStore();
  const { songsList, addScheduleItem, addSong, deleteSong } = store;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>(() =>
    songsList[0]?.id ? [songsList[0].id] : [],
  );
  const [anchorSongId, setAnchorSongId] = useState<string | null>(
    () => songsList[0]?.id || null,
  );
  const [activeCategory, setActiveCategory] = useState<CategoryType>("All");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [categoryWidth, setCategoryWidth] = useState(140);
  const [actionsWidth, setActionsWidth] = useState(90);
  const [resizingColumn, setResizingColumn] = useState<
    "category" | "actions" | null
  >(null);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const importExportDropdownRef = useRef<HTMLDivElement>(null);

  // Resizing Category Column (between Title and Category)
  const handleCategoryResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn("category");
    const startX = e.clientX;
    const startWidth = categoryWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      // Dragging left makes category wider; dragging right makes category narrower
      const delta = startX - moveEvent.clientX;
      setCategoryWidth(Math.max(105, Math.min(260, startWidth + delta)));
    };

    const onMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // Resizing Actions Column (between Category and Actions)
  const handleActionsResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn("actions");
    const startX = e.clientX;
    const startWidth = actionsWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      // Dragging left makes actions column wider; dragging right makes actions narrower
      const delta = startX - moveEvent.clientX;
      setActionsWidth(Math.max(75, Math.min(160, startWidth + delta)));
    };

    const onMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    song: Song;
  } | null>(null);

  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportSongs = (
    songsToExport: Song[] = songsList,
    fileNamePrefix: string = "simpleworship_songs",
  ) => {
    try {
      const songsData = JSON.stringify(songsToExport, null, 2);
      const blob = new Blob([songsData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileNamePrefix}_${new Date().toISOString().split("T")[0]}.sws`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.dispatchEvent(
        new CustomEvent("simpleworship:notify", {
          detail: `Exported ${songsToExport.length} songs successfully.`,
        }),
      );
    } catch (err) {
      console.error("Failed to export songs:", err);
      window.dispatchEvent(
        new CustomEvent("simpleworship:notify", {
          detail: "Failed to export songs.",
        }),
      );
    }
  };

  const handleImportSongs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        let importedSongs: Song[] = [];
        const parsed = JSON.parse(content);

        if (Array.isArray(parsed)) {
          importedSongs = parsed;
        } else if (parsed && Array.isArray(parsed.songs)) {
          importedSongs = parsed.songs;
        } else {
          throw new Error("Invalid format: expected an array of songs.");
        }

        const validSongs = importedSongs.filter((s) => s && s.title);

        if (validSongs.length === 0) {
          throw new Error("No valid songs found in the file.");
        }

        for (const song of validSongs) {
          const formattedSong: Song = {
            id:
              song.id ||
              `song-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            title: song.title,
            author: song.author || "",
            category: song.category || "Hymns",
            lyrics: song.lyrics || "",
            sections:
              Array.isArray(song.sections) && song.sections.length > 0
                ? song.sections
                : [
                    {
                      id: `sec-${Date.now()}`,
                      name: "Verse 1",
                      text: song.lyrics || song.title,
                    },
                  ],
            ccli: song.ccli,
            ccliNumber: song.ccliNumber,
            key: song.key || "G",
            tempo: song.tempo || "Moderate",
          };
          await addSong(formattedSong);
        }

        window.dispatchEvent(
          new CustomEvent("simpleworship:notify", {
            detail: `Imported ${validSongs.length} songs successfully.`,
          }),
        );
      } catch (err) {
        console.error("Failed to import songs:", err);
        window.dispatchEvent(
          new CustomEvent("simpleworship:notify", {
            detail: `Failed to import songs. Please ensure it is a valid .sws or JSON file.`,
          }),
        );
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreDefaultHymnal = async () => {
    try {
      let restored = 0;
      const allBuiltInSongs = [...BAPTIST_HYMNAL_SONGS, ...HYMNS_OF_PRAISES, ...BAPTIST_SPECIAL_NUMBERS];
      for (const hymn of allBuiltInSongs) {
        if (
          !songsList.some(
            (s) =>
              s.id === hymn.id ||
              s.title.toLowerCase() === hymn.title.toLowerCase(),
          )
        ) {
          await addSong(hymn);
          restored++;
        }
      }
      window.dispatchEvent(
        new CustomEvent("simpleworship:notify", {
          detail:
            restored > 0
              ? `Restored ${restored} standard hymns to song library.`
              : "All standard hymns are already present in library.",
        }),
      );
    } catch (err) {
      console.error("Failed to restore hymnal:", err);
    }
  };

  useEffect(() => {
    const handleFocusSearch = (e: CustomEvent) => {
      if (e.detail?.target === "songs" || !e.detail?.target) {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener(
      "simpleworship:focus-search" as any,
      handleFocusSearch,
    );
    return () =>
      window.removeEventListener(
        "simpleworship:focus-search" as any,
        handleFocusSearch,
      );
  }, []);

  const getNormalizedCategory = (song: Song): "Hymns" | "Special Number" => {
    const cat = (song.category || "").toLowerCase();
    if (
      cat.includes("special") ||
      (song.tags && song.tags.some((t) => t.toLowerCase().includes("special")))
    ) {
      return "Special Number";
    }
    return "Hymns";
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: songsList.length,
      Hymns: 0,
      "Special Number": 0,
    };
    songsList.forEach((s) => {
      const cat = getNormalizedCategory(s);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [songsList]);

  const filteredSongs = useMemo(() => {
    return OfflineSearchEngine.filterSongs(
      songsList,
      searchQuery,
      activeCategory,
    );
  }, [songsList, activeCategory, searchQuery]);

  const handleAddToSchedule = (song: Song) => {
    store.addScheduleItem({
      type: "song",
      contentId: song.id,
      name: song.title,
      notes: song.author
        ? `Key of ${song.key || "G"} • By ${song.author}`
        : undefined,
      customBackgroundUrl: undefined,
      themeOverride: song.themeOverride,
      data: {
        songId: song.id,
        title: song.title,
        author: song.author,
        key: song.key,
        lyrics: song.lyrics,
        sections: song.sections,
        ccliNumber: song.ccliNumber,
      },
    });
    window.dispatchEvent(
      new CustomEvent("simpleworship:notify", {
        detail: `Added "${song.title}" to schedule!`,
      }),
    );
  };

  const handleGoLive = (song: Song) => {
    const item: PresentationItem = {
      id: `song-${song.id}-${Date.now()}`,
      type: "song",
      contentId: song.id,
      name: song.title,
      notes: song.author
        ? `Key of ${song.key || "G"} • By ${song.author}`
        : undefined,
      customBackgroundUrl: undefined,
      themeOverride: song.themeOverride,
      data: {
        songId: song.id,
        title: song.title,
        author: song.author,
        key: song.key,
        lyrics: song.lyrics,
        sections: song.sections,
        ccliNumber: song.ccliNumber,
      },
    };
    store.addScheduleItem(item);
    store.setPreviewItem(item.id, 0);
    store.goLiveItem(item.id, 0, store.activeControlGroupId || undefined, item);
  };

  // Drag-and-drop start handler with full metadata
  const handleDragStart = (e: React.DragEvent, song: Song) => {
    const payload = {
      type: "song",
      item: {
        id: `song-${song.id}-${Date.now()}`,
        type: "song",
        contentId: song.id,
        name: song.title,
        notes: song.author
          ? `Key of ${song.key || "G"} • By ${song.author}`
          : undefined,
        customBackgroundUrl: undefined,
        themeOverride: song.themeOverride,
        data: {
          songId: song.id,
          title: song.title,
          author: song.author,
          key: song.key,
          lyrics: song.lyrics,
          sections: song.sections,
          ccliNumber: song.ccliNumber,
        },
      },
    };
    const jsonStr = JSON.stringify(payload);
    e.dataTransfer.setData("application/json", jsonStr);
    e.dataTransfer.setData("application/x-simpleworship-item", jsonStr);
    e.dataTransfer.setData("text/plain", song.title);
    e.dataTransfer.effectAllowed = "copyMove";
  };

  const handleSongClick = (e: React.MouseEvent, song: Song) => {
    const { selectedIds, anchorId } = handleRangeSelection(
      filteredSongs,
      selectedSongIds,
      song.id,
      e,
      anchorSongId,
    );
    setSelectedSongIds(selectedIds);
    setAnchorSongId(anchorId);
  };

  const handleContextMenu = (e: React.MouseEvent, song: Song) => {
    e.preventDefault();
    if (!selectedSongIds.includes(song.id)) {
      setSelectedSongIds([song.id]);
      setAnchorSongId(song.id);
    }
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 240),
      song,
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#181a1f] text-gray-200 select-none text-xs relative">
      {/* Top Search & Category Filter Bar */}
      <div className="h-10 bg-[#22252c] border-b border-[#15161a] flex items-center justify-between px-3 gap-3 shrink-0 relative z-30">
        <div className="flex items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
          {/* 1. Song Search Input */}
          <div className="relative flex-1 min-w-0 min-w-[100px] max-w-xs shrink">
            <Search
              size={13}
              className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search songs..."
              className="w-full bg-[#141519] border border-[#373c49] focus:border-cyan-500 rounded pl-8 pr-7 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none transition-colors shadow-inner truncate"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-gray-400 hover:text-white p-0.5 text-[10px]"
                title="Clear Search"
              >
                ✕
              </button>
            )}
          </div>

          {/* 2. + New Song Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenNewSong();
            }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-2 sm:px-3 py-1.5 rounded text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
            title="Create New Song in SimpleWorship Slide Editor (Ctrl+N)"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span className="hidden sm:inline">New Song</span>
          </button>

          {/* 3. Category Filter Button with Fully Functional Clickable Dropdown Menu */}
          <div className="relative shrink-0" ref={categoryDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsCategoryOpen((prev) => !prev);
                setIsImportExportOpen(false);
              }}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                isCategoryOpen || activeCategory !== "All"
                  ? "bg-[#1c2230] border-cyan-500/80 text-cyan-300 ring-1 ring-cyan-500/30"
                  : "bg-[#16181e] hover:bg-[#20232e] text-gray-200 border-[#2d3240]"
              }`}
              title="Filter by Category"
            >
              <Tag
                size={13}
                className={
                  activeCategory !== "All" ? "text-cyan-300" : "text-cyan-400"
                }
              />
              <span className="hidden lg:inline">
                Category: {activeCategory}
              </span>
              <span className="inline lg:hidden">
                {activeCategory === "All" ? "Filter" : activeCategory}
              </span>
              <ChevronDown
                size={12}
                className={`ml-1 transition-transform duration-200 hidden sm:block ${isCategoryOpen ? "rotate-180 text-cyan-400" : "text-gray-400"}`}
              />
            </button>

            {/* Category Dropdown Menu */}
            <PortalDropdown
              isOpen={isCategoryOpen}
              onClose={() => setIsCategoryOpen(false)}
              triggerRef={categoryDropdownRef}
              className="w-60 bg-[#1a1c24] border border-[#2e3342] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
            >
              <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-gray-400 uppercase border-b border-[#2a2e3d] mb-1 flex items-center justify-between">
                <span>Select Category</span>
                <span className="text-gray-500">{songsList.length} Total</span>
              </div>

              <div className="flex flex-col gap-0.5">
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat;
                  const count = categoryCounts[cat] || 0;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setActiveCategory(cat);
                        setIsCategoryOpen(false);
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer w-full text-left ${
                        isActive
                          ? "bg-cyan-600 text-white font-bold shadow-xs"
                          : "text-gray-300 hover:bg-[#252936] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Check
                          size={13}
                          className={
                            isActive ? "opacity-100 text-white" : "opacity-0"
                          }
                        />
                        <span>{cat}</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                          isActive
                            ? "bg-cyan-700/80 text-white"
                            : "bg-[#222530] text-gray-400 border border-[#2e3342]"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeCategory !== "All" && (
                <div className="mt-1 pt-1 border-t border-[#2a2e3d]">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory("All");
                      setIsCategoryOpen(false);
                    }}
                    className="w-full text-center py-1 text-[11px] text-gray-400 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    Clear Category Filter
                  </button>
                </div>
              )}
            </PortalDropdown>
          </div>

          {/* 4. Import / Export Dropdown Button with Full Functional Options */}
          <div className="relative shrink-0" ref={importExportDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsImportExportOpen((prev) => !prev);
                setIsCategoryOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                isImportExportOpen
                  ? "bg-[#262c3b] border-cyan-500/80 text-cyan-300 ring-1 ring-cyan-500/30"
                  : "bg-[#222631] hover:bg-[#2a2f3d] text-gray-200 border-[#383d4e]"
              }`}
              title="Import or Export Songs (.sws / JSON)"
            >
              <FolderUp size={13} className="text-cyan-400" />
              <span>Import / Export</span>
              <ChevronDown
                size={12}
                className={`ml-0.5 transition-transform duration-200 ${isImportExportOpen ? "rotate-180 text-cyan-400" : "text-gray-400"}`}
              />
            </button>

            <PortalDropdown
              isOpen={isImportExportOpen}
              onClose={() => setIsImportExportOpen(false)}
              triggerRef={importExportDropdownRef}
              align="right"
              className="w-64 bg-[#1a1c24] border border-[#2e3342] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
            >
              <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-gray-400 uppercase border-b border-[#2a2e3d] mb-1">
                Song Library Tools
              </div>

              <div className="flex flex-col gap-0.5">
                {/* Import Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsImportExportOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-xs text-gray-200 hover:bg-[#252936] hover:text-white transition-colors text-left w-full cursor-pointer group"
                >
                  <Upload
                    size={14}
                    className="text-cyan-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-100">
                      Import Songs (.sws / JSON)
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Load songs from saved backup file
                    </span>
                  </div>
                </button>

                {/* Export All Songs */}
                <button
                  type="button"
                  onClick={() => {
                    setIsImportExportOpen(false);
                    handleExportSongs(songsList, "simpleworship_songs_all");
                  }}
                  className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-xs text-gray-200 hover:bg-[#252936] hover:text-white transition-colors text-left w-full cursor-pointer group"
                >
                  <Download
                    size={14}
                    className="text-indigo-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-100">
                      Export All Songs (.sws)
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Backup complete library ({songsList.length} songs)
                    </span>
                  </div>
                </button>

                {/* Export Filtered Songs */}
                {activeCategory !== "All" && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsImportExportOpen(false);
                      handleExportSongs(
                        filteredSongs,
                        `simpleworship_songs_${activeCategory.toLowerCase().replace(/\s+/g, "_")}`,
                      );
                    }}
                    className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-xs text-gray-200 hover:bg-[#252936] hover:text-white transition-colors text-left w-full cursor-pointer group"
                  >
                    <FolderDown
                      size={14}
                      className="text-amber-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform"
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-100">
                        Export "{activeCategory}" ({filteredSongs.length})
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Export only currently selected category
                      </span>
                    </div>
                  </button>
                )}

                {/* Restore Baptist Hymnal Default */}
                <div className="pt-1 mt-1 border-t border-[#2a2e3d]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsImportExportOpen(false);
                      handleRestoreDefaultHymnal();
                    }}
                    className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-xs text-gray-200 hover:bg-[#252936] hover:text-white transition-colors text-left w-full cursor-pointer group"
                  >
                    <Sparkles
                      size={14}
                      className="text-yellow-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform"
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-yellow-300">
                        Restore Built-in Songs
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Add standard hymnals and special numbers
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </PortalDropdown>

            <input
              type="file"
              accept=".sws,.json"
              ref={fileInputRef}
              onChange={handleImportSongs}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Main Full-Width Song Table */}
      <div className="flex-1 flex flex-col bg-[#141519] overflow-hidden relative">
        {/* Scrollable Container with Sticky Table Header */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {/* Table Header - Sticky at the top */}
          <div className="sticky top-0 flex h-8 bg-[#20232a] border-b border-[#282b34] text-[11px] font-bold text-gray-400 items-center shrink-0 select-none z-30">
            {/* Index Column */}
            <div className="w-[46px] shrink-0 h-full flex items-center justify-center text-[10px] text-gray-400">
              #
            </div>

            {/* Title Column */}
            <div className="relative flex-1 min-w-[180px] h-full flex items-center px-3">
              <span className="truncate">Title (Drag to Schedule)</span>

              {/* Invisible Resizer 1 (Between Title and Category) */}
              <div
                className="absolute right-0 top-0 bottom-0 w-3 -mr-1.5 cursor-col-resize z-20"
                onMouseDown={handleCategoryResize}
                onDoubleClick={() => setCategoryWidth(140)}
                title="Drag to resize Category"
              />
            </div>

            {/* Category Column - Perfectly Aligned */}
            <div
              className="relative h-full flex items-center justify-center px-2 shrink-0"
              style={{ width: `${categoryWidth}px` }}
            >
              <span className="truncate uppercase tracking-wider text-[10px] font-bold text-gray-400 text-center w-full select-none">
                Category
              </span>

              {/* Invisible Resizer 2 (Between Category and Actions) */}
              <div
                className="absolute right-0 top-0 bottom-0 w-3 -mr-1.5 cursor-col-resize z-20"
                onMouseDown={handleActionsResize}
                onDoubleClick={() => setActionsWidth(90)}
                title="Drag to resize Actions"
              />
            </div>

            {/* Actions Column - Perfectly Aligned */}
            <div
              className="h-full flex items-center justify-center px-2 shrink-0 text-center"
              style={{ width: `${actionsWidth}px` }}
            >
              <span className="truncate uppercase tracking-wider text-[10px] font-bold text-gray-400 text-center w-full select-none">
                Actions
              </span>
            </div>
          </div>

          {/* Table Body - Rows */}
          <div className="divide-y divide-[#1e2027]">
            {filteredSongs.length === 0 ? (
              <div className="p-12 text-center text-gray-500 text-xs flex flex-col items-center justify-center gap-2">
                <Music size={28} className="text-gray-600" />
                <span>No songs found in "{activeCategory}".</span>
                <button
                  onClick={onOpenNewSong}
                  className="mt-2 text-cyan-400 hover:underline font-semibold cursor-pointer"
                  type="button"
                >
                  + Create new song in this category
                </button>
              </div>
            ) : (
              filteredSongs.map((song, idx) => {
                const isSelected = selectedSongIds.includes(song.id);
                const normalizedCat = getNormalizedCategory(song);

                return (
                  <div
                    key={song.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, song)}
                    onClick={(e) => handleSongClick(e, song)}
                    onDoubleClick={() => handleGoLive(song)}
                    onContextMenu={(e) => handleContextMenu(e, song)}
                    className={`flex h-9 text-xs transition-colors items-center cursor-grab active:cursor-grabbing border-b border-[#1b1d24] group ${
                      isSelected
                        ? "bg-[#22334d] text-white font-medium border-l-2 border-l-cyan-400 ring-1 ring-cyan-500/30"
                        : "hover:bg-[#1c1e25] text-gray-300"
                    }`}
                  >
                    {/* Grip & Index */}
                    <div className="w-[46px] shrink-0 h-full flex items-center justify-center gap-1 text-gray-500 group-hover:text-gray-300">
                      <GripVertical
                        size={12}
                        className="shrink-0 opacity-60 group-hover:opacity-100"
                      />
                      <span className="font-mono text-[10px] text-gray-400">
                        {idx + 1}
                      </span>
                    </div>

                    {/* Title */}
                    <div
                      className="flex-1 min-w-[180px] h-full flex items-center gap-2 font-semibold text-cyan-200 truncate px-3"
                      title={song.title}
                    >
                      <Music size={13} className="text-cyan-400 shrink-0" />
                      <span className="truncate">{song.title}</span>
                    </div>

                    {/* Category Badge - Directly aligned with Category header */}
                    <div
                      className="shrink-0 h-full flex items-center justify-center px-2"
                      style={{ width: `${categoryWidth}px` }}
                    >
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded text-[10px] font-bold border truncate max-w-full text-center select-none ${
                          normalizedCat === "Special Number"
                            ? "bg-purple-950/80 text-purple-300 border-purple-800/80"
                            : "bg-cyan-950/80 text-cyan-300 border-cyan-800/80"
                        }`}
                      >
                        {normalizedCat}
                      </span>
                    </div>

                    {/* Action Buttons - Directly aligned with Actions header */}
                    <div
                      className="shrink-0 h-full flex items-center justify-center px-2 text-center"
                      style={{ width: `${actionsWidth}px` }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToSchedule(song);
                        }}
                        className="px-2.5 py-1 bg-[#232734] hover:bg-cyan-600 hover:text-white text-gray-200 rounded text-[10px] font-bold transition-all cursor-pointer border border-[#343b4f] active:scale-95 shadow-xs"
                        title="Add to Service Schedule"
                      >
                        + Sched
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right-Click Context Menu for Songs */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-[#1c1f28] border border-[#373c4d] rounded-md shadow-2xl py-1 w-52 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        >
          <div className="px-3 py-1 font-bold text-cyan-300 border-b border-[#2a2e3d] text-[11px] truncate">
            {contextMenu.song.title}
          </div>

          <button
            onClick={() => {
              handleGoLive(contextMenu.song);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-emerald-600 hover:text-white flex items-center gap-2 text-emerald-300 font-semibold"
          >
            <Play size={12} className="text-emerald-400 fill-emerald-400" />
            <span>Go Live</span>
          </button>

          <button
            onClick={() => {
              onEditSong(contextMenu.song);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2"
          >
            <Edit3 size={12} className="text-cyan-400" />
            <span>Edit in Song Editor</span>
          </button>

          <button
            onClick={() => {
              handleAddToSchedule(contextMenu.song);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2"
          >
            <Plus size={12} className="text-indigo-400" />
            <span>Add to Schedule</span>
          </button>

          <div className="border-t border-[#2a2e3d] my-1"></div>

          <button
            onClick={() => {
              const dup: Song = {
                ...contextMenu.song,
                id: `song-${Date.now()}`,
                title: `${contextMenu.song.title} (Copy)`,
              };
              addSong(dup);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2"
          >
            <Copy size={12} className="text-gray-400" />
            <span>Duplicate Song</span>
          </button>

          <button
            onClick={() => {
              deleteSong(contextMenu.song.id);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-rose-600 hover:text-white flex items-center gap-2 text-rose-300"
          >
            <Trash2 size={12} />
            <span>Delete Song</span>
          </button>
        </div>
      )}
    </div>
  );
}
