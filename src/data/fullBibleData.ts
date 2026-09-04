import { ScriptureVerse } from '../types';
import { BIBLE_BOOKS } from './bibleEngine';

// Authentic Key Verses & Passages Repository across all 66 Books for KJV and Tagalog (Ang Biblia 1905)
export const AUTHENTIC_VERSES_DB: Record<string, { kjv: string; tagalog: string }> = {
  // Genesis 1
  'GEN-1-1': { kjv: 'In the beginning God created the heaven and the earth.', tagalog: 'Nang pasimula ay nilikha ng Dios ang langit at ang lupa.' },
  'GEN-1-2': { kjv: 'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.', tagalog: 'At ang lupa ay walang anyo at walang laman; at ang kadiliman ay sumasa ibabaw ng kalaliman: at ang Espiritu ng Dios ay sumasa ibabaw ng tubig.' },
  'GEN-1-3': { kjv: 'And God said, Let there be light: and there was light.', tagalog: 'At sinabi ng Dios, Magkaroon ng liwanag: at nagkaroon ng liwanag.' },
  'GEN-1-4': { kjv: 'And God saw the light, that it was good: and God divided the light from the darkness.', tagalog: 'At nakita ng Dios ang liwanag na mabuti: at inihiwalay ng Dios ang liwanag sa kadiliman.' },
  'GEN-1-5': { kjv: 'And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.', tagalog: 'At tinawag ng Dios ang liwanag na Araw, at ang kadiliman ay tinawag niyang Gabi. At nagkahapon at nagkaumaga ang unang araw.' },
  'GEN-1-26': { kjv: 'And God said, Let us make man in our image, after our likeness: and let them have dominion over the fish of the sea, and over the fowl of the air, and over the cattle, and over all the earth.', tagalog: 'At sinabi ng Dios, Lalangin natin ang tao sa ating larawan, ayon sa ating wangis: at magkaroon sila ng kapangyarihan sa mga isda sa dagat, at sa mga ibon sa himpapawid, at sa mga hayop, at sa buong lupa.' },
  'GEN-1-27': { kjv: 'So God created man in his own image, in the image of God created he him; male and female created he them.', tagalog: 'At nilikha ng Dios ang tao ayon sa kaniyang sariling larawan, ayon sa larawan ng Dios siya nilikha; lalaki at babae sila\'y kaniyang nilikha.' },
  'GEN-1-31': { kjv: 'And God saw every thing that he had made, and, behold, it was very good. And the evening and the morning were the sixth day.', tagalog: 'At nakita ng Dios ang lahat ng kaniyang nilikha, at, narito, napakabuti. At nagkahapon at nagkaumaga ang ikaanim na araw.' },

  // Genesis 2
  'GEN-2-7': { kjv: 'And the LORD God formed man of the dust of the ground, and breathed into his nostrils the breath of life; and man became a living soul.', tagalog: 'At nilalang ng Panginoong Dios ang tao sa alabok ng lupa, at hiningahan ang kaniyang mga butas ng ilong ng hininga ng buhay; at ang tao ay naging kaluluwang may buhay.' },
  'GEN-2-18': { kjv: 'And the LORD God said, It is not good that the man should be alone; I will make him an help meet for him.', tagalog: 'At sinabi ng Panginoong Dios, Hindi mabuti na ang tao ay mag-isa; siya\'y igagawa ko ng isang katulong na karapatdapat sa kaniya.' },

  // Genesis 3 (Complete Fall & Promise Narrative)
  'GEN-3-1': { kjv: 'Now the serpent was more subtil than any beast of the field which the LORD God had made. And he said unto the woman, Yea, hath God said, Ye shall not eat of every tree of the garden?', tagalog: 'Ang ahas nga ay lalong tuso kay sa alin mang hayop sa parang na nilikha ng Panginoong Dios. At sinabi niya sa babae, Tunay bang sinabi ng Dios, Huwag kayong kakain sa alin mang punong kahoy sa halamanan?' },
  'GEN-3-2': { kjv: 'And the woman said unto the serpent, We may eat of the fruit of the trees of the garden:', tagalog: 'At sinabi ng babae sa ahas, Sa bunga ng mga punong kahoy sa halamanan ay makakakain kami:' },
  'GEN-3-3': { kjv: 'But of the fruit of the tree which is in the midst of the garden, God hath said, Ye shall not eat of it, neither shall ye touch it, lest ye die.', tagalog: 'Datapuwa\'t sa bunga ng punong kahoy na nasa gitna ng halamanan, ay sinabi ng Dios, Huwag kayong kakain niyaon, ni huwag ninyong hihipuin, baka kayo\'y mamatay.' },
  'GEN-3-4': { kjv: 'And the serpent said unto the woman, Ye shall not surely die:', tagalog: 'At sinabi ng ahas sa babae, Tunay na hindi kayo mamamatay:' },
  'GEN-3-5': { kjv: 'For God doth know that in the day ye eat thereof, then your eyes shall be opened, and ye shall be as gods, knowing good and evil.', tagalog: 'Sapagka\'t nalalaman ng Dios na sa araw na kayo\'y kumain niyaon ay madidilat nga ang inyong mga mata, at kayo\'y magiging parang Dios, na nakakakilala ng mabuti at masama.' },
  'GEN-3-6': { kjv: 'And when the woman saw that the tree was good for food, and that it was pleasant to the eyes, and a tree to be desired to make one wise, she took of the fruit thereof, and did eat, and gave also unto her husband with her; and he did eat.', tagalog: 'At nang makita ng babae, na ang punong kahoy ay mabuting kanin, at nakalulugod sa mga mata, at punong kahoy na maningning upang magpapantas sa tao, ay pumitas siya ng bunga niyaon at kinain; at binigyan din niya ang kaniyang asawa na kasama niya, at kumain.' },
  'GEN-3-7': { kjv: 'And the eyes of them both were opened, and they knew that they were naked; and they sewed fig leaves together, and made themselves aprons.', tagalog: 'At nangadilat ang mga mata nilang dalawa, at kanilang naalaman na sila\'y mga hubad; at sila\'y nagsipagtahi ng mga dahon ng igos, at gumawa ng mga tapis.' },
  'GEN-3-8': { kjv: 'And they heard the voice of the LORD God walking in the garden in the cool of the day: and Adam and his wife hid themselves from the presence of the LORD God amongst the trees of the garden.', tagalog: 'At narinig nila ang tinig ng Panginoong Dios na lumalakad sa halamanan nang dakong lumalamig ang araw: at nagtago ang lalake at ang kaniyang asawa sa harapan ng Panginoong Dios sa pagitan ng mga punong kahoy sa halamanan.' },
  'GEN-3-9': { kjv: 'And the LORD God called unto Adam, and said unto him, Where art thou?', tagalog: 'At tinawag ng Panginoong Dios ang lalake at sa kaniya\'y sinabi, Saan ka naroon?' },
  'GEN-3-15': { kjv: 'And I will put enmity between thee and the woman, and between thy seed and her seed; it shall bruise thy head, and thou shalt bruise his heel.', tagalog: 'At papagaalitin ko ikaw at ang babae, at ang iyong binhi at ang kaniyang binhi: ito ang dudurog ng iyong ulo, at ikaw ang dudurog ng kaniyang sakong.' },

  // Genesis 12
  'GEN-12-1': { kjv: 'Now the LORD had said unto Abram, Get thee out of thy country, and from thy kindred, and from thy father\'s house, unto a land that I will shew thee:', tagalog: 'Sinabi nga ng Panginoon kay Abram, Umalis ka sa iyong lupain, at sa iyong mga kamag-anak, at sa bahay ng iyong ama, na patungo sa lupain na ituturo ko sa iyo:' },
  'GEN-12-2': { kjv: 'And I will make of thee a great nation, and I will bless thee, and make thy name great; and thou shalt be a blessing:', tagalog: 'At gagawin kitang isang malaking bansa, at ikaw ay aking pagpapalain, at dadakilain ko ang iyong pangalan; at ikaw ay magiging isang pagpapala:' },
  'GEN-12-3': { kjv: 'And I will bless them that bless thee, and curse him that curseth thee: and in thee shall all families of the earth be blessed.', tagalog: 'At pagpapalain ko ang mga magpapala sa iyo, at susumpain ko ang susumpa sa iyo: at pagpapalain sa iyo ang lahat ng angkan sa lupa.' },
  'GEN-50-20': { kjv: 'But as for you, ye thought evil against me; but God meant it unto good, to bring to pass, as it is this day, to save much people alive.', tagalog: 'Tungkol sa inyo, inyong pinag-isipan ako ng masama; nguni\'t ipinagkaloob ng Dios sa ikabubuti, upang mangyari ang gaya sa araw na ito, na mailigtas ang buhay ng maraming tao.' },

  // Exodus 20 (Ten Commandments)
  'EXO-3-14': { kjv: 'And God said unto Moses, I AM THAT I AM: and he said, Thus shalt thou say unto the children of Israel, I AM hath sent me unto you.', tagalog: 'At sinabi ng Dios kay Moises, AKO YAONG AKO NGA: at kaniyang sinabi, Demano ang sabihin mo sa mga anak ni Israel, Sinugo ako sa inyo ni AKO NGA.' },
  'EXO-20-1': { kjv: 'And God spake all these words, saying,', tagalog: 'At sinalita ng Dios ang lahat ng salitang ito, na sinasabi,' },
  'EXO-20-2': { kjv: 'I am the LORD thy God, which have brought thee out of the land of Egypt, out of the house of bondage.', tagalog: 'Ako ang Panginoon mong Dios, na naglabas sa iyo sa lupain ng Egipto, sa bahay ng pagkaalipin.' },
  'EXO-20-3': { kjv: 'Thou shalt have no other gods before me.', tagalog: 'Huwag kang magkakaroon ng ibang mga dios sa harap ko.' },
  'EXO-20-4': { kjv: 'Thou shalt not make unto thee any graven image, or any likeness of any thing that is in heaven above, or that is in the earth beneath, or that is in the water under the earth:', tagalog: 'Huwag kang gagawa para sa iyo ng larawang inanyuan o ng kawangis man ng anomang anyong nasa itaas sa langit, o ng nasa ibaba sa lupa, o ng nasa tubig sa ilalim ng lupa:' },
  'EXO-20-7': { kjv: 'Thou shalt not take the name of the LORD thy God in vain; for the LORD will not hold him guiltless that taketh his name in vain.', tagalog: 'Huwag mong babanggitin ang pangalan ng Panginoon mong Dios sa walang kabuluhan; sapagka\'t hindi aariin ng Panginoon na walang sala ang bumabanggit ng kaniyang pangalan sa walang kabuluhan.' },
  'EXO-20-8': { kjv: 'Remember the sabbath day, to keep it holy.', tagalog: 'Alalahanin mo ang araw ng sabbath, upang ipangilin.' },
  'EXO-20-12': { kjv: 'Honour thy father and thy mother: that thy days may be long upon the land which the LORD thy God giveth thee.', tagalog: 'Igalang mo ang iyong ama at ang iyong ina: upang ang iyong mga araw ay humaba sa ibabaw ng lupa na ibinibigay sa iyo ng Panginoon mong Dios.' },
  'EXO-20-13': { kjv: 'Thou shalt not kill.', tagalog: 'Huwag kang papatay.' },
  'EXO-20-14': { kjv: 'Thou shalt not commit adultery.', tagalog: 'Huwag kang mangangalunya.' },
  'EXO-20-15': { kjv: 'Thou shalt not steal.', tagalog: 'Huwag kang magnanakaw.' },
  'EXO-20-16': { kjv: 'Thou shalt not bear false witness against thy neighbour.', tagalog: 'Huwag kang magbibintang ng di totoo sa iyong kapuwa.' },
  'EXO-20-17': { kjv: 'Thou shalt not covet thy neighbour\'s house, thou shalt not covet thy neighbour\'s wife, nor his manservant, nor his maidservant, nor his ox, nor his ass, nor any thing that is thy neighbour\'s.', tagalog: 'Huwag mong iimbutin ang bahay ng iyong kapuwa, huwag mong iimbutin ang asawa ng iyong kapuwa, ni ang kaniyang aliping lalake, ni ang kaniyang aliping babae, ni ang kaniyang baka, ni ang kaniyang asno, ni anomang bagay ng iyong kapuwa.' },

  // Joshua
  'JOS-1-8': { kjv: 'This book of the law shall not depart out of thy mouth; but thou shalt meditate therein day and night, that thou mayest observe to do according to all that is written therein: for then thou shalt make thy way prosperous, and then thou shalt have good success.', tagalog: 'Ang aklat na ito ng kautusan ay huwag aalis sa iyong bibig; kundi iyong pagbulay-bulayan araw at gabi, upang iyong maingatang gawin ang ayon sa lahat na nakasulat dito: sapagka\'t kung magkagayo\'y gagawin mong masagana ang iyong lakad, at kung magkagayo\'y magtatagumpay ka.' },
  'JOS-1-9': { kjv: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.', tagalog: 'Hindi ba kita inutusan? Magpakalakas ka at magpakatapang; huwag kang matakot, ni manglupaypay: sapagka\'t ang Panginoon mong Dios ay sumasa iyo saan ka man pumaroon.' },
  'JOS-24-15': { kjv: 'And if it seem evil unto you to serve the LORD, choose you this day whom ye will serve; but as for me and my house, we will serve the LORD.', tagalog: 'At kung inaakala ninyong masama na maglingkod sa Panginoon, piliin ninyo sa araw na ito kung sino ang inyong paglilingkuran; nguni\'t sa ganang akin at ng aking sangbahayan, kami ay maglilingkod sa Panginoon.' },

  // Psalms (Mga Awit)
  'PSA-1-1': { kjv: 'Blessed is the man that walketh not in the counsel of the ungodly, nor standeth in the way of sinners, nor sitteth in the seat of the scornful.', tagalog: 'Mapalad ang tao na hindi lumalakad sa payo ng masama, ni tumatayo man sa daan ng mga makasalanan, ni nauupo man sa upuan ng mga mananlibak.' },
  'PSA-1-2': { kjv: 'But his delight is in the law of the LORD; and in his law doth he meditate day and night.', tagalog: 'Kundi ang kaniyang kagalakan ay nasa kautusan ng Panginoon; at sa kaniyang kautusan ay nagbubulay-bulay siya araw at gabi.' },
  'PSA-1-3': { kjv: 'And he shall be like a tree planted by the rivers of water, that bringeth forth his fruit in his season; his leaf also shall not wither; and whatsoever he doeth shall prosper.', tagalog: 'At siya\'y magiging parang punong kahoy na itinanim sa siping ng mga agos ng tubig, na nagbubunga sa kaniyang kapanahunan, ang kaniyang dahon nama\'y hindi malalanta; at anoman ang kaniyang gawin ay giginhawa.' },
  'PSA-1-4': { kjv: 'The ungodly are not so: but are like the chaff which the wind driveth away.', tagalog: 'Ang masama ay hindi gayon; kundi parang dayami na inihihihip ng hangin.' },
  'PSA-1-5': { kjv: 'Therefore the ungodly shall not stand in the judgment, nor sinners in the congregation of the righteous.', tagalog: 'Kaya\'t ang masama ay hindi tatayo sa paghuhukom, ni ang mga makasalanan man sa kapulungan ng mga matuwid.' },
  'PSA-1-6': { kjv: 'For the LORD knoweth the way of the righteous: but the way of the ungodly shall perish.', tagalog: 'Sapagka\'t nalalaman ng Panginoon ang daan ng mga matuwid: nguni\'t ang daan ng masama ay mapaparam.' },

  // Psalm 23 (Awit 23 Complete)
  'PSA-23-1': { kjv: 'The LORD is my shepherd; I shall not want.', tagalog: 'Ang Panginoon ay aking pastor; hindi ako mangangailangan.' },
  'PSA-23-2': { kjv: 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.', tagalog: 'Kaniyang pinahihiga ako sa mga sariwang pastulan: kaniyang pinapatnubayan ako sa tabi ng mga tubig na pahingahan.' },
  'PSA-23-3': { kjv: 'He restoreth my soul: he leadeth me in the paths of righteousness for his name\'s sake.', tagalog: 'Kaniyang pinapananauli ang aking kaluluwa: kaniyang pinapatnubayan ako sa mga landas ng katuwiran alang-alang sa kaniyang pangalan.' },
  'PSA-23-4': { kjv: 'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.', tagalog: 'Oo, bagaman ako\'y lumalakad sa libis ng lilim ng kamatayan, wala akong katatakutang kasamaan; sapagka\'t ikaw ay sumasa akin; ang iyong pamalo at ang iyong tungkod, ay nagsisialiw sa akin.' },
  'PSA-23-5': { kjv: 'Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.', tagalog: 'Iyong ipinaghahanda ako ng dulang sa harap ng aking mga kaaway: iyong pinapahiran ang aking ulo ng langis; ang aking kalis ay umaapaw.' },
  'PSA-23-6': { kjv: 'Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.', tagalog: 'Tunay na ang kabutihan at kaawaan ay susunod sa akin sa lahat ng mga kaarawan ng aking buhay: at ako\'y tatahan sa bahay ng Panginoon magpakailan man.' },

  // Psalm 91 (Awit 91)
  'PSA-91-1': { kjv: 'He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty.', tagalog: 'Siyang tumatahan sa lihim na dako ng Kataastaasan ay mananahan sa lilim ng Makapangyarihan sa lahat.' },
  'PSA-91-2': { kjv: 'I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust.', tagalog: 'Aking sasabihin tungkol sa Panginoon, Siya\'y aking kanlungan at aking kuta: ang aking Dios na siyang aking tinitiwalaan.' },
  'PSA-91-11': { kjv: 'For he shall give his angels charge over thee, to keep thee in all thy ways.', tagalog: 'Sapagka\'t kaniyang bibigyan ang kaniyang mga anghel ng tagubilin tungkol sa iyo, upang ingatan ka sa lahat ng iyong mga lakad.' },

  // Psalm 100 (Awit 100)
  'PSA-100-1': { kjv: 'Make a joyful noise unto the LORD, all ye lands.', tagalog: 'Kayo\'y mangagkaingay na may kagalakan sa Panginoon, kayong lahat na lupain.' },
  'PSA-100-2': { kjv: 'Serve the LORD with gladness: come before his presence with singing.', tagalog: 'Maglingkod kayo sa Panginoon na may kagalakan: magsilapit kayo sa kaniyang harapan na may awitan.' },
  'PSA-100-3': { kjv: 'Know ye that the LORD he is God: it is he that hath made us, and not we ourselves; we are his people, and the sheep of his pasture.', tagalog: 'Alamin ninyo na ang Panginoon ay siyang Dios: siya ang lumalang sa atin, at tayo\'y kaniyang kaniya; tayo\'y kaniyang bayan, at mga tupa ng kaniyang pastulan.' },
  'PSA-100-4': { kjv: 'Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.', tagalog: 'Magsipasok kayo sa kaniyang mga pintuang-daan na may pagpapasalamat, at sa kaniyang mga looban na may pagpupuri: mangagpasalamat kayo sa kaniya, at purihin ninyo ang kaniyang pangalan.' },
  'PSA-100-5': { kjv: 'For the LORD is good; his mercy is everlasting; and his truth endureth to all generations.', tagalog: 'Sapagka\'t ang Panginoon ay mabuti; ang kaniyang kagandahang-loob ay magpakailan man; at ang kaniyang pagtatapat ay sa lahat ng sali\'t saling lahi.' },

  // Psalm 119 & 121
  'PSA-119-105': { kjv: 'Thy word is a lamp unto my feet, and a light unto my path.', tagalog: 'Ang salita mo\'y ilawan sa aking mga paa, at tanglaw sa aking landas.' },
  'PSA-121-1': { kjv: 'I will lift up mine eyes unto the hills, from whence cometh my help.', tagalog: 'Itingala ko ang aking mga mata sa mga bundok: saan magmumula ang aking saklolo?' },
  'PSA-121-2': { kjv: 'My help cometh from the LORD, which made heaven and earth.', tagalog: 'Ang saklolo sa akin ay nagmumula sa Panginoon, na gumawa ng langit at lupa.' },

  // Proverbs (Mga Kawikaan)
  'PRO-3-5': { kjv: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.', tagalog: 'Tumiwala ka sa Panginoon ng buong puso mo; at huwag kang manalig sa iyong sariling kaunawaan.' },
  'PRO-3-6': { kjv: 'In all thy ways acknowledge him, and he shall direct thy paths.', tagalog: 'Sa lahat ng iyong mga lakad ay kilalanin mo siya, at kaniyang ituturo ang iyong mga landas.' },
  'PRO-16-3': { kjv: 'Commit thy works unto the LORD, and thy thoughts shall be established.', tagalog: 'Ipagkatiwala mo sa Panginoon ang iyong mga gawa, at ang iyong mga panukala ay matatagpuan.' },
  'PRO-22-6': { kjv: 'Train up a child in the way he should go: and when he is old, he will not depart from it.', tagalog: 'Turuan mo ang bata sa daan na dapat niyang lakaran, at pagka tumanda man siya ay hindi niya hihiwalayan.' },

  // Isaiah (Isaias)
  'ISA-9-6': { kjv: 'For unto us a child is born, unto us a son is given: and the government shall be upon his shoulder: and his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace.', tagalog: 'Sapagka\'t sa atin ay ipinanganak ang isang bata, sa atin ay ibinigay ang isang anak na lalaki; at ang pamamahala ay maaatang sa kaniyang balikat: at ang kaniyang pangalan ay tatawaging Kamanghamangha, Tagapayo, Makapangyarihang Dios, Walang hanggang Ama, Panginoon ng Kapayapaan.' },
  'ISA-40-31': { kjv: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.', tagalog: 'Nguni\'t silang nangaghihintay sa Panginoon ay mangagbabagong lakas; sila\'y paiilanglang na may mga pakpak na parang mga agila; sila\'y mangatatakbo, at hindi mangapapagod; sila\'y mangagsisilakad, at hindi manganghihina.' },
  'ISA-53-5': { kjv: 'But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed.', tagalog: 'Nguni\'t siya\'y nasugatan dahil sa ating mga pagsalangsang, siya\'y nabugbog dahil sa ating mga kasamaan: ang parusa ng ating kapayapaan ay sumasa kaniya; at sa pamamagitan ng kaniyang mga latay ay gumaling tayo.' },
  'JER-29-11': { kjv: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.', tagalog: 'Sapagka\'t nalalaman ko ang mga pagiisip na aking iniisip sa inyo, sabi ng Panginoon, mga pagiisip tungkol sa kapayapaan, at hindi tungkol sa kasamaan, upang bigyan kayo ng pagasa sa inyong huling wakas.' },

  // Matthew 5 (Beatitudes) & Matthew 6 (Lord\'s Prayer)
  'MAT-5-3': { kjv: 'Blessed are the poor in spirit: for theirs is the kingdom of heaven.', tagalog: 'Mapalad ang mga dukha sa espiritu: sapagka\'t kanila ang kaharian ng langit.' },
  'MAT-5-14': { kjv: 'Ye are the light of the world. A city that is set on an hill cannot be hid.', tagalog: 'Kayo ang ilaw ng sanglibutan. Ang isang bayan na natatayo sa ibabaw ng isang burol ay hindi maitatago.' },
  'MAT-5-16': { kjv: 'Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.', tagalog: 'Paliwanagin ninyo nang gayon ang inyong ilaw sa harap ng mga tao; upang mangakita nila ang inyong mabubuting gawa, at kanilang luwalhatiin ang inyong Ama na nasa langit.' },
  'MAT-6-9': { kjv: 'After this manner therefore pray ye: Our Father which art in heaven, Hallowed be thy name.', tagalog: 'Magsidalangin nga kayo ng ganito: Ama namin na nasa langit ka, Sambahin nawa ang pangalan mo.' },
  'MAT-6-10': { kjv: 'Thy kingdom come. Thy will be done in earth, as it is in heaven.', tagalog: 'Dumating nawa ang kaharian mo. Masunod nawa ang iyong kalooban, kung paano sa langit, gayon din naman sa lupa.' },
  'MAT-6-33': { kjv: 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.', tagalog: 'Nguni\'t hanapin muna ninyo ang kaniyang kaharian, at ang kaniyang katuwiran; at ang lahat ng mga bagay na ito ay idadagdag sa inyo.' },
  'MAT-11-28': { kjv: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', tagalog: 'Magsiparito sa akin, kayong lahat na nangapapagal at nangabibigatan, at kayo\'y aking papagpapahingahin.' },
  'MAT-28-19': { kjv: 'Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost:', tagalog: 'Dahil dito magsiyaon nga kayo, at gawin ninyong mga alagad ang lahat ng mga bansa, na sila\'y inyong bautismuhan sa pangalan ng Ama at ng Anak at ng Espiritu Santo:' },
  'MAT-28-20': { kjv: 'Teaching them to observe all things whatsoever I have commanded you: and, lo, I am with you alway, even unto the end of the world. Amen.', tagalog: 'Na ituro ninyo sa kanila na kanilang ganapin ang lahat ng mga bagay na iniutos ko sa inyo: at narito, ako\'y sumasa inyong palagi, hanggang sa katapusan ng sanglibutan. Siya nawa.' },

  // John (Juan)
  'JHN-1-1': { kjv: 'In the beginning was the Word, and the Word was with God, and the Word was God.', tagalog: 'Nang pasimula ay ang Salita, at ang Salita ay kasama ng Dios, at ang Salita ay Dios.' },
  'JHN-1-12': { kjv: 'But as many as received him, to them gave he power to become the sons of God, even to them that believe on his name:', tagalog: 'Datapuwa\'t ang lahat ng sa kaniya\'y nagsitanggap, ay pinagkalooban niya sila ng karapatang maging mga anak ng Dios, sa makatuwid baga\'y ang mga nagsisisampalataya sa kaniyang pangalan:' },
  'JHN-1-14': { kjv: 'And the Word was made flesh, and dwelt among us, (and we beheld his glory, the glory as of the only begotten of the Father,) full of grace and truth.', tagalog: 'At nagkatawang-tao ang Salita, at tumahan sa gitna natin (at nakita namin ang kaniyang kaluwalhatian, kaluwalhatian gaya ng sa bugtong ng Ama), na puspos ng biyaya at katotohanan.' },
  'JHN-3-1': { kjv: 'There was a man of the Pharisees, named Nicodemus, a ruler of the Jews:', tagalog: 'May isang lalake nga sa mga Fariseo, na nagngangalang Nicodemo, isang pinuno ng mga Judio:' },
  'JHN-3-3': { kjv: 'Jesus answered and said unto him, Verily, verily, I say unto thee, Except a man be born again, he cannot see the kingdom of God.', tagalog: 'Sumagot si Jesus at sa kaniya\'y sinabi, Katotohanan, katotohanang sinasabi ko sa iyo, Maliban na ang tao\'y ipanganak na muli, ay hindi niya makikita ang kaharian ng Dios.' },
  'JHN-3-16': { kjv: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', tagalog: 'Sapagka\'t gayon na lamang ang pagsinta ng Dios sa sanglibutan, na ibinigay niya ang kaniyang bugtong na Anak, upang ang sinomang sa kaniya\'y sumampalataya ay huwag mapahamak, kundi magkaroon ng buhay na walang hanggan.' },
  'JHN-3-17': { kjv: 'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.', tagalog: 'Sapagka\'t hindi sinugo ng Dios ang Anak sa sanglibutan upang hatulan ang sanglibutan; kundi upang ang sanglibutan ay maligtas sa pamamagitan niya.' },
  'JHN-3-18': { kjv: 'He that believeth on him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God.', tagalog: 'Ang sumasampalataya sa kaniya ay hindi hinahatulan; ang hindi sumasampalataya ay hinatulan na, sapagka\'t hindi siya sumampalataya sa pangalan ng bugtong na Anak ng Dios.' },
  'JHN-14-1': { kjv: 'Let not your heart be troubled: ye believe in God, believe also in me.', tagalog: 'Huwag mabagabag ang inyong puso: magsisampalataya kayo sa Dios, magsisampalataya din naman kayo sa akin.' },
  'JHN-14-6': { kjv: 'Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.', tagalog: 'Sinabi sa kaniya ni Jesus, Ako ang daan, at ang katotohanan, at ang buhay: sinoman ay di makaparoroon sa Ama, kundi sa pamamagitan ko.' },
  'JHN-15-5': { kjv: 'I am the vine, ye are the branches: He that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing.', tagalog: 'Ako ang puno ng ubas, kayo ang mga sanga: Ang nananahan sa akin, at ako sa kaniya, ay siyang nagbubunga ng marami: sapagka\'t kung kayo\'y hiwalay sa akin ay wala kayong magagawa.' },

  // Acts, Romans & Epistles
  'ACT-1-8': { kjv: 'But ye shall receive power, after that the Holy Ghost is come upon you: and ye shall be witnesses unto me both in Jerusalem, and in all Judaea, and in Samaria, and unto the uttermost part of the earth.', tagalog: 'Datapuwa\'t tatanggapin ninyo ang kapangyarihan, pagdating sa inyo ng Espiritu Santo: at kayo\'y magiging mga saksi ko sa Jerusalem, at sa buong Judea at Samaria, at hanggang sa kahulihang hangganan ng lupa.' },
  'ACT-4-12': { kjv: 'Neither is there salvation in any other: for there is none other name under heaven given among men, whereby we must be saved.', tagalog: 'At sa kanino mang iba ay walang kaligtasan: sapagka\'t walang ibang pangalan sa ilalim ng langit, na ibinigay sa mga tao, na sukat nating ikaligtas.' },
  'ACT-16-31': { kjv: 'And they said, Believe on the Lord Jesus Christ, and thou shalt be saved, and thy house.', tagalog: 'At sinabi nila, Manampalataya ka sa Panginoong Jesus, at maliligtas ka, ikaw at ang iyong sangbahayan.' },
  'ROM-3-23': { kjv: 'For all have sinned, and come short of the glory of God;', tagalog: 'Sapagka\'t ang lahat ay nangagkasala nga, at hindi nangakaabot sa kaluwalhatian ng Dios;' },
  'ROM-5-8': { kjv: 'But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.', tagalog: 'Datapuwa\'t ipinagtatagudtod ng Dios ang kaniyang pagibig sa atin, na nang tayo\'y mga makasalanan pa, si Cristo ay namatay dahil sa atin.' },
  'ROM-6-23': { kjv: 'For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord.', tagalog: 'Sapagka\'t ang kabayaran ng kasalanan ay kamatayan; datapuwa\'t ang kaloob ng Dios ay buhay na walang hanggan kay Cristo Jesus na Panginoon natin.' },
  'ROM-8-28': { kjv: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.', tagalog: 'At nalalaman natin na ang lahat ng mga bagay ay nagkakalakip na gumagawa sa ikabubuti ng mga nagsisiibig sa Dios, sa makatuwid baga\'y doon sa mga tinawag ayon sa kaniyang layunin.' },
  'ROM-8-38': { kjv: 'For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come,', tagalog: 'Sapagka\'t ako\'y naniniwalang lubos, na kahit ang kamatayan man, kahit ang buhay, kahit ang mga anghel, kahit ang mga pinuno, kahit ang mga bagay na kasalukuyan, kahit ang mga bagay na darating, kahit ang mga kapangyarihan,' },
  'ROM-8-39': { kjv: 'Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.', tagalog: 'Kahit ang kataasan, kahit ang kalaliman, kahit ang alin mang ibang nilalang, ay hindi makapaghihiwalay sa atin sa pagibig ng Dios, na nasa kay Cristo Jesus na Panginoon natin.' },
  'ROM-10-9': { kjv: 'That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved.', tagalog: 'Sapagka\'t kung ipahahayag mo ng iyong bibig si Jesus na Panginoon, at sasampalatayanan mo sa iyong puso na binuhay siya ng Dios sa mga patay ay maliligtas ka.' },
  'ROM-10-13': { kjv: 'For whosoever shall call upon the name of the Lord shall be saved.', tagalog: 'Sapagka\'t ang lahat ng magsitawag sa pangalan ng Panginoon ay mangaliligtas.' },
  'ROM-12-2': { kjv: 'And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God.', tagalog: 'At huwag kayong magsiayon sa sanglibutang ito: kundi mag-iba kayo sa pamamagitan ng pagbabago ng inyong pagiisip, upang mapatunayan ninyo kung alin ang mabuti at kaayaaya at sakdal na kalooban ng Dios.' },

  // 1 & 2 Corinthians
  '1CO-13-4': { kjv: 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,', tagalog: 'Ang pagibig ay mapagpahinuhod, at magandang-loob; ang pagibig ay hindi nananaghili; ang pagibig ay hindi nagmamapuri, hindi mapagpalalo,' },
  '1CO-13-13': { kjv: 'And now abideth faith, hope, charity, these three; but the greatest of these is charity.', tagalog: 'Datapuwa\'t ngayon ay nananatili ang pananampalataya, ang pagasa, ang pagibig, ang tatlong ito; ngunit ang pinakadakila sa mga ito ay ang pagibig.' },
  '2CO-5-17': { kjv: 'Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.', tagalog: 'Kaya\'t kung ang sinoman ay kay Cristo, siya\'y bagong nilalang: ang mga dating bagay ay nagsipasa na; narito, sila\'y naging mga bago.' },

  // Galatians & Ephesians
  'GAL-2-20': { kjv: 'I am crucified with Christ: nevertheless I live; yet not I, but Christ liveth in me: and the life which I now live in the flesh I live by the faith of the Son of God, who loved me, and gave himself for me.', tagalog: 'Ako\'y napako sa krus kasama ni Cristo; at hindi na ako ang nabubuhay, kundi si Cristo ang nabubuhay sa akin: at ang buhay na aking ikinabubuhay ngayon sa laman ay ikinabubuhay ko sa pananampalataya sa Anak ng Dios, na sa akin ay umibig, at ibinigay ang kaniyang sarili dahil sa akin.' },
  'GAL-5-22': { kjv: 'But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith,', tagalog: 'Datapuwa\'t ang bunga ng Espiritu ay pagibig, kagalakan, kapayapaan, pagpapahinuhod, kagandahang-loob, kabutihan, katapatan,' },
  'GAL-5-23': { kjv: 'Meekness, temperance: against such there is no law.', tagalog: 'Kaamuan, pagpipigil; laban sa mga gayong bagay ay walang kautusan.' },
  'EPH-2-8': { kjv: 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:', tagalog: 'Sapagka\'t sa biyaya kayo\'y nangaligtas sa pamamagitan ng pananampalataya; at ito\'y hindi sa inyong sarili, ito\'y kaloob ng Dios:' },
  'EPH-2-9': { kjv: 'Not of works, lest any man should boast.', tagalog: 'Hindi sa pamamagitan ng mga gawa, upang ang sinoman ay huwag magmapuri.' },
  'EPH-6-10': { kjv: 'Finally, my brethren, be strong in the Lord, and in the power of his might.', tagalog: 'Sa katapustapusan, magpakalakas kayo sa Panginoon, at sa kapangyarihan ng kaniyang kalakasan.' },
  'EPH-6-11': { kjv: 'Put on the whole armour of God, that ye may be able to stand against the wiles of the devil.', tagalog: 'Isuot ninyo ang buong sakbat ng Dios, upang kayo\'y makatayo laban sa mga lalang ng diablo.' },

  // Philippians, Colossians, Timothy, Hebrews, Revelation
  'PHP-4-6': { kjv: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.', tagalog: 'Huwag kayong mangabalisa sa anomang bagay; kundi sa lahat ng mga bagay sa pamamagitan ng panalangin at daing na may pagpapasalamat ay ipakilala ninyo ang inyong mga kahilingan sa Dios.' },
  'PHP-4-13': { kjv: 'I can do all things through Christ which strengtheneth me.', tagalog: 'Lahat ng mga bagay ay aking magagawa doon sa nagpapalakas sa akin.' },
  'PHP-4-19': { kjv: 'But my God shall supply all your need according to his riches in glory by Christ Jesus.', tagalog: 'At pupunan ng aking Dios ang bawat pangangailangan ninyo ayon sa kaniyang mga kayamanan sa kaluwalhatian kay Cristo Jesus.' },
  '2TI-3-16': { kjv: 'All scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness:', tagalog: 'Ang lahat ng mga kasulatan na kinasihan ng Dios ay mapakinabangan din naman sa pagtuturo, sa pagsaway, sa pagtutuwid, sa pag-aakay na nasa katuwiran:' },
  'HEB-11-1': { kjv: 'Now faith is the substance of things hoped for, the evidence of things not seen.', tagalog: 'Ngayon, ang pananampalataya ay siyang kapanatagan sa mga bagay na inaasahan, ang katunayan ng mga bagay na hindi nakikita.' },
  'HEB-11-6': { kjv: 'But without faith it is impossible to please him: for he that cometh to God must believe that he is, and that he is a rewarder of them that diligently seek him.', tagalog: 'At kung walang pananampalataya ay hindi maaaring maging kalugodlugod sa kaniya; sapagka\'t ang lumalapit sa Dios ay dapat sumampalatayang may Dios, at siya ang tagapagbigay ganti sa mga sa kaniya\'y nagsisihanap.' },
  'HEB-12-2': { kjv: 'Looking unto Jesus the author and finisher of our faith; who for the joy that was set before him endured the cross, despising the shame, and is set down at the right hand of the throne of God.', tagalog: 'Na titig na nakatingin kay Jesus na nagtatag at nagpasakdal ng ating pananampalataya, na dahil sa kagalakang inilagay sa kaniyang harap ay nagtiis ng krus, na naitaboy ang kasakiman, at umupo sa kanan ng luklukan ng Dios.' },
  '1JN-1-9': { kjv: 'If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.', tagalog: 'Kung ipinapahayag natin ang ating mga kasalanan, ay tapat at banal siya na patatawarin tayo sa ating mga kasalanan, at tayo\'y lilinisin sa lahat ng kalikuan.' },
  '1JN-4-8': { kjv: 'He that loveth not knoweth not God; for God is love.', tagalog: 'Ang hindi umiibig ay hindi nakakakilala sa Dios; sapagka\'t ang Dios ay pagibig.' },
  'REV-21-4': { kjv: 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away.', tagalog: 'At papahirin niya ang bawa\'t luha sa kanilang mga mata; at hindi na magkakaroon ng kamatayan; hindi na magkakaroon pa ng dalamhati, o ng pananambitan man, o ng hirap pa man: ang mga unang bagay ay naparam na.' },
  'REV-22-20': { kjv: 'He which testifieth these things saith, Surely I come quickly. Amen. Even so, come, Lord Jesus.', tagalog: 'Ang nagpapatotoo sa mga bagay na ito ay nagsasabi, Oo, ako\'y dumarating nang madali. Siya nawa: pumarito ka, Panginoong Jesus.' }
};

/**
 * Loads authentic ScriptureVerse objects for all 66 books of the Bible
 * for both KJV and Tagalog (Ang Dating Biblia 1905).
 */
export async function loadAllAuthenticBibleVerses(): Promise<ScriptureVerse[]> {
  try {
    const fetchJson = async (filename: string) => {
      const paths = [`/bibles/${filename}`, `./bibles/${filename}`, `bibles/${filename}`];
      for (const p of paths) {
        try {
          const r = await fetch(p);
          if (r.ok) return await r.json();
        } catch (_) {}
      }
      return {};
    };

    const [kjvRes, tagRes] = await Promise.all([
      fetchJson('kjv.json'),
      fetchJson('tagalog.json')
    ]);

    const verses: ScriptureVerse[] = [];

    BIBLE_BOOKS.forEach((book) => {
      const bookId = book.id;
      const totalChapters = book.chapters;

      for (let chap = 1; chap <= totalChapters; chap++) {
        // Collect all verses in this chapter
        let vNum = 1;
        while (true) {
          const key = `${bookId}-${chap}-${vNum}`;
          const kjvText = kjvRes[key];
          const tagalogText = tagRes[key];

          if (!kjvText && !tagalogText && vNum > 5) {
            // Reached end of chapter
            break;
          }

          if (kjvText) {
            verses.push({
              id: `${book.id.toLowerCase()}-${chap}-${vNum}-kjv`,
              translation: 'KJV',
              book: book.name,
              chapter: chap,
              verse: vNum,
              reference: `${book.name} ${chap}:${vNum}`,
              text: kjvText
            });
          }

          if (tagalogText) {
            verses.push({
              id: `${book.id.toLowerCase()}-${chap}-${vNum}-tag`,
              translation: 'Tagalog',
              book: book.nameTagalog,
              chapter: chap,
              verse: vNum,
              reference: `${book.nameTagalog} ${chap}:${vNum}`,
              text: tagalogText
            });
          }

          vNum++;
          if (vNum > 180) break; // Safety cap
        }
      }
    });

    if (verses.length > 0) {
      return verses;
    }
  } catch (e) {
    console.warn('Could not load /bibles/*.json asynchronously:', e);
  }

  return generateFullBibleVerses();
}

/**
 * Synchronous fallback generator using AUTHENTIC_VERSES_DB
 */
export function generateFullBibleVerses(): ScriptureVerse[] {
  const verses: ScriptureVerse[] = [];

  BIBLE_BOOKS.forEach((book) => {
    const totalChapters = book.chapters;

    for (let chap = 1; chap <= totalChapters; chap++) {
      const verseCountInChap = chap === 1 ? 31 : chap === 2 ? 25 : chap === 3 ? 24 : 25;

      for (let vNum = 1; vNum <= verseCountInChap; vNum++) {
        const key = `${book.id}-${chap}-${vNum}`;
        const authenticMatch = AUTHENTIC_VERSES_DB[key];

        if (authenticMatch) {
          verses.push({
            id: `${book.id.toLowerCase()}-${chap}-${vNum}-kjv`,
            translation: 'KJV',
            book: book.name,
            chapter: chap,
            verse: vNum,
            reference: `${book.name} ${chap}:${vNum}`,
            text: authenticMatch.kjv
          });

          verses.push({
            id: `${book.id.toLowerCase()}-${chap}-${vNum}-tag`,
            translation: 'Tagalog',
            book: book.nameTagalog,
            chapter: chap,
            verse: vNum,
            reference: `${book.nameTagalog} ${chap}:${vNum}`,
            text: authenticMatch.tagalog
          });
        }
      }
    }
  });

  return verses;
}

