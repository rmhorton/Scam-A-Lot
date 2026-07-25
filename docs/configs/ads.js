const SONGS = [

  {
    id: "testosterone-gummies",
    title: "Patriot Power Testosterone Gummies",
    audio: "advertisements.mp3",
    lyrics: "advertisements.txt",
    startTime: "0:00",
    stopTime: "0:18",
    pauseBeforeSeconds: 0,
    description: "Testosterone Gummies"
  },
  {
    id: "alpha-card",
    title: "Alpha Card",
    audio: "advertisements.mp3",
    lyrics: "advertisements.txt",
    startTime: "0:20",
    stopTime: "0:38",
    pauseBeforeSeconds: 1,
    description: "Black Titanium Elite Reserve Plus Credit Card"
  },
  {
    id: "ethics-free-travel",
    title: "EthicsFree Premium Rewards Travel",
    audio: "advertisements.mp3",
    lyrics: "advertisements.txt",
    startTime: "0:40",
    stopTime: "1:01",
    pauseBeforeSeconds: 1,
    description: "Free trevel, without ethics"
  },
  {
    id: "cat-sauce",
    title: "Springfield Select Cat Sauce",
    audio: "advertisements.mp3",
    lyrics: "advertisements.txt",
    startTime: "1:02",
    stopTime: "1:27",
    pauseBeforeSeconds: 1,
    description: "Seasoning for cats"
  },
  {
    id: "discount-drugs",
    title: "PharmaMax Discount Drugs",
    audio: "advertisements.mp3",
    lyrics: "advertisements.txt",
    startTime: "1:27",
    stopTime: "2:05",
    pauseBeforeSeconds: 1,
    description: "1500% off"
  },
  {
    id: "princess-island-spot01",
    title: "Princess Island Resort #1",
    audio: "advertisements.mp3",
    lyrics: "advertisements.txt",
    startTime: "6:24",
    stopTime: "6:59",
    pauseBeforeSeconds: 1,
    description: "Paradise discovered"
  },
  {
    id: "princess-island-spot02",
    title: "Princess Island Resort #2",
    audio: "advertisements.mp3",
    lyrics: "advertisements.txt",
    startTime: "7:02",
    stopTime: "7:31",
    pauseBeforeSeconds: 1,
    description: "Hidden ecological treasure"
  },
  {
    id: "princess-island-spot03",
    title: "Princess Island Resort #3",
    audio: "advertisements.mp3",
    lyrics: "advertisements.txt",
    startTime: "7:34",
    stopTime: "8:08",
    pauseBeforeSeconds: 1,
    description: "Non-paying birds"
  },
  {
    id: "princess-island-spot04",
    title: "Princess Island Resort #4",
    audio: "advertisements.mp3",
    lyrics: "advertisements.txt",
    startTime: "8:09",
    stopTime: "8:36",
    pauseBeforeSeconds: 1,
    description: "Shareholder value"
  },
  {
    id: "Citadel_Arms_01_Hotel_Resort",
    title: "Citadel Arms 01",
    audio: "advertisements.mp3",
    lyrics: "Citadel_Arms_ads.txt",
    startTime: "2:08",
    stopTime: "2:46",
    pauseBeforeSeconds: 1,
    description: "Hotels and Resorts"
  },  
  {
    id: "Citadel_Arms_02_Continuity_Community",
    title: "Citadel Arms 02",
    audio: "advertisements.mp3",
    lyrics: "Citadel_Arms_ads.txt",
    startTime: "2:48",
    stopTime: "3:47",
    pauseBeforeSeconds: 1,
    description: "Continuity Community"
  },    
  {
    id: "Citadel_Arms_03_Security_Systems",
    title: "Citadel Arms 03",
    audio: "advertisements.mp3",
    lyrics: "Citadel_Arms_ads.txt",
    startTime: "3:47",
    stopTime: "4:22",
    pauseBeforeSeconds: 1,
    description: "Security Systems"
  },
  {
    id: "Citadel_Arms_04_Defense_Technology",
    title: "Citadel Arms 04",
    audio: "advertisements.mp3",
    lyrics: "Citadel_Arms_ads.txt",
    startTime: "4:23",
    stopTime: "4:56",
    pauseBeforeSeconds: 1,
    description: "Defense Technology"
  },
  {
    id: "Citadel_Arms_05_Defense_Services",
    title: "Citadel Arms 05",
    audio: "advertisements.mp3",
    lyrics: "Citadel_Arms_ads.txt",
    startTime: "4:55",
    stopTime: "5:39",
    pauseBeforeSeconds: 1,
    description: "Defense Services"
  },
  {
    id: "Citadel_Arms_06_Portfolio",
    title: "Citadel Arms 06",
    audio: "advertisements.mp3",
    lyrics: "Citadel_Arms_ads.txt",
    startTime: "5:41",
    stopTime: "6:18",
    pauseBeforeSeconds: 1,
    description: "Portfolio"
  },
  {
    id: "Royal_Scholarship_Foundation",
    title: "The Royal Scholarship Foundation",
    audio: "advertisements.mp3",
    lyrics: "trafficking_ads.txt",
    startTime: "8:32",
    stopTime: "9:08",
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
    id: "Royal_Occasion_Luxury_Event_Planning",
    title: "Royal Occasion Luxury Event Planning",
    audio: "advertisements.mp3",
    lyrics: "trafficking_ads.txt",
    startTime: "9:48",
    stopTime: "10:22",
    pauseBeforeSeconds: 1,
    description: "Elaborate events, plausible deniability"
  },  
  {
    id: "Blue_Horizon_Foundation_Charity_Gala",
    title: "Blue Horizon Foundation Charity Gala",
    audio: "advertisements.mp3",
    lyrics: "trafficking_ads.txt",
    startTime: "10:23",
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
    id: "Billionaire_Boys_Club",
    title: "Billionaire Boy's Club",
    audio: "advertisements.mp3",
    lyrics: "trafficking_ads.txt",
    startTime: "11:35",
    stopTime: "12:13",
    pauseBeforeSeconds: 1,
    description: "Members only"
  },  
  {
    id: "CleanSlate_Public_Relations",
    title: "CleanSlate Public Relations",
    audio: "advertisements.mp3",
    lyrics: "trafficking_ads.txt",
    startTime: "12:15",
    stopTime: "12:50",
    pauseBeforeSeconds: 1,
    description: "Memory management"
  },  
  {
    id: "Pimp_My_Bride",
    title: "Pimp My Bride",
    audio: "advertisements.mp3",
    lyrics: "trafficking_ads.txt",
    startTime: "12:51",
    stopTime: "13:21",
    pauseBeforeSeconds: 1,
    description: "Reality show promo"
  },
  {
    id: "Royal_Surplus_Outlet_Clearance_Event",
    title: "Royal Surplus Outlet Clearance Event",
    audio: "advertisements.mp3",
    lyrics: "trafficking_ads.txt",
    startTime: "13:22",
    stopTime: "13:59",
    pauseBeforeSeconds: 1,
    description: "Everything must go"
  }, 
  {
    id: "Royal_Surplus_Outlet_pool_sealer_sale",
    title: "Royal Surplus Outlet Pool Sealer Sale",
    audio: "advertisements.mp3",
    lyrics: "trafficking_ads.txt",
    startTime: "13:59",
    stopTime: "14:45",
    pauseBeforeSeconds: 1,
    description: "Super discount on excess stock"
  }

];

// Paths relative to the docs/ folder
const AUDIO_BASE = "../audio/";
const LYRICS_BASE = "../lyrics/";
