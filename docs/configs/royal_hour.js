const SONGS = [

  {
    id: "act02_Royal_Hour_scene01A",
    title: "Act 2, Scene 1A",
    audio: "act02_Royal_Hour.mp3",
    lyrics: "act02_Royal_Hour_scene01.txt",
    startTime: "0:00",
    stopTime: "0:44",
    pauseBeforeSeconds: 0,
    description: "Introducing the King"
  },
  {
    id: "Hail_to_the_Thief",
    title: "Hail to the Thief",
    audio: "Hail_to_the_Thief_traditional.mp3",
    lyrics: "Hail_to_the_Thief.txt",
    pauseBeforeSeconds: 0,
    description: "The King's Personal Anthem"
  },
  {
    id: "act02_Royal_Hour_scene01B",
    title: "Act 2, Scene 1B",
    audio: "act02_Royal_Hour.mp3",
    lyrics: "act02_Royal_Hour_scene01.txt",
    startTime: "0:48",
    stopTime: "2:26",
    pauseBeforeSeconds: 0,
    description: "Housing"
  },
  {
    id: "all-about-me",
    title: "All About Me",
    audio: "All_About_Me.mp3",
    lyrics: "all_about_me.txt",
    description: "Origin story of the King"
  },
  {
    id: "Royal_Scholarship_Foundation",
    title: "The Royal Scholarship Foundation",
    audio: "advertisements.mp3",
    lyrics: "trafficking_ads.txt",
    startTime: "8:32",
    stopTime: "9:07",
    pauseBeforeSeconds: 1,
    description: "Beauty, poise, and marketability"
  },  
  {
    id: "Global_Prestige_Talent_Network",
    title: "Global Prestige Talent Network",
    audio: "advertisements.mp3",
    lyrics: "trafficking_ads.txt",
    startTime: "9:08",
    stopTime: "9:47",
    pauseBeforeSeconds: 1,
    description: "Staffing for all your needs"
  }, 
  {
    id: "Pimp_My_Bride",
    title: "Pimp My Bride",
    audio: "advertisements.mp3",
    lyrics: "trafficking_ads.txt",
    startTime: "12:52",
    stopTime: "13:21",
    pauseBeforeSeconds: 1,
    description: "Reality show promo"
  },
  {
    id: "act02_Royal_Hour_scene02",
    title: "Act 2, Scene 2",
    audio: "act02_Royal_Hour.mp3",
    lyrics: "act02_Royal_Hour_scene02.txt",
    startTime: "2:28",
    stopTime: "3:49",
    pauseBeforeSeconds: 0,
    description: "Trumped-Up Charges"
  },
  {
    id: "Trumped_Up_Charges",
    title: "Trumped-Up Charges",
    audio: "Trumped_Up_Charges.mp3",
    lyrics: "Trumped_Up_Charges.txt",
    description: "Evidence-optional law enforcement."
  },
  {
    id: "Blue_Horizon_Foundation_Charity_Gala",
    title: "Blue Horizon Foundation Charity Gala",
    audio: "advertisements.mp3",
    lyrics: "trafficking_ads.txt",
    startTime: "10:24",
    stopTime: "11:05",
    pauseBeforeSeconds: 1,
    description: "Protecting marina life"
  },  
  {
    id: "Discrete_Air_Private_Aviation",
    title: "Discrete Air Private Aviation",
    audio: "advertisements.mp3",
    lyrics: "trafficking_ads.txt",
    startTime: "11:06",
    stopTime: "11:35",
    pauseBeforeSeconds: 1,
    description: "Nobody's business"
  }, 
  {
    id: "traffic_report",
    title: "Traffic Report",
    audio: "traffic_report.mp3",
    lyrics: "traffic_report_script.txt",
    pauseBeforeSeconds: 0,
    description: "Don't get caught in traffic"
  },
  {
    id: "act02_Royal_Hour_scene03",
    title: "Act 2, Scene 3",
    audio: "act02_Royal_Hour.mp3",
    lyrics: "act02_Royal_Hour_scene03.txt",
    startTime: "3:50",
    stopTime: "4:32",
    pauseBeforeSeconds: 0,
    description: "The Stock Market"
  },
  {
    id: "Dow_Fifty_Thousand",
    title: "Dow Fifty Thousand",
    audio: "Dow_Fifty_Thousand.mp3",
    lyrics: "Dow_Fifty_Thousand.txt",
    description: "The national anthem of trickle-down reality."
  },
  {
    id: "act02_Royal_Hour_scene04",
    title: "Act 2, Scene 4",
    audio: "act02_Royal_Hour.mp3",
    lyrics: "act02_Royal_Hour_scene04.txt",
    startTime: "4:36",
    stopTime: "6:04",
    pauseBeforeSeconds: 0,
    description: "Questions and Scientists"
  },
  {
    id: "nobody_knows_more",
    title: "Nobody Knows More",
    audio: "Nobody_Knows_More.mp3",
    lyrics: "Nobody_Knows_More.txt",
    description: "I don't need experts. They need me!"
  },
  {
    id: "act02_Royal_Hour_scene05",
    title: "Act 2, Scene 5",
    audio: "act02_Royal_Hour.mp3",
    lyrics: "act02_Royal_Hour_scene05.txt",
    startTime: "6:05",
    stopTime: "8:10",
    pauseBeforeSeconds: 0,
    description: "The Weave"
  }
  
];

// Paths relative to the docs/ folder
const AUDIO_BASE = "../audio/";
const LYRICS_BASE = "../lyrics/";
