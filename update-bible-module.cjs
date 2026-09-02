const fs = require('fs');
let content = fs.readFileSync('src/components/workspace/BibleLibraryModule.tsx', 'utf-8');

// We need to change `currentVerses` from useMemo to state and an effect.
content = content.replace(
  /  const currentVerses = useMemo\(\(\) => \{[\s\S]*?\}, \[activeBook, selectedChapter, selectedTranslation, searchQuery, isSearchActive, asyncVerses\]\);/,
  `  const [currentVerses, setCurrentVerses] = useState<ScriptureVerse[]>([]);
  
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
  }, [activeBook, selectedChapter, selectedTranslation, searchQuery, isSearchActive]);`
);

// We can also remove `asyncVerses` and `loadChapterOnline` entirely, because `getPassage` will just read from DB directly.
content = content.replace(/  const \[asyncVerses, setAsyncVerses\] = useState<ScriptureVerse\[\] \| null>\(null\);\n/, '');
content = content.replace(/  \/\/ Fetch full authentic KJV text for chapter online[\s\S]*?\}, \[activeBook, selectedChapter, selectedTranslation, isSearchActive\]\);\n/, '');

// Fix handleQuickJump
content = content.replace(
  /    const matched = BibleEngine\.search\(searchQuery, selectedTranslation\);[\s\S]*?      \}/,
  `    BibleEngine.search(searchQuery, selectedTranslation).then(matched => {
      if (matched && matched.length > 0) {
        const first = matched[0];
        const book = BIBLE_BOOKS.find(b => b.name === first.book || b.nameTagalog === first.book);
        if (book) {
          setSelectedBookId(book.id);
          setSelectedChapter(first.chapter);
          setSearchQuery('');
        }
      }
    });`
);
fs.writeFileSync('src/components/workspace/BibleLibraryModule.tsx', content);
