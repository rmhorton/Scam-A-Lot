const SONGS = [
  // Optional segment fields:
  // pauseBeforeSeconds: 5,
  // startTime: "1:15",
  // stopTime: "2:30"
  {
    id: "scam-a-lot",
    title: "Scam-A-Lot",
    audio: "Scam_A_Lot.mp3",
    lyrics: "Scam_A_Lot.txt",
    description: "Propaganda anthem with dark carnival march energy"
  },
  {
    id: "are-we-great-yet",
    title: "Are We Great Yet?",
    audio: "Are_We_Great_Yet.mp3",
    lyrics: "Are_We_Great_Yet.txt",
    description: "Theatrical call-and-response between soloist and crowd chorus"
  },
  {
    id: "the-ballroom",
    title: "The Ballroom",
    audio: "The Ballroom v04b.mp3",
    lyrics: "The_Ballroom.txt",
    description: "Grand imperial waltz for the grand imperial ballroom, plus a secret bunker"
  },
  {
    id: "all-about-me",
    title: "All About Me",
    audio: "All_About_Me.mp3",
    lyrics: "all_about_me.txt",
    description: "Origin story of the King"
  },
  {
    id: "billionaire-boys-club",
    title: "Billionaire Boy's Club",
    audio: "Billionaire_Boys_Club.mp3",
    lyrics: "Billionaire_Boys_Club.txt",
    description: "From luxury fantasy to authoritarian oligarchy"
  },
  {
    id: "russia-russia-russia",
    title: "Russia Russia Russia",
    audio: "Russia_Russia_Russia.mp3",
    lyrics: "Russia_Russia_Russia.txt",
    description: "Soviet-style propaganda anthem on information warfare"
  },
  {
    id: "forever-war",
    title: "Forever War",
    audio: "Forever_War.mp3",
    lyrics: "Forever_War.txt",
    description: "Arena-rock anthem — the economy of fear"
  },
  {
    id: "forever-war-redux",
    title: "Forever War Redux",
    audio: "Forever_War_redux_4.mp3",
    lyrics: "Forever_War.txt",
    description: "Faster version"
  },
  {
    id: "for-he-is-an-army-man",
    title: "For He Is an Army Man",
    audio: "For He is an Army Man v1a.mp3",
    lyrics: "For_He_is_an_Army_Man.txt",
    description: "Supportive testimony at the confirmation hearing of Sir Bombsalot, in the style of Gilbert and Sullivan"
  },
  {
    id: "forgotten-man",
    title: "Forgotten Man",
    audio: "Forgotten_Man.mp3",
    lyrics: "Forgotten_Man.txt",
    description: "Dark heartland anthem — loneliness weaponized"
  },
  {
    id: "comfort-thinking",
    title: "Comfort Thinking",
    audio: "Comfort_Thinking.mp3",
    lyrics: "comfort_thinking.txt",
    description: "Authoritarian mental wellness-pop"
  },
  {
    id: "can-you-hear-me-now",
    title: "Can You Hear Me Now?",
    audio: "Can you hear me now.mp3",
    lyrics: "Can_You_Hear_Me_Now.txt",
    description: "Late-night pirate radio ballad — the signal in the noise"
  },
  {
    id: "nice",
    title: "NICE",
    audio: "NICE.mp3",
    lyrics: "NICE_theme.txt",
    description: "Children's movement — twice the smiles for half the price"
  },
  {
    id: "thats-what-xi-said",
    title: "That's What Xi Said",
    audio: "thats_what_xi_said.mp3",
    lyrics: "Thats_What_Xi_Said.txt",
    description: "Satirical rally anthem with nursery-rhyme intro"
  },
  {
    id: "imperial_casino",
    title: "Imperial Casino",
    audio: "Imperial_Casino.mp3",
    lyrics: "imperial_casino.txt",
    description: "Populism betrayed"
  },
  {
    id: "justice_must_be_blind",
    title: "Justice Must Be Blind",
    audio: "Justice Must Be Blind Blues v4b.mp3",
    lyrics: "Justice_Must_Be_Blind_blues.txt",
    description: "Supreme Court ethics"
  },
  {
    id: "reflections",
    title: "Reflections",
    audio: "Reflections.mp3",
    lyrics: "Reflections.txt",
    description: "A Reflecting Pool Reveals the King"
  },
  {
    id: "positive_thinking",
    title: "The Power of Positive Thinking",
    audio: "Positive_Thinking.mp3",
    lyrics: "Positive_Thinking.txt",
    description: "The creed that made Scam-A-Lot possible"
  },
  {
    id: "nobody_knows_more",
    title: "Nobody Knows More",
    audio: "Nobody_Knows_More.mp3",
    lyrics: "Nobody_Knows_More.txt",
    description: "I don't need experts. They need me!"
  },
  {
    id: "What_Could_Possibly_Go_Wrong",
    title: "What Could Possibly Go Wrong",
    audio: "What_Could_Possibly_Go_Wrong.mp3",
    lyrics: "What_Could_Possibly_Go_Wrong.txt",
    description: "An ounce of prevention is worth cutting from the budget."
  },
  {
    id: "Trumped_Up_Charges",
    title: "Trumped-Up Charges",
    audio: "Trumped_Up_Charges.mp3",
    lyrics: "Trumped_Up_Charges.txt",
    description: "Evidence-optional law enforcement."
  },
  {
    id: "Dow_Fifty_Thousand",
    title: "Dow Fifty Thousand",
    audio: "Dow_Fifty_Thousand.mp3",
    lyrics: "Dow_Fifty_Thousand.txt",
    description: "The national anthem of trickle-down reality."
  },
  {
    id: "eating-the-cats",
    title: "Eating The Cats",
    audio: "Eating_the_Cats_v3a.mp3",
    lyrics: "eating_the_cats.txt",
    description: "Rapping genuine Trump quotes (experimental)"
  }
];

// Default pause between automatically advanced tracks:
// DEFAULT_PAUSE_BETWEEN_TRACKS_SECONDS = 2

// Paths relative to the docs/ folder
const AUDIO_BASE = "../audio/";
const LYRICS_BASE = "../lyrics/";
