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
    category: "Modern Worship",
    lyrics: compiledText,
    sections
  };
}

const newSongs = [
  processSong("10,000 Reasons (Bless the Lord)", "Matt Redman", `[Chorus]
Bless the Lord, O my soul, O my soul
Worship His holy name
Sing like never before, O my soul
I'll worship Your holy name

[Verse 1]
The sun comes up, it's a new day dawning
It's time to sing Your song again
Whatever may pass and whatever lies before me
Let me be singing when the evening comes

[Verse 2]
You're rich in love and You're slow to anger
Your name is great and Your heart is kind
For all Your goodness I will keep on singing
Ten thousand reasons for my heart to find

[Verse 3]
And on that day when my strength is failing
The end draws near and my time has come
Still my soul will sing Your praise unending
Ten thousand years and then forevermore`),

  processSong("What a Beautiful Name", "Hillsong Worship", `[Verse 1]
You were the Word at the beginning
One with God the Lord Most High
Your hidden glory in creation
Now revealed in You our Christ

[Chorus 1]
What a beautiful Name it is
What a beautiful Name it is
The Name of Jesus Christ my King
What a beautiful Name it is
Nothing compares to this
What a beautiful Name it is
The Name of Jesus

[Verse 2]
You didn't want heaven without us
So Jesus You brought heaven down
My sin was great Your love was greater
What could separate us now

[Chorus 2]
What a wonderful Name it is
What a wonderful Name it is
The Name of Jesus Christ my King
What a wonderful Name it is
Nothing compares to this
What a wonderful Name it is
The Name of Jesus

[Bridge]
Death could not hold You
The veil tore before You
You silence the boast of sin and grave
The heavens are roaring
The praise of Your glory
For You are raised to life again

You have no rival
You have no equal
Now and forever God You reign
Yours is the kingdom
Yours is the glory
Yours is the Name above all names`),

  processSong("Here I Am to Worship", "Tim Hughes", `[Verse 1]
Light of the world
You stepped down into darkness
Opened my eyes, let me see
Beauty that made this heart adore You
Hope of a life spent with You

[Chorus]
Here I am to worship
Here I am to bow down
Here I am to say that You're my God
You're altogether lovely
Altogether worthy
Altogether wonderful to me

[Verse 2]
King of all days
Oh so highly exalted
Glorious in heaven above
Humbly You came to the earth You created
All for love's sake became poor

[Bridge]
I'll never know how much it cost
To see my sin upon that cross
I'll never know how much it cost
To see my sin upon that cross`),

  processSong("Goodness of God", "Bethel Music", `[Verse 1]
I love You, Lord
For Your mercy never fails me
All my days, I've been held in Your hands
From the moment that I wake up
Until I lay my head
Oh, I will sing of the goodness of God

[Chorus]
And all my life You have been faithful
And all my life You have been so, so good
With every breath that I am able
Oh, I will sing of the goodness of God

[Verse 2]
I love Your voice
You have led me through the fire
In darkest nights You are close like no other
I've known You as a Father
I've known You as a Friend
And I have lived in the goodness of God

[Bridge]
'Cause Your goodness is running after, it's running after me
Your goodness is running after, it's running after me
With my life laid down, I'm surrendered now
I give You everything
'Cause Your goodness is running after, it's running after me`),
  
  processSong("Shout to the Lord", "Darlene Zschech", `[Verse]
My Jesus, my Saviour
Lord, there is none like You
All of my days, I want to praise
The wonders of Your mighty love

[Verse]
My comfort, my shelter
Tower of refuge and strength
Let every breath, all that I am
Never cease to worship You

[Chorus]
Shout to the Lord, all the earth let us sing
Power and majesty, praise to the King
Mountains bow down and the seas will roar
At the sound of Your name
I sing for joy at the work of Your hands
Forever I'll love You, forever I'll stand
Nothing compares to the promise I have in You`),
];

// Append to specialNumbers.ts
let content = fs.readFileSync('src/data/specialNumbers.ts', 'utf8');

const closingBracketIndex = content.lastIndexOf('];');
if (closingBracketIndex > -1) {
  const jsonSongs = newSongs.map(s => JSON.stringify(s, null, 2)).join(',\n') + ',\n';
  content = content.slice(0, closingBracketIndex) + ',\n' + jsonSongs + content.slice(closingBracketIndex);
  content = content.replace(/,\s*,/g, ',');
  fs.writeFileSync('src/data/specialNumbers.ts', content);
  console.log('Added ' + newSongs.length + ' English songs.');
}
