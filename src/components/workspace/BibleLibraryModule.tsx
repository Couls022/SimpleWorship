import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Tv, 
  Play, 
  Copy, 
  Check, 
  Filter, 
  GripVertical,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Columns,
  Layers,
  X,
  ExternalLink,
  ListFilter
} from 'lucide-react';
import { Panel, PanelGroup } from 'react-resizable-panels';
import ResizeHandle from '../ResizeHandle';
import { ScriptureVerse, PresentationItem } from '../../types';
import { BIBLE_BOOKS, BibleEngine, BibleBook } from '../../data/bibleEngine';
import { handleRangeSelection } from '../../utils/selectionUtils';
import { useStore } from '../../store/useStore';

export interface ScriptureViewOptions {
  density: 'compact' | 'comfortable' | 'spacious';
  fontSize: 'small' | 'medium' | 'large';
  showVerseNumbers: boolean;
  showReferences: boolean;
}

const DEFAULT_SCRIPTURE_VIEW_OPTIONS: ScriptureViewOptions = {
  density: 'comfortable',
  fontSize: 'medium',
  showVerseNumbers: true,
  showReferences: true,
};

interface BibleLibraryModuleProps {
  isSidebarMode?: boolean;
  onClose?: () => void;
}

export default function BibleLibraryModule({ isSidebarMode = false }: BibleLibraryModuleProps) {
  const store = useStore();
  const { addScheduleItem, setPreviewItem, goLiveItem } = store;

  // View options state with operator preference persistence
  const [viewOptions, setViewOptions] = useState<ScriptureViewOptions>(() => {
    try {
      const saved = localStorage.getItem('simpleworship_scriptures_view_options');
      if (saved) {
        return { ...DEFAULT_SCRIPTURE_VIEW_OPTIONS, ...JSON.parse(saved) };
      }
    } catch {
      // fallback to defaults
    }
    return DEFAULT_SCRIPTURE_VIEW_OPTIONS;
  });
  const [isViewOptionsOpen, setIsViewOptionsOpen] = useState(false);
  const viewOptionsRef = useRef<HTMLDivElement>(null);

  const updateViewOption = <K extends keyof ScriptureViewOptions>(
    key: K,
    value: ScriptureViewOptions[K]
  ) => {
    setViewOptions(prev => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem('simpleworship_scriptures_view_options', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  // Selected states
  const [selectedTranslation, setSelectedTranslation] = useState<'KJV' | 'Tagalog' | 'ALL'>('KJV');
  const [selectedTestament, setSelectedTestament] = useState<'ALL' | 'OT' | 'NT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBookId, setSelectedBookId] = useState<string>('JHN');
  const [selectedChapter, setSelectedChapter] = useState<number>(3);
  const [selectedVerseIds, setSelectedVerseIds] = useState<string[]>([]);
  const [anchorVerseId, setAnchorVerseId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoadingChapter, setIsLoadingChapter] = useState(false);
  const [isChapterDropdownOpen, setIsChapterDropdownOpen] = useState(false);

  const chapterDropdownRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isSearchActive = searchQuery.trim().length > 0;

  // Books list (filterable by testament or book name query)
  const filteredBooks = useMemo(() => {
    return BIBLE_BOOKS.filter(b => {
      if (selectedTestament !== 'ALL' && b.testament !== selectedTestament) return false;
      return true;
    });
  }, [selectedTestament]);

  const activeBook = useMemo(() => {
    return BIBLE_BOOKS.find(b => b.id === selectedBookId) || BIBLE_BOOKS[42]; // Default John
  }, [selectedBookId]);

  // Total verses for current book & chapter
  const totalVersesInChapter = useMemo(() => {
    return BibleEngine.getVerseCount(activeBook.id, selectedChapter);
  }, [activeBook.id, selectedChapter]);

  // Verses computation
  const [currentVerses, setCurrentVerses] = useState<ScriptureVerse[]>([]);
  
  React.useEffect(() => {
    let isCancelled = false;
    setIsLoadingChapter(true);
    
    async function loadVerses() {
      if (isSearchActive) {
        const results = await BibleEngine.search(searchQuery, selectedTranslation, activeBook.id);
        if (!isCancelled) {
          setCurrentVerses(results);
          setIsLoadingChapter(false);
        }
        return;
      }
      
      const results = await BibleEngine.getPassage(activeBook, selectedChapter, undefined, undefined, selectedTranslation);
      if (!isCancelled) {
        setCurrentVerses(results);
        setIsLoadingChapter(false);
      }
    }
    
    loadVerses();
    
    return () => { isCancelled = true; };
  }, [activeBook, selectedChapter, selectedTranslation, searchQuery, isSearchActive]);

  const activeChapterButtonRef = useRef<HTMLButtonElement | null>(null);

  // Auto-close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chapterDropdownRef.current && !chapterDropdownRef.current.contains(event.target as Node)) {
        setIsChapterDropdownOpen(false);
      }
      if (viewOptionsRef.current && !viewOptionsRef.current.contains(event.target as Node)) {
        setIsViewOptionsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // When chapter dropdown opens, scroll selected chapter into view smoothly
  useEffect(() => {
    if (isChapterDropdownOpen && activeChapterButtonRef.current) {
      activeChapterButtonRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [isChapterDropdownOpen]);

  const handleMouseEnterDropdown = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsChapterDropdownOpen(true);
  };

  const handleMouseLeaveDropdown = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsChapterDropdownOpen(false);
    }, 180);
  };

  const handleSelectChapter = (ch: number) => {
    setSelectedChapter(ch);
    setSelectedVerseIds([]);
    setIsChapterDropdownOpen(false);
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  // Handle Quick Reference Jump
  const handleQuickJump = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    BibleEngine.search(searchQuery, selectedTranslation, activeBook.id).then(matched => {
      if (matched && matched.length > 0) {
        const first = matched[0];
        const book = BIBLE_BOOKS.find(b => b.name === first.book || b.nameTagalog === first.book);
        if (book) {
          setSelectedBookId(book.id);
          setSelectedChapter(first.chapter);
          setSearchQuery('');
        }
      }
    });
  };

  // Jump to specific verse's book & chapter
  const handleJumpToPassage = (verse: ScriptureVerse) => {
    const foundBook = BIBLE_BOOKS.find(b => 
      b.name.toLowerCase() === verse.book.toLowerCase() || 
      b.nameTagalog.toLowerCase() === verse.book.toLowerCase()
    );
    if (foundBook) {
      setSelectedBookId(foundBook.id);
      setSelectedChapter(verse.chapter);
      setSelectedVerseIds([verse.id]);
      setSearchQuery(''); // Exit search mode and focus on chapter
    }
  };

  // Selection handler for verses supporting single click, Ctrl+click, and Shift+click
  const handleVerseToggle = (verseId: string, e: React.MouseEvent) => {
    const { selectedIds, anchorId } = handleRangeSelection(
      currentVerses,
      selectedVerseIds,
      verseId,
      e,
      anchorVerseId
    );
    setSelectedVerseIds(selectedIds);
    setAnchorVerseId(anchorId);
  };

  // Format presentation item from selected verses or single verse
  const createPresentationItem = (verses: ScriptureVerse[]): PresentationItem => {
    if (verses.length === 0) return {} as PresentationItem;

    const sorted = [...verses].sort((a, b) => {
      if (a.book !== b.book) return a.book.localeCompare(b.book);
      if (a.chapter !== b.chapter) return a.chapter - b.chapter;
      return a.verse - b.verse;
    });

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const transBadge = first.translation === 'Tagalog' ? 'Tagalog' : 'KJV';
    
    let refLabel = first.reference;
    if (sorted.length > 1) {
      if (first.book === last.book && first.chapter === last.chapter) {
        refLabel = `${first.book} ${first.chapter}:${first.verse}-${last.verse} (${transBadge})`;
      } else {
        refLabel = `${first.reference} - ${last.reference} (${transBadge})`;
      }
    } else {
      refLabel = `${first.reference} (${transBadge})`;
    }

    const fullText = sorted.map(v => v.text.trim()).join('  ');
    const defaultScriptureBg = store.themesList?.find(t => t.type === 'bible')?.styles?.backgroundImageUrl;

    return {
      id: `bible-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'bible',
      name: refLabel,
      contentId: first.id,
      notes: `${transBadge} Scripture Reading (${sorted.length} ${sorted.length === 1 ? 'verse' : 'verses'})`,
      isExpanded: true,
      customBackgroundUrl: defaultScriptureBg || undefined,
      data: {
        reference: refLabel,
        text: fullText,
        translation: first.translation,
        verses: sorted
      }
    };
  };

  // Drag start handler with full presentation item payload (handles multi-verse bundling)
  const handleDragStart = (e: React.DragEvent, verse?: ScriptureVerse) => {
    let targetVerses: ScriptureVerse[] = [];
    
    if (verse && selectedVerseIds.includes(verse.id) && selectedVerseIds.length > 1) {
      // User dragged one of the multi-selected verses -> drag all selected verses together
      targetVerses = currentVerses.filter(v => selectedVerseIds.includes(v.id));
    } else if (verse) {
      targetVerses = [verse];
    } else if (selectedVerseIds.length > 0) {
      targetVerses = currentVerses.filter(v => selectedVerseIds.includes(v.id));
    }

    if (targetVerses.length === 0 && currentVerses.length > 0) {
      targetVerses = [currentVerses[0]];
    }

    const item = createPresentationItem(targetVerses);
    const jsonStr = JSON.stringify({ item, type: 'bible', source: 'bible' });
    
    e.dataTransfer.setData('application/json', jsonStr);
    e.dataTransfer.setData('application/x-simpleworship-item', jsonStr);
    e.dataTransfer.setData('text/plain', item.name);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  // Quick Action Buttons
  const handleAddToSchedule = (verses: ScriptureVerse[]) => {
    const item = createPresentationItem(verses);
    addScheduleItem(item);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Added "${item.name}" (${verses.length} verses) to Schedule!` 
      })
    );
  };

  const handleSendToPreview = (verses: ScriptureVerse[]) => {
    const item = createPresentationItem(verses);
    setPreviewItem(item, 0);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Loaded "${item.name}" into Preview!` 
      })
    );
  };

  const handleGoLiveNow = (verses: ScriptureVerse[]) => {
    const item = createPresentationItem(verses);
    addScheduleItem(item);
    store.setRoutingRequest({ item, isNew: false, slideIndex: 0 });
  };

  const handleCopy = (verse: ScriptureVerse) => {
    navigator.clipboard.writeText(`${verse.reference} (${verse.translation})\n"${verse.text}"`);
    setCopiedId(verse.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const selectedVerses = currentVerses.filter(v => selectedVerseIds.includes(v.id));

  return (
    <div className={`flex flex-col h-full bg-[#181a20] text-gray-200 select-none overflow-hidden ${
      isSidebarMode ? 'text-xs' : 'text-sm'
    }`}>
      {/* Top Header & Translation Bar */}
      <div className="bg-[#222630] border-b border-[#131519] p-2 shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <BookOpen size={14} className="text-amber-400" />
            <span className="font-bold text-xs uppercase tracking-wider text-gray-200">
              Scriptures
            </span>
          </div>

          {/* Single Main Bible Search Bar (in top header red box position) */}
          <form onSubmit={handleQuickJump} className="relative flex-1 min-w-[100px] shrink">
            <input
              type="text"
              placeholder="Search across ALL Bible books (e.g. John 3:16, grace, kapayapaan, Awit 23)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#15171c] border border-[#2d3240] rounded pl-7 pr-7 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500/50 shadow-inner"
            />
            <Search size={12} className="absolute left-2 top-2 text-amber-400 pointer-events-none" />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1 text-gray-400 hover:text-white p-0.5 rounded hover:bg-[#2e3444]"
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </form>

          {/* Translation Switcher (KJV / Tagalog / Side-by-Side) */}
          <div className="flex items-center bg-[#181a20] p-0.5 rounded border border-[#2d313d] text-[11px] shrink-0">
            <button
              onClick={() => setSelectedTranslation('KJV')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                selectedTranslation === 'KJV' 
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="King James Version (English)"
            >
              KJV
            </button>
            <button
              onClick={() => setSelectedTranslation('Tagalog')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                selectedTranslation === 'Tagalog' 
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Ang Biblia 1905 (Tagalog)"
            >
              Tagalog
            </button>
            <button
              onClick={() => setSelectedTranslation('ALL')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                selectedTranslation === 'ALL' 
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="All Translations"
            >
              Both
            </button>
          </div>

          {/* Operator View Options Dropdown Control */}
          <div className="relative shrink-0" ref={viewOptionsRef}>
            <button
              type="button"
              onClick={() => setIsViewOptionsOpen(prev => !prev)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-semibold transition-all cursor-pointer select-none ${
                isViewOptionsOpen
                  ? 'bg-amber-500/25 text-amber-300 border-amber-400/80 shadow-sm ring-1 ring-amber-400/30'
                  : 'bg-[#181a20] hover:bg-[#252834] text-gray-300 hover:text-white border-[#2d313d]'
              }`}
              title="Scriptures View Options (Density, Font Size, Visibility)"
            >
              <ListFilter size={12} className="text-amber-400 shrink-0" />
              <span className="hidden sm:inline">View</span>
            </button>

            {isViewOptionsOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-[#161821] border border-[#30384c] rounded-lg shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md text-xs text-gray-200">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-0.5">
                  Verse Density
                </div>
                <div className="grid grid-cols-3 gap-1 mb-2.5">
                  {(['compact', 'comfortable', 'spacious'] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => updateViewOption('density', d)}
                      className={`px-1.5 py-1 rounded text-[11px] font-semibold capitalize transition-colors text-center cursor-pointer ${
                        viewOptions.density === d
                          ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/50 shadow-xs'
                          : 'bg-[#1f232d] hover:bg-[#292e3c] text-gray-300 border border-transparent'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-0.5">
                  Text Size
                </div>
                <div className="grid grid-cols-3 gap-1 mb-2.5">
                  {(['small', 'medium', 'large'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateViewOption('fontSize', s)}
                      className={`px-1.5 py-1 rounded text-[11px] font-semibold capitalize transition-colors text-center cursor-pointer ${
                        viewOptions.fontSize === s
                          ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/50 shadow-xs'
                          : 'bg-[#1f232d] hover:bg-[#292e3c] text-gray-300 border border-transparent'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="border-t border-[#292e3d] pt-2 mb-0.5 space-y-2 px-0.5">
                  <label className="flex items-center justify-between cursor-pointer text-[11px] text-gray-300 hover:text-white select-none">
                    <span>Show Verse Numbers</span>
                    <input
                      type="checkbox"
                      checked={viewOptions.showVerseNumbers}
                      onChange={e => updateViewOption('showVerseNumbers', e.target.checked)}
                      className="rounded accent-amber-500 w-3.5 h-3.5 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer text-[11px] text-gray-300 hover:text-white select-none">
                    <span>Show Verse References</span>
                    <input
                      type="checkbox"
                      checked={viewOptions.showReferences}
                      onChange={e => updateViewOption('showReferences', e.target.checked)}
                      className="rounded accent-amber-500 w-3.5 h-3.5 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Body: Resizable Split View between Books and Chapters/Verses */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" autoSaveId="simpleworship-bible-split-v5" className="h-full w-full">
          {/* Books Column (Resizable & Persistent) */}
          <Panel defaultSize={isSidebarMode ? 32 : 24} minSize={14} maxSize={50} collapsible>
            <div className="h-full bg-[#15171c] border-r border-[#131519] flex flex-col overflow-hidden">
              <div className="p-1.5 bg-[#1b1e26] border-b border-[#131519] text-[10px] font-semibold text-gray-400 flex items-center justify-between shrink-0">
                <span>Bible Books</span>
                <span className="text-gray-500 font-normal">{filteredBooks.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                {filteredBooks.map((book) => {
                  const isSelected = book.id === selectedBookId && !isSearchActive;
                  const displayName = selectedTranslation === 'Tagalog' ? book.nameTagalog : book.name;
                  const altName = selectedTranslation === 'Tagalog' ? book.name : book.nameTagalog;

                  return (
                    <button
                      key={book.id}
                      onClick={() => {
                        setSelectedBookId(book.id);
                        setSelectedChapter(1);
                        setSelectedVerseIds([]);
                        setSearchQuery(''); // Clicking a book opens that book directly
                      }}
                      className={`w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between transition-colors ${
                        isSelected 
                          ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' 
                          : 'text-gray-300 hover:bg-[#222632] hover:text-gray-100'
                      }`}
                    >
                      <div className="truncate">
                        <div>{displayName}</div>
                        {altName !== displayName && (
                          <div className="text-[9px] text-gray-500 font-normal truncate">{altName}</div>
                        )}
                      </div>
                      {isSelected && <ChevronRight size={10} className="shrink-0 text-amber-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </Panel>

          {/* Draggable Divider Handle */}
          <ResizeHandle direction="horizontal" />

          {/* Chapters & Verses View */}
          <Panel defaultSize={isSidebarMode ? 68 : 76} minSize={35}>
            <div className="h-full flex flex-col bg-[#1a1d24] overflow-hidden">
              {/* Header / Passage Status with Chapter Dropdown Trigger (Red box from user request) */}
              <div className="p-1.5 bg-[#20242e] border-b border-[#131519] shrink-0 relative">
                {isSearchActive ? (
                  <div className="flex items-center justify-between text-[11px] text-amber-300">
                    <div className="flex items-center gap-1.5 truncate">
                      <Search size={12} className="text-amber-400 shrink-0" />
                      <span className="font-semibold truncate">
                        Global Search Results for "<span className="text-white font-bold">{searchQuery}</span>"
                      </span>
                    </div>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-[10px] text-gray-400 hover:text-white bg-[#2b3040] hover:bg-[#384055] px-1.5 py-0.5 rounded transition-colors shrink-0 ml-2"
                    >
                      Back to {activeBook.name}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-300">
                    {/* Left: Book Name + Interactive Chapter Dropdown with Arrow Down */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-amber-400 font-bold text-xs truncate">
                        {selectedTranslation === 'Tagalog' ? activeBook.nameTagalog : activeBook.name}
                      </span>

                      {/* Chapter Selector Dropdown Container (Arrow Down button with auto-close & smooth scroll) */}
                      <div 
                        ref={chapterDropdownRef}
                        className="relative inline-block"
                        onMouseEnter={handleMouseEnterDropdown}
                        onMouseLeave={handleMouseLeaveDropdown}
                      >
                        <button
                          type="button"
                          onClick={() => setIsChapterDropdownOpen((prev) => !prev)}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer border ${
                            isChapterDropdownOpen
                              ? 'bg-amber-500 text-gray-950 border-amber-400 shadow-md ring-1 ring-amber-300'
                              : 'bg-[#222736] hover:bg-[#2e3549] text-amber-300 border-[#384157] hover:border-amber-500/50 shadow-sm'
                          }`}
                        >
                          <span>Ch {selectedChapter}</span>
                          <ChevronDown 
                            size={11} 
                            className={`transition-transform duration-200 ${
                              isChapterDropdownOpen 
                                ? 'rotate-180 text-gray-950 font-black' 
                                : 'text-amber-400'
                            }`} 
                          />
                        </button>

                        {/* Enterprise Compact Fitted Chapter Selector Dropdown */}
                        {isChapterDropdownOpen && (
                          <div 
                            className={`absolute left-0 top-full mt-1 z-50 bg-[#151821] border border-[#30384c] rounded-md shadow-2xl overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150 ${
                              activeBook.chapters > 40 ? 'w-64' : 'w-52'
                            }`}
                            onMouseEnter={handleMouseEnterDropdown}
                            onMouseLeave={handleMouseLeaveDropdown}
                          >
                            <div className="px-2 py-1 bg-[#1c202d] border-b border-[#293043] flex items-center justify-between text-[10px]">
                              <span className="font-semibold text-gray-200 truncate flex items-center gap-1">
                                <span className="text-amber-400 font-bold">{selectedTranslation === 'Tagalog' ? activeBook.nameTagalog : activeBook.name}</span>
                                <span className="text-gray-400">Chapters</span>
                              </span>
                              <span className="text-[9px] text-amber-400 font-bold bg-[#292218] px-1 py-0.2 rounded border border-amber-800/40">
                                1 – {activeBook.chapters}
                              </span>
                            </div>

                            {/* Enterprise Fitted Compact Grid (Tight Gap & Height) */}
                            <div className={`max-h-52 overflow-y-auto custom-scrollbar p-1.5 grid gap-1 scroll-smooth ${
                              activeBook.chapters > 40 ? 'grid-cols-6' : 'grid-cols-5'
                            }`}>
                              {Array.from({ length: activeBook.chapters }, (_, i) => i + 1).map((ch) => {
                                const isCur = selectedChapter === ch;
                                return (
                                  <button
                                    key={ch}
                                    ref={isCur ? activeChapterButtonRef : null}
                                    type="button"
                                    onClick={() => handleSelectChapter(ch)}
                                    className={`h-6 rounded text-[11px] font-semibold transition-all text-center flex items-center justify-center cursor-pointer ${
                                      isCur
                                        ? 'bg-amber-500 text-gray-950 font-black shadow-sm ring-1 ring-amber-300 scale-[1.02]'
                                        : 'bg-[#1e2330] text-gray-300 hover:bg-[#2d3448] hover:text-amber-300 hover:border-[#434e6b] border border-transparent'
                                    }`}
                                  >
                                    {ch}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {isLoadingChapter && (
                        <span className="text-[9px] text-amber-400/80 italic animate-pulse">Loading...</span>
                      )}
                    </div>

                    {/* Right: Total Verses Count */}
                    <span className="text-[10px] text-gray-400 flex items-center gap-1.5 shrink-0">
                      <span className="text-amber-400/90 font-medium">({totalVersesInChapter} Verses)</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Verses Feed */}
              <div className={`flex-1 overflow-y-auto p-2 custom-scrollbar ${
                viewOptions.density === 'compact' ? 'space-y-1' : viewOptions.density === 'spacious' ? 'space-y-2.5' : 'space-y-1.5'
              }`}>
                {currentVerses.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                    <BookOpen size={32} className="text-gray-600 mb-2" />
                    <p className="text-xs">No verses matched "{searchQuery}".</p>
                    <p className="text-[10px] text-gray-600 mt-1">Try searching for keywords (e.g. grace, love, light, pastor, peace) or book references.</p>
                  </div>
                ) : (
                  currentVerses.map((verse) => {
                    const isSelected = selectedVerseIds.includes(verse.id);
                    const isTag = verse.translation === 'Tagalog';

                    return (
                      <div
                        key={verse.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, verse)}
                        onClick={(e) => handleVerseToggle(verse.id, e)}
                        onDoubleClick={() => {
                          const target = (selectedVerseIds.includes(verse.id) && selectedVerses.length > 1)
                            ? selectedVerses
                            : [verse];
                          handleGoLiveNow(target);
                        }}
                        className={`group relative rounded border cursor-grab active:cursor-grabbing transition-all ${
                          viewOptions.density === 'compact' ? 'p-1.5' : viewOptions.density === 'spacious' ? 'p-3' : 'p-2'
                        } ${
                          isSelected
                            ? 'bg-[#252c3d] border-amber-500/60 shadow-md ring-1 ring-amber-500/20'
                            : 'bg-[#1e222c] border-[#292e3c] hover:border-[#3d4559] hover:bg-[#232733]'
                        }`}
                        title="Click to select (use Shift/Ctrl for multi-select). Double-click to Go Live, or drag directly to Schedule or Live panel."
                      >
                        <div className="flex items-start gap-1.5">
                          {/* Drag Grip handle */}
                          <GripVertical size={13} className="text-gray-500 group-hover:text-amber-400 shrink-0 mt-0.5 transition-colors" />

                          {/* Verse Number */}
                          {viewOptions.showVerseNumbers && (
                            <div className="shrink-0 flex items-center gap-1">
                              <span className="font-bold text-amber-400 text-xs">
                                {verse.verse}
                              </span>
                            </div>
                          )}

                          {/* Verse Scripture Text */}
                          <div className="flex-1 min-w-0">
                            <p className={`${
                              viewOptions.fontSize === 'small' 
                                ? 'text-[11px] leading-relaxed' 
                                : viewOptions.fontSize === 'large' 
                                ? 'text-sm leading-relaxed' 
                                : 'text-xs leading-relaxed'
                            } text-gray-200 font-serif`}>
                              {verse.text}
                            </p>
                            {viewOptions.showReferences && (
                              <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                                <span className="font-semibold text-amber-200/90">{verse.reference}</span>
                              </div>
                            )}
                            <div className="mt-1 flex items-center justify-end text-[10px] text-gray-400">
                              {/* Quick row actions on hover */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {isSearchActive && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleJumpToPassage(verse);
                                    }}
                                    className="px-1.5 py-0.5 bg-[#252b38] hover:bg-[#343e54] text-cyan-300 rounded text-[10px] flex items-center gap-0.5"
                                    title="Open full chapter"
                                  >
                                    <ExternalLink size={9} />
                                    <span>Open Chapter</span>
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy(verse);
                                  }}
                                  className="p-1 hover:bg-[#343b4c] rounded text-gray-300 hover:text-white"
                                  title="Copy verse text"
                                >
                                  {copiedId === verse.id ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const target = (selectedVerseIds.includes(verse.id) && selectedVerses.length > 1)
                                      ? selectedVerses
                                      : [verse];
                                    handleAddToSchedule(target);
                                  }}
                                  className="px-1.5 py-0.5 bg-[#2d3444] hover:bg-amber-600 hover:text-white rounded text-[10px] text-amber-300 font-semibold"
                                  title="Add to Presentation Schedule"
                                >
                                  {selectedVerseIds.includes(verse.id) && selectedVerses.length > 1 ? `+ Schedule (${selectedVerses.length})` : '+ Schedule'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const target = (selectedVerseIds.includes(verse.id) && selectedVerses.length > 1)
                                      ? selectedVerses
                                      : [verse];
                                    handleSendToPreview(target);
                                  }}
                                  className="p-1 hover:bg-[#343b4c] rounded text-cyan-300 hover:text-cyan-200"
                                  title="Load into Preview"
                                >
                                  <Tv size={10} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
