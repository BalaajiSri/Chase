// Constants and Game Configuration
const GAME_STATES = {
  LOADING: 'loading',
  START: 'start',
  PLAYING: 'playing',
  ENDING: 'ending',
  SPEEDRUN: 'speedrun' // Added new game state for speed runs
};

const MOVEMENT = {
  ACCELERATION: 0.025,
  DECELERATION: 0.95,
  MAX_SPEED: 0.6, // Increased for better traversal of the larger world
  BOOST_MULTIPLIER: 2.0, // Speed multiplier when boost is active
  BOOST_DURATION: 3.0, // Duration of boost in seconds
  BOOST_COOLDOWN: 6.0  // Cooldown period before boost can be used again
};

// Navigation system constants
const NAVIGATION = {
  MINIMAP_SIZE: 180,          // Increased size
  MINIMAP_ZOOM: 0.05,
  MARKER_SIZE: 8,
  PLAYER_MARKER_COLOR: '#00ffff',
  KEY_MARKER_COLOR: '#ffd700',    // Changed to gold
  LOVED_ONE_MARKER_COLOR: '#ff69b4', // Changed to hot pink
  ISLAND_MARKER_COLOR: '#4dff4d',   // Brighter green
  COMPASS_ENABLED: true,
  DIRECTION_MARKERS_ENABLED: true,
  WAYPOINT_PATH_ENABLED: true,
  DISTANCE_INDICATORS_ENABLED: true,
  MINIMAP_ROTATION_ENABLED: true,
  ALTITUDE_INDICATOR_ENABLED: true,
  MINIMAP_BACKGROUND: 'rgba(0, 0, 0, 0.7)',  // Darker background
  MINIMAP_BORDER: '3px solid rgba(255, 255, 255, 0.5)', // More visible border
  COMPASS_BACKGROUND: 'rgba(0, 0, 0, 0.8)',   // Darker background for compass
  COMPASS_TEXT_COLOR: '#ffffff',               // White text
  COMPASS_HIGHLIGHT_COLOR: '#00ffff'          // Cyan highlights
};

// Import Three.js utilities
// BufferGeometryUtils is not directly available in Three.js core, we need to load it separately
// Define a placeholder that will be populated when the script is loaded
let BufferGeometryUtils;

// Global game variables
let scene, camera, renderer;
let player, lovedOne;
let cameraRig; // Added camera rig for improved 3rd person camera
let keys = [];
let islands = []; // Re-added islands array
let particles = [];
let skybox;
let velocity;
let rotationVelocity; // Added for camera rotation
let gameState;
let keysCollected = 0;
let keysRequired = 15; // Increased from 5 to 15 keys
let keyTypes = ['regular', 'gold', 'crystal', 'ancient']; // Different key types
let easterEggs = []; // Array to store easter egg objects
let collectedEasterEggs = []; // Track which easter eggs have been collected
let playerSpeedMultiplier = 1.0; // For gold key effect
let playerShielded = false;      // For crystal key effect
let revealAllKeys = false;       // For ancient key effect
let playerTrailColor = 'default'; // For rainbow easter egg
let gravityReversed = false;     // For gravity easter egg
// Controls - WASD/Arrows: movement, Space: up, Shift: down, Tab/Double-click: unlimited boost
let controls = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false,
  unlimitedBoost: false  // Activated by Tab key or double-clicking movement keys
};
let mouseLook = false; // For mouse camera control
let cameraLookSpeed = 0.002; // Speed of camera rotation
let updateEndingFunction = null;
let sounds = {};
let clock; // Added for consistent animation timing

// Navigation system variables
let minimapCanvas, minimapCtx;
let compassElement;
let navMarkersContainer;
let currentTarget = null;

// Global references to SpeedRunSystem objects (initialized by SpeedRunSystem)
// We'll use these references instead of declaring the variables ourselves
// These variables are defined and managed in speedrun.js

// Create audio context and background music
let audioContext;
let backgroundMusic;
function initAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Create and load the audio element
  const audioElement = new Audio();
  audioElement.src = 'assets/romantic_music.wav'; // Make sure to add your WAV file
  audioElement.loop = true;
  
  backgroundMusic = audioContext.createMediaElementSource(audioElement);
  const gainNode = audioContext.createGain();
  gainNode.gain.value = 0.5; // Set initial volume
  
  backgroundMusic.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  return audioElement;
}

// Create a flower bouquet
function createFlowerBouquet() {
  const bouquetGroup = new THREE.Group();
  const flowerCount = 15;
  const colors = [
    0xff69b4, // pink
    0xff1493, // deep pink
    0xff0000, // red
    0xffffff, // white
    0xffd700  // gold
  ];

  for (let i = 0; i < flowerCount; i++) {
    const flower = createDetailedFlower(colors[Math.floor(Math.random() * colors.length)]);
    
    // Position flowers in a bouquet arrangement
    const angle = (i / flowerCount) * Math.PI * 2;
    const radius = 0.5 + Math.random() * 0.3;
    flower.position.set(
      Math.cos(angle) * radius,
      Math.random() * 2,
      Math.sin(angle) * radius
    );
    
    // Random rotation for natural look
    flower.rotation.set(
      Math.random() * 0.3,
      Math.random() * Math.PI * 2,
      Math.random() * 0.3
    );
    
    bouquetGroup.add(flower);
  }

  // Add ribbon
  const ribbonGeometry = new THREE.TorusKnotGeometry(0.8, 0.1, 100, 16);
  const ribbonMaterial = new THREE.MeshStandardMaterial({
    color: 0xff1493,
    metalness: 0.3,
    roughness: 0.5,
    emissive: 0xff69b4,
    emissiveIntensity: 0.2
  });
  const ribbon = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
  ribbon.scale.set(0.5, 0.5, 0.5);
  ribbon.position.y = -0.5;
  bouquetGroup.add(ribbon);

  return bouquetGroup;
}

function createDetailedFlower(color) {
  const flowerGroup = new THREE.Group();
  
  // Create petals
  const petalCount = 8;
  const petalGeometry = new THREE.EllipseCurve(
    0, 0,
    0.3, 0.15,
    0, Math.PI * 2,
    false
  );
  
  const petalShape = new THREE.Shape(petalGeometry.getPoints(20));
  const petalExtrudeSettings = {
    steps: 1,
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 3
  };
  
  const petalMaterial = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.5,
    metalness: 0.1,
    side: THREE.DoubleSide
  });
  
  for (let i = 0; i < petalCount; i++) {
    const petal = new THREE.Mesh(
      new THREE.ExtrudeGeometry(petalShape, petalExtrudeSettings),
      petalMaterial
    );
    petal.position.y = 0.1;
    petal.rotation.x = Math.PI / 2;
    petal.rotation.y = (i / petalCount) * Math.PI * 2;
    petal.rotation.z = Math.PI / 6;
    flowerGroup.add(petal);
  }
  
  // Create center
  const centerGeometry = new THREE.SphereGeometry(0.15, 16, 16);
  const centerMaterial = new THREE.MeshStandardMaterial({
    color: 0xffdd00,
    roughness: 0.3,
    metalness: 0.5,
    emissive: 0xffaa00,
    emissiveIntensity: 0.2
  });
  const center = new THREE.Mesh(centerGeometry, centerMaterial);
  center.position.y = 0.1;
  flowerGroup.add(center);
  
  return flowerGroup;
}

// Create floating text with romantic messages
function createFloatingMessage(text, position) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 1024; // Increased resolution
  canvas.height = 256;
  
  // Create gradient background for text
  const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, '#ff69b4');    // Hot pink
  gradient.addColorStop(0.5, '#ffd700');   // Gold
  gradient.addColorStop(1, '#ff69b4');    // Hot pink
  
  // Add glow effect
  context.shadowColor = '#ff69b4';
  context.shadowBlur = 25;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  
  // Draw text with gradient
  context.fillStyle = gradient;
  context.font = 'bold 72px "Arial", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  
  // Add stroke for better visibility
  context.strokeStyle = '#ffffff';
  context.lineWidth = 4;
  context.strokeText(text, canvas.width / 2, canvas.height / 2);
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  // Add sparkle effect
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = Math.random() * 2 + 1;
    
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = '#ffffff';
    context.fill();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter; // Prevent texture blurring
  texture.magFilter = THREE.LinearFilter;
  
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending // Add glow effect
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(15, 4, 1); // Adjusted scale for better visibility
  
  // Add animation properties
  sprite.userData = {
    originalY: position.y,
    hoverSpeed: 0.0015 + Math.random() * 0.001,
    hoverRange: 0.3 + Math.random() * 0.2,
    rotationSpeed: 0.001 + Math.random() * 0.001,
    sparkleTime: 0
  };
  
  return sprite;
}

// Create a heart shape geometry for particles
function createHeartShape() {
  const shape = new THREE.Shape();
  const x = 0, y = 0;
  
  shape.moveTo(x, y + 0.25);
  shape.bezierCurveTo(x, y + 0.25, x - 0.25, y, x - 0.25, y - 0.25);
  shape.bezierCurveTo(x - 0.25, y - 0.5, x, y - 0.5, x, y - 0.5);
  shape.bezierCurveTo(x, y - 0.5, x + 0.25, y - 0.5, x + 0.25, y - 0.25);
  shape.bezierCurveTo(x + 0.25, y, x, y + 0.25, x, y + 0.25);
  
  const extrudeSettings = {
    depth: 0.1,
    bevelEnabled: false
  };
  
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

// Initialize the game
function init() {
  gameState = GAME_STATES.LOADING;
  velocity = new THREE.Vector3(0, 0, 0);
  rotationVelocity = new THREE.Vector2(0, 0); // Initialize rotation velocity
  clock = new THREE.Clock(); // Initialize clock
  
  // Set the BufferGeometryUtils from THREE
  BufferGeometryUtils = THREE.BufferGeometryUtils;
  
  // Setup Three.js scene
  setupScene();
  
  // Load assets
  loadAssets().then(() => {
    // Create game world
    createSkybox();
    createPlayer();
    createIslands();
    createKeys();
    createEasterEggs(); // Add Easter egg objects
    createLovedOne();
    
    // Setup controls
    setupControls();
    
    // Setup navigation system
    setupNavigation();
    
    // Setup event listeners
    setupEventListeners();
    
    // Show start screen
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'flex';
    
    // Initialize speed run system
    // Make game variables accessible to SpeedRunSystem
    window.player = player;
    window.gameState = gameState;
    window.gameControls = controls;
    window.MOVEMENT = MOVEMENT;
    window.createCollectionEffect = createCollectionEffect;
    window.createHeartExplosion = createHeartExplosion;
    
    // Initialize the SpeedRunSystem
    if (window.SpeedRunSystem) {
      window.SpeedRunSystem.initSpeedRun(scene, player, islands, keys, sounds);
    }
    
    // Start animation loop
    animate(0);
  });
}

// Setup Three.js scene
function setupScene() {
  // Create scene
  scene = new THREE.Scene();
  
  // Create renderer (camera is now created in createPlayer function)
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000022);
  document.body.appendChild(renderer.domElement);
  
  // Create a temporary camera - it will be replaced later in createPlayer
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 10, 20);
  camera.lookAt(0, 0, 0);
  
  // Add enhanced lighting for a more vibrant and romantic atmosphere
  
  // Soft ambient light for overall illumination
  const ambientLight = new THREE.AmbientLight(0x6666aa, 0.6);
  scene.add(ambientLight);
  
  // Main directional light (sun-like)
  const directionalLight = new THREE.DirectionalLight(0xffffcc, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);
  
  // Add colored rim lights for dramatic effect
  const pinkRimLight = new THREE.DirectionalLight(0xff99cc, 0.5);
  pinkRimLight.position.set(-1, 0.5, -1);
  scene.add(pinkRimLight);
  
  const purpleRimLight = new THREE.DirectionalLight(0xaa88ff, 0.5);
  purpleRimLight.position.set(1, -0.5, -1);
  scene.add(purpleRimLight);
  
  // Add a subtle pulsing light that follows the player
  const playerLight = new THREE.PointLight(0x88ccff, 1, 20);
  playerLight.position.set(0, 0, 0);
  scene.add(playerLight);
  
  // Store the player light for animation
  scene.userData.playerLight = playerLight;
  
  // Add some random colored point lights throughout the scene
  const lightColors = [
    0xff9999, // Pink
    0x99ccff, // Blue
    0xffcc99, // Peach
    0xccff99, // Lime
    0xcc99ff  // Purple
  ];
  
  scene.userData.ambientLights = [];
  
  for (let i = 0; i < 8; i++) {
    const color = lightColors[i % lightColors.length];
    const light = new THREE.PointLight(color, 0.8, 50);
    
    // Position randomly in the scene
    light.position.set(
      (Math.random() - 0.5) * 200,
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 200
    );
    
    // Add animation data
    light.userData = {
      originalY: light.position.y,
      hoverSpeed: 0.2 + Math.random() * 0.3,
      hoverRange: 10 + Math.random() * 10,
      pulseSpeed: 0.3 + Math.random() * 0.5,
      originalIntensity: light.intensity
    };
    
    scene.add(light);
    scene.userData.ambientLights.push(light);
  }
}

// Load game assets (textures, sounds, etc.)
async function loadAssets() {
  return new Promise((resolve) => {
    // Loading manager to track progress
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const progress = itemsLoaded / itemsTotal;
      document.getElementById('loading-bar').style.width = `${progress * 100}%`;
    };
    
    loadingManager.onLoad = () => {
      resolve();
    };
    
    // Load textures here if needed
    
    // Load sounds
    const listener = new THREE.AudioListener();
    camera.add(listener);
    
    const soundLoader = new THREE.AudioLoader(loadingManager);
    
    // Collect sound
    soundLoader.load('sounds/collect.mp3', function(buffer) {
      sounds.collect = new THREE.Audio(listener);
      sounds.collect.setBuffer(buffer);
      sounds.collect.setVolume(0.5);
    }, undefined, function(err) {
      console.log('Error loading collect sound:', err);
    });
    
    // Ending sound
    soundLoader.load('sounds/ending.mp3', function(buffer) {
      sounds.ending = new THREE.Audio(listener);
      sounds.ending.setBuffer(buffer);
      sounds.ending.setVolume(0.5);
    }, undefined, function(err) {
      console.log('Error loading ending sound:', err);
    });
    
    // Boost sound
    soundLoader.load('sounds/boost.mp3', function(buffer) {
      sounds.boost = new THREE.Audio(listener);
      sounds.boost.setBuffer(buffer);
      sounds.boost.setVolume(0.4);
    }, undefined, function(err) {
      console.log('Error loading boost sound:', err);
    });
  });
}

// Create a gradient skybox with day/night cycle
function createSkybox() {
  // Remove existing skybox if present
  if (skybox) {
    scene.remove(skybox);
  }

  // Create a large sphere for the skybox
  const geometry = new THREE.SphereGeometry(1000, 64, 64);
  
  // Create advanced shader material with day/night cycle
  const vertexShader = `
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  
  const fragmentShader = `
    uniform vec3 topColorDay;
    uniform vec3 middleColorDay;
    uniform vec3 bottomColorDay;
    uniform vec3 topColorNight;
    uniform vec3 middleColorNight;
    uniform vec3 bottomColorNight;
    uniform float dayNightMix; // 0.0 = day, 1.0 = night
    uniform float timeOfDay;   // For continuous animation
    uniform float offset;
    uniform float exponent;
    uniform float time;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    
    // Noise functions for star and cloud effects
    float hash(float n) {
      return fract(sin(n) * 43758.5453123);
    }
    
    float noise(vec2 p) {
      return hash(dot(p, vec2(12.9898, 78.233)));
    }
    
    float fbm(vec2 p) {
      float f = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        f += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return f;
    }
    
    void main() {
      float h = normalize(vWorldPosition + offset).y;
      
      // Calculate cloud pattern
      float cloudPattern = fbm(vUv * 10.0 + vec2(timeOfDay * 0.05, 0.0));
      cloudPattern = smoothstep(0.4, 0.6, cloudPattern);
      
      // Mix day and night colors based on dayNightMix
      vec3 topColor = mix(topColorDay, topColorNight, dayNightMix);
      vec3 middleColor = mix(middleColorDay, middleColorNight, dayNightMix);
      vec3 bottomColor = mix(bottomColorDay, bottomColorNight, dayNightMix);
      
      // Create gradient with three colors
      vec3 baseColor;
      if (h > 0.2) {
        float t = (h - 0.2) / 0.8;
        baseColor = mix(middleColor, topColor, pow(t, exponent));
      } else {
        float t = h / 0.2;
        baseColor = mix(bottomColor, middleColor, pow(t, exponent));
      }
      
      // Add clouds during day
      if (dayNightMix < 0.5) {
        float cloudStrength = (1.0 - dayNightMix * 2.0) * 0.3;
        baseColor = mix(baseColor, vec3(1.0, 1.0, 1.0), cloudPattern * cloudStrength * (h > 0.0 ? 1.0 : 0.0));
      }
      
      // Add twinkling stars at night
      float starValue = 0.0;
      if (dayNightMix > 0.5 && h > -0.2) {
        float starThreshold = 0.98;
        vec2 gridPos = floor(vWorldPosition.xz * 20.0);
        float starRandom = noise(gridPos);
        
        if (starRandom > starThreshold) {
          float starBlink = sin(time * (starRandom * 5.0) + starRandom * 20.0) * 0.5 + 0.5;
          starValue = starBlink * 0.8 * smoothstep(0.98, 1.0, starRandom) * min(1.0, (dayNightMix - 0.5) * 2.0); 
        }
      }
      
      // Add aurora effect at night
      float aurora = 0.0;
      if (dayNightMix > 0.5 && h > 0.1) {
        float auroraStrength = min(1.0, (dayNightMix - 0.5) * 2.0);
        float xWave = sin(vWorldPosition.x * 0.05 + time * 0.1) * 0.5 + 0.5;
        float zWave = cos(vWorldPosition.z * 0.05 + time * 0.15) * 0.5 + 0.5;
        float yWave = sin(vWorldPosition.y * 0.1 + time * 0.05) * 0.5 + 0.5;
        
        aurora = max(0.0, 1.0 - abs((h - 0.4 - xWave * 0.1) * 15.0)) * xWave * zWave * yWave * auroraStrength;
        aurora *= (0.5 + 0.5 * sin(vWorldPosition.x * 0.01 + time * 0.2));
      }
      
      // Add sun/moon glow based on time of day
      float sunOrMoon = 0.0;
      vec3 sunDir = normalize(vec3(sin(timeOfDay), 0.2, cos(timeOfDay)));
      vec3 moonDir = normalize(vec3(sin(timeOfDay + 3.14159), 0.2, cos(timeOfDay + 3.14159)));
      
      float sunDot = max(0.0, dot(normalize(vWorldPosition), sunDir));
      float moonDot = max(0.0, dot(normalize(vWorldPosition), moonDir));
      
      // Sun glow
      if (dayNightMix < 0.7) {
        float sunStrength = 1.0 - dayNightMix;
        float sunGlow = pow(sunDot, 64.0) * sunStrength;
        baseColor += vec3(1.0, 0.9, 0.6) * sunGlow * 2.0;
      }
      
      // Moon glow
      if (dayNightMix > 0.3) {
        float moonStrength = dayNightMix;
        float moonGlow = pow(moonDot, 256.0) * moonStrength;
        baseColor += vec3(0.8, 0.9, 1.0) * moonGlow * 2.0;
      }
      
      // Combine effects
      vec3 finalColor = baseColor + vec3(0.4, 0.8, 1.0) * aurora * 0.3 + vec3(1.0, 1.0, 0.8) * starValue;
      
      // Add sunset/sunrise coloring
      if (dayNightMix > 0.3 && dayNightMix < 0.7) {
        float twilightStrength = 1.0 - abs(dayNightMix - 0.5) * 2.0;
        vec3 twilightColor = vec3(1.0, 0.5, 0.3);
        
        // Add more twilight effect near the horizon
        float horizonEffect = 1.0 - abs(h) * 5.0;
        horizonEffect = max(0.0, horizonEffect);
        
        finalColor = mix(finalColor, twilightColor, horizonEffect * twilightStrength * 0.7);
      }
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;
  
  const uniforms = {
    topColorDay: { value: new THREE.Color(0x5588ff) },      // Blue day sky
    middleColorDay: { value: new THREE.Color(0x88bbff) },   // Light blue day horizon
    bottomColorDay: { value: new THREE.Color(0xeeffff) },   // Almost white day bottom
    topColorNight: { value: new THREE.Color(0x001133) },    // Dark night sky
    middleColorNight: { value: new THREE.Color(0x113366) }, // Blue night horizon
    bottomColorNight: { value: new THREE.Color(0x001133) }, // Dark night bottom
    offset: { value: 500 },
    exponent: { value: 0.6 },
    time: { value: 0 },
    dayNightMix: { value: 0.0 }, // Start with daytime
    timeOfDay: { value: 0.0 }    // Time of day for sun/moon position
  };
  
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    side: THREE.BackSide
  });
  
  // Create and add skybox
  skybox = new THREE.Mesh(geometry, material);
  skybox.userData = {
    updateTime: function(time) {
      material.uniforms.time.value = time;
      
      // Update time of day (full cycle every 5 minutes)
      const cycleDuration = 300; // seconds
      material.uniforms.timeOfDay.value = (time % cycleDuration) / cycleDuration * Math.PI * 2;
      
      // Smoothly transition between day and night
      const dayNightCycle = (1 + Math.sin(material.uniforms.timeOfDay.value - Math.PI/2)) / 2;
      material.uniforms.dayNightMix.value = dayNightCycle;
    }
  };
  scene.add(skybox);
  
  // Add enhanced stars (more layers)
  createEnhancedStarfield();
}

// Create enhanced starfield with multiple layers
function createEnhancedStarfield() {
  // Create several layers of stars with different sizes and densities
  const starLayers = [
    { count: 5000, size: 0.7, color: new THREE.Color(0xffffff), speed: 0.01 },
    { count: 3000, size: 1.2, color: new THREE.Color(0xffffcc), speed: 0.02 },
    { count: 1000, size: 1.5, color: new THREE.Color(0xccccff), speed: 0.03 },
    { count: 500, size: 2.0, color: new THREE.Color(0xffcccc), speed: 0.04 }
  ];
  
  starLayers.forEach((layer, index) => {
    const starGeometry = new THREE.BufferGeometry();
    const starVertices = [];
    const starColors = [];
    
    for (let i = 0; i < layer.count; i++) {
      const x = THREE.MathUtils.randFloatSpread(2000);
      const y = THREE.MathUtils.randFloatSpread(2000);
      const z = THREE.MathUtils.randFloatSpread(2000);
      starVertices.push(x, y, z);
      
      // Random color variations
      const r = layer.color.r * (0.8 + Math.random() * 0.2);
      const g = layer.color.g * (0.8 + Math.random() * 0.2);
      const b = layer.color.b * (0.8 + Math.random() * 0.2);
      starColors.push(r, g, b);
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
    
    const starMaterial = new THREE.PointsMaterial({
      size: layer.size,
      transparent: true,
      opacity: 0.7,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.userData = { rotationSpeed: layer.speed, layer: index };
    scene.add(stars);
  });
}

// Create romantic nebulae
function createNebulae() {
  const nebulae = [];
  
  // Create 5 nebula clouds with different colors
  const nebulaColors = [
    new THREE.Color(0xff99cc), // Pink
    new THREE.Color(0xcc99ff), // Purple
    new THREE.Color(0xff6666), // Red
    new THREE.Color(0x99ccff), // Blue
    new THREE.Color(0xffcc99)  // Peach
  ];
  
  for (let i = 0; i < 5; i++) {
    // Create a textured plane for each nebula
    const size = 100 + Math.random() * 200;
    const texture = createNebulaTexture(nebulaColors[i]);
    
    const nebulaMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    
    const nebulaGeometry = new THREE.PlaneGeometry(size, size);
    const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
    
    // Random position in the distance
    nebula.position.set(
      (Math.random() - 0.5) * 1000,
      (Math.random() - 0.5) * 500,
      (Math.random() - 0.5) * 1000
    );
    
    // Random rotation
    nebula.rotation.x = Math.random() * Math.PI;
    nebula.rotation.y = Math.random() * Math.PI;
    nebula.rotation.z = Math.random() * Math.PI;
    
    // Add animation parameters
    nebula.userData = {
      rotationSpeed: 0.0002 + Math.random() * 0.0002,
      pulseSpeed: 0.1 + Math.random() * 0.3,
      pulseAmount: 0.05 + Math.random() * 0.05
    };
    
    scene.add(nebula);
    nebulae.push(nebula);
  }
  
  return nebulae;
}

// Create nebula texture
function createNebulaTexture(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  
  // Fill with black
  context.fillStyle = 'black';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  // Create nebula effect
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // Create several cloud-like splotches
  for (let i = 0; i < 15; i++) {
    const radius = 50 + Math.random() * 150;
    const x = centerX + (Math.random() - 0.5) * canvas.width * 0.8;
    const y = centerY + (Math.random() - 0.5) * canvas.height * 0.8;
    
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    
    const colorHex = '#' + color.getHexString();
    gradient.addColorStop(0, colorHex);
    gradient.addColorStop(0.3, colorHex.substring(0, 7) + '66'); // semi-transparent
    gradient.addColorStop(1, 'transparent');
    
    context.fillStyle = gradient;
    context.globalCompositeOperation = 'lighter';
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  
  // Create texture
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Create player character
function createPlayer() {
  // Create player group
  player = new THREE.Group();
  
  // Replace CapsuleGeometry with CylinderGeometry
  const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8, 1);
  const bodyMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x333344, 
    shininess: 30,
    specular: 0x444455
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.rotation.x = Math.PI / 2; // Rotate to align with movement direction
  player.add(body);
  
  // Create butterfly wings using custom geometry
  function createButterflyWing(isLeft) {
    // Create a shape for the wing
    const wingShape = new THREE.Shape();
    
    // Starting point
    wingShape.moveTo(0, 0);
    
    // Wing outline - create a beautiful butterfly wing shape
    wingShape.bezierCurveTo(0, 0.5, 0.5, 1.5, 1.5, 1.2);
    wingShape.bezierCurveTo(2, 1.0, 2.3, 0.5, 2.2, 0);
    wingShape.bezierCurveTo(2.3, -0.5, 2, -1.2, 1.2, -1.6);
    wingShape.bezierCurveTo(0.6, -1.8, 0.2, -1, 0, -0.8);
    wingShape.bezierCurveTo(0, -0.5, 0, -0.2, 0, 0);
    
    // Create wing geometry
    const wingGeometry = new THREE.ShapeGeometry(wingShape);
    
    // Create patterns/details for the wing
    const wingDetailShape1 = new THREE.Shape();
    wingDetailShape1.moveTo(0.3, 0.2);
    wingDetailShape1.bezierCurveTo(0.6, 0.5, 1.2, 0.8, 1.6, 0.7);
    wingDetailShape1.bezierCurveTo(1.4, 0.4, 1.1, 0.2, 0.8, 0.1);
    wingDetailShape1.bezierCurveTo(0.6, 0.1, 0.4, 0.1, 0.3, 0.2);
    
    const wingDetailShape2 = new THREE.Shape();
    wingDetailShape2.moveTo(0.4, -0.3);
    wingDetailShape2.bezierCurveTo(0.8, -0.7, 1.4, -0.9, 1.7, -1.0);
    wingDetailShape2.bezierCurveTo(1.5, -0.7, 1.0, -0.5, 0.6, -0.2);
    wingDetailShape2.bezierCurveTo(0.5, -0.2, 0.4, -0.2, 0.4, -0.3);
    
    // Create wing material with beautiful gradient colors
    const wingMaterial = new THREE.MeshPhongMaterial({
      color: 0xff99cc, 
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      shininess: 50,
      specular: 0xffffff
    });
    
    const wingDetailMaterial = new THREE.MeshPhongMaterial({
      color: isLeft ? 0x9966ff : 0x6699ff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      shininess: 60,
      specular: 0xffffff
    });
    
    // Create the main wing
    const wing = new THREE.Mesh(wingGeometry, wingMaterial);
    
    // Create the detailed patterns
    const wingDetail1 = new THREE.Mesh(new THREE.ShapeGeometry(wingDetailShape1), wingDetailMaterial);
    const wingDetail2 = new THREE.Mesh(new THREE.ShapeGeometry(wingDetailShape2), wingDetailMaterial);
    
    // Group all wing parts
    const wingGroup = new THREE.Group();
    wingGroup.add(wing);
    wingGroup.add(wingDetail1);
    wingGroup.add(wingDetail2);
    
    // Position and scale
    wingGroup.scale.set(1.5, 1.5, 1.5);
    
    // Mirror if right wing
    if (!isLeft) {
      wingGroup.scale.x *= -1;
    }
    
    return wingGroup;
  }
  
  // Create both wings
  const leftWing = createButterflyWing(true);
  const rightWing = createButterflyWing(false);
  
  // Position wings
  leftWing.position.set(0.5, 0.1, 0);
  rightWing.position.set(-0.5, 0.1, 0);
  
  // Create wing container (for animation)
  const wingsContainer = new THREE.Group();
  wingsContainer.add(leftWing);
  wingsContainer.add(rightWing);
  player.add(wingsContainer);
  
  // Create antennae
  const antennaGeometry = new THREE.CylinderGeometry(0.02, 0.01, 0.8, 6);
  const antennaMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x111111,
    shininess: 30 
  });
  
  const leftAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
  leftAntenna.position.set(0.2, 0.2, -0.7);
  leftAntenna.rotation.x = -Math.PI / 4;
  
  const rightAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
  rightAntenna.position.set(-0.2, 0.2, -0.7);
  rightAntenna.rotation.x = -Math.PI / 4;
  
  // Create antenna tips
  const tipGeometry = new THREE.SphereGeometry(0.05, 8, 8);
  const tipMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x222222, 
    emissive: 0x111111,
    shininess: 60 
  });
  
  const leftTip = new THREE.Mesh(tipGeometry, tipMaterial);
  leftTip.position.set(0.33, 0.4, -1.1);
  
  const rightTip = new THREE.Mesh(tipGeometry, tipMaterial);
  rightTip.position.set(-0.33, 0.4, -1.1);
  
  player.add(leftAntenna);
  player.add(rightAntenna);
  player.add(leftTip);
  player.add(rightTip);
  
  // Add glow effect
  const glowGeometry = new THREE.SphereGeometry(1, 16, 16);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x88aaff,
    transparent: true,
    opacity: 0.2,
    side: THREE.BackSide
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  player.add(glow);
  
  // Add a visible "trail" effect with improved particles
  const trailGeometry = new THREE.BufferGeometry();
  const trailMaterial = new THREE.PointsMaterial({
    color: 0xaaddff,
    size: 0.4,
    transparent: true,
    opacity: 0.6,
    map: createTrailTexture(),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true
  });
  const trailPositions = new Float32Array(50 * 3); // 50 points for a longer trail
  const trailColors = new Float32Array(50 * 3); // Add colors for the trail
  
  // Initialize trail with rainbow gradient colors
  for (let i = 0; i < 50; i++) {
    const t = i / 50;
    trailColors[i * 3] = 0.7 + 0.3 * Math.sin(t * Math.PI * 2);
    trailColors[i * 3 + 1] = 0.7 + 0.3 * Math.sin(t * Math.PI * 2 + Math.PI * 2/3);
    trailColors[i * 3 + 2] = 0.7 + 0.3 * Math.sin(t * Math.PI * 2 + Math.PI * 4/3);
  }
  
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
  const trail = new THREE.Points(trailGeometry, trailMaterial);
  player.add(trail);
  
  // Add sparkle particles around the player
  const sparkleGeometry = new THREE.BufferGeometry();
  const sparklePositions = new Float32Array(20 * 3); // 20 sparkles
  const sparkleColors = new Float32Array(20 * 3);
  
  for (let i = 0; i < 20; i++) {
    // Position sparkles in a sphere around the player
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const radius = 1.2 + Math.random() * 0.5;
    
    sparklePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    sparklePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    sparklePositions[i * 3 + 2] = radius * Math.cos(phi);
    
    // Pastel colors for sparkles
    sparkleColors[i * 3] = 0.8 + Math.random() * 0.2;
    sparkleColors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
    sparkleColors[i * 3 + 2] = 0.9 + Math.random() * 0.1;
  }
  
  sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
  sparkleGeometry.setAttribute('color', new THREE.BufferAttribute(sparkleColors, 3));
  
  const sparkleMaterial = new THREE.PointsMaterial({
    size: 0.15,
    map: createSparkleTexture(),
    transparent: true,
    opacity: 0.8,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  
  const sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial);
  sparkles.userData = { time: 0 };
  player.add(sparkles);
  
  // Set initial position
  player.position.set(0, 10, 50);
  player.rotation.y = Math.PI; // Face forward
  
  // Add animation function for wing flapping and other movements
  player.animate = (time) => {
    wingsContainer.rotation.z = Math.sin(time * 10) * 0.3;
    leftAntenna.rotation.x = -Math.PI / 4 + Math.sin(time * 3) * 0.1;
    rightAntenna.rotation.x = -Math.PI / 4 + Math.sin(time * 3 + 0.2) * 0.1;
    glow.scale.set(
      1 + Math.sin(time * 2) * 0.05,
      1 + Math.sin(time * 2) * 0.05,
      1 + Math.sin(time * 2) * 0.05
    );
    
    // Animate sparkles
    if (sparkles) {
      sparkles.userData.time = time;
      const positions = sparkles.geometry.attributes.position.array;
      
      for (let i = 0; i < 20; i++) {
        // Make sparkles orbit around the player
        const theta = time * (0.2 + i * 0.01) + i * (Math.PI * 2 / 20);
        const phi = Math.sin(time * (0.1 + i * 0.01)) * 0.2 + Math.PI / 2;
        const radius = 1.2 + 0.3 * Math.sin(time * (0.3 + i * 0.05));
        
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
      }
      
      sparkles.geometry.attributes.position.needsUpdate = true;
    }
  };
  
  // Add to scene
  scene.add(player);
  
  // Update camera and attach directly to player
  camera.fov = 75;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.near = 0.1;
  camera.far = 1000;
  camera.updateProjectionMatrix();
  
  // Position camera for butterfly-like view (slightly above and behind)
  camera.position.set(0, 1.8, 6);
  camera.lookAt(new THREE.Vector3(0, 0, -10));
  
  // Add camera to player for direct attachment
  player.add(camera);
}

// Create a texture for the trail particles
function createTrailTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  
  const context = canvas.getContext('2d');
  
  // Create heart shape instead of a simple circle
  context.beginPath();
  context.moveTo(32, 16);
  // Left curve
  context.bezierCurveTo(25, 10, 16, 16, 16, 24);
  context.bezierCurveTo(16, 32, 24, 40, 32, 48);
  // Right curve
  context.bezierCurveTo(40, 40, 48, 32, 48, 24);
  context.bezierCurveTo(48, 16, 39, 10, 32, 16);
  context.closePath();
  
  // Create a gradient fill for the heart
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 180, 220, 0.8)');
  gradient.addColorStop(0.7, 'rgba(200, 150, 255, 0.3)');
  gradient.addColorStop(1, 'rgba(180, 200, 255, 0)');
  
  context.fillStyle = gradient;
  context.fill();
  
  // Add a glow effect
  context.shadowColor = 'rgba(255, 150, 200, 0.8)';
  context.shadowBlur = 15;
  context.fill();
  
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Create floating islands
function createIslands() {
  // Create flower planet geometries
  const createFlowerPlanetGeometry = (petalCount, radius, height) => {
    // Create a flower shape
    const shape = new THREE.Shape();
    
    // Create petals using sine function
    const petalDepth = 0.4; // How deep the petals go inward
    const points = [];
    
    for (let i = 0; i <= 360; i++) {
      const angle = (i * Math.PI) / 180;
      // Use sine to create petal effect
      const radiusAtAngle = radius * (1 - petalDepth * Math.abs(Math.sin(angle * petalCount / 2)));
      const x = radiusAtAngle * Math.cos(angle);
      const y = radiusAtAngle * Math.sin(angle);
      points.push(new THREE.Vector2(x, y));
    }
    
    shape.setFromPoints(points);
    
    // Extrude the shape to create a 3D planet
    const extrudeSettings = {
      depth: height,
      bevelEnabled: true,
      bevelThickness: 0.5,
      bevelSize: 0.3,
      bevelSegments: 3
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // Rotate to lay flat
    geometry.rotateX(-Math.PI / 2);
    
    // Add noise to vertices for more natural look
    const positionAttribute = geometry.getAttribute('position');
    const vertex = new THREE.Vector3();
    for (let i = 0; i < positionAttribute.count; i++) {
      vertex.fromBufferAttribute(positionAttribute, i);
      // Add random noise for organic look
      vertex.x += (Math.random() - 0.5) * 0.3;
      vertex.y += (Math.random() - 0.5) * 0.2;
      vertex.z += (Math.random() - 0.5) * 0.3;
      positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    
    geometry.computeVertexNormals();
    return geometry;
  };
  
  // Define planet size variations
  const planetSizes = [
    { petalCount: 5, radius: 6, height: 2 },    // Small flower planet
    { petalCount: 8, radius: 9, height: 2.5 },  // Medium flower planet
    { petalCount: 6, radius: 12, height: 3 }    // Large flower planet
  ];
  
  // Enhanced material variations with better textures
  const createPlanetMaterial = (colorIndex) => {
    // Colorful planet color palette
    const baseColors = [
      0xff88ee, // Pink
      0x77bbff, // Blue
      0xffcc77, // Orange
      0xccff88, // Lime
      0xaa99ff, // Purple
      0xff99aa  // Coral
    ];
    
    // Create a custom texture for the planet
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 256;
    textureCanvas.height = 256;
    const ctx = textureCanvas.getContext('2d');
    
    // Fill with base color
    ctx.fillStyle = `#${baseColors[colorIndex % baseColors.length].toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, 256, 256);
    
    // Add some texture/pattern
    ctx.globalCompositeOperation = 'multiply';
    
    // Add subtle gradient patterns
    const gradient = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
    gradient.addColorStop(0, `rgba(255, 255, 255, 0.5)`);
    gradient.addColorStop(1, `rgba(255, 255, 255, 0.1)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    
    // Add speckles/texture
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const radius = Math.random() * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.05)`;
      ctx.fill();
    }
    
    // Create texture
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    
    // Create normal map for better detail
    const normalMap = createNormalMap(textureCanvas);
    
    // Return enhanced material
    return new THREE.MeshStandardMaterial({
      color: baseColors[colorIndex % baseColors.length],
      map: texture,
      normalMap: normalMap,
      roughness: 0.7,
      metalness: 0.2,
      normalScale: new THREE.Vector2(0.5, 0.5)
    });
  };
  
  // Create multiple planets
  for (let i = 0; i < 20; i++) { // More planets for a bigger world
    // Choose random planet size and material
    const sizeIndex = Math.floor(Math.random() * planetSizes.length);
    const colorIndex = Math.floor(Math.random() * 6);
    
    const planetData = planetSizes[sizeIndex];
    const geometry = createFlowerPlanetGeometry(
      planetData.petalCount,
      planetData.radius,
      planetData.height
    );
    const material = createPlanetMaterial(colorIndex);
    
    const planet = new THREE.Mesh(geometry, material);
    planet.castShadow = true;
    planet.receiveShadow = true;
    
    // Position randomly in a much larger world
    planet.position.set(
      (Math.random() - 0.5) * 400, // Increased from 150 to 400
      (Math.random() - 0.5) * 120 - 30, // Increased vertical spread
      (Math.random() - 0.5) * 400  // Increased from 150 to 400
    );
    
    // Random rotation for variety
    planet.rotation.x = Math.random() * Math.PI * 2;
    planet.rotation.y = Math.random() * Math.PI * 2;
    planet.rotation.z = Math.random() * Math.PI * 2;
    
    // Add vegetation/details
    addPlanetDetails(planet, planetData.radius);
    
    // Add animation properties
    planet.userData = {
      originalY: planet.position.y,
      hoverSpeed: 0.0001 + Math.random() * 0.0001, // Slower for planets
      hoverRange: 0.8 + Math.random() * 0.7,       // More range for gentle hovering
      hoverOffset: Math.random() * Math.PI * 2,
      rotationSpeed: 0.00005 + Math.random() * 0.00005 // Slower rotation for planets
    };
    
    // Add to scene and islands array (keeping the name for compatibility)
    scene.add(planet);
    islands.push(planet);
  }
  
  // Add starting platform (flower-shaped)
  const startingPlatformGeometry = createFlowerPlanetGeometry(8, 14, 2);
  const startingPlatformMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x88ccff,
    roughness: 0.3,
    metalness: 0.4,
    emissive: 0x224466,
    emissiveIntensity: 0.3
  });
  const startingPlatform = new THREE.Mesh(startingPlatformGeometry, startingPlatformMaterial);
  startingPlatform.position.set(0, 5, 60);
  startingPlatform.castShadow = true;
  startingPlatform.receiveShadow = true;
  
  // Add glow effect to starting platform
  const platformGlow = new THREE.PointLight(0x66ccff, 1.5, 30);
  platformGlow.position.set(0, 6, 60);
  scene.add(platformGlow);
  
  // Add decoration to starting platform
  const platformDecoration = new THREE.Mesh(
    new THREE.TorusGeometry(13, 0.7, 16, 100),
    new THREE.MeshStandardMaterial({
      color: 0x44aaff,
      emissive: 0x2266aa,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.8
    })
  );
  platformDecoration.position.copy(startingPlatform.position);
  platformDecoration.position.y += 1;
  platformDecoration.rotation.x = Math.PI / 2;
  scene.add(platformDecoration);
  
  scene.add(startingPlatform);
  islands.push(startingPlatform);
}

// Add details to planets (flowers, crystals, etc)
function addPlanetDetails(planet, planetRadius) {
  // Group for all details
  const details = new THREE.Group();
  
  // Number of details based on planet size
  const detailCount = Math.floor(5 + Math.random() * 8);
  
  for (let i = 0; i < detailCount; i++) {
    // Determine detail type
    const detailType = Math.random();
    let detail;
    
    if (detailType < 0.5) {
      // Create a flower
      const stemGeometry = new THREE.CylinderGeometry(0.03, 0.05, 0.8, 6);
      const stemMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x77cc44,
        roughness: 0.8,
        metalness: 0.1
      });
      const stem = new THREE.Mesh(stemGeometry, stemMaterial);
      stem.castShadow = true;
      
      // Create flower petals
      const flowerGroup = new THREE.Group();
      const petalCount = 5 + Math.floor(Math.random() * 3);
      const petalColor = Math.random() < 0.5 ? 
          new THREE.Color(0xffaacc) : 
          (Math.random() < 0.5 ? new THREE.Color(0xaaddff) : new THREE.Color(0xffddaa));
      
      for (let p = 0; p < petalCount; p++) {
        const petalGeometry = new THREE.EllipseCurve(
          0, 0,                       // center
          0.3, 0.15,                  // x radius, y radius
          0, Math.PI * 2,             // start angle, end angle
          false                       // clockwise
        );
        
        const petalShape = new THREE.Shape(petalGeometry.getPoints(20));
        const petalExtrudeSettings = {
          steps: 1,
          depth: 0.05,
          bevelEnabled: false
        };
        
        const petal = new THREE.Mesh(
          new THREE.ExtrudeGeometry(petalShape, petalExtrudeSettings),
          new THREE.MeshStandardMaterial({
            color: petalColor,
            roughness: 0.7,
            metalness: 0.1,
            side: THREE.DoubleSide
          })
        );
        
        petal.position.y = 0.8;
        petal.rotation.x = Math.PI / 2;
        petal.rotation.y = (p / petalCount) * Math.PI * 2;
        petal.rotation.z = Math.PI / 6; // Tilt petals
        flowerGroup.add(petal);
      }
      
      // Add center of flower
      const centerGeometry = new THREE.SphereGeometry(0.15, 8, 8);
      const centerMaterial = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        roughness: 0.5,
        metalness: 0.4,
        emissive: 0xaa6600,
        emissiveIntensity: 0.2
      });
      const center = new THREE.Mesh(centerGeometry, centerMaterial);
      center.position.y = 0.8;
      flowerGroup.add(center);
      
      detail = new THREE.Group();
      detail.add(stem);
      detail.add(flowerGroup);
      detail.scale.set(0.8, 0.8, 0.8);
    } else if (detailType < 0.8) {
      // Create a crystal formation
      const crystalGroup = new THREE.Group();
      const crystalCount = 1 + Math.floor(Math.random() * 4);
      
      const crystalColors = [
        0x88ddff, // Blue
        0xffaadd, // Pink
        0xaaffcc, // Mint
        0xddaaff  // Purple
      ];
      
      const crystalColor = crystalColors[Math.floor(Math.random() * crystalColors.length)];
      
      for (let c = 0; c < crystalCount; c++) {
        const height = 0.4 + Math.random() * 0.7;
        const crystal = new THREE.Mesh(
          new THREE.ConeGeometry(0.15, height, 5),
          new THREE.MeshStandardMaterial({
            color: crystalColor,
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 0.8,
            emissive: crystalColor,
            emissiveIntensity: 0.2
          })
        );
        
        crystal.position.x = (Math.random() - 0.5) * 0.3;
        crystal.position.z = (Math.random() - 0.5) * 0.3;
        crystal.position.y = height / 2;
        crystal.rotation.y = Math.random() * Math.PI;
        crystal.rotation.x = (Math.random() - 0.5) * 0.2;
        
        crystalGroup.add(crystal);
      }
      
      detail = crystalGroup;
      detail.scale.set(0.7, 0.7, 0.7);
    } else {
      // Create small mushrooms
      const mushroomGroup = new THREE.Group();
      const mushroomCount = 1 + Math.floor(Math.random() * 3);
      
      for (let m = 0; m < mushroomCount; m++) {
        const stemHeight = 0.2 + Math.random() * 0.3;
        const stemRadius = 0.05 + Math.random() * 0.03;
        const capRadius = stemRadius * (2 + Math.random());
        
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(stemRadius, stemRadius * 1.2, stemHeight, 8),
          new THREE.MeshStandardMaterial({
            color: 0xddddcc,
            roughness: 0.9,
            metalness: 0.1
          })
        );
        
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(capRadius, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({
            color: Math.random() < 0.5 ? 0xff8866 : 0xaa88ff,
            roughness: 0.7,
            metalness: 0.2
          })
        );
        
        stem.position.y = stemHeight / 2;
        cap.position.y = stemHeight;
        
        const mushroom = new THREE.Group();
        mushroom.add(stem);
        mushroom.add(cap);
        
        mushroom.position.x = (Math.random() - 0.5) * 0.3;
        mushroom.position.z = (Math.random() - 0.5) * 0.3;
        mushroom.rotation.y = Math.random() * Math.PI * 2;
        
        mushroomGroup.add(mushroom);
      }
      
      detail = mushroomGroup;
      detail.scale.set(0.6, 0.6, 0.6);
    }
    
    // Position details on the planet surface
    // Use spherical coordinates for better placement on curved surface
    const theta = Math.random() * Math.PI * 2; // Around the planet
    const phi = Math.random() * Math.PI - Math.PI/2; // From top to bottom
    
    // Convert spherical to cartesian coordinates
    const radius = planetRadius + 0.1;
    const x = radius * Math.cos(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi);
    const z = radius * Math.cos(phi) * Math.sin(theta);
    
    detail.position.set(x, y, z);
    
    // Make details face outward from center
    const normal = new THREE.Vector3(x, y, z).normalize();
    detail.lookAt(normal.multiplyScalar(radius * 2));
    
    details.add(detail);
  }
  
  planet.add(details);
}

// Create a normal map from a texture
function createNormalMap(sourceCanvas) {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d');
  
  // Draw source to canvas
  ctx.drawImage(sourceCanvas, 0, 0);
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Create normal map (simple version)
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const index = (y * canvas.width + x) * 4;
      
      // Simple sobel filter for height differences
      const left = data[(y * canvas.width + Math.max(0, x - 1)) * 4];
      const right = data[(y * canvas.width + Math.min(canvas.width - 1, x + 1)) * 4];
      const up = data[(Math.max(0, y - 1) * canvas.width + x) * 4];
      const down = data[(Math.min(canvas.height - 1, y + 1) * canvas.width + x) * 4];
      
      // Set RGB as normals (simple approximation)
      data[index] = 128 + (right - left); // R: X normal
      data[index + 1] = 128 + (down - up); // G: Y normal
      data[index + 2] = 255; // B: always up in Z direction
      // Keep alpha
    }
  }
  
  // Put processed data back
  ctx.putImageData(imageData, 0, 0);
  
  // Create texture
  const normalTexture = new THREE.CanvasTexture(canvas);
  normalTexture.wrapS = THREE.RepeatWrapping;
  normalTexture.wrapT = THREE.RepeatWrapping;
  normalTexture.repeat.set(4, 4);
  
  return normalTexture;
}

// Create collectible keys
function createKeys() {
  // Create a more interesting key geometry
  const createKeyGeometry = () => {
    // Create a custom key shape
    const shape = new THREE.Shape();
    
    // Draw key head (circular part)
    shape.absarc(0, 0, 0.6, 0, Math.PI * 2, false);
    
    // Cut out inner circle
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, 0.3, 0, Math.PI * 2, true);
    shape.holes.push(holePath);
    
    // Add key stem
    const stemPath = new THREE.Shape();
    stemPath.moveTo(-0.15, 0);
    stemPath.lineTo(-0.15, -1.2);
    stemPath.lineTo(0.15, -1.2);
    stemPath.lineTo(0.15, 0);
    
    // Add key teeth
    stemPath.lineTo(0.15, -0.8);
    stemPath.lineTo(0.3, -0.8);
    stemPath.lineTo(0.3, -1.0);
    stemPath.lineTo(0.15, -1.0);
    
    // Extrude settings
    const extrudeSettings = {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 3
    };
    
    // Combine geometries
    const headGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const stemGeometry = new THREE.ExtrudeGeometry(stemPath, extrudeSettings);
    
    // Create BufferGeometries to combine them
    return BufferGeometryUtils.mergeBufferGeometries([
      headGeometry,
      stemGeometry
    ]);
  };
  
  // Create different colors for key types
  const keyColors = {
    regular: { color: 0xffdd22, emissive: 0xff9900, emissiveIntensity: 0.5 },
    gold: { color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.7 },
    crystal: { color: 0x00ffff, emissive: 0x0088ff, emissiveIntensity: 0.6 },
    ancient: { color: 0x9932cc, emissive: 0x800080, emissiveIntensity: 0.8 }
  };
  
  // Create keys
  for (let i = 0; i < keysRequired; i++) {
    // Determine key type
    const keyType = keyTypes[Math.min(Math.floor(i / 4), keyTypes.length - 1)];
    const keyColor = keyColors[keyType];
    
    // Create better key material with shine and glow
    const keyMaterial = new THREE.MeshStandardMaterial({ 
      color: keyColor.color, 
      emissive: keyColor.emissive,
      emissiveIntensity: keyColor.emissiveIntensity,
      metalness: 0.9,
      roughness: 0.2,
      envMapIntensity: 1.0
    });
    
    // Create key object
    const keyGeometry = createKeyGeometry();
    const key = new THREE.Mesh(keyGeometry, keyMaterial);
    
    // Add glow effect
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: keyColor.emissive,
      transparent: true,
      opacity: 0.4,
      side: THREE.BackSide
    });
    
    const glowMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 16, 16),
      glowMaterial
    );
    key.add(glowMesh);
    
    // Add light source inside key
    const keyLight = new THREE.PointLight(keyColor.emissive, 0.8, 3);
    keyLight.position.set(0, 0, 0);
    key.add(keyLight);
    
    // Position keys throughout the level in different zones based on type
    let x, y, z;
    
    if (i === 0) {
      // First key is near the starting platform for tutorial
      x = 0;
      y = 10;
      z = 50;
    } else if (keyType === 'regular') {
      // Regular keys in the inner area
      const radius = 80 + Math.random() * 70;
      const angle = Math.random() * Math.PI * 2;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
      y = 15 + Math.random() * 40;
    } else if (keyType === 'gold') {
      // Gold keys in the mid area
      const radius = 150 + Math.random() * 70;
      const angle = Math.random() * Math.PI * 2;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
      y = 30 + Math.random() * 50;
    } else if (keyType === 'crystal') {
      // Crystal keys in the upper area
      const radius = 200 + Math.random() * 70;
      const angle = Math.random() * Math.PI * 2;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
      y = 60 + Math.random() * 60;
    } else if (keyType === 'ancient') {
      // Ancient keys in the farthest areas
      const radius = 280 + Math.random() * 100;
      const angle = Math.random() * Math.PI * 2;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
      y = 80 + Math.random() * 70;
    }
    
    key.position.set(x, y, z);
    
    // Add hover animation data
    key.userData = {
      originalY: key.position.y,
      hoverSpeed: 0.001 + Math.random() * 0.001,
      hoverRange: 0.5 + Math.random() * 0.5,
      hoverOffset: Math.random() * Math.PI * 2,
      rotationSpeed: 0.01 + Math.random() * 0.01,
      pulseSpeed: 0.5 + Math.random() * 0.5,
      glowMesh: glowMesh,
      keyType: keyType, // Store key type for special effects
      value: keyType === 'regular' ? 1 : 
             keyType === 'gold' ? 2 : 
             keyType === 'crystal' ? 3 : 
             keyType === 'ancient' ? 4 : 1 // Different key types have different values
    };
    
    // Add sparkle particle effects
    addKeySparkles(key);
    
    // Add to scene and keys array
    scene.add(key);
    keys.push(key);
  }
}

// Add sparkle effects to keys
function addKeySparkles(key) {
  // Create sparkle material
  const sparkleTexture = createSparkleTexture();
  const sparkleMaterial = new THREE.PointsMaterial({
    size: 0.2,
    map: sparkleTexture,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: 0xffffcc
  });
  
  // Create sparkle positions (orbit around key)
  const sparkleCount = 8;
  const positions = new Float32Array(sparkleCount * 3);
  
  for (let i = 0; i < sparkleCount; i++) {
    const angle = (i / sparkleCount) * Math.PI * 2;
    const radius = 0.8 + Math.random() * 0.4;
    
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
  }
  
  // Create sparkle geometry
  const sparkleGeometry = new THREE.BufferGeometry();
  sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  // Create sparkle system
  const sparkleSystem = new THREE.Points(sparkleGeometry, sparkleMaterial);
  
  // Add animation properties
  sparkleSystem.userData = {
    time: 0,
    originalPositions: positions.slice()
  };
  
  // Add update function
  sparkleSystem.update = (time) => {
    sparkleSystem.userData.time = time;
    
    const positions = sparkleSystem.geometry.attributes.position.array;
    const originalPositions = sparkleSystem.userData.originalPositions;
    
    for (let i = 0; i < sparkleCount; i++) {
      const i3 = i * 3;
      
      // Calculate orbital motion (different speeds for each particle)
      const angle = time * (0.5 + i * 0.1);
      const radius = 0.8 + 0.2 * Math.sin(time * (0.3 + i * 0.05));
      
      positions[i3] = originalPositions[i3] * Math.cos(angle) - originalPositions[i3 + 1] * Math.sin(angle);
      positions[i3 + 1] = originalPositions[i3] * Math.sin(angle) + originalPositions[i3 + 1] * Math.cos(angle);
      
      // Add vertical motion
      positions[i3 + 2] = originalPositions[i3 + 2] + Math.sin(time * (1 + i * 0.1)) * 0.2;
    }
    
    sparkleSystem.geometry.attributes.position.needsUpdate = true;
  };
  
  key.add(sparkleSystem);
  key.userData.sparkleSystem = sparkleSystem;
}

// Create sparkle texture
function createSparkleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  
  const context = canvas.getContext('2d');
  
  // Create glow gradient
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.3, 'rgba(255, 250, 200, 0.8)');
  gradient.addColorStop(0.7, 'rgba(255, 220, 100, 0.3)');
  gradient.addColorStop(1, 'rgba(255, 220, 100, 0)');
  
  // Draw sparkle
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  
  // Add star shape
  context.globalCompositeOperation = 'screen';
  context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  context.lineWidth = 2;
  context.beginPath();
  
  // Draw star points
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
    const innerAngle = angle + Math.PI / 5;
    
    // Outer point
    const outerX = 32 + Math.cos(angle) * 30;
    const outerY = 32 + Math.sin(angle) * 30;
    
    // Inner point
    const innerX = 32 + Math.cos(innerAngle) * 12;
    const innerY = 32 + Math.sin(innerAngle) * 12;
    
    if (i === 0) {
      context.moveTo(outerX, outerY);
    } else {
      context.lineTo(outerX, outerY);
    }
    
    context.lineTo(innerX, innerY);
  }
  
  context.closePath();
  context.stroke();
  
  // Create texture
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Create loved one character at the end location
function createLovedOne() {
  // Create loved one group
  lovedOne = new THREE.Group();
  
  // Create a more detailed and romantic loved one model
  const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8, 1);
  const bodyMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xff6699, 
    shininess: 50,
    specular: 0xffccdd,
    emissive: 0xff3366,
    emissiveIntensity: 0.2
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.rotation.x = Math.PI / 2; // Rotate to align with movement direction
  lovedOne.add(body);
  
  // Create butterfly wings using custom geometry - similar to player but with different colors
  function createButterflyWing(isLeft) {
    // Create a shape for the wing
    const wingShape = new THREE.Shape();
    
    // Starting point
    wingShape.moveTo(0, 0);
    
    // Wing outline - create a beautiful butterfly wing shape
    wingShape.bezierCurveTo(0, 0.5, 0.5, 1.5, 1.5, 1.2);
    wingShape.bezierCurveTo(2, 1.0, 2.3, 0.5, 2.2, 0);
    wingShape.bezierCurveTo(2.3, -0.5, 2, -1.2, 1.2, -1.6);
    wingShape.bezierCurveTo(0.6, -1.8, 0.2, -1, 0, -0.8);
    wingShape.bezierCurveTo(0, -0.5, 0, -0.2, 0, 0);
    
    // Create wing geometry
    const wingGeometry = new THREE.ShapeGeometry(wingShape);
    
    // Create patterns/details for the wing
    const wingDetailShape1 = new THREE.Shape();
    wingDetailShape1.moveTo(0.3, 0.2);
    wingDetailShape1.bezierCurveTo(0.6, 0.5, 1.2, 0.8, 1.6, 0.7);
    wingDetailShape1.bezierCurveTo(1.4, 0.4, 1.1, 0.2, 0.8, 0.1);
    wingDetailShape1.bezierCurveTo(0.6, 0.1, 0.4, 0.1, 0.3, 0.2);
    
    const wingDetailShape2 = new THREE.Shape();
    wingDetailShape2.moveTo(0.4, -0.3);
    wingDetailShape2.bezierCurveTo(0.8, -0.7, 1.4, -0.9, 1.7, -1.0);
    wingDetailShape2.bezierCurveTo(1.5, -0.7, 1.0, -0.5, 0.6, -0.2);
    wingDetailShape2.bezierCurveTo(0.5, -0.2, 0.4, -0.2, 0.4, -0.3);
    
    // Create wing material with beautiful gradient colors - different from player
    const wingMaterial = new THREE.MeshPhongMaterial({
      color: 0xff3377, 
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      shininess: 70,
      specular: 0xffffff,
      emissive: 0xff0044,
      emissiveIntensity: 0.2
    });
    
    const wingDetailMaterial = new THREE.MeshPhongMaterial({
      color: isLeft ? 0xff66aa : 0xff99cc,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      shininess: 80,
      specular: 0xffffff,
      emissive: 0xff3366,
      emissiveIntensity: 0.3
    });
    
    // Create the main wing
    const wing = new THREE.Mesh(wingGeometry, wingMaterial);
    
    // Create the detailed patterns
    const wingDetail1 = new THREE.Mesh(new THREE.ShapeGeometry(wingDetailShape1), wingDetailMaterial);
    const wingDetail2 = new THREE.Mesh(new THREE.ShapeGeometry(wingDetailShape2), wingDetailMaterial);
    
    // Group all wing parts
    const wingGroup = new THREE.Group();
    wingGroup.add(wing);
    wingGroup.add(wingDetail1);
    wingGroup.add(wingDetail2);
    
    // Position and scale
    wingGroup.scale.set(1.5, 1.5, 1.5);
    
    // Mirror if right wing
    if (!isLeft) {
      wingGroup.scale.x *= -1;
    }
    
    return wingGroup;
  }
  
  // Create both wings
  const leftWing = createButterflyWing(true);
  const rightWing = createButterflyWing(false);
  
  // Position wings
  leftWing.position.set(0.5, 0.1, 0);
  rightWing.position.set(-0.5, 0.1, 0);
  
  // Create wing container (for animation)
  const wingsContainer = new THREE.Group();
  wingsContainer.add(leftWing);
  wingsContainer.add(rightWing);
  lovedOne.add(wingsContainer);
  
  // Create antennae
  const antennaGeometry = new THREE.CylinderGeometry(0.02, 0.01, 0.8, 6);
  const antennaMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xff3366,
    shininess: 50,
    emissive: 0xff0044,
    emissiveIntensity: 0.3
  });
  
  const leftAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
  leftAntenna.position.set(0.2, 0.2, -0.7);
  leftAntenna.rotation.x = -Math.PI / 4;
  
  const rightAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
  rightAntenna.position.set(-0.2, 0.2, -0.7);
  rightAntenna.rotation.x = -Math.PI / 4;
  
  // Create antenna tips with heart shapes
  const heartGeometry = createHeartShape();
  heartGeometry.scale(0.1, 0.1, 0.1);
  
  const tipMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xff0055, 
    emissive: 0xff3366,
    emissiveIntensity: 0.5,
    shininess: 80,
    specular: 0xffffff
  });
  
  const leftTip = new THREE.Mesh(heartGeometry, tipMaterial);
  leftTip.position.set(0.33, 0.4, -1.1);
  leftTip.rotation.x = Math.PI / 2;
  
  const rightTip = new THREE.Mesh(heartGeometry, tipMaterial);
  rightTip.position.set(-0.33, 0.4, -1.1);
  rightTip.rotation.x = Math.PI / 2;
  
  lovedOne.add(leftAntenna);
  lovedOne.add(rightAntenna);
  lovedOne.add(leftTip);
  lovedOne.add(rightTip);
  
  // Add glow effect
  const glowGeometry = new THREE.SphereGeometry(1.2, 16, 16);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff99cc,
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  lovedOne.add(glow);
  
  // Add sparkle particles around the loved one
  const sparkleGeometry = new THREE.BufferGeometry();
  const sparklePositions = new Float32Array(30 * 3); // 30 sparkles
  const sparkleColors = new Float32Array(30 * 3);
  
  for (let i = 0; i < 30; i++) {
    // Position sparkles in a sphere around the loved one
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const radius = 1.5 + Math.random() * 0.8;
    
    sparklePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    sparklePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    sparklePositions[i * 3 + 2] = radius * Math.cos(phi);
    
    // Pink and red colors for sparkles
    const r = 0.9 + Math.random() * 0.1;
    const g = 0.4 + Math.random() * 0.3;
    const b = 0.6 + Math.random() * 0.3;
    sparkleColors[i * 3] = r;
    sparkleColors[i * 3 + 1] = g;
    sparkleColors[i * 3 + 2] = b;
  }
  
  sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
  sparkleGeometry.setAttribute('color', new THREE.BufferAttribute(sparkleColors, 3));
  
  const sparkleMaterial = new THREE.PointsMaterial({
    size: 0.2,
    map: createSparkleTexture(),
    transparent: true,
    opacity: 0.8,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  
  const sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial);
  sparkles.userData = { time: 0 };
  lovedOne.add(sparkles);
  
  // Add a heart halo above the loved one
  const heartHalo = createHeartHalo();
  heartHalo.position.y = 1.5;
  lovedOne.add(heartHalo);
  
  // Add a point light to make the loved one glow
  const pointLight = new THREE.PointLight(0xff6699, 1, 10);
  pointLight.position.set(0, 0, 0);
  lovedOne.add(pointLight);
  
  // Position far from player
  lovedOne.position.set(0, 30, -200); // Moved further away and higher up
  
  // Add animation function
  lovedOne.animate = (time) => {
    wingsContainer.rotation.z = Math.sin(time * 8) * 0.3;
    leftAntenna.rotation.x = -Math.PI / 4 + Math.sin(time * 2.5) * 0.1;
    rightAntenna.rotation.x = -Math.PI / 4 + Math.sin(time * 2.5 + 0.2) * 0.1;
    
    // Animate heart tips
    leftTip.rotation.y = time * 2;
    rightTip.rotation.y = time * 2;
    
    // Pulse glow
    glow.scale.set(
      1 + Math.sin(time * 1.5) * 0.1,
      1 + Math.sin(time * 1.5) * 0.1,
      1 + Math.sin(time * 1.5) * 0.1
    );
    
    // Animate sparkles
    if (sparkles) {
      sparkles.userData.time = time;
      const positions = sparkles.geometry.attributes.position.array;
      
      for (let i = 0; i < 30; i++) {
        // Make sparkles orbit around the loved one
        const theta = time * (0.15 + i * 0.01) + i * (Math.PI * 2 / 30);
        const phi = Math.sin(time * (0.08 + i * 0.01)) * 0.3 + Math.PI / 2;
        const radius = 1.5 + 0.4 * Math.sin(time * (0.2 + i * 0.03));
        
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
      }
      
      sparkles.geometry.attributes.position.needsUpdate = true;
    }
    
    // Animate heart halo
    if (heartHalo) {
      heartHalo.rotation.y = time * 0.5;
      heartHalo.children.forEach((heart, i) => {
        heart.position.y = 0.2 * Math.sin(time * 1.5 + i * 0.5);
        heart.rotation.z = time * 0.5 + i * (Math.PI * 2 / heartHalo.children.length);
      });
    }
    
    // Pulse light intensity
    if (pointLight) {
      pointLight.intensity = 1 + 0.5 * Math.sin(time * 2);
    }
  };
  
  // Add to scene
  scene.add(lovedOne);
}

// Create a heart halo (circle of small hearts)
function createHeartHalo() {
  const haloGroup = new THREE.Group();
  const heartCount = 8;
  
  for (let i = 0; i < heartCount; i++) {
    const heartGeometry = createHeartShape();
    heartGeometry.scale(0.15, 0.15, 0.15);
    
    const heartMaterial = new THREE.MeshPhongMaterial({
      color: 0xff3366,
      emissive: 0xff0044,
      emissiveIntensity: 0.5,
      shininess: 70,
      specular: 0xffffff
    });
    
    const heart = new THREE.Mesh(heartGeometry, heartMaterial);
    
    // Position in a circle
    const angle = (i / heartCount) * Math.PI * 2;
    const radius = 0.8;
    heart.position.x = Math.cos(angle) * radius;
    heart.position.z = Math.sin(angle) * radius;
    
    // Random rotation
    heart.rotation.x = Math.PI / 2;
    heart.rotation.z = angle;
    
    haloGroup.add(heart);
  }
  
  return haloGroup;
}

// Setup controls
function setupControls() {
  // Variables to track double-clicks
  let lastClickTime = {};
  const doubleClickThreshold = 300; // milliseconds
  
  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    const now = Date.now();
    
    // Check for double-click on arrow keys or WASD
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
      if (lastClickTime[e.key] && (now - lastClickTime[e.key] < doubleClickThreshold)) {
        // Double-click detected, activate unlimited boost
        controls.unlimitedBoost = true;
      }
      lastClickTime[e.key] = now;
    }
    
    switch (e.key) {
      case 'ArrowUp':
      case 'w': controls.forward = true; break;
      case 'ArrowDown':
      case 's': controls.backward = true; break;
      case 'ArrowLeft':
      case 'a': controls.left = true; break;
      case 'ArrowRight':
      case 'd': controls.right = true; break;
      case ' ': controls.up = true; break;
      case 'Shift': controls.down = true; break;
      case 'Tab': 
        e.preventDefault(); // Prevent tab from changing focus
        controls.unlimitedBoost = true; 
        break;
    }
  });
  
  document.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'ArrowUp':
      case 'w': controls.forward = false; break;
      case 'ArrowDown':
      case 's': controls.backward = false; break;
      case 'ArrowLeft':
      case 'a': controls.left = false; break;
      case 'ArrowRight':
      case 'd': controls.right = false; break;
      case ' ': controls.up = false; break;
      case 'Shift': controls.down = false; break;
      case 'Tab': controls.unlimitedBoost = false; break;
    }
    
    // If all movement keys are released, also release unlimited boost
    if (!controls.forward && !controls.backward && !controls.left && !controls.right) {
      controls.unlimitedBoost = false;
    }
  });
  
  // Mouse controls for camera
  document.addEventListener('mousedown', (e) => {
    if (e.button === 2) { // Right mouse button
      mouseLook = true;
    }
  });
  
  document.addEventListener('mouseup', (e) => {
    if (e.button === 2) { // Right mouse button
      mouseLook = false;
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (mouseLook) {
      rotationVelocity.x -= e.movementY * cameraLookSpeed;
      rotationVelocity.y -= e.movementX * cameraLookSpeed;
      
      // Limit vertical rotation
      rotationVelocity.x = Math.max(-0.5, Math.min(0.5, rotationVelocity.x));
    }
  });
  
  // Prevent context menu on right-click
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
  
  // Mobile controls
  if ('ontouchstart' in window) {
    setupMobileControls();
  }
}

// Mobile-specific controls
function setupMobileControls() {
  // Remove the old mobile controls if they exist
  const oldMobileControls = document.getElementById('mobile-controls');
  if (oldMobileControls) {
    oldMobileControls.remove();
  }
  
  // Create UI elements
  const container = document.createElement('div');
  container.id = 'mobile-controls';
  container.style.position = 'fixed';
  container.style.bottom = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '40%';
  container.style.display = 'flex';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);
  
  // Left joystick for movement
  const leftJoystick = document.createElement('div');
  leftJoystick.style.width = '40%';
  leftJoystick.style.height = '100%';
  leftJoystick.style.pointerEvents = 'auto';
  container.appendChild(leftJoystick);
  
  // Right area for camera control
  const rightJoystick = document.createElement('div');
  rightJoystick.style.width = '40%';
  rightJoystick.style.height = '100%';
  rightJoystick.style.marginLeft = 'auto';
  rightJoystick.style.pointerEvents = 'auto';
  container.appendChild(rightJoystick);
  
  // Center buttons for up/down
  const centerButtons = document.createElement('div');
  centerButtons.style.position = 'absolute';
  centerButtons.style.bottom = '20px';
  centerButtons.style.left = '50%';
  centerButtons.style.transform = 'translateX(-50%)';
  centerButtons.style.display = 'flex';
  centerButtons.style.flexDirection = 'column';
  centerButtons.style.gap = '10px';
  centerButtons.style.pointerEvents = 'auto';
  container.appendChild(centerButtons);
  
  // Up button (Space)
  const upButton = document.createElement('div');
  upButton.style.width = '50px';
  upButton.style.height = '50px';
  upButton.style.borderRadius = '50%';
  upButton.style.backgroundColor = 'rgba(255,255,255,0.3)';
  upButton.innerHTML = '↑';
  upButton.style.display = 'flex';
  upButton.style.justifyContent = 'center';
  upButton.style.alignItems = 'center';
  upButton.style.fontSize = '24px';
  upButton.style.color = 'white';
  upButton.style.cursor = 'pointer';
  centerButtons.appendChild(upButton);
  
  // Down button (Shift)
  const downButton = document.createElement('div');
  downButton.style.width = '50px';
  downButton.style.height = '50px';
  downButton.style.borderRadius = '50%';
  downButton.style.backgroundColor = 'rgba(255,255,255,0.3)';
  downButton.innerHTML = '↓';
  downButton.style.display = 'flex';
  downButton.style.justifyContent = 'center';
  downButton.style.alignItems = 'center';
  downButton.style.fontSize = '24px';
  downButton.style.color = 'white';
  downButton.style.cursor = 'pointer';
  centerButtons.appendChild(downButton);
  
  // Boost indicator
  const boostIndicator = document.createElement('div');
  boostIndicator.style.position = 'absolute';
  boostIndicator.style.top = '-40px';
  boostIndicator.style.left = '50%';
  boostIndicator.style.transform = 'translateX(-50%)';
  boostIndicator.style.color = 'white';
  boostIndicator.style.fontSize = '14px';
  boostIndicator.style.textAlign = 'center';
  boostIndicator.innerHTML = 'Double tap for boost';
  boostIndicator.style.backgroundColor = 'rgba(0,0,0,0.5)';
  boostIndicator.style.padding = '5px 10px';
  boostIndicator.style.borderRadius = '5px';
  centerButtons.appendChild(boostIndicator);
  
  // Variables for touch tracking
  let leftTouchId = null;
  let rightTouchId = null;
  let leftStartX = 0;
  let leftStartY = 0;
  let rightStartX = 0;
  let rightStartY = 0;
  
  // Variables for double-tap detection
  let lastTapTime = 0;
  const doubleTapThreshold = 300; // milliseconds
  
  // Left joystick for movement
  leftJoystick.addEventListener('touchstart', (e) => {
    if (leftTouchId === null) {
      const touch = e.changedTouches[0];
      leftTouchId = touch.identifier;
      leftStartX = touch.clientX;
      leftStartY = touch.clientY;
      
      // Check for double-tap
      const now = Date.now();
      if (now - lastTapTime < doubleTapThreshold) {
        controls.unlimitedBoost = true;
        boostIndicator.innerHTML = 'UNLIMITED BOOST';
        boostIndicator.style.color = '#ff00ff';
      }
      lastTapTime = now;
    }
    e.preventDefault();
  });
  
  leftJoystick.addEventListener('touchmove', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === leftTouchId) {
        const dx = touch.clientX - leftStartX;
        const dy = touch.clientY - leftStartY;
        
        // Threshold for movement detection
        const threshold = 10;
        
        controls.right = dx > threshold;
        controls.left = dx < -threshold;
        controls.backward = dy > threshold;
        controls.forward = dy < -threshold;
        
        break;
      }
    }
    e.preventDefault();
  });
  
  rightJoystick.addEventListener('touchstart', (e) => {
    if (rightTouchId === null) {
      const touch = e.changedTouches[0];
      rightTouchId = touch.identifier;
      rightStartX = touch.clientX;
      rightStartY = touch.clientY;
    }
    e.preventDefault();
  });
  
  rightJoystick.addEventListener('touchmove', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === rightTouchId) {
        const dx = touch.clientX - rightStartX;
        const dy = touch.clientY - rightStartY;
        
        rotationVelocity.y -= dx * 0.001;
        rotationVelocity.x -= dy * 0.001;
        
        // Update start position for relative movement
        rightStartX = touch.clientX;
        rightStartY = touch.clientY;
        break;
      }
    }
    e.preventDefault();
  });
  
  // Up/down button handling
  upButton.addEventListener('touchstart', () => { controls.up = true; });
  upButton.addEventListener('touchend', () => { controls.up = false; });
  downButton.addEventListener('touchstart', () => { controls.down = true; });
  downButton.addEventListener('touchend', () => { controls.down = false; });
  
  // Clean up touch states when touch ends
  document.addEventListener('touchend', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === leftTouchId) {
        leftTouchId = null;
        controls.forward = controls.backward = controls.left = controls.right = false;
        controls.unlimitedBoost = false;
        boostIndicator.innerHTML = 'Double tap for boost';
        boostIndicator.style.color = 'white';
      } else if (touch.identifier === rightTouchId) {
        rightTouchId = null;
      }
    }
  });
}

// Setup event listeners for UI
function setupEventListeners() {
  // Start button
  document.getElementById('start-button').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    gameState = GAME_STATES.PLAYING;
    
    // Remove sound play attempt
    // No sound code here
  });
  
  // Restart button
  document.getElementById('restart-button').addEventListener('click', () => {
    window.location.reload(); // Simple way to restart the game
  });
  
  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  // Main keyboard controls are handled in setupControls()
  // We only need to handle the speed run controls here
  window.addEventListener('keydown', (event) => {
    // Speed run menu toggle - handled by SpeedRunSystem via setupSpeedRunControls
    // We keep this here as a fallback
    if (event.key === 'r' && gameState === GAME_STATES.PLAYING) {
      const speedRunSelection = document.querySelector('.speed-run-selection');
      if (speedRunSelection) {
        speedRunSelection.style.display = speedRunSelection.style.display === 'none' ? 'block' : 'none';
      }
    }
    
    // Cancel speed run - also handled by SpeedRunSystem
    // We keep this here as a fallback
    if (event.key === 'Escape' && gameState === GAME_STATES.SPEEDRUN) {
      if (window.SpeedRunSystem) {
        window.SpeedRunSystem.endSpeedRun(false);
      } else {
        endSpeedRun(false);
      }
    }
  });
  
  // Add event listener for target cycling (T key)
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyT' && gameState === GAME_STATES.PLAYING) {
      cycleNavigationTarget();
    }
  });
  
  // Add target cycling to mobile controls - let's add a button
  if (/Mobi|Android/i.test(navigator.userAgent)) {
    const cycleBtnSize = 40;
    const cycleBtn = document.createElement('button');
    cycleBtn.innerHTML = '🔄';
    cycleBtn.style.position = 'fixed';
    cycleBtn.style.bottom = '100px';
    cycleBtn.style.right = '20px';
    cycleBtn.style.width = `${cycleBtnSize}px`;
    cycleBtn.style.height = `${cycleBtnSize}px`;
    cycleBtn.style.borderRadius = '50%';
    cycleBtn.style.border = 'none';
    cycleBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
    cycleBtn.style.color = 'white';
    cycleBtn.style.fontSize = '20px';
    cycleBtn.style.display = 'flex';
    cycleBtn.style.justifyContent = 'center';
    cycleBtn.style.alignItems = 'center';
    cycleBtn.style.zIndex = '200';
    cycleBtn.style.opacity = '0.7';
    cycleBtn.style.touchAction = 'manipulation';
    cycleBtn.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    
    cycleBtn.addEventListener('touchstart', (event) => {
      event.preventDefault();
      cycleNavigationTarget();
    });
    
    document.body.appendChild(cycleBtn);
  }
}

// Create heart particles
function createHeartParticle() {
  // Create heart geometry if it doesn't exist
  const heartGeometry = createHeartShape();
  
  // Create heart material
  const heartMaterial = new THREE.MeshBasicMaterial({
    color: Math.random() < 0.5 ? 0xff3366 : 0xff66aa,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  
  const heart = new THREE.Mesh(heartGeometry, heartMaterial);
  
  // Set starting position near the midpoint of player and loved one
  const midPoint = new THREE.Vector3(
    (player.position.x + lovedOne.position.x) / 2,
    (player.position.y + lovedOne.position.y) / 2,
    (player.position.z + lovedOne.position.z) / 2
  );
  
  heart.position.copy(midPoint);
  heart.position.x += (Math.random() - 0.5) * 5;
  heart.position.y += (Math.random() - 0.5) * 5;
  heart.position.z += (Math.random() - 0.5) * 5;
  
  // Random rotation
  heart.rotation.x = Math.random() * Math.PI * 2;
  heart.rotation.y = Math.random() * Math.PI * 2;
  heart.rotation.z = Math.random() * Math.PI * 2;
  
  // Random scale
  const scale = 0.5 + Math.random() * 1;
  heart.scale.set(scale, scale, scale);
  
  // Add movement properties
  heart.userData = {
    type: 'heart',
    life: 1.0,
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2 + 0.1, // Slight upward bias
      (Math.random() - 0.5) * 0.2
    ),
    rotationSpeed: new THREE.Vector3(
      (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.1
    )
  };
  
  scene.add(heart);
  particles.push(heart);
}

// Create collection effect when collecting keys or easter eggs
function createCollectionEffect(position, type = 'regular') {
  // Define colors for different key types
  const colors = {
    regular: 0xffdd44,    // Regular gold color
    gold: 0xffd700,       // Bright gold
    crystal: 0x00ffff,    // Cyan/blue
    ancient: 0x9932cc,    // Purple
    easter: 0xff00ff      // Magenta for easter eggs
  };
  
  // Get color based on type
  const color = colors[type] || colors.regular;
  
  // Particle count based on type
  const particleCount = type === 'ancient' ? 30 : 
                       type === 'gold' ? 20 :
                       type === 'easter' ? 25 : 15;
  
  for (let i = 0; i < particleCount; i++) {
    // Geometry varies by type
    let geometry;
    
    if (type === 'easter') {
      // Star-shaped particles for easter eggs
      geometry = new THREE.TetrahedronGeometry(0.3, 1);
    } else if (type === 'ancient' || type === 'crystal') {
      // Crystal shaped for ancient and crystal keys
      geometry = new THREE.OctahedronGeometry(0.3, 0);
    } else {
      // Spheres for regular and gold keys
      geometry = new THREE.SphereGeometry(0.2, 8, 8);
    }
    
    const material = new THREE.MeshBasicMaterial({ 
      color: color,
      transparent: true,
      opacity: 1
    });
    
    const particle = new THREE.Mesh(geometry, material);
    particle.position.copy(position);
    
    // Different velocities based on type
    const speedMultiplier = type === 'ancient' ? 0.8 : 
                           type === 'gold' ? 0.6 :
                           type === 'easter' ? 0.9 : 0.5;
    
    particle.userData = {
      type: 'collection',
      life: 1.0,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * speedMultiplier,
        Math.random() * speedMultiplier,
        (Math.random() - 0.5) * speedMultiplier
      ),
    };
    
    // Add rotation for certain types
    if (type === 'crystal' || type === 'ancient' || type === 'easter') {
      particle.userData.rotationSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1
      );
    }
    
    scene.add(particle);
    particles.push(particle);
  }
}

// Update all particles
function updateParticles(deltaTime) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    
    if (particle.userData.type === 'firework') {
      // Update firework particle position
      particle.position.add(particle.userData.velocity);
      
      // Apply gravity
      particle.userData.velocity.y -= 0.1 * deltaTime;
      
      // Update rotation
      particle.rotation.x += particle.userData.rotationSpeed.x;
      particle.rotation.y += particle.userData.rotationSpeed.y;
      particle.rotation.z += particle.userData.rotationSpeed.z;
      
      // Update trail
      if (particle.userData.trail) {
        const positions = particle.userData.trail.geometry.attributes.position.array;
        const colors = particle.userData.trail.geometry.attributes.color.array;
        
        // Shift trail positions
        for (let j = positions.length - 3; j >= 3; j -= 3) {
          positions[j] = positions[j - 3];
          positions[j + 1] = positions[j - 2];
          positions[j + 2] = positions[j - 1];
          
          // Fade trail colors
          colors[j] *= 0.95;
          colors[j + 1] *= 0.95;
          colors[j + 2] *= 0.95;
        }
        
        // Add new position at the front
        positions[0] = 0;
        positions[1] = 0;
        positions[2] = 0;
        
        particle.userData.trail.geometry.attributes.position.needsUpdate = true;
        particle.userData.trail.geometry.attributes.color.needsUpdate = true;
      }
      
      // Update light position
      if (particle.userData.light) {
        particle.userData.light.position.copy(particle.position);
        particle.userData.light.intensity *= 0.98;
      }
      
      // Update life and opacity
      particle.userData.life -= particle.userData.decay;
      if (particle.material.opacity !== undefined) {
        particle.material.opacity = particle.userData.life;
      }
      
      // Remove dead particles
      if (particle.userData.life <= 0) {
        if (particle.userData.light) {
          scene.remove(particle.userData.light);
        }
        scene.remove(particle);
        particles.splice(i, 1);
      }
    } else if (particle.userData.type === 'flash') {
      // Update flash opacity
      particle.userData.life -= particle.userData.decay;
      if (particle.material.opacity !== undefined) {
        particle.material.opacity = particle.userData.life;
      }
      
      // Scale up flash
      particle.scale.addScalar(0.1);
      
      // Remove dead flash
      if (particle.userData.life <= 0) {
        scene.remove(particle);
        particles.splice(i, 1);
      }
    } else if (particle.userData.type === 'shield_activation') {
      // Update shield activation effect
      particle.userData.scale += 0.2;
      particle.scale.setScalar(particle.userData.scale);
      
      particle.userData.life -= 0.02;
      particle.material.opacity = particle.userData.life;
      
      if (particle.userData.life <= 0) {
        scene.remove(particle);
        particles.splice(i, 1);
      }
    } else {
      // Update regular particles
      if (particle.userData.velocity) {
        particle.position.add(particle.userData.velocity);
      }
      
      // Update life
      if (particle.userData.life !== undefined) {
        particle.userData.life -= deltaTime * (particle.userData.type === 'heart' ? 0.3 : 0.7);
        
        // Update opacity based on life
        if (particle.material.opacity !== undefined) {
          particle.material.opacity = particle.userData.life;
        }
      }
      
      // Apply rotation if it has rotation speed
      if (particle.userData.rotationSpeed) {
        particle.rotation.x += particle.userData.rotationSpeed.x;
        particle.rotation.y += particle.userData.rotationSpeed.y;
        particle.rotation.z += particle.userData.rotationSpeed.z;
      }
      
      // Remove dead particles
      if (particle.userData.life <= 0) {
        scene.remove(particle);
        particles.splice(i, 1);
      }
    }
  }
}

// Check collisions between player and game objects
function checkCollisions() {
  const playerPosition = player.position.clone();
  
  // Check key collisions
  for (let i = keys.length - 1; i >= 0; i--) {
    if (playerPosition.distanceTo(keys[i].position) < 3) {
      // Get key type and value
      const keyType = keys[i].userData.keyType || 'regular';
      const keyValue = keys[i].userData.value || 1;
      
      // Create collection effect with key-specific color
      createCollectionEffect(keys[i].position.clone(), keyType);
      
      // Special effects for different key types
      if (keyType === 'gold') {
        // Gold key gives a temporary speed boost
        playerSpeedMultiplier = 2.0;
        setTimeout(() => { playerSpeedMultiplier = 1.0; }, 5000); // 5 seconds boost
        showNavigationNotification("Gold Key: Speed Boost Activated (5s)!");
      } else if (keyType === 'crystal') {
        // Crystal key creates a shield that protects from obstacles
        playerShielded = true;
        const shield = createShieldEffect(player);
        player.userData.shield = shield;
        
        // Create initial shield activation effect
        const activationGeometry = new THREE.SphereGeometry(0.1, 32, 32);
        const activationMaterial = new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 1,
          blending: THREE.AdditiveBlending
        });
        
        const activation = new THREE.Mesh(activationGeometry, activationMaterial);
        activation.position.copy(player.position);
        
        activation.userData = {
          type: 'shield_activation',
          life: 1.0,
          scale: 0.1
        };
        
        scene.add(activation);
        particles.push(activation);
        
        // Remove shield after duration
        setTimeout(() => {
          playerShielded = false;
          if (player.userData.shield) {
            player.remove(player.userData.shield);
            delete player.userData.shield;
          }
        }, 10000); // 10 seconds shield
        
        showNavigationNotification("🛡️ Crystal Shield Activated (10s)!");
      } else if (keyType === 'ancient') {
        // Ancient key reveals all remaining keys on the minimap temporarily
        revealAllKeys = true;
        setTimeout(() => { revealAllKeys = false; }, 15000); // 15 seconds reveal
        showNavigationNotification("Ancient Key: All Keys Revealed (15s)!");
      }
      
      // Remove key
      scene.remove(keys[i]);
      keys.splice(i, 1);
      
      // Update UI with the appropriate value
      keysCollected += keyValue;
      document.getElementById('key-count').textContent = keysCollected;
      
      // Check if all keys collected
      if (keysCollected >= keysRequired) {
        startEnding();
      }
    }
  }
  
  // Check easter egg collisions
  for (let i = easterEggs.length - 1; i >= 0; i--) {
    if (playerPosition.distanceTo(easterEggs[i].position) < 3 && !collectedEasterEggs.includes(i)) {
      // Create special collection effect
      createCollectionEffect(easterEggs[i].position.clone(), 'easter');
      
      // Apply easter egg effect based on its type
      const eggType = easterEggs[i].userData.eggType;
      
      if (eggType === 'rainbow') {
        // Rainbow egg changes the player's trail to rainbow colors
        playerTrailColor = 'rainbow';
        showNavigationNotification("Rainbow Trail Activated!");
      } else if (eggType === 'giant') {
        // Giant egg makes the player temporarily larger
        player.scale.set(2, 2, 2);
        setTimeout(() => { player.scale.set(1, 1, 1); }, 10000); // 10 seconds
        showNavigationNotification("Giant Mode Activated (10s)!");
      } else if (eggType === 'tiny') {
        // Tiny egg makes the player temporarily smaller
        player.scale.set(0.5, 0.5, 0.5);
        setTimeout(() => { player.scale.set(1, 1, 1); }, 10000); // 10 seconds
        showNavigationNotification("Tiny Mode Activated (10s)!");
      } else if (eggType === 'gravity') {
        // Gravity egg reverses gravity temporarily
        gravityReversed = true;
        setTimeout(() => { gravityReversed = false; }, 15000); // 15 seconds
        showNavigationNotification("Gravity Reversed (15s)!");
      } else if (eggType === 'fireworks') {
        // Fireworks egg creates a spectacular display
        for (let j = 0; j < 5; j++) {
          setTimeout(() => {
            // Create fireworks at random positions around the original position
            const offset = new THREE.Vector3(
              (Math.random() - 0.5) * 20,
              Math.random() * 20,
              (Math.random() - 0.5) * 20
            );
            const position = easterEggs[i].position.clone().add(offset);
            createFireworks(position);
          }, j * 500); // Stagger the fireworks every 0.5 seconds
        }
        
        // Create a grand finale after the initial fireworks
        setTimeout(() => {
          for (let j = 0; j < 10; j++) {
            setTimeout(() => {
              const angle = (j / 10) * Math.PI * 2;
              const radius = 15;
              const position = easterEggs[i].position.clone().add(
                new THREE.Vector3(
                  Math.cos(angle) * radius,
                  10 + Math.random() * 20,
                  Math.sin(angle) * radius
                )
              );
              createFireworks(position);
            }, j * 200); // Rapid succession for finale
          }
        }, 3000); // Start finale after 3 seconds
        
        showNavigationNotification("🎆 Spectacular Fireworks Display! 🎆");
      }
      
      // Hide the easter egg (but don't remove it)
      easterEggs[i].visible = false;
      collectedEasterEggs.push(i);
    }
  }
  
  // Prevent player from going too far from the game area
  const maxDistance = 500; // Increased from 150 to 500
  if (playerPosition.length() > maxDistance) {
    // Gently push the player back toward the center
    const direction = playerPosition.normalize();
    velocity.sub(direction.multiplyScalar(0.05));
  }
  
  // Simple collision with planets (just a gentle push)
  for (const island of islands) {
    const distance = playerPosition.distanceTo(island.position);
    // Increased collision radius to account for flower-shaped planets
    const planetRadius = island.geometry.parameters && island.geometry.parameters.radiusTop ? 
                          island.geometry.parameters.radiusTop : 
                          (island.userData && island.userData.radius ? island.userData.radius : 6);
    
    const combinedRadius = planetRadius * 0.9 + 1; // Player radius + buffer
    
    if (distance < combinedRadius) {
      // Calculate push direction (away from planet)
      const pushDir = new THREE.Vector3()
        .subVectors(playerPosition, island.position)
        .normalize();
      
      // Apply push force (stronger for planets)
      velocity.add(pushDir.multiplyScalar(0.2));
      
      // Move player outside the collision radius
      const correction = combinedRadius - distance;
      player.position.add(pushDir.multiplyScalar(correction * 1.1));
    }
  }
}

// Update player movement
function updatePlayerMovement(deltaTime) {
  if (gameState !== GAME_STATES.PLAYING && gameState !== GAME_STATES.SPEEDRUN) return;
  
  // Create a movement direction vector based on player's orientation
  const moveDirection = new THREE.Vector3(0, 0, 0);
  
  // Get player's forward direction (where the spaceship is pointing)
  const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
  const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(player.quaternion);
  const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(player.quaternion);
  
  // Apply controls relative to spaceship orientation
  if (controls.forward) {
    moveDirection.add(forwardVector);
  }
  if (controls.backward) {
    moveDirection.sub(forwardVector);
  }
  if (controls.left) {
    moveDirection.sub(rightVector);
  }
  if (controls.right) {
    moveDirection.add(rightVector);
  }
  
  // Handle gravity reversal for up/down controls
  if (gravityReversed) {
    // Reverse up and down controls when gravity is reversed
    if (controls.up) {
      moveDirection.sub(upVector);
    }
    if (controls.down) {
      moveDirection.add(upVector);
    }
    
    // Apply a slight downward force (now upward due to reversal)
    moveDirection.add(upVector.clone().multiplyScalar(0.1));
  } else {
    // Normal gravity
    if (controls.up) {
      moveDirection.add(upVector);
    }
    if (controls.down) {
      moveDirection.sub(upVector);
    }
  }
  
  // Use SpeedRunSystem for boost handling
  let isBoostActive = false;
  if (window.SpeedRunSystem) {
    isBoostActive = window.SpeedRunSystem.updateBoost(deltaTime, player, velocity, sounds, particles, scene);
  } else {
    // Fallback if SpeedRunSystem is not available
    
    // Check for unlimited boost (Tab key or double-click)
    if (controls.unlimitedBoost) {
      isBoostActive = true;
      
      // Create particles occasionally for visual effect
      if (Math.random() > 0.8) {
        create_local_boost_particles();
      }
      
      // Update the boost UI indicator
      const boostIndicator = document.querySelector('.boost-indicator');
      if (boostIndicator) {
        boostIndicator.textContent = 'BOOST: UNLIMITED';
        boostIndicator.style.color = '#ff00ff'; // Bright magenta
      }
    } else {
      // No boost active
      const boostIndicator = document.querySelector('.boost-indicator');
      if (boostIndicator) {
        boostIndicator.textContent = 'BOOST: Ready (TAB or Double-click/tap for boost)';
        boostIndicator.style.color = '#00ff00';
      }
    }
  }
  
  // Normalize and apply acceleration
  if (moveDirection.length() > 0) {
    moveDirection.normalize().multiplyScalar(MOVEMENT.ACCELERATION);
    
    // Apply boost multiplier if active
    if (isBoostActive) {
      moveDirection.multiplyScalar(MOVEMENT.BOOST_MULTIPLIER);
    }
    
    // Apply gold key speed multiplier
    moveDirection.multiplyScalar(playerSpeedMultiplier);
    
    velocity.add(moveDirection);
  }
  
  // Apply damping
  velocity.multiplyScalar(MOVEMENT.DECELERATION);
  
  // Limit speed
  let maxSpeed = MOVEMENT.MAX_SPEED;
  if (isBoostActive) {
    maxSpeed *= MOVEMENT.BOOST_MULTIPLIER;
  }
  
  // Apply gold key speed multiplier to max speed
  maxSpeed *= playerSpeedMultiplier;
  
  if (velocity.length() > maxSpeed) {
    velocity.normalize().multiplyScalar(maxSpeed);
  }
  
  // Apply velocity to player position
  player.position.add(velocity);
  
  // Apply banking effect based on turning
  if (controls.left || controls.right) {
    const bankAmount = controls.left ? 0.3 : (controls.right ? -0.3 : 0);
    player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, bankAmount, 0.1);
  } else {
    // Return to level when not turning
    player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, 0, 0.1);
  }
  
  // Update trail with custom color if rainbow effect is active
  updateTrail();
}

// Create boost particle effect (fallback function)
function create_local_boost_particles() {
  // Get position behind the player
  const behindPos = player.position.clone();
  const backVector = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);
  behindPos.add(backVector.multiplyScalar(2));
  
  // Create particles
  for (let i = 0; i < 5; i++) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      })
    );
    
    // Position slightly offset from center
    particle.position.copy(behindPos);
    particle.position.x += (Math.random() - 0.5) * 0.5;
    particle.position.y += (Math.random() - 0.5) * 0.5;
    particle.position.z += (Math.random() - 0.5) * 0.5;
    
    // Add to scene
    scene.add(particle);
    
    // Set particle properties
    particle.userData = {
      velocity: backVector.clone().multiplyScalar(0.1),
      life: 1.0,
      fadeRate: 0.05 + Math.random() * 0.1,
      scaleRate: 0.02 + Math.random() * 0.03
    };
    
    // Add to particles array
    particles.push(particle);
  }
}

// Update camera movement for spaceship-like view
function updateCamera() {
  if (gameState !== GAME_STATES.PLAYING && gameState !== GAME_STATES.SPEEDRUN) return;
  
  // No need to update camera position as it's attached to the player
  // Just apply damping to rotation velocity for smoother movement
  rotationVelocity.x *= 0.9; // Damping
  rotationVelocity.y *= 0.9; // Damping
  
  // Apply rotation velocity to player directly
  player.rotation.x += rotationVelocity.x * 0.3;
  player.rotation.y += rotationVelocity.y * 0.3;
  
  // Limit vertical rotation (prevent flipping)
  player.rotation.x = Math.max(-0.3, Math.min(0.3, player.rotation.x));
}

// Update game objects
function updateGameObjects(deltaTime) {
  // Animate keys with enhanced effects
  for (const key of keys) {
    key.rotation.y += key.userData.rotationSpeed;
    
    // Hover effect
    const hoverOffset = key.userData.hoverOffset;
    const newY = key.userData.originalY + Math.sin(Date.now() * key.userData.hoverSpeed + hoverOffset) * key.userData.hoverRange;
    key.position.y = newY;
    
    // Pulse glow effect
    if (key.userData.glowMesh) {
      const glowPulse = 0.8 + Math.sin(Date.now() * 0.001 * key.userData.pulseSpeed) * 0.2;
      key.userData.glowMesh.scale.set(glowPulse, glowPulse, glowPulse);
    }
    
    // Update sparkle system
    if (key.userData.sparkleSystem && key.userData.sparkleSystem.update) {
      key.userData.sparkleSystem.update(Date.now() * 0.001);
    }
  }
  
  // Animate loved one if present
  if (lovedOne && gameState !== GAME_STATES.ENDING) {
    lovedOne.rotation.y += 0.01;
    lovedOne.position.y = 20 + Math.sin(Date.now() * 0.001) * 0.5;
  }
  
  // Slightly rotate skybox
  if (skybox) {
    skybox.rotation.y += 0.0001;
  }
}

// Start the ending sequence
function startEnding() {
  gameState = GAME_STATES.ENDING;
  
  // Start the background music
  const music = initAudio();
  music.play();
  
  // Create a separate camera for the ending sequence
  const endingCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  scene.add(endingCamera);
  
  // Remove camera from player
  player.remove(camera);
  
  // Use the ending camera for rendering
  camera = endingCamera;
  
  // Add romantic lighting for the ending sequence
  const romanticLight1 = new THREE.PointLight(0xff6699, 2, 50);
  romanticLight1.position.set(10, 10, 0);
  scene.add(romanticLight1);
  
  const romanticLight2 = new THREE.PointLight(0x9966ff, 2, 50);
  romanticLight2.position.set(-10, 5, 10);
  scene.add(romanticLight2);

  // Create and add the bouquet
  const bouquet = createFlowerBouquet();
  bouquet.position.copy(lovedOne.position);
  bouquet.position.y -= 2;
  scene.add(bouquet);

  // Create romantic messages
  const messages = [
    "Happy Birthday!",
    "You're Amazing!",
    "Forever Together!",
    "Love You!"
  ];
  
  const messageSprites = messages.map((text, index) => {
    const position = new THREE.Vector3(
      lovedOne.position.x + (Math.random() - 0.5) * 20,
      lovedOne.position.y + 5 + index * 3,
      lovedOne.position.z + (Math.random() - 0.5) * 20
    );
    return createFloatingMessage(text, position);
  });
  
  messageSprites.forEach(sprite => scene.add(sprite));

  // Create a heart-shaped path for the player to follow
  const heartPathPoints = [];
  const heartSize = 20;
  const heartSegments = 50;
  
  for (let i = 0; i < heartSegments; i++) {
    const t = i / (heartSegments - 1);
    const angle = t * Math.PI * 2;
    
    // Parametric heart curve
    let x, y;
    if (t <= 0.5) {
      // Top part of heart (two arcs)
      const adjustedT = t * 2; // Scale t to [0, 1] for this segment
      const arcAngle = adjustedT * Math.PI;
      
      if (adjustedT <= 0.5) {
        // Left arc
        x = -Math.cos(arcAngle) * heartSize * 0.5;
        y = Math.sin(arcAngle) * heartSize * 0.5 + heartSize * 0.25;
      } else {
        // Right arc
        x = Math.cos(Math.PI - arcAngle) * heartSize * 0.5;
        y = Math.sin(Math.PI - arcAngle) * heartSize * 0.5 + heartSize * 0.25;
      }
    } else {
      // Bottom part of heart (V shape)
      const adjustedT = (t - 0.5) * 2; // Scale t to [0, 1] for this segment
      x = (0.5 - adjustedT) * heartSize;
      y = (0.5 - Math.abs(adjustedT - 0.5)) * heartSize * 1.5 - heartSize * 0.5;
    }
    
    // Position the heart path between player and loved one
    const midPoint = new THREE.Vector3().addVectors(
      player.position.clone(),
      lovedOne.position.clone()
    ).multiplyScalar(0.5);
    
    const z = midPoint.z + (lovedOne.position.z - midPoint.z) * t;
    
    heartPathPoints.push(new THREE.Vector3(
      midPoint.x + x,
      midPoint.y + y,
      z
    ));
  }
  
  // Create a visible path with heart particles
  const pathParticles = [];
  for (let i = 0; i < heartPathPoints.length; i += 2) { // Use every other point for particles
    const heartGeometry = createHeartShape();
    const heartMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(i / heartPathPoints.length, 0.8, 0.7), // Rainbow colors
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    
    const heart = new THREE.Mesh(heartGeometry, heartMaterial);
    heart.position.copy(heartPathPoints[i]);
    heart.scale.set(0.2, 0.2, 0.2);
    heart.lookAt(heartPathPoints[Math.min(i + 1, heartPathPoints.length - 1)]);
    
    scene.add(heart);
    pathParticles.push(heart);
  }
  
  // Enable auto-pilot to fly to loved one along the heart path
  let pathIndex = 0;
  const pathSpeed = 0.5; // Speed along the path
  
  // Create update function for ending
  let endingTime = 0;
  let heartCreationInterval = 0.1; // Time between heart creation (more frequent)
  let timeSinceLastHeart = 0;
  
  updateEndingFunction = (deltaTime) => {
    endingTime += deltaTime;
    timeSinceLastHeart += deltaTime;
    
    // Update romantic lights
    romanticLight1.position.x = 10 * Math.cos(endingTime * 0.5);
    romanticLight1.position.z = 10 * Math.sin(endingTime * 0.5);
    romanticLight1.intensity = 2 + Math.sin(endingTime * 2) * 0.5;
    
    romanticLight2.position.x = -10 * Math.cos(endingTime * 0.7);
    romanticLight2.position.z = 10 * Math.sin(endingTime * 0.7);
    romanticLight2.intensity = 2 + Math.sin(endingTime * 2 + Math.PI) * 0.5;
    
    // Animate path particles
    pathParticles.forEach((heart, i) => {
      heart.rotation.y = endingTime * 2;
      heart.scale.setScalar(0.2 + 0.05 * Math.sin(endingTime * 3 + i * 0.2));
      heart.material.opacity = 0.6 + 0.4 * Math.sin(endingTime * 2 + i * 0.3);
    });
    
    // Move player along the heart path
    pathIndex += pathSpeed * deltaTime;
    if (pathIndex >= heartPathPoints.length - 1) {
      pathIndex = heartPathPoints.length - 1;
    }
    
    // Get current and next points
    const currentIndex = Math.floor(pathIndex);
    const nextIndex = Math.min(currentIndex + 1, heartPathPoints.length - 1);
    const t = pathIndex - currentIndex; // Interpolation factor
    
    // Interpolate position
    const currentPoint = heartPathPoints[currentIndex];
    const nextPoint = heartPathPoints[nextIndex];
    
    player.position.lerpVectors(currentPoint, nextPoint, t);
    
    // Look at loved one
    const lookDirection = new THREE.Vector3().subVectors(lovedOne.position, player.position).normalize();
    const targetRotation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      lookDirection
    );
    player.quaternion.slerp(targetRotation, 0.05);
    
    // Create hearts
    if (timeSinceLastHeart > heartCreationInterval) {
      createHeartParticle();
      timeSinceLastHeart = 0;
      
      // Also create some sparkles
      for (let i = 0; i < 3; i++) {
        createSparkleParticle();
      }
    }
    
    // Update camera to look at both player and loved one
    const midPoint = new THREE.Vector3()
      .addVectors(player.position, lovedOne.position)
      .multiplyScalar(0.5);
    
    // Circular camera movement around the reunion
    const cameraRadius = 30 - Math.min(20, endingTime * 2); // Camera gradually moves closer
    const cameraHeight = 10 + 5 * Math.sin(endingTime * 0.5); // Camera moves up and down
    const cameraAngle = endingTime * 0.2;
    
    camera.position.set(
      midPoint.x + Math.sin(cameraAngle) * cameraRadius,
      midPoint.y + cameraHeight,
      midPoint.z + Math.cos(cameraAngle) * cameraRadius
    );
    
    camera.lookAt(midPoint);
    
    // Show ending screen when close enough
    const distanceToLoved = player.position.distanceTo(lovedOne.position);
    if (distanceToLoved < 5) {
      // Create a heart explosion
      createHeartExplosion(midPoint, 100);
      
      // Show ending screen
      document.getElementById('end-screen').style.display = 'flex';
      updateEndingFunction = null; // Stop updating
    }

    // Animate the bouquet
    if (bouquet) {
      bouquet.rotation.y = endingTime * 0.5;
      bouquet.position.y = lovedOne.position.y - 2 + Math.sin(endingTime) * 0.3;
      
      bouquet.children.forEach((flower, i) => {
        if (flower.isMesh) {
          flower.rotation.z = Math.sin(endingTime * 2 + i) * 0.1;
        }
      });
    }

    // Animate the messages
    messageSprites.forEach((sprite, i) => {
      const delay = i * 0.5;
      if (endingTime > delay) {
        // Fade in with sparkle effect
        sprite.material.opacity = Math.min(1, (endingTime - delay));
        
        // Smooth floating motion
        sprite.position.y = sprite.userData.originalY + 
          Math.sin(endingTime * sprite.userData.hoverSpeed) * sprite.userData.hoverRange;
        
        // Gentle rotation
        sprite.rotation.z = Math.sin(endingTime * sprite.userData.rotationSpeed) * 0.1;
        
        // Update sparkle effect
        sprite.userData.sparkleTime += deltaTime;
        if (sprite.userData.sparkleTime > 0.1) { // Update sparkles every 0.1 seconds
          const canvas = sprite.material.map.image;
          const context = canvas.getContext('2d');
          
          // Clear previous sparkles
          context.clearRect(0, 0, canvas.width, canvas.height);
          
          // Redraw the text
          const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
          gradient.addColorStop(0, '#ff69b4');
          gradient.addColorStop(0.5, '#ffd700');
          gradient.addColorStop(1, '#ff69b4');
          
          context.shadowColor = '#ff69b4';
          context.shadowBlur = 25;
          context.shadowOffsetX = 0;
          context.shadowOffsetY = 0;
          
          context.fillStyle = gradient;
          context.font = 'bold 72px "Arial", sans-serif';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          
          context.strokeStyle = '#ffffff';
          context.lineWidth = 4;
          context.strokeText(sprite.userData.text, canvas.width / 2, canvas.height / 2);
          context.fillText(sprite.userData.text, canvas.width / 2, canvas.height / 2);
          
          // Add new sparkles
          for (let i = 0; i < 20; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const radius = Math.random() * 2 + 1;
            
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fillStyle = '#ffffff';
            context.fill();
          }
          
          sprite.material.map.needsUpdate = true;
          sprite.userData.sparkleTime = 0;
        }
      }
    });
  };
}

// Create sparkle particles for the ending sequence
function createSparkleParticle() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(3);
  
  // Position between player and loved one
  const midPoint = new THREE.Vector3(
    (player.position.x + lovedOne.position.x) / 2,
    (player.position.y + lovedOne.position.y) / 2,
    (player.position.z + lovedOne.position.z) / 2
  );
  
  midPoint.x += (Math.random() - 0.5) * 10;
  midPoint.y += (Math.random() - 0.5) * 10;
  midPoint.z += (Math.random() - 0.5) * 10;
  
  positions[0] = midPoint.x;
  positions[1] = midPoint.y;
  positions[2] = midPoint.z;
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  // Create a colorful sparkle
  const hue = Math.random();
  const color = new THREE.Color().setHSL(hue, 0.9, 0.7);
  
  const material = new THREE.PointsMaterial({
    size: 0.5 + Math.random() * 1.0,
    map: createSparkleTexture(),
    transparent: true,
    opacity: 1.0,
    color: color,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  
  const sparkle = new THREE.Points(geometry, material);
  
  // Add movement properties
  sparkle.userData = {
    type: 'sparkle',
    life: 1.0,
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.3 + 0.1,
      (Math.random() - 0.5) * 0.3
    ),
    size: material.size
  };
  
  scene.add(sparkle);
  particles.push(sparkle);
}

// Create a heart explosion for the finale
function createHeartExplosion(position, count) {
  for (let i = 0; i < count; i++) {
    // Create heart geometry
    const heartGeometry = createHeartShape();
    
    // Create heart material with rainbow colors
    const hue = i / count;
    const color = new THREE.Color().setHSL(hue, 0.8, 0.7);
    
    const heartMaterial = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      emissive: color,
      emissiveIntensity: 0.5
    });
    
    const heart = new THREE.Mesh(heartGeometry, heartMaterial);
    
    // Set position at explosion center
    heart.position.copy(position);
    
    // Random rotation
    heart.rotation.x = Math.random() * Math.PI * 2;
    heart.rotation.y = Math.random() * Math.PI * 2;
    heart.rotation.z = Math.random() * Math.PI * 2;
    
    // Random scale
    const scale = 0.1 + Math.random() * 0.3;
    heart.scale.set(scale, scale, scale);
    
    // Add explosion velocity (outward from center)
    const direction = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();
    
    const speed = 2 + Math.random() * 8;
    
    // Add movement properties
    heart.userData = {
      type: 'explosion',
      life: 3.0, // Longer life for explosion hearts
      velocity: direction.multiplyScalar(speed),
      rotationSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      )
    };
    
    scene.add(heart);
    particles.push(heart);
  }
  
  // Also add a bright flash
  const flashLight = new THREE.PointLight(0xffffff, 10, 50);
  flashLight.position.copy(position);
  scene.add(flashLight);
  
  // Fade out the flash
  const fadeFlash = () => {
    flashLight.intensity -= 0.5;
    if (flashLight.intensity > 0) {
      requestAnimationFrame(fadeFlash);
    } else {
      scene.remove(flashLight);
    }
  };
  
  fadeFlash();
}

// Main update function based on game state
function update(deltaTime) {
  // Update window.gameState value to reflect current gameState
  window.gameState = gameState;
  
  if (gameState === GAME_STATES.PLAYING) {
    // Update game objects
    updateParticles(deltaTime);
    updatePlayerMovement(deltaTime);
    updateCamera();
    updateGameObjects(deltaTime);
    checkCollisions();
    
    // Update navigation
    updateNavigationTarget();
    updateMinimap();
    updateCompass();
    updateDirectionMarkers();
  } else if (gameState === GAME_STATES.SPEEDRUN) {
    // Update speed run mechanics
    updateParticles(deltaTime);
    updatePlayerMovement(deltaTime);
    updateCamera();
    updateGameObjects(deltaTime);
    
    // Use SpeedRunSystem to update speed run
    if (window.SpeedRunSystem) {
      window.SpeedRunSystem.updateSpeedRun(deltaTime);
    }
  } else if (gameState === GAME_STATES.ENDING && updateEndingFunction) {
    updateEndingFunction(deltaTime);
  }
}

// Animation loop
function animate(currentTime) {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();
  
  // Update skybox time uniform
  if (skybox && skybox.userData && skybox.userData.updateTime) {
    skybox.userData.updateTime(time);
  }
  
  // Update star layers rotation
  scene.children.forEach(child => {
    if (child instanceof THREE.Points && child.userData && child.userData.rotationSpeed !== undefined) {
      child.rotation.y += child.userData.rotationSpeed;
    }
  });
  
  // Update nebulae
  if (window.nebulae) {
    window.nebulae.forEach(nebula => {
      if (nebula && nebula.userData) {
        nebula.rotation.x += nebula.userData.rotationSpeed || 0.001;
        nebula.rotation.y += (nebula.userData.rotationSpeed || 0.001) * 0.7;
        nebula.rotation.z += (nebula.userData.rotationSpeed || 0.001) * 0.5;
        
        // Pulse size effect
        const pulseSpeed = nebula.userData.pulseSpeed || 0.5;
        const pulseAmount = nebula.userData.pulseAmount || 0.05;
        const pulse = Math.sin(time * pulseSpeed) * pulseAmount;
        nebula.scale.set(1 + pulse, 1 + pulse, 1 + pulse);
      }
    });
  }
  
  // Update islands hover and rotation effects
  if (islands && islands.length > 0) {
    islands.forEach(island => {
      if (island && island.userData && island.userData.originalY !== undefined) {
        // Gentle hover effect
        island.position.y = island.userData.originalY + 
          Math.sin(time * (island.userData.hoverSpeed || 0.5) + (island.userData.hoverOffset || 0)) * 
          (island.userData.hoverRange || 0.5);
        
        // Very slight rotation for floating effect
        island.rotation.y += (island.userData.rotationSpeed || 0.001);
      }
    });
  }
  
  // Update player animations
  if (player && player.animate) {
    player.animate(time);
  }
  
  // Update shield effect if active
  if (playerShielded && player.userData.shield && player.userData.shield.update) {
    player.userData.shield.update(delta);
  }
  
  // Update loved one animations
  if (lovedOne && lovedOne.animate) {
    lovedOne.animate(time);
  }
  
  // Update ambient lights
  if (scene && scene.userData && scene.userData.ambientLights) {
    scene.userData.ambientLights.forEach(light => {
      if (light && light.userData) {
        // Hover effect
        light.position.y = light.userData.originalY + 
          Math.sin(time * light.userData.hoverSpeed) * light.userData.hoverRange;
        
        // Pulse intensity
        light.intensity = light.userData.originalIntensity + 
          Math.sin(time * light.userData.pulseSpeed) * 0.3;
      }
    });
  }
  
  // Update player light to follow player
  if (scene && scene.userData && scene.userData.playerLight && player) {
    const playerLight = scene.userData.playerLight;
    playerLight.position.copy(player.position);
    
    // Pulse the player light
    playerLight.intensity = 1 + Math.sin(time * 2) * 0.3;
    
    // Cycle through colors
    const hue = (time * 0.05) % 1;
    const playerLightColor = new THREE.Color().setHSL(hue, 0.7, 0.7);
    playerLight.color.copy(playerLightColor);
  }
  
  // Update particles
  updateParticles(delta);
  
  // Update game
  update(delta);
  
  // Add post-processing bloom effect for more vibrant colors
  if (renderer) {
    // Render scene
    renderer.render(scene, camera);
  }
}

// Update trail effects behind the player
function updateTrail() {
  if (!player) return;
  
  // Get trail positions and shift them
  const trail = player.children.find(child => child instanceof THREE.Points);
  if (!trail) return;
  
  const positions = trail.geometry.attributes.position.array;
  const colors = trail.geometry.attributes.color ? trail.geometry.attributes.color.array : null;
  
  // If colors attribute doesn't exist, create it
  if (!colors) {
    const colorArray = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      // Initialize with rainbow gradient colors
      colorArray[i] = 0.8 + Math.random() * 0.2; // R
      colorArray[i + 1] = 0.6 + Math.random() * 0.4; // G
      colorArray[i + 2] = 0.9 + Math.random() * 0.1; // B
    }
    trail.geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  }
  
  // Shift all particles back
  for (let i = positions.length - 3; i >= 3; i -= 3) {
    positions[i] = positions[i - 3];
    positions[i + 1] = positions[i - 2];
    positions[i + 2] = positions[i - 1];
    
    // Also shift colors if they exist
    if (trail.geometry.attributes.color) {
      const colors = trail.geometry.attributes.color.array;
      colors[i] = colors[i - 3];
      colors[i + 1] = colors[i - 2];
      colors[i + 2] = colors[i - 1];
    }
  }
  
  // Add new position at the front
  positions[0] = 0;
  positions[1] = 0;
  positions[2] = -2;
  
  // Add new color at the front based on trail type
  if (trail.geometry.attributes.color) {
    const colors = trail.geometry.attributes.color.array;
    const time = Date.now() * 0.001;
    
    if (playerTrailColor === 'rainbow') {
      // Rainbow trail - vibrant cycling colors
      const hue = (time * 0.2) % 1; // Cycle through hues
      const color = new THREE.Color().setHSL(hue, 1.0, 0.5);
      colors[0] = color.r;
      colors[1] = color.g;
      colors[2] = color.b;
    } else {
      // Default trail - pastel colors
      colors[0] = 0.7 + 0.3 * Math.sin(time * 1.1); // R
      colors[1] = 0.7 + 0.3 * Math.sin(time * 0.5 + 2); // G
      colors[2] = 0.7 + 0.3 * Math.sin(time * 0.7 + 4); // B
    }
  }
  
  // Small random variation for sparkle effect
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += (Math.random() - 0.5) * 0.1;
    positions[i + 1] += (Math.random() - 0.5) * 0.1;
    positions[i + 2] += (Math.random() - 0.5) * 0.1;
  }
  
  // Update the geometry
  trail.geometry.attributes.position.needsUpdate = true;
  if (trail.geometry.attributes.color) {
    trail.geometry.attributes.color.needsUpdate = true;
  }
}

// Create small heart particles that follow the player
function createSmallHeartParticle(position) {
  // Create heart geometry
  const heartGeometry = createHeartShape();
  
  // Create heart material with random pastel color
  const hue = Math.random() * 60 + 300; // Range from pink to purple
  const color = new THREE.Color().setHSL(hue / 360, 0.8, 0.7);
  
  const heartMaterial = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
    emissive: color,
    emissiveIntensity: 0.5
  });
  
  const heart = new THREE.Mesh(heartGeometry, heartMaterial);
  
  // Set position slightly behind player
  heart.position.copy(position);
  heart.position.z += 2 + Math.random() * 2;
  heart.position.x += (Math.random() - 0.5) * 2;
  heart.position.y += (Math.random() - 0.5) * 2;
  
  // Random rotation
  heart.rotation.x = Math.random() * Math.PI * 2;
  heart.rotation.y = Math.random() * Math.PI * 2;
  heart.rotation.z = Math.random() * Math.PI * 2;
  
  // Random scale (smaller than the reunion hearts)
  const scale = 0.1 + Math.random() * 0.2;
  heart.scale.set(scale, scale, scale);
  
  // Add movement properties
  heart.userData = {
    type: 'smallHeart',
    life: 1.0,
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.1 + 0.05, // Slight upward bias
      (Math.random() - 0.5) * 0.1
    ),
    rotationSpeed: new THREE.Vector3(
      (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.1
    )
  };
  
  scene.add(heart);
  particles.push(heart);
}

// Setup navigation system
function setupNavigation() {
  // Create minimap container with enhanced styling
  const minimapContainer = document.createElement('div');
  minimapContainer.id = 'minimap-container';
  minimapContainer.style.position = 'fixed';
  minimapContainer.style.top = '20px';
  minimapContainer.style.right = '20px';
  minimapContainer.style.width = `${NAVIGATION.MINIMAP_SIZE}px`;
  minimapContainer.style.height = `${NAVIGATION.MINIMAP_SIZE}px`;
  minimapContainer.style.backgroundColor = NAVIGATION.MINIMAP_BACKGROUND;
  minimapContainer.style.borderRadius = '50%';
  minimapContainer.style.zIndex = '100';
  minimapContainer.style.border = NAVIGATION.MINIMAP_BORDER;
  minimapContainer.style.overflow = 'hidden';
  minimapContainer.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.3)'; // Cyan glow
  document.body.appendChild(minimapContainer);
  
  // Create canvas for minimap
  minimapCanvas = document.createElement('canvas');
  minimapCanvas.id = 'minimap';
  minimapCanvas.width = NAVIGATION.MINIMAP_SIZE;
  minimapCanvas.height = NAVIGATION.MINIMAP_SIZE;
  minimapCanvas.style.width = '100%';
  minimapCanvas.style.height = '100%';
  minimapContainer.appendChild(minimapCanvas);
  minimapCtx = minimapCanvas.getContext('2d');
  
  // Create circular clip path for minimap
  minimapCtx.beginPath();
  minimapCtx.arc(NAVIGATION.MINIMAP_SIZE / 2, NAVIGATION.MINIMAP_SIZE / 2, NAVIGATION.MINIMAP_SIZE / 2 - 2, 0, Math.PI * 2);
  minimapCtx.clip();
  
  // Add minimap zoom controls
  const zoomControls = document.createElement('div');
  zoomControls.style.position = 'absolute';
  zoomControls.style.bottom = '5px';
  zoomControls.style.right = '5px';
  zoomControls.style.display = 'flex';
  zoomControls.style.flexDirection = 'column';
  zoomControls.style.gap = '5px';
  minimapContainer.appendChild(zoomControls);
  
  // Zoom in button
  const zoomInBtn = document.createElement('button');
  zoomInBtn.innerHTML = '+';
  zoomInBtn.style.width = '20px';
  zoomInBtn.style.height = '20px';
  zoomInBtn.style.borderRadius = '50%';
  zoomInBtn.style.border = 'none';
  zoomInBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
  zoomInBtn.style.cursor = 'pointer';
  zoomInBtn.style.fontSize = '12px';
  zoomInBtn.style.fontWeight = 'bold';
  zoomInBtn.style.display = 'flex';
  zoomInBtn.style.justifyContent = 'center';
  zoomInBtn.style.alignItems = 'center';
  zoomInBtn.onclick = () => {
    NAVIGATION.MINIMAP_ZOOM *= 1.5;
    NAVIGATION.MINIMAP_ZOOM = Math.min(NAVIGATION.MINIMAP_ZOOM, 0.2); // Cap max zoom
  };
  zoomControls.appendChild(zoomInBtn);
  
  // Zoom out button
  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.innerHTML = '-';
  zoomOutBtn.style.width = '20px';
  zoomOutBtn.style.height = '20px';
  zoomOutBtn.style.borderRadius = '50%';
  zoomOutBtn.style.border = 'none';
  zoomOutBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
  zoomOutBtn.style.cursor = 'pointer';
  zoomOutBtn.style.fontSize = '12px';
  zoomOutBtn.style.fontWeight = 'bold';
  zoomOutBtn.style.display = 'flex';
  zoomOutBtn.style.justifyContent = 'center';
  zoomOutBtn.style.alignItems = 'center';
  zoomOutBtn.onclick = () => {
    NAVIGATION.MINIMAP_ZOOM /= 1.5;
    NAVIGATION.MINIMAP_ZOOM = Math.max(NAVIGATION.MINIMAP_ZOOM, 0.01); // Cap min zoom
  };
  zoomControls.appendChild(zoomOutBtn);
  
  // Create navigation settings panel
  const navSettingsBtn = document.createElement('button');
  navSettingsBtn.innerHTML = '⚙️';
  navSettingsBtn.style.position = 'absolute';
  navSettingsBtn.style.top = '5px';
  navSettingsBtn.style.right = '5px';
  navSettingsBtn.style.width = '24px';
  navSettingsBtn.style.height = '24px';
  navSettingsBtn.style.borderRadius = '50%';
  navSettingsBtn.style.border = 'none';
  navSettingsBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
  navSettingsBtn.style.cursor = 'pointer';
  navSettingsBtn.style.fontSize = '14px';
  navSettingsBtn.style.display = 'flex';
  navSettingsBtn.style.justifyContent = 'center';
  navSettingsBtn.style.alignItems = 'center';
  minimapContainer.appendChild(navSettingsBtn);
  
  // Create settings panel (hidden by default)
  const settingsPanel = document.createElement('div');
  settingsPanel.id = 'nav-settings-panel';
  settingsPanel.style.position = 'fixed';
  settingsPanel.style.top = `${NAVIGATION.MINIMAP_SIZE + 30}px`;
  settingsPanel.style.right = '20px';
  settingsPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  settingsPanel.style.borderRadius = '10px';
  settingsPanel.style.padding = '10px';
  settingsPanel.style.zIndex = '101';
  settingsPanel.style.display = 'none';
  settingsPanel.style.flexDirection = 'column';
  settingsPanel.style.gap = '5px';
  document.body.appendChild(settingsPanel);
  
  // Toggle settings panel
  navSettingsBtn.onclick = () => {
    settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'flex' : 'none';
  };
  
  // Create toggle options
  const createToggle = (label, property) => {
    const toggleContainer = document.createElement('div');
    toggleContainer.style.display = 'flex';
    toggleContainer.style.alignItems = 'center';
    toggleContainer.style.gap = '10px';
    
    const toggleLabel = document.createElement('label');
    toggleLabel.textContent = label;
    toggleLabel.style.color = 'white';
    toggleLabel.style.fontSize = '12px';
    toggleContainer.appendChild(toggleLabel);
    
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = NAVIGATION[property];
    toggleInput.onchange = () => {
      NAVIGATION[property] = toggleInput.checked;
    };
    toggleContainer.appendChild(toggleInput);
    
    return toggleContainer;
  };
  
  // Add toggle options
  settingsPanel.appendChild(createToggle('Show Compass', 'COMPASS_ENABLED'));
  settingsPanel.appendChild(createToggle('Show Direction Markers', 'DIRECTION_MARKERS_ENABLED'));
  settingsPanel.appendChild(createToggle('Show Waypoint Path', 'WAYPOINT_PATH_ENABLED'));
  settingsPanel.appendChild(createToggle('Show Distance', 'DISTANCE_INDICATORS_ENABLED'));
  settingsPanel.appendChild(createToggle('Rotate Minimap', 'MINIMAP_ROTATION_ENABLED'));
  settingsPanel.appendChild(createToggle('Show Altitude', 'ALTITUDE_INDICATOR_ENABLED'));
  
  // Create compass indicator
  if (NAVIGATION.COMPASS_ENABLED) {
    compassElement = document.createElement('div');
    compassElement.id = 'compass';
    compassElement.style.position = 'fixed';
    compassElement.style.top = '20px';
    compassElement.style.left = '50%';
    compassElement.style.transform = 'translateX(-50%)';
    compassElement.style.width = '250px';  // Increased width
    compassElement.style.textAlign = 'center';
    compassElement.style.color = NAVIGATION.COMPASS_TEXT_COLOR;
    compassElement.style.fontFamily = '"Arial Black", Gadget, sans-serif';  // Bolder font
    compassElement.style.fontSize = '18px';  // Larger text
    compassElement.style.backgroundColor = NAVIGATION.COMPASS_BACKGROUND;
    compassElement.style.borderRadius = '15px';
    compassElement.style.padding = '8px 15px';
    compassElement.style.zIndex = '100';
    compassElement.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.2)';  // Cyan glow
    compassElement.style.border = '2px solid rgba(0, 255, 255, 0.3)';    // Cyan border
    compassElement.style.textShadow = '0 0 5px rgba(0, 255, 255, 0.5)';  // Text glow
    document.body.appendChild(compassElement);
  }
  
  // Create direction markers container
  if (NAVIGATION.DIRECTION_MARKERS_ENABLED) {
    navMarkersContainer = document.createElement('div');
    navMarkersContainer.id = 'nav-markers';
    navMarkersContainer.style.position = 'fixed';
    navMarkersContainer.style.top = '0';
    navMarkersContainer.style.left = '0';
    navMarkersContainer.style.width = '100%';
    navMarkersContainer.style.height = '100%';
    navMarkersContainer.style.pointerEvents = 'none';
    navMarkersContainer.style.zIndex = '90';
    document.body.appendChild(navMarkersContainer);
  }
  
  // Set initial target (first key)
  updateNavigationTarget();
}

// Update navigation target based on game progress
function updateNavigationTarget() {
  if (keys.length > 0 && keysCollected < keysRequired) {
    // Find uncollected keys - pick the closest one
    const uncollectedKeys = keys.filter(key => !key.collected);
    if (uncollectedKeys.length > 0) {
      // Find the closest key
      let closestKey = uncollectedKeys[0];
      let closestDistance = player.position.distanceTo(closestKey.position);
      
      for (let i = 1; i < uncollectedKeys.length; i++) {
        const distance = player.position.distanceTo(uncollectedKeys[i].position);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestKey = uncollectedKeys[i];
        }
      }
      
      currentTarget = closestKey;
    }
  } else if (keysCollected >= keysRequired && lovedOne) {
    // Target loved one once all keys are collected
    currentTarget = lovedOne;
  } else {
    currentTarget = null;
  }
}

// Update minimap
function updateMinimap() {
  if (!minimapCtx || gameState !== GAME_STATES.PLAYING) return;
  
  const width = minimapCanvas.width;
  const height = minimapCanvas.height;
  
  // Clear the canvas with a radial gradient background
  const gradient = minimapCtx.createRadialGradient(
    width/2, height/2, 0,
    width/2, height/2, width/2
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
  
  minimapCtx.fillStyle = gradient;
  minimapCtx.fillRect(0, 0, width, height);
  
  // Add a subtle grid pattern
  minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  minimapCtx.lineWidth = 1;
  const gridSize = 20;
  
  for (let i = 0; i < width; i += gridSize) {
    minimapCtx.beginPath();
    minimapCtx.moveTo(i, 0);
    minimapCtx.lineTo(i, height);
    minimapCtx.stroke();
  }
  
  for (let i = 0; i < height; i += gridSize) {
    minimapCtx.beginPath();
    minimapCtx.moveTo(0, i);
    minimapCtx.lineTo(width, i);
    minimapCtx.stroke();
  }
  
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Draw player with improved visibility
  minimapCtx.fillStyle = NAVIGATION.PLAYER_MARKER_COLOR;
  minimapCtx.beginPath();
  minimapCtx.arc(centerX, centerY, NAVIGATION.MARKER_SIZE, 0, Math.PI * 2);
  minimapCtx.fill();
  
  // Add glow effect to player marker
  minimapCtx.shadowBlur = 10;
  minimapCtx.shadowColor = NAVIGATION.PLAYER_MARKER_COLOR;
  
  // Draw player direction with arrow
  const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
  minimapCtx.strokeStyle = NAVIGATION.PLAYER_MARKER_COLOR;
  minimapCtx.lineWidth = 3;
  minimapCtx.beginPath();
  minimapCtx.moveTo(centerX, centerY);
  minimapCtx.lineTo(
    centerX + forwardVector.x * NAVIGATION.MARKER_SIZE * 2,
    centerY + forwardVector.z * NAVIGATION.MARKER_SIZE * 2
  );
  minimapCtx.stroke();
  
  // Reset shadow for other elements
  minimapCtx.shadowBlur = 0;
  
  // Draw islands with improved visibility
  islands.forEach(island => {
    const relativePosition = island.position.clone().sub(player.position);
    const islandX = centerX + relativePosition.x * NAVIGATION.MINIMAP_ZOOM;
    const islandY = centerY + relativePosition.z * NAVIGATION.MINIMAP_ZOOM;
    
    if (isInMinimapBounds(islandX, islandY)) {
      minimapCtx.fillStyle = NAVIGATION.ISLAND_MARKER_COLOR;
      minimapCtx.beginPath();
      minimapCtx.arc(islandX, islandY, NAVIGATION.MARKER_SIZE / 2, 0, Math.PI * 2);
      minimapCtx.fill();
    }
  });
  
  // Draw keys with improved visibility and effects
  keys.forEach(key => {
    if (!key.collected) {
      const relativePosition = key.position.clone().sub(player.position);
      const keyX = centerX + relativePosition.x * NAVIGATION.MINIMAP_ZOOM;
      const keyY = centerY + relativePosition.z * NAVIGATION.MINIMAP_ZOOM;
      
      if (isInMinimapBounds(keyX, keyY)) {
        // Add glow effect for keys
        minimapCtx.shadowBlur = 8;
        minimapCtx.shadowColor = NAVIGATION.KEY_MARKER_COLOR;
        
        minimapCtx.fillStyle = NAVIGATION.KEY_MARKER_COLOR;
        minimapCtx.beginPath();
        minimapCtx.arc(keyX, keyY, NAVIGATION.MARKER_SIZE / 1.5, 0, Math.PI * 2);
        minimapCtx.fill();
        
        minimapCtx.shadowBlur = 0;
      }
    }
  });
  
  // Draw loved one with special effects
  if (lovedOne && keysCollected >= keysRequired) {
    const relativePosition = lovedOne.position.clone().sub(player.position);
    const lovedOneX = centerX + relativePosition.x * NAVIGATION.MINIMAP_ZOOM;
    const lovedOneY = centerY + relativePosition.z * NAVIGATION.MINIMAP_ZOOM;
    
    if (isInMinimapBounds(lovedOneX, lovedOneY)) {
      // Add special glow effect for loved one
      minimapCtx.shadowBlur = 12;
      minimapCtx.shadowColor = NAVIGATION.LOVED_ONE_MARKER_COLOR;
      
      minimapCtx.fillStyle = NAVIGATION.LOVED_ONE_MARKER_COLOR;
      minimapCtx.beginPath();
      minimapCtx.arc(lovedOneX, lovedOneY, NAVIGATION.MARKER_SIZE, 0, Math.PI * 2);
      minimapCtx.fill();
      
      minimapCtx.shadowBlur = 0;
    }
  }
  
  // Add outer glow to the minimap border
  minimapCtx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
  minimapCtx.lineWidth = 4;
  minimapCtx.beginPath();
  minimapCtx.arc(width/2, height/2, width/2 - 4, 0, Math.PI * 2);
  minimapCtx.stroke();
  
  // Add inner border
  minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  minimapCtx.lineWidth = 2;
  minimapCtx.beginPath();
  minimapCtx.arc(width/2, height/2, width/2 - 6, 0, Math.PI * 2);
  minimapCtx.stroke();
}

// Update compass direction
function updateCompass() {
  if (!compassElement || gameState !== GAME_STATES.PLAYING) return;
  
  // Get player's forward direction
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
  
  // Calculate angle in degrees (0 = North, 90 = East, etc.)
  let angle = Math.atan2(forward.x, forward.z) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  
  // Format angle to always show 3 digits with leading zeros
  const formattedAngle = angle.toFixed(0).padStart(3, '0');
  
  // Get cardinal direction
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(angle / 45) % 8;
  
  // Create compass display with colored cardinal direction
  const direction = directions[index];
  const compassText = `${formattedAngle}° <span style="color: ${NAVIGATION.COMPASS_HIGHLIGHT_COLOR}; font-weight: bold">${direction}</span>`;
  
  // Update compass UI with HTML content
  compassElement.innerHTML = compassText;
}

// Update direction markers
function updateDirectionMarkers() {
  if (!navMarkersContainer || !NAVIGATION.DIRECTION_MARKERS_ENABLED || gameState !== GAME_STATES.PLAYING) return;
  
  // Remove existing markers
  while (navMarkersContainer.firstChild) {
    navMarkersContainer.removeChild(navMarkersContainer.firstChild);
  }
  
  // If no current target, don't show direction markers
  if (!currentTarget) return;
  
  // Calculate direction to target
  const targetDirection = currentTarget.position.clone().sub(player.position).normalize();
  
  // Project target onto camera view
  const widthHalf = window.innerWidth / 2;
  const heightHalf = window.innerHeight / 2;
  
  // Create a copy of the target position
  const targetVector = currentTarget.position.clone();
  
  // Project the target into screen space
  targetVector.project(camera);
  
  // Convert to screen coordinates
  const x = (targetVector.x * widthHalf) + widthHalf;
  const y = -(targetVector.y * heightHalf) + heightHalf;
  
  // Calculate vertical difference for altitude indicator
  const verticalDifference = currentTarget.position.y - player.position.y;
  
  // Only show marker if target is outside viewport
  if (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight || targetVector.z > 1) {
    // Calculate position on edge of screen
    let markerX = x;
    let markerY = y;
    
    // Clamp to screen edges
    if (targetVector.z > 1) {
      // Target is behind us, show at bottom of screen
      markerX = widthHalf;
      markerY = window.innerHeight - 50;
    } else {
      const angle = Math.atan2(y - heightHalf, x - widthHalf);
      const edgeX = Math.cos(angle);
      const edgeY = Math.sin(angle);
      
      if (x < 0 || x > window.innerWidth) {
        markerX = (x < 0) ? 30 : window.innerWidth - 30;
        markerY = heightHalf + edgeY / edgeX * ((x < 0) ? -1 : 1) * (widthHalf - 30);
        
        // Clamp Y to viewport
        markerY = Math.max(30, Math.min(window.innerHeight - 30, markerY));
      }
      
      if (y < 0 || y > window.innerHeight) {
        markerY = (y < 0) ? 30 : window.innerHeight - 30;
        markerX = widthHalf + edgeX / edgeY * ((y < 0) ? -1 : 1) * (heightHalf - 30);
        
        // Clamp X to viewport
        markerX = Math.max(30, Math.min(window.innerWidth - 30, markerX));
      }
    }
    
    // Create marker container
    const markerContainer = document.createElement('div');
    markerContainer.style.position = 'absolute';
    markerContainer.style.left = `${markerX}px`;
    markerContainer.style.top = `${markerY}px`;
    markerContainer.style.transform = 'translate(-50%, -50%)';
    markerContainer.style.display = 'flex';
    markerContainer.style.flexDirection = 'column';
    markerContainer.style.alignItems = 'center';
    markerContainer.style.gap = '5px';
    navMarkersContainer.appendChild(markerContainer);
    
    // Create marker element
    const marker = document.createElement('div');
    marker.style.width = '20px';
    marker.style.height = '20px';
    marker.style.backgroundColor = currentTarget === lovedOne ? 
      NAVIGATION.LOVED_ONE_MARKER_COLOR : NAVIGATION.KEY_MARKER_COLOR;
    marker.style.borderRadius = '50%';
    marker.style.boxShadow = `0 0 10px ${currentTarget === lovedOne ? 
      NAVIGATION.LOVED_ONE_MARKER_COLOR : NAVIGATION.KEY_MARKER_COLOR}`;
    
    // Add pulse animation
    marker.style.animation = 'pulse 1.5s infinite';
    
    // Add to container
    markerContainer.appendChild(marker);
    
    // Calculate distance to target
    const distance = player.position.distanceTo(currentTarget.position).toFixed(0);
    
    // Create info container
    const infoContainer = document.createElement('div');
    infoContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    infoContainer.style.padding = '3px 8px';
    infoContainer.style.borderRadius = '10px';
    infoContainer.style.fontSize = '12px';
    infoContainer.style.color = 'white';
    infoContainer.style.display = 'flex';
    infoContainer.style.flexDirection = 'column';
    infoContainer.style.alignItems = 'center';
    markerContainer.appendChild(infoContainer);
    
    // Add distance label
    const distanceLabel = document.createElement('div');
    distanceLabel.textContent = `${distance}m`;
    distanceLabel.style.whiteSpace = 'nowrap';
    infoContainer.appendChild(distanceLabel);
    
    // Add altitude indicator if enabled
    if (NAVIGATION.ALTITUDE_INDICATOR_ENABLED) {
      const altitudeIndicator = document.createElement('div');
      
      // Use arrow symbols to indicate up/down
      if (Math.abs(verticalDifference) > 5) { // Only show if difference is significant
        const absoluteDifference = Math.abs(verticalDifference).toFixed(0);
        const arrowSymbol = verticalDifference > 0 ? '↑' : '↓';
        altitudeIndicator.textContent = `${arrowSymbol} ${absoluteDifference}m`;
        
        // Color code based on direction
        altitudeIndicator.style.color = verticalDifference > 0 ? '#88ff88' : '#ff8888';
        infoContainer.appendChild(altitudeIndicator);
      }
    }
    
    // Add visual helpers for direction when target is behind
    if (targetVector.z > 1) {
      const behindIndicator = document.createElement('div');
      behindIndicator.textContent = '↓ BEHIND ↓';
      behindIndicator.style.position = 'absolute';
      behindIndicator.style.top = '-25px';
      behindIndicator.style.color = 'white';
      behindIndicator.style.fontWeight = 'bold';
      behindIndicator.style.fontSize = '12px';
      behindIndicator.style.textShadow = '0 0 3px black';
      markerContainer.appendChild(behindIndicator);
    }
  }
}

// Add CSS for pulse animation
function addNavigationStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.7; }
      100% { transform: scale(1); opacity: 1; }
    }
    
    #minimap-container {
      transition: all 0.3s ease;
    }
    
    #minimap-container:hover {
      transform: scale(1.1);
    }
    
    #compass {
      transition: all 0.3s ease;
    }
    
    #compass:hover {
      transform: translateX(-50%) scale(1.1);
    }
    
    .minimap-button {
      transition: all 0.2s ease;
      opacity: 0.7;
    }
    
    .minimap-button:hover {
      opacity: 1;
      transform: scale(1.1);
    }
    
    .direction-marker {
      animation: pulse 1.5s infinite;
    }
    
    .settings-panel {
      transition: all 0.3s ease;
    }
    
    .toggle-container {
      transition: all 0.2s ease;
    }
    
    .toggle-container:hover {
      transform: translateX(5px);
    }
  `;
  document.head.appendChild(style);
}

// Initialize navigation styles when loading the game
document.addEventListener('DOMContentLoaded', () => {
  addNavigationStyles();
});

// Start the game
document.addEventListener('DOMContentLoaded', () => {
  init();
});

// Fallback function for ending a speed run (used if SpeedRunSystem is not available)
function endSpeedRun(completed = false) {
  console.log("Fallback endSpeedRun called. SpeedRunSystem should be used instead.");
  // Just reset game state
  gameState = GAME_STATES.PLAYING;
}

// Add a new function to cycle between navigation targets
function cycleNavigationTarget() {
  if (gameState !== GAME_STATES.PLAYING || !keys.length) return;
  
  // Find all valid targets (uncollected keys and loved one if all keys collected)
  const validTargets = [];
  
  // Add uncollected keys
  keys.forEach(key => {
    if (!key.collected) {
      validTargets.push(key);
    }
  });
  
  // Add loved one if all keys collected
  if (keysCollected >= keysRequired && lovedOne) {
    validTargets.push(lovedOne);
  }
  
  // If no valid targets, return
  if (validTargets.length === 0) return;
  
  // Find current target index
  let currentIndex = -1;
  for (let i = 0; i < validTargets.length; i++) {
    if (validTargets[i] === currentTarget) {
      currentIndex = i;
      break;
    }
  }
  
  // Get next target index (wrap around)
  const nextIndex = (currentIndex + 1) % validTargets.length;
  currentTarget = validTargets[nextIndex];
  
  // Show a brief notification about the new target
  const targetName = currentTarget === lovedOne ? "Loved One" : "Key";
  showNavigationNotification(`Target: ${targetName}`);
}

// Function to show a temporary navigation notification
function showNavigationNotification(message) {
  // Create notification element if it doesn't exist
  let notification = document.getElementById('nav-notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'nav-notification';
    notification.style.position = 'fixed';
    notification.style.bottom = '50px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    notification.style.color = 'white';
    notification.style.padding = '8px 15px';
    notification.style.borderRadius = '20px';
    notification.style.fontSize = '14px';
    notification.style.fontWeight = 'bold';
    notification.style.zIndex = '200';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s ease-in-out';
    document.body.appendChild(notification);
  }
  
  // Update message and show notification
  notification.textContent = message;
  notification.style.opacity = '1';
  
  // Hide after 2 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
  }, 2000);
}

// Create Easter egg objects hidden throughout the world
function createEasterEggs() {
  // Types of easter eggs
  const eggTypes = ['rainbow', 'giant', 'tiny', 'gravity', 'fireworks'];
  
  // Create 5 Easter eggs of different types
  for (let i = 0; i < 5; i++) {
    const eggType = eggTypes[i];
    
    // Create a different geometry for each type
    let geometry, material;
    
    if (eggType === 'rainbow') {
      // Rainbow egg is a colorful sphere
      geometry = new THREE.SphereGeometry(1, 16, 16);
      
      // Create custom rainbow material
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const context = canvas.getContext('2d');
      
      // Create rainbow gradient
      const gradient = context.createLinearGradient(0, 0, 0, 128);
      gradient.addColorStop(0, 'red');
      gradient.addColorStop(0.2, 'orange');
      gradient.addColorStop(0.4, 'yellow');
      gradient.addColorStop(0.6, 'green');
      gradient.addColorStop(0.8, 'blue');
      gradient.addColorStop(1, 'violet');
      
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
      
      const texture = new THREE.CanvasTexture(canvas);
      material = new THREE.MeshBasicMaterial({ map: texture });
    } else if (eggType === 'giant') {
      // Giant egg is a large cube
      geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      material = new THREE.MeshStandardMaterial({ 
        color: 0x00ff00, 
        emissive: 0x00aa00,
        emissiveIntensity: 0.5,
        metalness: 0.7,
        roughness: 0.3
      });
    } else if (eggType === 'tiny') {
      // Tiny egg is a small tetrahedron
      geometry = new THREE.TetrahedronGeometry(1, 0);
      material = new THREE.MeshStandardMaterial({ 
        color: 0xff00ff, 
        emissive: 0xaa00aa,
        emissiveIntensity: 0.5,
        metalness: 0.7,
        roughness: 0.3
      });
    } else if (eggType === 'gravity') {
      // Gravity egg is an octahedron with "up/down" arrows
      geometry = new THREE.OctahedronGeometry(1, 0);
      material = new THREE.MeshStandardMaterial({ 
        color: 0x0000ff, 
        emissive: 0x0000aa,
        emissiveIntensity: 0.5,
        metalness: 0.7,
        roughness: 0.3
      });
    } else if (eggType === 'fireworks') {
      // Fireworks egg is a icosahedron
      geometry = new THREE.IcosahedronGeometry(1, 0);
      material = new THREE.MeshStandardMaterial({ 
        color: 0xff0000, 
        emissive: 0xaa0000,
        emissiveIntensity: 0.5,
        metalness: 0.7,
        roughness: 0.3
      });
    }
    
    const easterEgg = new THREE.Mesh(geometry, material);
    
    // Position easter eggs in hidden, challenging locations
    if (eggType === 'rainbow') {
      // Rainbow egg at the highest point
      easterEgg.position.set(0, 150, 0);
    } else if (eggType === 'giant') {
      // Giant egg in a remote corner
      easterEgg.position.set(-200, 30, -200);
    } else if (eggType === 'tiny') {
      // Tiny egg hidden below the main area
      easterEgg.position.set(0, -50, 0);
    } else if (eggType === 'gravity') {
      // Gravity egg in another distant corner
      easterEgg.position.set(200, 30, 200);
    } else if (eggType === 'fireworks') {
      // Fireworks egg in another distant corner
      easterEgg.position.set(-200, 30, 200);
    }
    
    // Add glow effect
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: material.color,
      transparent: true,
      opacity: 0.4,
      side: THREE.BackSide
    });
    
    const glowMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 16, 16),
      glowMaterial
    );
    easterEgg.add(glowMesh);
    
    // Add light source inside
    const eggLight = new THREE.PointLight(material.color, 0.8, 3);
    eggLight.position.set(0, 0, 0);
    easterEgg.add(eggLight);
    
    // Add hover animation data
    easterEgg.userData = {
      originalY: easterEgg.position.y,
      hoverSpeed: 0.001 + Math.random() * 0.001,
      hoverRange: 0.5 + Math.random() * 0.5,
      hoverOffset: Math.random() * Math.PI * 2,
      rotationSpeed: 0.01 + Math.random() * 0.01,
      pulseSpeed: 0.5 + Math.random() * 0.5,
      glowMesh: glowMesh,
      eggType: eggType // Store egg type for special effects
    };
    
    // Add sparkle particle effects similar to keys
    addKeySparkles(easterEgg); // Reuse key sparkles function
    
    // Add to scene and easterEggs array
    scene.add(easterEgg);
    easterEggs.push(easterEgg);
  }
}

// Create spectacular fireworks effect
function createFireworks(position, color = 0xff0066) {
  const particleCount = 100;
  const colors = [0xff0066, 0x00ffff, 0xffff00, 0xff00ff, 0x00ff00];
  
  // Create explosion particles
  for (let i = 0; i < particleCount; i++) {
    // Vary the geometry for more interesting effects
    let geometry;
    if (i % 3 === 0) {
      geometry = new THREE.TetrahedronGeometry(0.2, 0);
    } else if (i % 3 === 1) {
      geometry = new THREE.OctahedronGeometry(0.2, 0);
    } else {
      geometry = new THREE.SphereGeometry(0.2, 8, 8);
    }
    
    // Create glowing material
    const particleColor = colors[Math.floor(Math.random() * colors.length)];
    const material = new THREE.MeshBasicMaterial({
      color: particleColor,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });
    
    const particle = new THREE.Mesh(geometry, material);
    
    // Set initial position
    particle.position.copy(position);
    
    // Create explosion velocity
    const angle = Math.random() * Math.PI * 2;
    const elevation = Math.random() * Math.PI;
    const speed = 2 + Math.random() * 3;
    
    particle.userData = {
      velocity: new THREE.Vector3(
        Math.sin(angle) * Math.cos(elevation) * speed,
        Math.sin(elevation) * speed,
        Math.cos(angle) * Math.cos(elevation) * speed
      ),
      rotationSpeed: new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).multiplyScalar(0.2),
      life: 1.0,
      decay: 0.01 + Math.random() * 0.02,
      type: 'firework'
    };
    
    // Add trail effect
    const trailLength = 20;
    const trailPositions = new Float32Array(trailLength * 3);
    const trailColors = new Float32Array(trailLength * 3);
    
    for (let j = 0; j < trailLength; j++) {
      const color = new THREE.Color(particleColor);
      trailColors[j * 3] = color.r;
      trailColors[j * 3 + 1] = color.g;
      trailColors[j * 3 + 2] = color.b;
    }
    
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
    
    const trailMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    
    const trail = new THREE.Points(trailGeometry, trailMaterial);
    particle.add(trail);
    particle.userData.trail = trail;
    
    // Add to scene and particles array
    scene.add(particle);
    particles.push(particle);
    
    // Add a point light that follows the particle
    const light = new THREE.PointLight(particleColor, 1, 10);
    light.position.copy(particle.position);
    particle.userData.light = light;
    scene.add(light);
  }
  
  // Create central explosion flash
  const flashGeometry = new THREE.SphereGeometry(2, 32, 32);
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending
  });
  
  const flash = new THREE.Mesh(flashGeometry, flashMaterial);
  flash.position.copy(position);
  flash.userData = {
    type: 'flash',
    life: 1.0,
    decay: 0.1
  };
  
  scene.add(flash);
  particles.push(flash);
  
  // Add central explosion light
  const explosionLight = new THREE.PointLight(0xffffff, 2, 20);
  explosionLight.position.copy(position);
  scene.add(explosionLight);
  
  // Fade out explosion light
  const fadeLight = () => {
    explosionLight.intensity -= 0.1;
    if (explosionLight.intensity > 0) {
      requestAnimationFrame(fadeLight);
    } else {
      scene.remove(explosionLight);
    }
  };
  fadeLight();
}

// Create shield effect for crystal key
function createShieldEffect(target) {
  // Create shield geometry
  const shieldGeometry = new THREE.SphereGeometry(2, 32, 32);
  const shieldMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(0x00ffff) }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        float pulse = sin(time * 2.0) * 0.5 + 0.5;
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.0);
        float hexagon = abs(mod(vPosition.x * 10.0 + time, 1.0) - 0.5) +
                       abs(mod(vPosition.y * 10.0 + time, 1.0) - 0.5) +
                       abs(mod(vPosition.z * 10.0 + time, 1.0) - 0.5);
        
        vec3 finalColor = color * (fresnel + 0.2) * (pulse * 0.5 + 0.5);
        float alpha = fresnel * (0.6 + pulse * 0.4) * (1.0 - hexagon * 0.5);
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  
  const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
  shield.userData = {
    type: 'shield',
    time: 0
  };
  
  // Add glow effect
  const glowGeometry = new THREE.SphereGeometry(2.2, 32, 32);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(0x00ffff) }
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      varying vec3 vNormal;
      
      void main() {
        float pulse = sin(time * 3.0) * 0.5 + 0.5;
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 3.0);
        vec3 finalColor = color * fresnel * (0.5 + pulse * 0.5);
        float alpha = fresnel * 0.3;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending
  });
  
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  shield.add(glow);
  
  // Add to target and scene
  target.add(shield);
  
  // Add update function
  shield.update = (deltaTime) => {
    shield.userData.time += deltaTime;
    shield.material.uniforms.time.value = shield.userData.time;
    glow.material.uniforms.time.value = shield.userData.time;
    
    // Rotate shield slowly
    shield.rotation.y += deltaTime * 0.2;
    shield.rotation.z += deltaTime * 0.1;
    
    // Scale shield with breathing effect
    const scale = 1 + Math.sin(shield.userData.time * 2) * 0.05;
    shield.scale.set(scale, scale, scale);
  };
  
  return shield;
}

// Check if a point is within the minimap bounds
function isInMinimapBounds(x, y) {
  const width = minimapCanvas.width;
  const height = minimapCanvas.height;
  return x >= 0 && x < width && y >= 0 && y < height;
}
