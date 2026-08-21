const SONGS = [

  {
    id: "act01_scene01_introducing_dave",
    title: "Introducing Dave",
    audio: "act01_scene01.mp3",
    lyrics: "act01_scene01_official_voice.txt",
    pauseBeforeSeconds: 0,
    description: "Scene 1: Introducing Dave"
  },
  {
    id: "scam-a-lot",
    title: "Scam-A-Lot",
    audio: "Scam_A_Lot.mp3",
    lyrics: "Scam_A_Lot.txt",
    pauseBeforeSeconds: 1,
    description: "Propaganda anthem with dark carnival march energy"
  },
  {
    id: "act01_scene02_rumors",
    title: "Rumors",
    audio: "act01_scene02.mp3",
    lyrics: "act01_scene02_conspiracy_corner.txt",
    pauseBeforeSeconds: 0,
    description: "Scene 2: Rumors"
  },
  {
    id: "ad_testosterone-gummies",
    title: "Patriot Power Testosterone Gummies",
    audio: "advertisements.mp3",
    lyrics: "advertisements.txt",
    startTime: "0:00",
    stopTime: "0:18",
    pauseBeforeSeconds: 0,
    description: "Testosterone Gummies"
  },
  {
    id: "forgotten-man",
    title: "Forgotten Man",
    audio: "Forgotten_Man.mp3",
    lyrics: "Forgotten_Man.txt",
    description: "Dark heartland anthem — loneliness weaponized"
  },
  {
    id: "act01_scene03_signal_breach",
    title: "Signal Breach",
    audio: "act01_scene03.mp3",
    lyrics: "act01_scene03_signal_breach.txt",
    pauseBeforeSeconds: 0,
    description: "Scene 3: Signal Breach"
  },
  {
    id: "ad_alpha-card",
    title: "Alpha Card",
    audio: "advertisements.mp3",
    lyrics: "advertisements.txt",
    startTime: "0:20",
    stopTime: "0:38",
    pauseBeforeSeconds: 1,
    description: "Black Titanium Elite Reserve Plus Credit Card"
  },
  {
    id: "reflections",
    title: "Reflections",
    audio: "Reflections.mp3",
    lyrics: "Reflections.txt",
    description: "Retrospectives and Revelations"
  },
  {
    id: "ad_vegan_PSA",
    title: "Vegan PSA",
    audio: "advertisements.mp3",
    lyrics: "advertisements.txt",
    startTime: "17:27",
    stopTime: "18:10",
    pauseBeforeSeconds: 1,
    description: "Today's vegan could become tomorrow's cyclist."
  },
  {
    id: "act01_scene04_intrusion",
    title: "Intrusion",
    audio: "act01_scene04.mp3",
    lyrics: "act01_scene04_signal_intrusion.txt",
    pauseBeforeSeconds: 0,
    description: "Scene 4: Intrusion"
  },
  {
    id: "forever-war-redux",
    title: "Forever War Redux",
    audio: "Forever_War_redux_4.mp3",
    lyrics: "Forever_War.txt",
    description: "Arena-rock anthem — the economy of fear"
  },
  {
    id: "act01_scene05_late_night",
    title: "Late Night",
    audio: "act01_scene05.mp3",
    lyrics: "act01_scene05_late_night_frequencies.txt",
    pauseBeforeSeconds: 0,
    description: "Scene 5: Late night"
  },
  {
    id: "imperial_casino",
    title: "Imperial Casino",
    audio: "Imperial_Casino.mp3",
    lyrics: "imperial_casino.txt",
    description: "Populism betrayed"
  },
  {
    id: "act01_scene06_after_the_broadcast",
    title: "After The Broadcast",
    audio: "act01_scene06.mp3",
    lyrics: "act01_scene06_after_the_broadcast.txt",
    pauseBeforeSeconds: 0,
    description: "Scene 6: After The Broadcast"
  },
  {
    id: "can-you-hear-me-now",
    title: "Can You Hear Me Now?",
    audio: "Can you hear me now.mp3",
    lyrics: "Can_You_Hear_Me_Now.txt",
    description: "Late-night pirate radio ballad — the signal in the noise"
  },
  {
    id: "Fathers_and_Sons",
    title: "Fathers and Sons",
    audio: "Fathers_and_Sons.mp3",
    lyrics: "Fathers_and_Sons.txt",
    pauseBeforeSeconds: 0,
    description: "Traditional family values"
  },
  {
    id: "The_Press_Pool",
    title: "The Press Pool",
    audio: "The_Press_Pool.mp3",
    lyrics: "The_Press_Pool.txt",
    pauseBeforeSeconds: 0,
    description: "The best journalists money can buy"
  }, 
  {
    id: "ad_trans_PSA",
    title: "Tommy PSA",
    audio: "advertisements.mp3",
    lyrics: "advertisements.txt",
    startTime: "16:03",
    stopTime: "16:37",
    pauseBeforeSeconds: 1,
    description: "But I don't want to be a girl!"
  },
  {
    id: "russia-russia-russia",
    title: "Russia Russia Russia",
    audio: "Russia_Russia_Russia.mp3",
    lyrics: "Russia_Russia_Russia.txt",
    description: "Soviet-style propaganda anthem on information warfare"
  },
  {
    id: "act02_scene01A_the_king",
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
    id: "act02_scene01B_housing",
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
    id: "act02_scene02_trumped_up",
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
    id: "act02_scene03_stock_market",
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
    id: "act02_scene04_questions",
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
  },
  {
    id: "concepts_of_a_plan",
    title: "Concepts of a Plan",
    audio: "concepts_of_a_plan.mp3",
    lyrics: "concepts_of_a_plan.txt",
    pauseBeforeSeconds: 0,
    description: "Actual plans can be so disappointing"
  },
  {
    id: "one_of_them",
    title: "One of Them",
    audio: "one_of_them.mp3",
    lyrics: "one_of_them.txt",
    pauseBeforeSeconds: 0,
    description: "Kids these days"
  }, 
  {
    id: "ad_Prime_for_people",
    title: "Prime for People",
    audio: "advertisements.mp3",
    lyrics: "advertisements.txt",
    startTime: "14:31",
    stopTime: "15:16",
    pauseBeforeSeconds: 1,
    description: "Process your entire family!"
  },
  {
    id: "act03_scene01_positive_thinking",
    title: "The Path to Prosperity, Scene 1",
    audio: "The_Path_to_Prosperity.mp3",
    lyrics: "The_Path_to_Prosperity.txt",
    startTime: "0:00",
    stopTime: "1:01",
    pauseBeforeSeconds: 0,
    description: "Positive Thinking"
  },
  {
    id: "positive_thinking",
    title: "The Power of Positive Thinking",
    audio: "Positive_Thinking.mp3",
    lyrics: "Positive_Thinking.txt",
    description: "The creed that made Scam-A-Lot possible"
  },
  {
    id: "act03_scene02_comfort_thinking",
    title: "The Path to Prosperity, Scene 2",
    audio: "The_Path_to_Prosperity.mp3",
    lyrics: "The_Path_to_Prosperity.txt",
    startTime: "1:04",
    stopTime: "1:57",
    pauseBeforeSeconds: 0,
    description: "Comfort Thinking"
  },
  {
    id: "comfort-thinking",
    title: "Comfort Thinking",
    audio: "Comfort_Thinking.mp3",
    lyrics: "comfort_thinking.txt",
    description: "Authoritarian mental wellness-pop"
  },
  {
    id: "act03_scene03_they_dont_want_you_to_know",
    title: "The Path to Prosperity, Scene 3",
    audio: "The_Path_to_Prosperity.mp3",
    lyrics: "The_Path_to_Prosperity.txt",
    startTime: "2:00",
    stopTime: "2:31",
    pauseBeforeSeconds: 0,
    description: "They Don't Want You to Know"
  },
  {
    id: "what_they_dont_want_you_to_know",
    title: "What They Don't Want You to Know",
    audio: "what_they_dont_want_you_to_know.mp3",
    lyrics: "what_they_dont_want_you_to_know.txt",
    pauseBeforeSeconds: 0,
    description: "It's all a big conspiracy"
  },
  {
    id: "act03_scene04_what_could_possibly_go_wrong",
    title: "The Path to Prosperity, Scene 4",
    audio: "The_Path_to_Prosperity.mp3",
    lyrics: "The_Path_to_Prosperity.txt",
    startTime: "2:32",
    stopTime: "3:25",
    pauseBeforeSeconds: 0,
    description: "What Could Possibly Go Wrong?"
  },
  {
    id: "What_Could_Possibly_Go_Wrong",
    title: "What Could Possibly Go Wrong",
    audio: "What_Could_Possibly_Go_Wrong.mp3",
    lyrics: "What_Could_Possibly_Go_Wrong.txt",
    description: "An ounce of prevention is worth cutting from the budget."
  },
  {
    id: "act03_scene05_the_opportunity",
    title: "The Path to Prosperity, Scene 5",
    audio: "The_Path_to_Prosperity.mp3",
    lyrics: "The_Path_to_Prosperity_scene5.txt",
    startTime: "3:28",
    stopTime: "7:12",
    pauseBeforeSeconds: 0,
    description: "The Opportunity"
  },
  {
    id: "billionaire-boys-club",
    title: "Billionaire Boy's Club",
    audio: "Billionaire_Boys_Club.mp3",
    lyrics: "Billionaire_Boys_Club.txt",
    description: "From luxury fantasy to authoritarian oligarchy"
  },
  {
    id: "the-ballroom",
    title: "The Ballroom",
    audio: "The Ballroom v04b.mp3",
    lyrics: "The_Ballroom.txt",
    description: "Grand imperial waltz for the grand imperial ballroom, plus a secret bunker!"
  },
  {
    id: "act04_epilogue_skit",
    title: "Act 4",
    audio: "act04_Epilogue.mp3",
    lyrics: "act04_Epilogue.txt",
    pauseBeforeSeconds: 0,
    description: "Epilogue"
  },
  {
    id: "nice",
    title: "NICE",
    audio: "NICE.mp3",
    lyrics: "NICE_theme.txt",
    description: "Twice the smiles for half the price"
  }

]