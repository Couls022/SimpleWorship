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
  ExternalLink
} from 'lucide-react';
import { Panel, PanelGroup } from 'react-resizable-panels';
import ResizeHandle from '../ResizeHandle';
import { ScriptureVerse, PresentationItem } from '../../types';
import { BIBLE_BOOKS, BibleEngine, BibleBook } from '../../data/bibleEngine';
import { handleRangeSelection } from '../../utils/selectionUtils';
import { useStore } from '../../store/useStore';

interface BibleLibraryModuleProps {
  isSidebarMode?: boolean;
  onClose?: () => void;
}

export default function BibleLibraryModule({ isSidebarMode = false }: BibleLibraryModuleProps) {
  const store = useStore();
  const { addScheduleItem, setPreviewItem, goLiveItem } = store;

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
        const results = await BibleEngine.search(searchQuery, selectedTranslation);
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

    BibleEngine.search(searchQuery, selectedTranslation).then(matched => {
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
              Bible Library
            </span>
            <input type="file" accept=".json" id="bible-import" className="hidden" onChange={async (e) => {
              if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = async (event) => {
                  if (event.target?.result) {
                    try {
                      const json = JSON.parse(event.target.result as string);
                      if (Array.isArray(json)) {
                         const { dbApi } = await import('../../db');
                         let imported = 0;
                         for (const verse of json) {
                           if (verse.book && verse.chapter && verse.verse && verse.text) {
                              const newVerse = {
                                id: `${verse.book.toLowerCase()}-${verse.chapter}-${verse.verse}-${verse.translation || 'KJV'}`,
                                translation: verse.translation || 'KJV',
                                book: verse.book,
                                chapter: parseInt(verse.chapter),
                                verse: parseInt(verse.verse),
                                reference: `${verse.book} ${verse.chapter}:${verse.verse}`,
                                text: verse.text
                              };
                              await dbApi.addScripture(newVerse);
                              imported++;
                           }
                         }
                         alert(`Imported ${imported} verses successfully!`);
                      } else {
                         alert("Invalid JSON format. Expected an array of verses.");
                      }
                    } catch(err) {
                      console.error("Error importing bible", err);
                      alert("Error importing bible: " + (err as any).message);
                    }
                  }
                };
                reader.readAsText(file);
              }
            }} />
            <button
              onClick={() => document.getElementById('bible-import')?.click()}
              className="text-[10px] bg-[#3a4150] px-1.5 py-0.5 rounded text-gray-300 hover:text-white"
              title="Import JSON Bible format"
            >
              Import JSON
            </button>
          </div>

          {/* Single Main Bible Search Bar (in top header red box position) */}
          <form onSubmit={handleQuickJump} className="relative flex-1 min-w-[200px]">
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
        </div>

        {/* Subheader Bar: Testament Filter Tabs & Quick Reference */}
        <div className="flex items-center justify-between gap-3 text-[10px] bg-[#171a22] px-2 py-1 rounded border border-[#282d3c]">
          {/* Testament Filter Tabs */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setSelectedTestament('ALL')}
              className={`px-2 py-0.5 rounded transition-all ${
                selectedTestament === 'ALL'
                  ? 'bg-[#323744] text-white font-semibold'
                  : 'text-gray-400 hover:bg-[#252934] hover:text-gray-300'
              }`}
            >
              All (66)
            </button>
            <button
              onClick={() => setSelectedTestament('OT')}
              className={`px-2 py-0.5 rounded transition-all ${
                selectedTestament === 'OT'
                  ? 'bg-[#323744] text-amber-300 font-semibold'
                  : 'text-gray-400 hover:bg-[#252934] hover:text-gray-300'
              }`}
            >
              OT (39)
            </button>
            <button
              onClick={() => setSelectedTestament('NT')}
              className={`px-2 py-0.5 rounded transition-all ${
                selectedTestament === 'NT'
                  ? 'bg-[#323744] text-cyan-300 font-semibold'
                  : 'text-gray-400 hover:bg-[#252934] hover:text-gray-300'
              }`}
            >
              NT (27)
            </button>
          </div>

          {/* Quick Active Book & Chapter Summary */}
          {!isSearchActive ? (
            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
              <span className="text-[10px] text-gray-400 font-normal truncate flex items-center gap-1">
                <span className="font-bold text-amber-400">{selectedTranslation === 'Tagalog' ? activeBook.nameTagalog : activeBook.name}</span>
                <span className="text-gray-300 font-medium">Chapter {selectedChapter}</span>
                <span className="text-gray-500">({activeBook.chapters} Chs)</span>
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-amber-400 font-medium bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40 shrink-0">
              Global Search ({currentVerses.length} found)
            </span>
          )}
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
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
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
                        className={`group relative p-2 rounded border cursor-grab active:cursor-grabbing transition-all ${
                          isSelected
                            ? 'bg-[#252c3d] border-amber-500/60 shadow-md ring-1 ring-amber-500/20'
                            : 'bg-[#1e222c] border-[#292e3c] hover:border-[#3d4559] hover:bg-[#232733]'
                        }`}
                        title="Click to select (use Shift/Ctrl for multi-select). Double-click to Go Live, or drag directly to Schedule or Live panel."
                      >
                        <div className="flex items-start gap-1.5">
                          {/* Drag Grip handle */}
                          <GripVertical size={13} className="text-gray-500 group-hover:text-amber-400 shrink-0 mt-0.5 transition-colors" />

                          {/* Verse Number & Translation Badge */}
                          <div className="shrink-0 flex items-center gap-1">
                            <span className="font-bold text-amber-400 text-xs">
                              {verse.verse}
                            </span>
                            <span className={`text-[9px] px-1 py-0.2 rounded font-semibold uppercase ${
                              isTag ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40' : 'bg-blue-950/80 text-blue-300 border border-blue-800/40'
                            }`}>
                              {verse.translation}
                            </span>
                          </div>

                          {/* Verse Scripture Text */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-200 leading-relaxed font-serif">
                              {verse.text}
                            </p>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                              <span className="font-semibold text-amber-200/90">{verse.reference}</span>
                              
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

      {/* Selected Action Dock / Drag-and-Drop Guidance */}
      <div className="p-2 bg-[#20242e] border-t border-[#131519] shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px] text-gray-300 truncate">
          <GripVertical size={13} className="text-amber-400 shrink-0" />
          <span className="font-medium truncate">
            {selectedVerseIds.length > 0 ? (
              <span className="text-amber-300 font-bold">{selectedVerseIds.length} verses selected</span>
            ) : (
              <span>Drag any verse into Schedule</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              const target = selectedVerses.length > 0 ? selectedVerses : currentVerses.slice(0, 1);
              if (target.length > 0) handleAddToSchedule(target);
            }}
            draggable={selectedVerses.length > 0}
            onDragStart={(e) => handleDragStart(e)}
            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-gray-950 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-grab active:cursor-grabbing shadow"
            title="Add selected verses to presentation schedule (or drag button directly into schedule)"
          >
            <Plus size={12} />
            <span>Add to Schedule</span>
          </button>

          <button
            onClick={() => {
              const target = selectedVerses.length > 0 ? selectedVerses : currentVerses.slice(0, 1);
              if (target.length > 0) handleSendToPreview(target);
            }}
            className="flex items-center gap-1 bg-[#2e3545] hover:bg-[#3a4358] text-cyan-300 px-2 py-1 rounded text-xs font-semibold transition-colors border border-[#414b63]"
            title="Load directly into Preview monitor"
          >
            <Tv size={11} />
            <span>Preview</span>
          </button>

          <button
            onClick={() => {
              const target = selectedVerses.length > 0 ? selectedVerses : currentVerses.slice(0, 1);
              if (target.length > 0) handleGoLiveNow(target);
            }}
            className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-xs font-bold transition-colors shadow"
            title="Broadcast Live to Congregation"
          >
            <Play size={11} />
            <span>Go Live</span>
          </button>
        </div>
      </div>
    </div>
  );
}
