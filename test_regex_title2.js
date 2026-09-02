const regex = /^\s*(?:Title\s*:|Title)\s*\n?([^\n]+)(?:\n\s*\n|\n|$)/i;
const texts = [
  "Title:\nSound the Battle Cry\n\nVerse:",
  "Title: Sound the Battle Cry\n\nVerse:",
  "Title : Sound the Battle Cry\nVerse:",
  "title sound the battle cry\nVerse"
];

texts.forEach(t => {
  const match = t.match(regex);
  if (match) {
    console.log("MATCH:", match[1].trim());
    console.log("REPLACED:", t.replace(match[0], ''));
  } else {
    console.log("NO MATCH for:", t);
  }
});
