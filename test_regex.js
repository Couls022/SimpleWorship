const rawText = `Verse:
Sound the battle cry!
See, the foe is nigh,

Refrain:
Rouse, then, soldiers, rally round the banner!`;

const normalizedLines = rawText.split('\n').map(line => {
    const trimmed = line.trim();
    // Match something like "Verse 1:", "Chorus", "Refrain:" when it's the whole line
    const implicitTagMatch = trimmed.match(/^(Verse(?:\s+\d+)?|Chorus(?:\s+\d+)?|Refrain|Bridge|Pre-Chorus|Tag|Ending|Talatâ(?:\s+\d+)?|Koro|Tulay):?$/i);
    if (implicitTagMatch && !trimmed.startsWith('[')) {
    return `[${implicitTagMatch[1]}]`;
    }
    return line;
});
const normalizedText = normalizedLines.join('\n');
console.log(normalizedText);
