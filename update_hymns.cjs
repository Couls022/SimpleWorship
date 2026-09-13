const fs = require('fs');

const baptistHymns = [
  {
    title: "How Great Thou Art",
    author: "Carl Boberg",
    lyrics: `[Title]
How Great Thou Art
Carl Boberg

[Verse 1]
O Lord my God, when I in awesome wonder
Consider all the worlds Thy hands have made,
I see the stars, I hear the rolling thunder,
Thy power throughout the universe displayed.

[Chorus]
Then sings my soul, my Savior God, to Thee:
How great Thou art, how great Thou art!
Then sings my soul, my Savior God, to Thee:
How great Thou art, how great Thou art!

[Verse 2]
When through the woods and forest glades I wander
And hear the birds sing sweetly in the trees,
When I look down from lofty mountain grandeur,
And hear the brook and feel the gentle breeze.

[Chorus]
Then sings my soul, my Savior God, to Thee:
How great Thou art, how great Thou art!
Then sings my soul, my Savior God, to Thee:
How great Thou art, how great Thou art!

[Verse 3]
And when I think that God, His Son not sparing,
Sent Him to die, I scarce can take it in,
That on the cross, my burden gladly bearing,
He bled and died to take away my sin.

[Chorus]
Then sings my soul, my Savior God, to Thee:
How great Thou art, how great Thou art!
Then sings my soul, my Savior God, to Thee:
How great Thou art, how great Thou art!

[Verse 4]
When Christ shall come with shout of acclamation
And take me home, what joy shall fill my heart!
Then I shall bow in humble adoration,
And there proclaim: My God, how great Thou art!

[Chorus]
Then sings my soul, my Savior God, to Thee:
How great Thou art, how great Thou art!
Then sings my soul, my Savior God, to Thee:
How great Thou art, how great Thou art!`
  },
  {
    title: "Amazing Grace",
    author: "John Newton",
    lyrics: `[Title]
Amazing Grace
John Newton

[Verse 1]
Amazing grace! how sweet the sound,
That saved a wretch like me!
I once was lost but now am found,
Was blind but now I see.

[Verse 2]
'Twas grace that taught my heart to fear,
And grace my fears relieved;
How precious did that grace appear
The hour I first believed!

[Verse 3]
The Lord has promised good to me,
His word my hope secures;
He will my shield and portion be
As long as life endures.

[Verse 4]
Through many dangers, toils, and snares,
I have already come;
'Tis grace hath brought me safe thus far,
And grace will lead me home.

[Verse 5]
When we've been there ten thousand years,
Bright shining as the sun,
We've no less days to sing God's praise
Than when we'd first begun.`
  },
  {
    title: "Holy, Holy, Holy! Lord God Almighty",
    author: "Reginald Heber",
    lyrics: `[Title]
Holy, Holy, Holy! Lord God Almighty
Reginald Heber

[Verse 1]
Holy, holy, holy! Lord God Almighty!
Early in the morning our song shall rise to Thee;
Holy, holy, holy, merciful and mighty!
God in three Persons, blessed Trinity!

[Verse 2]
Holy, holy, holy! All the saints adore Thee,
Casting down their golden crowns around the glassy sea;
Cherubim and seraphim falling down before Thee,
Who was, and is, and evermore shall be.

[Verse 3]
Holy, holy, holy! though the darkness hide Thee,
Though the eye of sinful man Thy glory may not see;
Only Thou art holy; there is none beside Thee,
Perfect in power, in love, and purity.

[Verse 4]
Holy, holy, holy! Lord God Almighty!
All Thy works shall praise Thy Name, in earth, and sky, and sea;
Holy, holy, holy; merciful and mighty!
God in three Persons, blessed Trinity!`
  },
  {
    title: "Come, Thou Fount of Every Blessing",
    author: "Robert Robinson",
    lyrics: `[Title]
Come, Thou Fount of Every Blessing
Robert Robinson

[Verse 1]
Come, Thou Fount of every blessing,
Tune my heart to sing Thy grace;
Streams of mercy, never ceasing,
Call for songs of loudest praise.
Teach me some melodious sonnet,
Sung by flaming tongues above.
Praise the mount! I'm fixed upon it,
Mount of Thy redeeming love.

[Verse 2]
Here I raise mine Ebenezer;
Hither by Thy help I'm come;
And I hope, by Thy good pleasure,
Safely to arrive at home.
Jesus sought me when a stranger,
Wandering from the fold of God;
He, to rescue me from danger,
Interposed His precious blood.

[Verse 3]
O to grace how great a debtor
Daily I'm constrained to be!
Let Thy goodness, like a fetter,
Bind my wandering heart to Thee.
Prone to wander, Lord, I feel it,
Prone to leave the God I love;
Here's my heart, O take and seal it,
Seal it for Thy courts above.`
  },
  {
    title: "It Is Well With My Soul",
    author: "Horatio G. Spafford",
    lyrics: `[Title]
It Is Well With My Soul
Horatio G. Spafford

[Verse 1]
When peace like a river attendeth my way,
When sorrows like sea billows roll;
Whatever my lot, Thou hast taught me to say,
"It is well, it is well with my soul."

[Chorus]
It is well (it is well)
With my soul (with my soul),
It is well, it is well with my soul.

[Verse 2]
Though Satan should buffet, though trials should come,
Let this blest assurance control,
That Christ hath regarded my helpless estate,
And hath shed His own blood for my soul.

[Chorus]
It is well (it is well)
With my soul (with my soul),
It is well, it is well with my soul.

[Verse 3]
My sin—O the bliss of this glorious thought!—
My sin, not in part but the whole,
Is nailed to the cross, and I bear it no more,
Praise the Lord, praise the Lord, O my soul!

[Chorus]
It is well (it is well)
With my soul (with my soul),
It is well, it is well with my soul.

[Verse 4]
And Lord, haste the day when my faith shall be sight,
The clouds be rolled back as a scroll;
The trump shall resound, and the Lord shall descend,
Even so, it is well with my soul.

[Chorus]
It is well (it is well)
With my soul (with my soul),
It is well, it is well with my soul.`
  },
  {
    title: "To God Be the Glory",
    author: "Fanny J. Crosby",
    lyrics: `[Title]
To God Be the Glory
Fanny J. Crosby

[Verse 1]
To God be the glory, great things He has done;
So loved He the world that He gave us His Son,
Who yielded His life an atonement for sin,
And opened the life gate that all may go in.

[Chorus]
Praise the Lord, praise the Lord,
Let the earth hear His voice!
Praise the Lord, praise the Lord,
Let the people rejoice!
O come to the Father, through Jesus the Son,
And give Him the glory, great things He has done.

[Verse 2]
O perfect redemption, the purchase of blood,
To every believer the promise of God;
The vilest offender who truly believes,
That moment from Jesus a pardon receives.

[Chorus]
Praise the Lord, praise the Lord,
Let the earth hear His voice!
Praise the Lord, praise the Lord,
Let the people rejoice!
O come to the Father, through Jesus the Son,
And give Him the glory, great things He has done.

[Verse 3]
Great things He has taught us, great things He has done,
And great our rejoicing through Jesus the Son;
But purer, and higher, and greater will be
Our wonder, our transport, when Jesus we see.

[Chorus]
Praise the Lord, praise the Lord,
Let the earth hear His voice!
Praise the Lord, praise the Lord,
Let the people rejoice!
O come to the Father, through Jesus the Son,
And give Him the glory, great things He has done.`
  },
  {
    title: "Blessed Assurance",
    author: "Fanny J. Crosby",
    lyrics: `[Title]
Blessed Assurance
Fanny J. Crosby

[Verse 1]
Blessed assurance, Jesus is mine!
O what a foretaste of glory divine!
Heir of salvation, purchase of God,
Born of His Spirit, washed in His blood.

[Chorus]
This is my story, this is my song,
Praising my Savior all the day long;
This is my story, this is my song,
Praising my Savior all the day long.

[Verse 2]
Perfect submission, perfect delight,
Visions of rapture now burst on my sight;
Angels descending bring from above
Echoes of mercy, whispers of love.

[Chorus]
This is my story, this is my song,
Praising my Savior all the day long;
This is my story, this is my song,
Praising my Savior all the day long.

[Verse 3]
Perfect submission, all is at rest,
I in my Savior am happy and blest,
Watching and waiting, looking above,
Filled with His goodness, lost in His love.

[Chorus]
This is my story, this is my song,
Praising my Savior all the day long;
This is my story, this is my song,
Praising my Savior all the day long.`
  },
  {
    title: "Great Is Thy Faithfulness",
    author: "Thomas O. Chisholm",
    lyrics: `[Title]
Great Is Thy Faithfulness
Thomas O. Chisholm

[Verse 1]
Great is Thy faithfulness, O God my Father;
There is no shadow of turning with Thee;
Thou changest not, Thy compassions, they fail not;
As Thou hast been, Thou forever wilt be.

[Chorus]
Great is Thy faithfulness!
Great is Thy faithfulness!
Morning by morning new mercies I see:
All I have needed Thy hand hath provided—
Great is Thy faithfulness, Lord, unto me!

[Verse 2]
Summer and winter and springtime and harvest,
Sun, moon, and stars in their courses above
Join with all nature in manifold witness
To Thy great faithfulness, mercy, and love.

[Chorus]
Great is Thy faithfulness!
Great is Thy faithfulness!
Morning by morning new mercies I see:
All I have needed Thy hand hath provided—
Great is Thy faithfulness, Lord, unto me!

[Verse 3]
Pardon for sin and a peace that endureth,
Thine own dear presence to cheer and to guide,
Strength for today and bright hope for tomorrow,
Blessings all mine, with ten thousand beside!

[Chorus]
Great is Thy faithfulness!
Great is Thy faithfulness!
Morning by morning new mercies I see:
All I have needed Thy hand hath provided—
Great is Thy faithfulness, Lord, unto me!`
  },
  {
    title: "Because He Lives",
    author: "William J. Gaither",
    lyrics: `[Title]
Because He Lives
William J. Gaither

[Verse 1]
God sent His son, they called Him Jesus;
He came to love, heal, and forgive;
He lived and died to buy my pardon,
An empty grave is there to prove my Savior lives.

[Chorus]
Because He lives, I can face tomorrow;
Because He lives, all fear is gone;
Because I know He holds the future,
And life is worth the living just because He lives.

[Verse 2]
How sweet to hold a newborn baby,
And feel the pride and joy he gives;
But greater still the calm assurance,
This child can face uncertain days because He lives.

[Chorus]
Because He lives, I can face tomorrow;
Because He lives, all fear is gone;
Because I know He holds the future,
And life is worth the living just because He lives.

[Verse 3]
And then one day I'll cross the river;
I'll fight life's final war with pain;
And then as death gives way to vict'ry,
I'll see the lights of glory and I'll know He lives.

[Chorus]
Because He lives, I can face tomorrow;
Because He lives, all fear is gone;
Because I know He holds the future,
And life is worth the living just because He lives.`
  },
  {
    title: "In Christ Alone",
    author: "Keith Getty, Stuart Townend",
    lyrics: `[Title]
In Christ Alone
Keith Getty, Stuart Townend

[Verse 1]
In Christ alone my hope is found,
He is my light, my strength, my song;
This Cornerstone, this solid Ground,
Firm through the fiercest drought and storm.
What heights of love, what depths of peace,
When fears are stilled, when strivings cease!
My Comforter, my All in All,
Here in the love of Christ I stand.

[Verse 2]
In Christ alone! - who took on flesh,
Fullness of God in helpless babe.
This gift of love and righteousness,
Scorned by the ones He came to save:
Till on that cross as Jesus died,
The wrath of God was satisfied -
For every sin on Him was laid;
Here in the death of Christ I live.

[Verse 3]
There in the ground His body lay,
Light of the world by darkness slain:
Then bursting forth in glorious day
Up from the grave He rose again!
And as He stands in victory
Sin's curse has lost its grip on me,
For I am His and He is mine -
Bought with the precious blood of Christ.

[Verse 4]
No guilt in life, no fear in death,
This is the power of Christ in me;
From life's first cry to final breath,
Jesus commands my destiny.
No power of hell, no scheme of man,
Can ever pluck me from His hand:
Till He returns or calls me home,
Here in the power of Christ I'll stand.`
  }
];

const hymnsOfPraises = [
  {
    title: "Dakilang Katapatan",
    author: "Papuri Singers",
    lyrics: `[Title]
Dakilang Katapatan
Papuri Singers

[Verse 1]
Sadyang kay buti ng ating Panginoon
Nagtatapat sa habang panahon
Maging sa kabila ng ating pagkukulang
Biyaya Niya'y patuloy na laan

[Chorus]
Dakila Ka O Diyos
Tapat Ka ngang tunay
Magmula pa sa ugat ng aming lahi
Mundo'y magunaw man
Maaasahan Kang lagi
Maging hanggang wakas nitong buhay

[Verse 2]
Kaya O Diyos Ika'y laging pupurihin
Sa buong mundo'y aking aawitin
Ang kadakilaan Mo at katapatan
Pag-ibig Mong walang hanggan

[Chorus]
Dakila Ka O Diyos
Tapat Ka ngang tunay
Magmula pa sa ugat ng aming lahi
Mundo'y magunaw man
Maaasahan Kang lagi
Maging hanggang wakas nitong buhay`
  },
  {
    title: "Salamat Panginoon",
    author: "Papuri",
    lyrics: `[Title]
Salamat Panginoon
Papuri

[Verse 1]
Ikaw ay mabuti, bawat sandali
Sa habang buhay ay mananatili
Hindi nagbabago, di nagkukulang
Ang Iyong pag-ibig, laging laan

[Chorus]
Salamat Panginoon, kilala Mo ako
Ang lahat ng bagay ay di lingid sa Iyo
Salamat Panginoon, tinutugon Mo
Ang tanging dalangin ng aking puso

[Verse 2]
Sa Iyong paningin, ako'y mahalaga
Sa piling Mo, ako'y may pag-asa
Walang katapusan, ang 'Yong pag-ibig
Ika'y magtatapat sa bawat saglit

[Chorus]
Salamat Panginoon, kilala Mo ako
Ang lahat ng bagay ay di lingid sa Iyo
Salamat Panginoon, tinutugon Mo
Ang tanging dalangin ng aking puso`
  },
  {
    title: "Banal Mong Tahanan",
    author: "Papuri",
    lyrics: `[Title]
Banal Mong Tahanan
Papuri

[Verse 1]
Ang puso ko ay dinudulog sa Iyo
Nagpapakumbaba, sumasamo
Pag-ibig Mo'y nawa'y maranasan ko
Panginoon, ako'y turuan Mo

[Chorus]
Buhay ko'y Iyong pagharian
Puso ko'y Iyong tahanan
Nais ko'y manatili sa Iyong piling
Panginoon, Ika'y laging pupurihin

[Verse 2]
Sa Iyong biyaya ako'y umaasa
Ikaw ang kalakasan at pag-asa
Di ko kayang mabuhay kung wala Ka
Tanging sa Iyo, ako'y sasamba

[Chorus]
Buhay ko'y Iyong pagharian
Puso ko'y Iyong tahanan
Nais ko'y manatili sa Iyong piling
Panginoon, Ika'y laging pupurihin`
  },
  {
    title: "Wala Kang Katulad",
    author: "Papuri",
    lyrics: `[Title]
Wala Kang Katulad
Papuri

[Verse 1]
Awitin ko man lahat ng awit sa mundo
Ay di kayang ilarawan ang kadakilaan Mo
Kulang ang lahat ng tula, kulang maging mga salita
Upang ihayag ang kabutihan Mo

[Chorus]
Wala Kang katulad, wala Kang katulad
Ikaw ang Diyos na sa 'mi'y nagmamahal
Wala Kang katulad, wala Kang katulad
Panginoon, Ika'y aming itatanghal

[Verse 2]
Sa habang panahon, Ika'y aming pupurihin
Sa bawat sandali, Ika'y aawitin
Walang ibang Diyos na sa 'mi'y magliligtas
Tanging Ikaw, hanggang wakas

[Chorus]
Wala Kang katulad, wala Kang katulad
Ikaw ang Diyos na sa 'mi'y nagmamahal
Wala Kang katulad, wala Kang katulad
Panginoon, Ika'y aming itatanghal`
  },
  {
    title: "Sambahin Ka O Diyos",
    author: "Papuri Singers",
    lyrics: `[Title]
Sambahin Ka O Diyos
Papuri Singers

[Verse 1]
O Diyos, Ikaw ang aming pinupuri
Ang Iyong pangalan ay itinataas
Sa Iyong kabutihan kami'y nagagalak
Ang Iyong pag-ibig ay wagas

[Chorus]
Sambahin Ka O Diyos, sambahin Ka
Ika'y aming pinupuri, Ika'y aming sinasamba
Wala Kang katulad sa buong mundo
Sambahin Ka O Diyos ng aming puso

[Verse 2]
Ang Iyong kaharian ay walang hanggan
Ang Iyong kapangyarihan ay di matatawaran
Sa Iyong pangalan kami'y magdiriwang
Ang Iyong pag-ibig, walang hanggan

[Chorus]
Sambahin Ka O Diyos, sambahin Ka
Ika'y aming pinupuri, Ika'y aming sinasamba
Wala Kang katulad sa buong mundo
Sambahin Ka O Diyos ng aming puso`
  }
];

const specialNumbers = [
  {
    title: "Via Dolorosa",
    author: "Sandi Patty",
    lyrics: `[Title]
Via Dolorosa
Sandi Patty

[Verse 1]
Down the Via Dolorosa in Jerusalem that day
The soldiers tried to clear the narrow street
But the crowd pressed in to see
The Man condemned to die on Calvary

[Verse 2]
He was bleeding from a beating, there were stripes upon His back
And He wore a crown of thorns upon His head
And He bore with every step
The scorn of those who cried out for His death

[Chorus]
Down the Via Dolorosa called the way of suffering
Like a lamb came the Messiah, Christ the King,
But He chose to walk that road out of His love for you and me.
Down the Via Dolorosa, all the way to Calvary.

[Verse 3]
Por la Via Dolorosa, triste dia en Jerusalem
Los soldados le abrian paso a Jesus
Mas la gente se acercaba
Para ver al que llevaba aquella cruz

[Chorus]
Por la Via Dolorosa, que es la via del dolor
Como oveja vino Cristo, Rey, Señor
Y fue Él quien quiso ir por su amor por ti y por mi
Por la Via Dolorosa al Calvario y a morir

[Bridge]
The blood that would cleanse the souls of all men
Made its way through the heart of Jerusalem.

[Chorus]
Down the Via Dolorosa called the way of suffering
Like a lamb came the Messiah, Christ the King,
But He chose to walk that road out of His love for you and me.
Down the Via Dolorosa, all the way to Calvary.`
  },
  {
    title: "I Can Only Imagine",
    author: "MercyMe",
    lyrics: `[Title]
I Can Only Imagine
MercyMe

[Verse 1]
I can only imagine what it will be like
When I walk by Your side
I can only imagine what my eyes will see
When Your face is before me
I can only imagine, yeah

[Chorus]
Surrounded by Your glory
What will my heart feel?
Will I dance for You Jesus
Or in awe of You be still?
Will I stand in Your presence
Or to my knees will I fall?
Will I sing hallelujah?
Will I be able to speak at all?
I can only imagine
I can only imagine

[Verse 2]
I can only imagine when that day comes
And I find myself standing in the Son
I can only imagine when all I will do
Is forever, forever worship You
I can only imagine, yeah
I can only imagine

[Chorus]
Surrounded by Your glory
What will my heart feel?
Will I dance for You Jesus
Or in awe of You be still?
Will I stand in Your presence
Or to my knees will I fall?
Will I sing hallelujah?
Will I be able to speak at all?
I can only imagine
I can only imagine`
  },
  {
    title: "Blessings",
    author: "Laura Story",
    lyrics: `[Title]
Blessings
Laura Story

[Verse 1]
We pray for blessings, we pray for peace
Comfort for family, protection while we sleep
We pray for healing, for prosperity
We pray for Your mighty hand to ease our suffering

[Pre-Chorus]
And all the while, You hear each spoken need
Yet love us way too much to give us lesser things

[Chorus]
'Cause what if Your blessings come through raindrops?
What if Your healing comes through tears?
What if a thousand sleepless nights
Are what it takes to know You're near?
And what if trials of this life
Are Your mercies in disguise?

[Verse 2]
We pray for wisdom, Your voice to hear
And we cry in anger when we cannot feel You near
We doubt Your goodness, we doubt Your love
As if every promise from His Word is not enough

[Pre-Chorus]
And all the while, You hear each desperate plea
And long that we'd have faith to believe

[Chorus]
'Cause what if Your blessings come through raindrops?
What if Your healing comes through tears?
What if a thousand sleepless nights
Are what it takes to know You're near?
And what if trials of this life
Are Your mercies in disguise?

[Bridge]
When friends betray us, and when darkness seems to win
We know that pain reminds this heart
That this is not, this is not our home
It's not our home

[Chorus]
'Cause what if Your blessings come through raindrops?
What if Your healing comes through tears?
And what if a thousand sleepless nights
Are what it takes to know You're near?
What if my greatest disappointments
Or the aching of this life
Is the revealing of a greater thirst
This world can't satisfy?
And what if trials of this life
The rain, the storms, the hardest nights
Are Your mercies in disguise?`
  },
  {
    title: "You Raise Me Up",
    author: "Josh Groban",
    lyrics: `[Title]
You Raise Me Up
Josh Groban

[Verse 1]
When I am down and, oh my soul, so weary;
When troubles come and my heart burdened be;
Then, I am still and wait here in the silence,
Until you come and sit awhile with me.

[Chorus]
You raise me up, so I can stand on mountains;
You raise me up, to walk on stormy seas;
I am strong, when I am on your shoulders;
You raise me up: To more than I can be.

[Verse 2]
There is no life - no life without its hunger;
Each restless heart beats so imperfectly;
But when you come and I am filled with wonder,
Sometimes, I think I glimpse eternity.

[Chorus]
You raise me up, so I can stand on mountains;
You raise me up, to walk on stormy seas;
I am strong, when I am on your shoulders;
You raise me up: To more than I can be.

[Chorus]
You raise me up, so I can stand on mountains;
You raise me up, to walk on stormy seas;
I am strong, when I am on your shoulders;
You raise me up: To more than I can be.

[Chorus]
You raise me up, so I can stand on mountains;
You raise me up, to walk on stormy seas;
I am strong, when I am on your shoulders;
You raise me up: To more than I can be.

[Outro]
You raise me up: To more than I can be.`
  },
  {
    title: "Lead Me Lord",
    author: "Gary Valenciano",
    lyrics: `[Title]
Lead Me Lord
Gary Valenciano

[Verse 1]
Lead me Lord, lead me by the hand
And make me face the rising sun
Comfort me through all the pain that life may bring
There's no other hope that I can lean upon
Lead me Lord, lead me all my life

[Verse 2]
Walk by me, walk by me across the lonely road of everyday
Take my arms and let Your hand show me the way
Show the way to live inside Your love
Lead me Lord, all my life

[Chorus]
You are my light
You're the lamp upon my feet
All the time, my Lord, I need You there
You are my life
I cannot live alone
Let me stay by Your guiding love
All through my life, lead me Lord

[Verse 3]
Lead me Lord, even though at times I'd rather go along my way
Help me take the right direction, take Your road
Lead me Lord and never leave my side
All my days, all my life

[Chorus]
You are my light
You're the lamp upon my feet
All the time, my Lord, I need You there
You are my life
I cannot live alone
Let me stay by Your guiding love
All through my life, lead me Lord`
  }
];

function generateFile(array, arrayName, idPrefix, catName) {
  let content = `import { Song } from '../types';

export const ${arrayName}: Song[] = [
`;

  array.forEach((s, idx) => {
    let sections = [];
    const blocks = s.lyrics.split(/\n\s*\n/).filter(b => b.trim().length > 0);
    blocks.forEach((block, bIdx) => {
      const match = block.match(/^\[(.*?)\]\n?([\s\S]*)$/);
      const title = match ? match[1] : "Verse " + (bIdx + 1);
      const text = match ? match[2].trim() : block.trim();
      sections.push({ name: title, text: text });
    });

    content += `  {
    id: "${idPrefix}-${idx + 1}",
    title: ${JSON.stringify(s.title)},
    author: ${JSON.stringify(s.author)},
    copyright: "Public Domain",
    key: "C",
    tempo: "Moderate",
    category: "${catName}",
    lyrics: ${JSON.stringify(s.lyrics)},
    sections: ${JSON.stringify(sections, null, 6)}
  }`;
    if (idx < array.length - 1) content += ',';
    content += '\n';
  });

  content += `];\n`;
  return content;
}

fs.writeFileSync('./src/data/baptistHymnal.ts', generateFile(baptistHymns, 'BAPTIST_HYMNAL', 'hymn', 'Hymns'));
fs.writeFileSync('./src/data/hymnsOfPraises.ts', generateFile(hymnsOfPraises, 'HYMNS_OF_PRAISES', 'hop', 'Hymns of Praises'));
fs.writeFileSync('./src/data/specialNumbers.ts', generateFile(specialNumbers, 'SPECIAL_NUMBERS', 'special', 'Special Numbers'));
console.log('Updated songs data files.');
