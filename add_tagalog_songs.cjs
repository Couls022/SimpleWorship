const fs = require('fs');
const { v4: uuidv4 } = require('crypto');

function generateId() {
  return "song-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
}

function generateSectionId() {
  return require('crypto').randomUUID();
}

function processSong(title, author, rawText) {
  const sections = [];
  const parts = rawText.split('\n\n');
  let currentSectionName = '';
  let currentSectionLines = [];

  for (const part of parts) {
    if (part.startsWith('[')) {
      if (currentSectionName) {
        sections.push({ id: generateSectionId(), name: currentSectionName, text: currentSectionLines.join('\n') });
      }
      const endIdx = part.indexOf(']');
      currentSectionName = part.substring(1, endIdx);
      currentSectionLines = part.substring(endIdx + 1).trim().split('\n');
    } else {
      if (currentSectionName) {
        currentSectionLines.push(...part.split('\n'));
      }
    }
  }
  
  if (currentSectionName) {
    sections.push({ id: generateSectionId(), name: currentSectionName, text: currentSectionLines.join('\n') });
  }

  // Prepend Title section if not present
  if (sections.length > 0 && sections[0].name !== 'Title') {
     sections.unshift({ id: generateSectionId(), name: 'Title', text: title });
  }

  // Ensure rawText matches the expected format for presentation core
  let compiledText = `[Title]\n${title}\n\n`;
  const rawSections = sections.filter(s => s.name !== 'Title').map(s => `[${s.name}]\n${s.text}`).join('\n\n');
  compiledText += rawSections;

  return {
    id: generateId(),
    title,
    author,
    copyright: "Used by Permission",
    key: "G",
    tempo: "Moderate",
    category: "Praise & Worship (Tagalog)",
    lyrics: compiledText,
    sections
  };
}

const newSongs = [
  processSong("Salamat Salamat", "Malayang Pilipino", `[Verse 1]
Kung aking mamasdan ang kalawakan
Hindi ko maunawaan
Ang Iyong dahilan kung bakit ako'y
Pinili Mo't iningatan

[Pre-Chorus]
Hindi ko kayang isipin
Hinding-hindi ko kayang sukatin
Ang pag-ibig Mo Hesus
Na Iyong binigay sa akin

[Chorus]
Salamat, salamat O Hesus sa pag-ibig Mo
Walang ibang nagmahal sa akin ng katulad Mo
Salamat, salamat O Hesus sa pag-ibig Mo
Ako'y magsasaya sa piling Mo`),

  processSong("Sapat Na At Higit Pa", "Musikatha", `[Verse]
Sapat na at higit pa
Ang Biyaya Mo O Diyos
Sapat na at higit pa
Ang Pag-ibig Mo O Diyos

[Chorus]
Kaya't magpupuri
Kaya't sasamba
Kaya't aawitin ang Iyong Kadakilaan
Sapat na at higit pa
Ang Biyaya Mo O Diyos`),

  processSong("Ako'y Binago Niya", "Papuri Singers", `[Verse 1]
Nung una ang aking buhay
Ay walang patutunguhan
Puno ng lungkot at kasawian
Ngunit ng makilala ko
Ang Panginoong Hesus
Ang buhay ko'y nagbago

[Chorus]
Ako'y binago Niya
Binago Niya ang aking buhay
Puso ko'y nilinis Niya
At pinuno ng kagalakan
Kaya't ako'y aawit
Ng pagpupuri sa Kanya
Ako'y binago Niya`),

  processSong("Kay Buti-Buti Mo Panginoon", "Rommel Guevarra", `[Verse]
Kay buti-buti Mo, Panginoon
Sa lahat ng oras, sa bawat pagkakataon
Maging sa kagipitan, Ika'y gumagawa
Ng paraan upang kami ay matulungan

[Chorus]
Kaya't kami'y nagpupuri
Sa Iyong kabutihan
Kaya't kami'y sumasamba
Sa Iyong kadakilaan
Panginoon, Ika'y pasasalamatan
Sa Iyong walang hanggang pag-ibig`),

  processSong("Awit ng Pagsamba", "Musikatha", `[Verse]
Kay buti Mo Panginoon
Dakila Ka sa buhay ko
Sa labis na pag-ibig Mo
Ay naligtas ako

[Chorus]
Kaya't awit ng pagsamba
Ay ialay sa Iyo
Ang puso ko'y magpupuri
Sa Iyo Hesus`),

  processSong("Diyos Ay Mabuti", "Papuri Singers", `[Verse]
Ang Diyos ay mabuti
Ang Diyos ay mabuti
Ang Diyos ay mabuti
Sa akin

[Chorus]
Ipapahayag ko
Ang kabutihan Niya
Ipapahayag ko
Ang pag-ibig Niya
Ang Diyos ay mabuti
Sa akin`),
];

// Append to hymnsOfPraises.ts
let content = fs.readFileSync('src/data/hymnsOfPraises.ts', 'utf8');

// The file exports `export const HYMNS_OF_PRAISES: Song[] = [ ... ];`
// Let's insert new songs before the closing `];`
const closingBracketIndex = content.lastIndexOf('];');
if (closingBracketIndex > -1) {
  const jsonSongs = newSongs.map(s => JSON.stringify(s, null, 2)).join(',\n') + ',\n';
  content = content.slice(0, closingBracketIndex) + ',\n' + jsonSongs + content.slice(closingBracketIndex);
  
  // Clean up formatting where there might be double commas
  content = content.replace(/,\s*,/g, ',');
  fs.writeFileSync('src/data/hymnsOfPraises.ts', content);
  console.log('Added ' + newSongs.length + ' Tagalog songs.');
}
