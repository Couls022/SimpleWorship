import re

with open('src/components/SongEditorModal.tsx', 'r') as f:
    content = f.read()

old_parser = """    // Split by explicit tags [Verse 1], [Chorus], [John 3:16], or slide breaks --- / ===
    const sections = rawText.split(/(?=\\[(?:.*?)\\]|\\n---|\\n===)/g);

    for (let sec of sections) {
      sec = sec.trim();
      if (!sec) continue;

      if (sec.startsWith('---') || sec.startsWith('===')) {
        sec = sec.replace(/^---+|^===+/, '').trim();
      }

      const tagMatch = sec.match(/^\\[(.*?)\\]\\n?([\\s\\S]*)$/);
      if (tagMatch) {
        const label = tagMatch[1].trim();
        const content = tagMatch[2].trim();
        
        // Check if content itself has double line breaks or verse splits
        const subParts = content.split(/\\n\\s*\\n/).filter(p => p.trim().length > 0);
        if (subParts.length > 1) {
          subParts.forEach((part, idx) => {
            slides.push({
              label: subParts.length > 1 ? `${label} (${idx + 1})` : label,
              text: part.trim()
            });
          });
        } else {
          slides.push({
            label: label || `Slide ${slides.length + 1}`,
            text: content || 'Enter text here...'
          });
        }
      } else {
        // Un-tagged text: split by double newlines or verse prefixes (e.g., "Verse 1:", "1. ", "John 3:16")
        const blocks = sec.split(/\\n\\s*\\n/).filter(b => b.trim().length > 0);
        blocks.forEach((block, idx) => {
          // Check if block starts with "Verse 1:", "1. ", "Talatâ 1:", "John 3:16"
          const versePrefixMatch = block.match(/^(?:Verse\\s*\\d+|Talatâ\\s*\\d+|\\d+\\.|\\d+:?\\d*|[A-Z][a-z]+\\s*\\d+:\\d+):?\\s*/i);
          let label = `${contentType === 'bible' ? 'Verse' : 'Slide'} ${slides.length + 1}`;
          let text = block.trim();

          if (versePrefixMatch) {
            label = versePrefixMatch[0].replace(/:$/, '').trim();
            text = block.substring(versePrefixMatch[0].length).trim();
          }

          slides.push({ label, text });
        });
      }
    }"""

new_parser = """    // Normalize lines: Convert implicit text-based tags like "Verse 1:" or "Chorus:" on their own line into bracketed tags
    const normalizedLines = rawText.split('\\n').map(line => {
      const trimmed = line.trim();
      // Match something like "Verse 1:", "Chorus", "Refrain:" when it's the whole line
      const implicitTagMatch = trimmed.match(/^(Verse(?:\\s+\\d+)?|Chorus(?:\\s+\\d+)?|Refrain|Bridge|Pre-Chorus|Tag|Ending|Talatâ(?:\\s+\\d+)?|Koro|Tulay):?$/i);
      if (implicitTagMatch && !trimmed.startsWith('[')) {
        return `[${implicitTagMatch[1]}]`;
      }
      return line;
    });
    const normalizedText = normalizedLines.join('\\n');

    // Split by explicit tags [Verse 1], [Chorus], [John 3:16], or slide breaks --- / ===
    const sections = normalizedText.split(/(?=\\[(?:.*?)\\]|\\n---|\\n===)/g);

    for (let sec of sections) {
      sec = sec.trim();
      if (!sec) continue;

      if (sec.startsWith('---') || sec.startsWith('===')) {
        sec = sec.replace(/^---+|^===+/, '').trim();
      }

      const tagMatch = sec.match(/^\\[(.*?)\\]\\n?([\\s\\S]*)$/);
      if (tagMatch) {
        const label = tagMatch[1].trim();
        const content = tagMatch[2].trim();
        
        // Check if content itself has double line breaks or verse splits
        const subParts = content.split(/\\n\\s*\\n/).filter(p => p.trim().length > 0);
        if (subParts.length > 1) {
          subParts.forEach((part, idx) => {
            slides.push({
              label: subParts.length > 1 ? `${label} (${idx + 1})` : label,
              text: part.trim()
            });
          });
        } else {
          slides.push({
            label: label || `Slide ${slides.length + 1}`,
            text: content || 'Enter text here...'
          });
        }
      } else {
        // Un-tagged text: split by double newlines or verse prefixes
        const blocks = sec.split(/\\n\\s*\\n/).filter(b => b.trim().length > 0);
        blocks.forEach((block, idx) => {
          // Check if block starts with implicit tags at the beginning of a paragraph
          const versePrefixMatch = block.match(/^(?:Verse(?:\\s+\\d+)?|Chorus(?:\\s+\\d+)?|Refrain|Bridge|Pre-Chorus|Tag|Ending|Talatâ(?:\\s+\\d+)?|Koro|Tulay|\\d+\\.|\\d+:?\\d*|[A-Z][a-z]+\\s*\\d+:\\d+):?\\s*/i);
          let label = `${contentType === 'bible' ? 'Verse' : 'Slide'} ${slides.length + 1}`;
          let text = block.trim();

          if (versePrefixMatch) {
            label = versePrefixMatch[0].replace(/:$/, '').trim();
            text = block.substring(versePrefixMatch[0].length).trim();
          }

          slides.push({ label, text });
        });
      }
    }"""

if old_parser in content:
    content = content.replace(old_parser, new_parser)
    with open('src/components/SongEditorModal.tsx', 'w') as f:
        f.write(content)
    print("Patched SongEditorModal successfully!")
else:
    print("Could not find old_parser block!")
