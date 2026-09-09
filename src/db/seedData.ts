import { Song, Theme, OutputGroup, Schedule, ScriptureVerse, Asset } from '../types';
import { BAPTIST_HYMNAL_SONGS } from '../data/baptistHymnal';
import { HYMNS_OF_PRAISES } from '../data/hymnsOfPraises';
import { BAPTIST_SPECIAL_NUMBERS } from '../data/specialNumbers';


export const defaultThemes: Theme[] = [
  {
    id: 'theme-global',
    name: 'Default Congregation Theme',
    type: 'global',
    styles: {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 90,
      fontColor: '#FFFFFF',
      fontWeight: '700',
      textAlign: 'center',
      textShadow: true,
      shadowColor: 'rgba(0, 0, 0, 0.85)',
      textOutline: true,
      outlineColor: 'rgba(0, 0, 0, 0.95)',
      backgroundType: 'color',
      backgroundColor: '#000000',
      logoPosition: 'bottom-right',
      logoSize: 72,
      logoOpacity: 0.85,
      showLogo: true,
      padding: '4rem',
      lineHeight: 1.35,
    }
  },
  {
    id: 'theme-scripture',
    name: 'Scripture Serif Theme',
    type: 'bible',
    styles: {
      fontFamily: 'Tahoma, sans-serif',
      fontSize: 90,
      fontColor: '#F8FAFC',
      fontWeight: '700',
      fontStyle: 'normal',
      textAlign: 'center',
      textShadow: true,
      shadowColor: 'rgba(0, 0, 0, 0.9)',
      backgroundType: 'color',
      backgroundColor: '#000000',
      padding: '5rem',
      lineHeight: 1.35,
    }
  },
  {
    id: 'theme-stage',
    name: 'High-Contrast Stage Monitor',
    type: 'stage',
    styles: {
      fontFamily: 'Arial, sans-serif',
      fontSize: 58,
      fontColor: '#FACC15',
      fontWeight: '800',
      textAlign: 'left',
      backgroundColor: '#000000',
      backgroundType: 'color',
      padding: '2rem',
      lineHeight: 1.25,
    }
  },
  {
    id: 'theme-song',
    name: 'Default Song Theme',
    type: 'song',
    styles: {
      backgroundType: 'color',
      backgroundColor: '#000000',
    }
  },
  {
    id: 'theme-presentation',
    name: 'Default Presentation Theme',
    type: 'presentation',
    styles: {
      backgroundType: 'color',
      backgroundColor: '#000000',
    }
  },
  {
    id: 'theme-announcement',
    name: 'Default Announcement Theme',
    type: 'announcement',
    styles: {
      backgroundType: 'color',
      backgroundColor: '#000000',
    }
  },
  {
    id: 'theme-logo',
    name: 'Default Logo Theme',
    type: 'logo',
    styles: {
      backgroundType: 'color',
      backgroundColor: '#000000',
      showLogo: true,
      logoPosition: 'bottom-right',
      logoSize: 120,
      logoOpacity: 1.0,
    }
  }
];

export const defaultSongs: Song[] = [
  {
    id: 'song-1',
    title: 'Hallelujah What A Savior',
    author: 'Philip P. Bliss',
    copyright: 'Public Domain',
    ccli: '19530',
    key: 'B',
    tempo: 'Slow',
    tags: ['Hymn', 'Cross', 'Easter', 'Grace'],
    sections: [
      {
        id: 's1-v1',
        name: 'Verse 1',
        text: '"Man of Sorrows!" what a name\nFor the Son of God, who came\nRuined sinners to reclaim.\nHallelujah! What a Savior!'
      },
      {
        id: 's1-v2',
        name: 'Verse 2',
        text: 'Bearing shame and scoffing rude,\nIn my place condemned He stood;\nSealed my pardon with His blood.\nHallelujah! What a Savior!'
      },
      {
        id: 's1-v3',
        name: 'Verse 3',
        text: 'Guilty, vile, and helpless we;\nSpotless Lamb of God was He;\n"Full atonement!" can it be?\nHallelujah! What a Savior!'
      },
      {
        id: 's1-v4',
        name: 'Verse 4',
        text: 'Lifted up was He to die;\n"It is finished!" was His cry;\nNow in Heav\'n exalted high.\nHallelujah! What a Savior!'
      },
      {
        id: 's1-v5',
        name: 'Verse 5',
        text: 'When He comes, our glorious King,\nAll His ransomed home to bring,\nThen anew this song we\'ll sing:\nHallelujah! What a Savior!'
      }
    ]
  },
  {
    id: 'song-2',
    title: 'Jesus Paid It All',
    author: 'Elvina M. Hall / John T. Grape',
    copyright: 'Public Domain',
    ccli: '2233',
    key: 'Eb',
    tempo: 'Medium',
    tags: ['Hymn', 'Blood of Jesus', 'Grace'],
    sections: [
      {
        id: 's2-v1',
        name: 'Verse 1',
        text: 'I hear the Savior say,\n"Thy strength indeed is small;\nChild of weakness, watch and pray,\nFind in Me thine all in all."'
      },
      {
        id: 's2-c1',
        name: 'Chorus',
        text: 'Jesus paid it all,\nAll to Him I owe;\nSin had left a crimson stain,\nHe washed it white as snow.'
      },
      {
        id: 's2-v2',
        name: 'Verse 2',
        text: 'Lord, now indeed I find\nThy power, and Thine alone,\nCan change the leper\'s spots\nAnd melt the heart of stone.'
      },
      {
        id: 's2-v3',
        name: 'Verse 3',
        text: 'For nothing good have I\nWhereby Thy grace to claim;\nI\'ll wash my garments white\nIn the blood of Calvary\'s Lamb.'
      },
      {
        id: 's2-v4',
        name: 'Verse 4',
        text: 'And when before the throne\nI stand in Him complete,\n"Jesus died my soul to save,"\nMy lips shall still repeat.'
      }
    ]
  },
  {
    id: 'song-3',
    title: 'Amazing Grace',
    author: 'John Newton',
    copyright: 'Public Domain',
    ccli: '22025',
    key: 'G',
    tempo: 'Slow',
    tags: ['Hymn', 'Grace', 'Salvation'],
    sections: [
      {
        id: 's3-v1',
        name: 'Verse 1',
        text: 'Amazing grace! how sweet the sound,\nThat saved a wretch like me!\nI once was lost, but now am found,\nWas blind, but now I see.'
      },
      {
        id: 's3-v2',
        name: 'Verse 2',
        text: '\'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed!'
      },
      {
        id: 's3-v3',
        name: 'Verse 3',
        text: 'Through many dangers, toils and snares,\nI have already come;\n\'Tis grace hath brought me safe thus far,\nAnd grace will lead me home.'
      },
      {
        id: 's3-v4',
        name: 'Verse 4',
        text: 'When we\'ve been there ten thousand years,\nBright shining as the sun,\nWe\'ve no less days to sing God\'s praise\nThan when we\'d first begun.'
      }
    ]
  },
  {
    id: 'song-4',
    title: 'How Great Thou Art',
    author: 'Stuart K. Hine',
    copyright: '1953 Stuart K. Hine Trust',
    ccli: '14181',
    key: 'A',
    tempo: 'Medium',
    tags: ['Hymn', 'Creation', 'Praise', 'Worship'],
    sections: [
      {
        id: 's4-v1',
        name: 'Verse 1',
        text: 'O Lord my God, when I in awesome wonder\nConsider all the worlds Thy hands have made,\nI see the stars, I hear the rolling thunder,\nThy power throughout the universe displayed.'
      },
      {
        id: 's4-c1',
        name: 'Chorus',
        text: 'Then sings my soul, my Savior God, to Thee:\nHow great Thou art, how great Thou art!\nThen sings my soul, my Savior God, to Thee:\nHow great Thou art, how great Thou art!'
      },
      {
        id: 's4-v2',
        name: 'Verse 2',
        text: 'And when I think that God, His Son not sparing,\nSent Him to die, I scarce can take it in;\nThat on the cross, my burden gladly bearing,\nHe bled and died to take away my sin.'
      },
      {
        id: 's4-v3',
        name: 'Verse 3',
        text: 'When Christ shall come with shout of acclamation\nAnd take me home, what joy shall fill my heart!\nThen I shall bow in humble adoration,\nAnd there proclaim, "My God, how great Thou art!"'
      }
    ]
  },
  {
    id: 'song-spec-1',
    title: 'Via Dolorosa',
    author: 'Billy Sprague, Niles Borop',
    copyright: '1984 Word Music',
    ccli: '28671',
    key: 'Fm',
    tempo: 'Solemn',
    category: 'Special Number',
    tags: ['Special Number', 'Solo', 'Easter', 'Cross'],
    sections: [
      {
        id: 'spec1-v1',
        name: 'Verse 1',
        text: 'Down the Via Dolorosa in Jerusalem that day\nThe soldiers tried to clear the narrow street\nBut the crowd pressed in to see\nA Man condemned to die on Calvary'
      },
      {
        id: 'spec1-v2',
        name: 'Verse 2',
        text: 'He was bleeding from a thousand wounds\nAnd His back was lashed and torn\nAnd He bore upon His head a crown of thorns\nAnd with every step He took\nHe had the love of heaven in His heart'
      },
      {
        id: 'spec1-c1',
        name: 'Chorus',
        text: 'Down the Via Dolorosa called the way of suffering\nLike a lamb came the Messiah, Christ the King,\nBut He chose to walk that road out of His love for you and me\nDown the Via Dolorosa all the way to Calvary'
      }
    ]
  },
  {
    id: 'song-spec-2',
    title: "I'd Rather Have Jesus",
    author: 'Rhea F. Miller / George Beverly Shea',
    copyright: 'Public Domain',
    ccli: '17235',
    key: 'C',
    tempo: 'Slow',
    category: 'Special Number',
    tags: ['Special Number', 'Solo', 'Hymn', 'Devotion'],
    sections: [
      {
        id: 'spec2-v1',
        name: 'Verse 1',
        text: "I'd rather have Jesus than silver or gold;\nI'd rather be His than have riches untold;\nI'd rather have Jesus than houses or lands;\nI'd rather be led by His nail-pierced hand."
      },
      {
        id: 'spec2-c1',
        name: 'Chorus',
        text: "Than to be the king of a vast domain\nAnd be held in sin's dread sway;\nI'd rather have Jesus than anything\nThis world affords today."
      },
      {
        id: 'spec2-v2',
        name: 'Verse 2',
        text: "I'd rather have Jesus than men's applause;\nI'd rather be faithful to His dear cause;\nI'd rather have Jesus than worldwide fame;\nI'd rather be true to His holy name."
      }
    ]
  },
  {
    id: 'song-spec-3',
    title: 'Goodness of God',
    author: 'Jenn Johnson, Ed Cash, Jason Ingram',
    copyright: '2018 Bethel Music',
    ccli: '7117726',
    key: 'Ab',
    tempo: 'Medium',
    category: 'Special Number',
    tags: ['Special Number', 'Solo', 'Praise', 'Faithfulness'],
    sections: [
      {
        id: 'spec3-v1',
        name: 'Verse 1',
        text: 'I love You, Lord, for Your mercy never fails me\nAll my days, I\'ve been held in Your hands\nFrom the moment that I wake up until I lay my head\nOh, I will sing of the goodness of God'
      },
      {
        id: 'spec3-c1',
        name: 'Chorus',
        text: 'All my life You have been faithful\nAll my life You have been so, so good\nWith every breath that I am able\nOh, I will sing of the goodness of God'
      },
      {
        id: 'spec3-v2',
        name: 'Verse 2',
        text: 'I love Your voice, You have led me through the fire\nIn darkest night, You are close like no other\nI\'ve known You as a Father, I\'ve known You as a Friend\nAnd I have lived in the goodness of God'
      }
    ]
  },
  {
    id: 'song-spec-4',
    title: 'He Touched Me',
    author: 'William J. Gaither',
    copyright: '1963 William J. Gaither, Inc.',
    ccli: '13072',
    key: 'Eb',
    tempo: 'Medium',
    category: 'Special Number',
    tags: ['Special Number', 'Solo', 'Testimony'],
    sections: [
      {
        id: 'spec4-v1',
        name: 'Verse 1',
        text: "Shackled by a heavy burden,\n'Neath a load of guilt and shame.\nThen the hand of Jesus touched me,\nAnd now I am no longer the same."
      },
      {
        id: 'spec4-c1',
        name: 'Chorus',
        text: 'He touched me, oh He touched me,\nAnd oh the joy that floods my soul!\nSomething happened and now I know,\nHe made me whole, He made me whole.'
      }
    ]
  },
  ...BAPTIST_HYMNAL_SONGS,
  ...HYMNS_OF_PRAISES,
  ...BAPTIST_SPECIAL_NUMBERS
];

export const defaultScriptures: ScriptureVerse[] = [];

export const defaultAssets: Asset[] = [
  {
    id: 'asset-audio-ambient-pad',
    name: 'Serene Worship Ambient Pad',
    type: 'audio',
    hash: 'h_audio_01',
    url: 'https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3',
    duration: 120,
    tags: ['audio', 'ambient', 'pad'],
    createdAt: Date.now()
  }
];

export const defaultOutputGroups: OutputGroup[] = [
  {
    id: 'group-congregation',
    name: 'Main Presentation Display',
    themeId: 'theme-global',
    role: 'broadcast',
    displayIds: [],
    targetDisplayId: '',
    isBlack: false,
    isClear: false,
    showLogo: true
  },
  {
    id: 'group-stage',
    name: 'Confidence / Stage Display',
    themeId: 'theme-global',
    role: 'confidence',
    displayIds: [],
    targetDisplayId: '',
    isBlack: false,
    isClear: false,
    showLogo: true
  }
];

export const defaultSchedule: Schedule = {
  id: 'sched-1',
  name: 'Sunday Morning Service',
  createdAt: Date.now(),
  items: []
};
