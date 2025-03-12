// Speed Run and Boost Features
// This file contains functionality for the speed run mini-games and boost mechanics

// Speed run constants
const SPEEDRUN = {
  COUNTDOWN_DURATION: 3,  // seconds
  CHECKPOINT_RADIUS: 3,   // units
  MAX_CHECKPOINTS: 8,     // maximum checkpoints per course
  OBSTACLE_COUNT: 10      // number of obstacles for obstacle course
};

// Variables to track speed run state
let speedRuns = [];
let activeSpeedRun = null;
let speedRunCheckpoints = [];
let currentCheckpoint = 0;
let speedRunTimer = 0;
let speedRunBestTimes = {};
let speedRunUI;
let obstacles = []; // Array to store obstacles for obstacle course

// Variables to track boost state
let boostActive = false;
let boostTimeRemaining = 0;
let boostCooldown = 0;
let boostEffect = null;

// Initialize speed run features
function initSpeedRun(scene, player, islands, keys, sounds) {
  // Create speed run checkpoints and boosts
  createSpeedRuns(scene, islands, keys);
  createBoostEffects(player);
  setupSpeedRunUI();

  // Add to global event listeners
  setupSpeedRunControls();
}

// Create boost particle effect
function createBoostParticles(scene, player, particles) {
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

// Create speed run checkpoints and define courses
function createSpeedRuns(scene, islands, keys) {
  // Define different speed run courses
  speedRuns = [
    {
      id: 'island_circuit',
      name: 'Island Circuit',
      description: 'Race through the floating islands in record time!',
      checkpoints: []
    },
    {
      id: 'celestial_dash',
      name: 'Celestial Dash',
      description: 'Navigate through the nebulae clouds!',
      checkpoints: []
    },
    {
      id: 'key_collector',
      name: 'Key Collector Rush',
      description: 'Collect all the keys as fast as possible!',
      checkpoints: []
    },
    {
      id: 'obstacle_course',
      name: 'Obstacle Course',
      description: 'Navigate through a series of obstacles without hitting them!',
      checkpoints: []
    },
    {
      id: 'time_attack',
      name: 'Time Attack Challenge',
      description: 'Collect as many time bonuses as possible before time runs out!',
      checkpoints: [],
      timeLimit: 60 // seconds
    }
  ];
  
  // Place checkpoints for Island Circuit
  islands.forEach((island, index) => {
    if (index % 2 === 0 && speedRuns[0].checkpoints.length < SPEEDRUN.MAX_CHECKPOINTS) {
      const checkpointPos = island.position.clone();
      checkpointPos.y += 5; // Place above island
      
      const checkpoint = createCheckpoint(scene, checkpointPos, index);
      speedRuns[0].checkpoints.push(checkpoint);
    }
  });
  
  // Place checkpoints for Celestial Dash using nebulae
  if (window.nebulae) {
    window.nebulae.forEach((nebula, index) => {
      if (index % 2 === 0 && speedRuns[1].checkpoints.length < 6) {
        const checkpointPos = nebula.position.clone();
        checkpointPos.x += (Math.random() - 0.5) * 15;
        checkpointPos.z += (Math.random() - 0.5) * 15;
        
        const checkpoint = createCheckpoint(scene, checkpointPos, index);
        speedRuns[1].checkpoints.push(checkpoint);
      }
    });
  }
  
  // Place checkpoints for Key Collector using key positions
  keys.forEach((key, index) => {
    if (index < keys.length) {
      const checkpointPos = key.position.clone();
      const checkpoint = createCheckpoint(scene, checkpointPos, index, true);
      speedRuns[2].checkpoints.push(checkpoint);
    }
  });
  
  // Create obstacles and checkpoints for obstacle course
  if (islands.length > 0) {
    // Create a start checkpoint
    const startPos = new THREE.Vector3(0, 20, 0);
    const startCheckpoint = createCheckpoint(scene, startPos, 0);
    speedRuns[3].checkpoints.push(startCheckpoint);
    
    // Create a mid checkpoint
    const midPos = new THREE.Vector3(50, 30, 50);
    const midCheckpoint = createCheckpoint(scene, midPos, 1);
    speedRuns[3].checkpoints.push(midCheckpoint);
    
    // Create obstacles that will be enabled during the game
    for (let i = 0; i < SPEEDRUN.OBSTACLE_COUNT; i++) {
      const obstacle = createObstacle(scene, i);
      obstacles.push(obstacle);
    }
    
    // Create finish checkpoint
    const finishPos = new THREE.Vector3(0, 30, 100);
    const finishCheckpoint = createCheckpoint(scene, finishPos, 2, false, true);
    speedRuns[3].checkpoints.push(finishCheckpoint);
  }
  
  // Create time attack checkpoints
  if (islands.length > 0) {
    // Start point
    const startPos = new THREE.Vector3(0, 20, 0);
    const startCheckpoint = createCheckpoint(scene, startPos, 0);
    speedRuns[4].checkpoints.push(startCheckpoint);
    
    // Create several time bonus checkpoints - they give extra time
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const radius = 50 + (i % 3) * 20;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 20 + (i % 4) * 10;
      
      const bonusPos = new THREE.Vector3(x, y, z);
      const bonusCheckpoint = createCheckpoint(scene, bonusPos, i + 1, false, false, true);
      speedRuns[4].checkpoints.push(bonusCheckpoint);
    }
  }
  
  // Add finish checkpoint for each speed run
  speedRuns.forEach((speedRun, idx) => {
    if (speedRun.checkpoints.length > 0 && idx < 3) { // Only for the first 3 speed runs
      const startPos = speedRun.checkpoints[0].position.clone();
      startPos.y += 2;
      
      const finishCheckpoint = createCheckpoint(scene, startPos, speedRun.checkpoints.length, false, true);
      speedRun.checkpoints.push(finishCheckpoint);
    }
  });
}

// Create an obstacle for the obstacle course
function createObstacle(scene, index) {
  // Create a moving obstacle
  const geometry = new THREE.BoxGeometry(5, 5, 5);
  const material = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.7
  });
  
  const obstacle = new THREE.Mesh(geometry, material);
  
  // Position at random locations along the path
  const angle = (index / SPEEDRUN.OBSTACLE_COUNT) * Math.PI * 2;
  const radius = 40;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const y = 20 + (index % 3) * 10;
  
  obstacle.position.set(x, y, z);
  
  // Add properties
  obstacle.userData = {
    isObstacle: true,
    index: index,
    initialPosition: obstacle.position.clone(),
    movementRadius: 5 + (index % 5),
    movementSpeed: 0.5 + (index % 3) * 0.2,
    rotationSpeed: 0.01 + (index % 4) * 0.01
  };
  
  // Not visible by default
  obstacle.visible = false;
  
  scene.add(obstacle);
  return obstacle;
}

// Create a checkpoint for speed runs
function createCheckpoint(scene, position, index, isKeyPoint = false, isFinish = false, isTimeBonus = false) {
  const geometry = new THREE.TorusGeometry(SPEEDRUN.CHECKPOINT_RADIUS, 0.5, 16, 32);
  
  // Different material based on checkpoint type
  let material;
  
  if (isFinish) {
    material = new THREE.MeshStandardMaterial({ 
      color: 0xffffff,
      emissive: 0xff0000,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.8
    });
  } else if (isKeyPoint) {
    material = new THREE.MeshStandardMaterial({ 
      color: 0xffcc00,
      emissive: 0xffcc00,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.8
    });
  } else if (isTimeBonus) {
    material = new THREE.MeshStandardMaterial({ 
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.8
    });
  } else {
    material = new THREE.MeshStandardMaterial({ 
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.8
    });
  }
  
  const checkpoint = new THREE.Mesh(geometry, material);
  checkpoint.position.copy(position);
  
  // Make checkpoints not visible by default (only visible during speed runs)
  checkpoint.visible = false;
  
  // Add properties
  checkpoint.userData = {
    isCheckpoint: true,
    checkpointIndex: index,
    isFinishCheckpoint: isFinish,
    isKeyCheckpoint: isKeyPoint,
    isTimeBonus: isTimeBonus,
    timeBonusValue: isTimeBonus ? 10 : 0, // 10 seconds bonus time
    rotationSpeed: 0.01,
    collected: false
  };
  
  // Add sparkles to make the checkpoint more visible
  const sparkles = createCheckpointSparkles();
  checkpoint.add(sparkles);
  
  scene.add(checkpoint);
  return checkpoint;
}

// Create sparkle effect for checkpoints
function createCheckpointSparkles() {
  const sparkleCount = 20;
  const sparkleGeometry = new THREE.BufferGeometry();
  const sparklePositions = [];
  const sparkleColors = [];
  
  for (let i = 0; i < sparkleCount; i++) {
    // Position sparkles in a circular pattern
    const angle = (i / sparkleCount) * Math.PI * 2;
    const radius = SPEEDRUN.CHECKPOINT_RADIUS;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = (Math.random() - 0.5) * 0.5;
    
    sparklePositions.push(x, y, z);
    
    // Random colors for sparkles
    const r = Math.random() * 0.5 + 0.5;
    const g = Math.random() * 0.5 + 0.5;
    const b = Math.random() * 0.5 + 0.5;
    
    sparkleColors.push(r, g, b);
  }
  
  sparkleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sparklePositions, 3));
  sparkleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(sparkleColors, 3));
  
  const sparkleMaterial = new THREE.PointsMaterial({
    size: 0.3,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });
  
  const sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial);
  sparkles.userData = {
    rotationSpeed: 0.005
  };
  
  return sparkles;
}

// Create visual effects for the boost feature
function createBoostEffects(player) {
  // Create boost trail effect
  const boostTrailGeometry = new THREE.CylinderGeometry(0.1, 0.5, 6, 8);
  boostTrailGeometry.rotateX(Math.PI / 2);
  boostTrailGeometry.translate(0, 0, -3);
  
  const boostTrailMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
  });
  
  boostEffect = new THREE.Mesh(boostTrailGeometry, boostTrailMaterial);
  boostEffect.visible = false;
  
  player.add(boostEffect);
}

// Create speed run UI
function setupSpeedRunUI() {
  // Main speed run UI (timer, checkpoint counter)
  speedRunUI = document.createElement('div');
  speedRunUI.className = 'speed-run-ui';
  speedRunUI.style.position = 'absolute';
  speedRunUI.style.top = '70px';
  speedRunUI.style.left = '20px';
  speedRunUI.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  speedRunUI.style.color = 'white';
  speedRunUI.style.padding = '10px';
  speedRunUI.style.borderRadius = '5px';
  speedRunUI.style.fontFamily = 'Arial, sans-serif';
  speedRunUI.style.fontSize = '16px';
  speedRunUI.style.display = 'none';
  document.body.appendChild(speedRunUI);
  
  // Boost indicator UI
  const boostIndicator = document.createElement('div');
  boostIndicator.className = 'boost-indicator';
  boostIndicator.style.position = 'absolute';
  boostIndicator.style.bottom = '20px';
  boostIndicator.style.right = '20px';
  boostIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  boostIndicator.style.color = 'white';
  boostIndicator.style.padding = '10px';
  boostIndicator.style.borderRadius = '5px';
  boostIndicator.style.fontFamily = 'Arial, sans-serif';
  boostIndicator.style.fontSize = '14px';
  boostIndicator.textContent = 'BOOST: Ready (TAB or Double-click/tap for boost)';
  document.body.appendChild(boostIndicator);
  
  // Speed run selection menu
  const speedRunSelection = document.createElement('div');
  speedRunSelection.className = 'speed-run-selection';
  speedRunSelection.style.position = 'absolute';
  speedRunSelection.style.top = '50%';
  speedRunSelection.style.left = '50%';
  speedRunSelection.style.transform = 'translate(-50%, -50%)';
  speedRunSelection.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  speedRunSelection.style.color = 'white';
  speedRunSelection.style.padding = '20px';
  speedRunSelection.style.borderRadius = '10px';
  speedRunSelection.style.fontFamily = 'Arial, sans-serif';
  speedRunSelection.style.display = 'none';
  speedRunSelection.style.zIndex = '1000';
  speedRunSelection.innerHTML = '<h2>Speed Run Challenges</h2><p>Choose a challenge:</p>';
  
  // Add speed run options
  speedRuns.forEach(speedRun => {
    const button = document.createElement('button');
    button.textContent = speedRun.name;
    button.style.display = 'block';
    button.style.margin = '10px 0';
    button.style.padding = '10px';
    button.style.width = '100%';
    button.style.backgroundColor = '#007bff';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.color = 'white';
    button.style.cursor = 'pointer';
    
    button.addEventListener('click', () => {
      startSpeedRun(speedRun);
      speedRunSelection.style.display = 'none';
    });
    
    // Add description
    const description = document.createElement('p');
    description.textContent = speedRun.description;
    description.style.fontSize = '14px';
    description.style.marginTop = '5px';
    description.style.color = '#aaa';
    
    speedRunSelection.appendChild(button);
    speedRunSelection.appendChild(description);
  });
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.display = 'block';
  closeButton.style.margin = '20px 0 0 0';
  closeButton.style.padding = '10px';
  closeButton.style.width = '100%';
  closeButton.style.backgroundColor = '#dc3545';
  closeButton.style.border = 'none';
  closeButton.style.borderRadius = '5px';
  closeButton.style.color = 'white';
  closeButton.style.cursor = 'pointer';
  
  closeButton.addEventListener('click', () => {
    speedRunSelection.style.display = 'none';
  });
  
  speedRunSelection.appendChild(closeButton);
  document.body.appendChild(speedRunSelection);
}

// Setup event listeners for speed run and boost controls
function setupSpeedRunControls() {
  window.addEventListener('keydown', (event) => {
    // Speed run menu toggle
    if (event.key === 'r' && window.gameState === 'PLAYING') {
      const speedRunSelection = document.querySelector('.speed-run-selection');
      if (speedRunSelection) {
        speedRunSelection.style.display = speedRunSelection.style.display === 'none' ? 'block' : 'none';
      }
    }
    
    // Cancel speed run
    if (event.key === 'Escape' && window.gameState === 'SPEEDRUN') {
      endSpeedRun(false);
    }
  });
  
  // Handle visual effect for unlimited boost
  window.addEventListener('keyup', (event) => {
    // Hide boost visual effect when Tab is released (unlimited boost)
    if (event.key === 'Tab' && boostEffect) {
      boostEffect.visible = false;
    }
  });
}

// Start a speed run challenge
function startSpeedRun(speedRun) {
  // Save previous game state
  const previousState = window.gameState;
  
  // Change game state
  window.gameState = 'SPEEDRUN';
  
  // Set active speed run
  activeSpeedRun = speedRun;
  
  // Reset checkpoint counter
  currentCheckpoint = 0;
  
  // Special setup for obstacle course
  if (speedRun.id === 'obstacle_course') {
    // Show obstacles
    obstacles.forEach(obstacle => {
      obstacle.visible = true;
    });
  }
  
  // Special setup for time attack
  if (speedRun.id === 'time_attack') {
    // Reset all checkpoints' "collected" status
    speedRun.checkpoints.forEach(checkpoint => {
      if (checkpoint.userData) {
        checkpoint.userData.collected = false;
      }
    });
    
    // Start with the time limit
    speedRunTimer = speedRun.timeLimit || 60;
  } else {
    // Normal races start at 0
    speedRunTimer = 0;
  }
  
  // Show checkpoints
  speedRunCheckpoints = [...speedRun.checkpoints];
  speedRunCheckpoints.forEach(checkpoint => {
    checkpoint.visible = true;
    
    // Make first checkpoint more visible (except for time attack)
    if (speedRun.id !== 'time_attack' && checkpoint.userData.checkpointIndex === 0) {
      checkpoint.material.emissiveIntensity = 2.0;
      checkpoint.scale.set(1.2, 1.2, 1.2);
    }
  });
  
  // Update UI
  speedRunUI.style.display = 'block';
  updateSpeedRunUI();
  
  // Add a 3 second countdown before starting
  const countdown = document.createElement('div');
  countdown.style.position = 'absolute';
  countdown.style.top = '50%';
  countdown.style.left = '50%';
  countdown.style.transform = 'translate(-50%, -50%)';
  countdown.style.fontSize = '100px';
  countdown.style.color = 'white';
  countdown.style.textShadow = '0 0 10px rgba(0, 0, 0, 0.7)';
  countdown.style.zIndex = '1000';
  countdown.textContent = '3';
  document.body.appendChild(countdown);
  
  let count = 3;
  const countdownInterval = setInterval(() => {
    count--;
    if (count > 0) {
      countdown.textContent = count.toString();
    } else if (count === 0) {
      countdown.textContent = 'GO!';
      countdown.style.color = '#00ff00';
    } else {
      clearInterval(countdownInterval);
      document.body.removeChild(countdown);
    }
  }, 1000);
}

// Update the speed run UI based on the active speed run type
function updateSpeedRunUI() {
  if (!activeSpeedRun) return;
  
  if (activeSpeedRun.id === 'time_attack') {
    // For time attack, show time remaining
    speedRunUI.innerHTML = `
      <h3>${activeSpeedRun.name}</h3>
      <p>Time Remaining: ${speedRunTimer.toFixed(2)}s</p>
      <p>Bonuses Collected: ${getCollectedBonusCount()}/${speedRunCheckpoints.length - 1}</p>
    `;
  } else if (activeSpeedRun.id === 'obstacle_course') {
    // For obstacle course, show checkpoint progress and time
    speedRunUI.innerHTML = `
      <h3>${activeSpeedRun.name}</h3>
      <p>Checkpoint: ${currentCheckpoint}/${speedRunCheckpoints.length - 1}</p>
      <p>Time: ${speedRunTimer.toFixed(2)}s</p>
      <p>Avoid the red obstacles!</p>
    `;
  } else {
    // For regular races, show checkpoint progress and time
    speedRunUI.innerHTML = `
      <h3>${activeSpeedRun.name}</h3>
      <p>Checkpoint: ${currentCheckpoint}/${speedRunCheckpoints.length - 1}</p>
      <p>Time: ${speedRunTimer.toFixed(2)}s</p>
    `;
  }
}

// Count collected time bonuses in time attack mode
function getCollectedBonusCount() {
  if (!activeSpeedRun || !speedRunCheckpoints) return 0;
  
  return speedRunCheckpoints.filter(cp => 
    cp.userData && cp.userData.isTimeBonus && cp.userData.collected
  ).length;
}

// End the current speed run
function endSpeedRun(completed = false) {
  if (!activeSpeedRun) return;
  
  // Hide checkpoints
  speedRunCheckpoints.forEach(checkpoint => {
    checkpoint.visible = false;
  });
  
  // Hide obstacles if this was an obstacle course
  if (activeSpeedRun.id === 'obstacle_course') {
    obstacles.forEach(obstacle => {
      obstacle.visible = false;
    });
  }
  
  // Reset variables
  speedRunCheckpoints = [];
  
  // Update UI
  speedRunUI.style.display = 'none';
  
  // Show results if completed
  if (completed) {
    const resultElement = document.createElement('div');
    resultElement.style.position = 'absolute';
    resultElement.style.top = '50%';
    resultElement.style.left = '50%';
    resultElement.style.transform = 'translate(-50%, -50%)';
    resultElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    resultElement.style.color = 'white';
    resultElement.style.padding = '20px';
    resultElement.style.borderRadius = '10px';
    resultElement.style.fontFamily = 'Arial, sans-serif';
    resultElement.style.zIndex = '1000';
    
    let resultHtml = '';
    
    if (activeSpeedRun.id === 'time_attack') {
      // Results for time attack mode
      const bonusesCollected = getCollectedBonusCount();
      
      // Check if this is a new high score
      let newRecord = false;
      if (!speedRunBestTimes[activeSpeedRun.id] || bonusesCollected > speedRunBestTimes[activeSpeedRun.id]) {
        speedRunBestTimes[activeSpeedRun.id] = bonusesCollected;
        newRecord = true;
      }
      
      resultHtml = `
        <h2>Time Attack Complete!</h2>
        <h3>${activeSpeedRun.name}</h3>
        <p>Time Bonuses Collected: ${bonusesCollected}</p>
        ${newRecord ? '<p style="color: gold; font-weight: bold">NEW RECORD!</p>' : ''}
        <p>Best Score: ${speedRunBestTimes[activeSpeedRun.id]} bonuses</p>
      `;
    } else {
      // Results for regular races
      // Check if this is a new best time
      let newRecord = false;
      if (!speedRunBestTimes[activeSpeedRun.id] || speedRunTimer < speedRunBestTimes[activeSpeedRun.id]) {
        speedRunBestTimes[activeSpeedRun.id] = speedRunTimer;
        newRecord = true;
      }
      
      resultHtml = `
        <h2>Speed Run Complete!</h2>
        <h3>${activeSpeedRun.name}</h3>
        <p>Time: ${speedRunTimer.toFixed(2)}s</p>
        ${newRecord ? '<p style="color: gold; font-weight: bold">NEW RECORD!</p>' : ''}
        <p>Best Time: ${speedRunBestTimes[activeSpeedRun.id].toFixed(2)}s</p>
      `;
    }
    
    resultHtml += `
      <button id="closeSpeedRunResult" style="display: block; margin: 20px auto 0; padding: 10px 20px; background-color: #007bff; border: none; border-radius: 5px; color: white; cursor: pointer;">Continue</button>
    `;
    
    resultElement.innerHTML = resultHtml;
    
    document.body.appendChild(resultElement);
    
    document.getElementById('closeSpeedRunResult').addEventListener('click', () => {
      document.body.removeChild(resultElement);
    });
    
    // Create heart explosion effect
    if (window.createHeartExplosion) {
      window.createHeartExplosion(window.player.position.clone(), 30);
    }
  }
  
  // Reset game state
  window.gameState = 'PLAYING';
  activeSpeedRun = null;
}

// Update the obstacle course obstacles
function updateObstacles(deltaTime) {
  obstacles.forEach(obstacle => {
    if (!obstacle.visible) return;
    
    // Rotate the obstacle
    obstacle.rotation.x += obstacle.userData.rotationSpeed;
    obstacle.rotation.y += obstacle.userData.rotationSpeed * 1.5;
    
    // Move the obstacle in a circular pattern
    const time = Date.now() * 0.001 * obstacle.userData.movementSpeed;
    const radius = obstacle.userData.movementRadius;
    
    const initialPos = obstacle.userData.initialPosition;
    obstacle.position.x = initialPos.x + Math.cos(time) * radius;
    obstacle.position.y = initialPos.y + Math.sin(time * 0.5) * radius * 0.5;
    obstacle.position.z = initialPos.z + Math.sin(time) * radius;
    
    // Check for collision with player
    if (window.player) {
      const distance = window.player.position.distanceTo(obstacle.position);
      if (distance < 3) {
        // Player hit an obstacle! End the speed run
        endSpeedRun(false);
      }
    }
  });
}

// Update speed run mechanics
function updateSpeedRun(deltaTime) {
  if (window.gameState !== 'SPEEDRUN' || !activeSpeedRun) return;
  
  // Update timer
  if (activeSpeedRun.id === 'time_attack') {
    // In time attack, timer counts down
    speedRunTimer -= deltaTime;
    
    // Check if time is up
    if (speedRunTimer <= 0) {
      // Time's up, end the speed run with completion
      endSpeedRun(true);
      return;
    }
  } else {
    // In normal races, timer counts up
    speedRunTimer += deltaTime;
  }
  
  // Update UI
  updateSpeedRunUI();
  
  // Update obstacles for obstacle course
  if (activeSpeedRun.id === 'obstacle_course') {
    updateObstacles(deltaTime);
  }
  
  // Update checkpoints
  speedRunCheckpoints.forEach(checkpoint => {
    // Rotate checkpoints
    checkpoint.rotation.z += checkpoint.userData.rotationSpeed;
    
    // Make current checkpoint more visible in regular races
    if (activeSpeedRun.id !== 'time_attack') {
      if (checkpoint.userData.checkpointIndex === currentCheckpoint) {
        checkpoint.material.emissiveIntensity = 2.0 + Math.sin(speedRunTimer * 5) * 0.5;
      } else {
        checkpoint.material.emissiveIntensity = 0.5;
      }
    }
    
    // Check collision with checkpoint
    if (window.player) {
      const distance = window.player.position.distanceTo(checkpoint.position);
      
      if (distance < SPEEDRUN.CHECKPOINT_RADIUS) {
        if (activeSpeedRun.id === 'time_attack') {
          // In time attack, any checkpoint can be collected for time bonus
          if (checkpoint.userData.isTimeBonus && !checkpoint.userData.collected) {
            // Collect time bonus
            checkpoint.userData.collected = true;
            speedRunTimer += checkpoint.userData.timeBonusValue;
            
            // Visual feedback
            if (window.createCollectionEffect) {
              window.createCollectionEffect(checkpoint.position);
            }
            
            // Play sound
            if (window.sounds && window.sounds.collect) {
              const sound = window.sounds.collect.clone();
              sound.play();
            }
            
            // Hide the collected checkpoint
            checkpoint.visible = false;
          }
        } else {
          // For regular races, check if this is the current target checkpoint
          if (checkpoint.userData.checkpointIndex === currentCheckpoint) {
            // Checkpoint reached
            if (checkpoint.userData.isFinishCheckpoint && currentCheckpoint === speedRunCheckpoints.length - 1) {
              // Race completed
              endSpeedRun(true);
            } else {
              // Move to next checkpoint
              currentCheckpoint++;
              
              // Visual feedback
              if (window.createCollectionEffect) {
                window.createCollectionEffect(checkpoint.position);
              }
              
              // Play sound
              if (window.sounds && window.sounds.collect) {
                const sound = window.sounds.collect.clone();
                sound.play();
              }
            }
          }
        }
      }
    }
  });
}

// Handle boost activation and update
function updateBoost(deltaTime, player, velocity, sounds, particles, scene) {
  const MOVEMENT = window.MOVEMENT;
  const controls = window.gameControls;
  
  // Check for unlimited boost (triggered by Tab or double-click)
  const isUnlimitedBoost = controls.unlimitedBoost;
  
  if (isUnlimitedBoost) {
    // Unlimited boost is active
    boostActive = true;
    
    // Visual effect
    if (boostEffect) {
      boostEffect.visible = true;
    }
    
    // Create boost particles with a lower frequency for unlimited boost
    if (Math.random() > 0.8) {
      createBoostParticles(scene, player, particles);
    }
    
    // Update boost UI indicator for unlimited boost
    const boostIndicator = document.querySelector('.boost-indicator');
    if (boostIndicator) {
      boostIndicator.textContent = 'BOOST: UNLIMITED';
      boostIndicator.style.color = '#ff00ff'; // Bright magenta for unlimited boost
    }
    
    return true;
  } else {
    // No boost active
    boostActive = false;
    
    // Hide visual effect
    if (boostEffect && boostEffect.visible) {
      boostEffect.visible = false;
    }
    
    // Update boost UI indicator
    const boostIndicator = document.querySelector('.boost-indicator');
    if (boostIndicator) {
      boostIndicator.textContent = 'BOOST: Ready (TAB or Double-click/tap for boost)';
      boostIndicator.style.color = '#00ff00';
    }
    
    return false;
  }
}

// Expose public API
window.SpeedRunSystem = {
  initSpeedRun,
  updateSpeedRun,
  updateBoost,
  startSpeedRun,
  endSpeedRun,
  isBoostActive: () => boostActive
}; 