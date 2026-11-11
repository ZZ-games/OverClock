// ---------------------------------------------------------------
// Overclock configuration
// ---------------------------------------------------------------

export const CONFIG = {
  // Paste your AdSense publisher ID here once Google approves your
  // H5 Games Ads account, e.g. 'ca-pub-1234567890123456'.
  // While this is empty, rewarded ads show a short placeholder screen
  // and still grant the reward, so every ad button can be tested.
  ADSENSE_CLIENT: '',

  // Keep 'on' while testing a real AdSense account (shows test ads).
  ADS_TEST_MODE: true,

  // The game is likely to be played by kids, so ask for
  // non-personalized ads only.
  NON_PERSONALIZED_ADS: true,

  // Length of the placeholder "ad" while no AdSense ID is set.
  PLACEHOLDER_AD_SECONDS: 3,

  // How many bonus crates (ad rewards on the menu) per day.
  CRATES_PER_DAY: 3,
  CRATE_XP: 60,
};

export const TUNING = {
  HALF_WIDTH: 7,          // half the track width in metres
  START_CLOCK: 30,        // seconds on the clock at the start
  MAX_CLOCK: 60,
  NEAR_MISS_TIME: 1.0,    // seconds gained per near-miss
  CRYSTAL_TIME: 3,        // seconds gained per time crystal
  HIT_PENALTY: 3,         // seconds lost when you crash
  NEAR_DIST: 0.9,         // how close counts as a near-miss
  BASE_SPEED: 22,
  MAX_SPEED_ADD: 34,
  SPEED_DIST: 3000,
  UPGRADE_FIRST: 20,      // seconds into the run for the first upgrade pick
  UPGRADE_EVERY: 25,
  CONTINUE_TIME: 10,      // seconds granted by the second-chance ad
  DASH_COOLDOWN: 2.5,
  DASH_TIME: 0.35,
  COMBO_DECAY: 5,
  DRAIN_RAMP: 150,       // clock drains 1x at the start, 2x after this many seconds
  MULT_CAP: 10,
  SHIP_HW: 0.55, SHIP_HH: 0.3, SHIP_HD: 0.8,
  HOVER_Y: 0.7,
  JUMP_V: 9.5,
  GRAVITY: 26,
};
