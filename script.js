// Game logic will go here
// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("gameCanvas"),
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
const initialSkyColor = new THREE.Color(0x87ceeb); // Sky Blue
const targetSkyGrayColor = new THREE.Color(0x708090); // Slate Gray
renderer.setClearColor(initialSkyColor.clone()); // Start with a blue background

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// Store initial lighting conditions
const initialAmbientLightIntensity = ambientLight.intensity;
const initialAmbientLightColor = ambientLight.color.clone();

// Player Sphere - Defined EARLIER NOW
const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
const initialSphereColor = new THREE.Color().setHSL(Math.random(), 1.0, 0.5); // Random HSL color from the start
const sphereMaterial = new THREE.MeshStandardMaterial({
  color: initialSphereColor.clone(),
});
const playerSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
playerSphere.castShadow = true;
playerSphere.position.y = 0.5;
scene.add(playerSphere); // Add playerSphere to scene before using it as a light target

// Directional Light - Setup MOVED to AFTER playerSphere definition
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
const lightInitialPositionOffset = new THREE.Vector3(10, 19.5, 10);
directionalLight.position
  .copy(playerSphere.position)
  .add(lightInitialPositionOffset);
directionalLight.castShadow = true;
directionalLight.target = playerSphere;
scene.add(directionalLight);
scene.add(directionalLight.target);

// Store initial lighting conditions
const initialDirectionalLightIntensity = directionalLight.intensity;
const initialDirectionalLightColor = directionalLight.color.clone();

// Configure directional light shadow properties
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;

const fullyDesaturatedSphereHSL = {};
initialSphereColor.clone().getHSL(fullyDesaturatedSphereHSL);
const grayBallColor = new THREE.Color().setHSL(
  fullyDesaturatedSphereHSL.h,
  0,
  fullyDesaturatedSphereHSL.l
);
const grayBallSpawnDisplayedSteps = [
  5, 22, 44, 52, 59, 68, 72, 75, 76, 78, 80, 81, 82,
];
const spawnedGrayBallsForDisplayedStep = new Set();

// Ground (Abstract) - initially a simple plane
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x228b22, // Forest Green for the ground
  side: THREE.DoubleSide,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.receiveShadow = true;
ground.rotation.x = -Math.PI / 2; // Rotate to be flat
scene.add(ground);

// Camera position
camera.position.z = 5;
camera.position.y = 2;
camera.lookAt(playerSphere.position);

// Game variables
let actualHopsTaken = 0;
let displayedSteps = 0;
const stepCounterElement = document.getElementById("stepCounter");
let initialStepSize = 7.0; // Initial jump distance - Doubled
let currentStepSize = initialStepSize;
const minStepSize = 0.02; // Minimum effective step size - Doubled
let gameActive = true;
const maxFootprints = 50; // Limit the number of footprints for performance
let gameIsRunning = false;

// Lighting progression constants
const LIGHTING_EFFECT_START_STEP = 30;
const LIGHTING_EFFECT_END_STEP = 83; // Matches game end
const TARGET_LIGHT_INTENSITY_FACTOR = 0.85; // Dim to 85%
const LIGHT_COLOR_TARGET_GRAY_FACTOR = 0.3; // Tint 30% towards mid-gray
const MID_GRAY_LIGHT_COLOR = new THREE.Color(0x888888);

// Footprints array
const footprints = [];

// Grass array and settings
const grassBlades = [];
const maxGrassBlades = 1500; // Max number of grass blades
const grassGenerationRadius = 12; // How far around the player to generate grass - Wider
const initialFloraItemsPerHop = 35; // Increased slightly
let currentFloraItemsPerHop = initialFloraItemsPerHop; // This will be calculated dynamically
const grassForwardOffset = 6; // How far ahead to center flora generation
const grassBladeMaterial = new THREE.MeshStandardMaterial({
  color: 0x00cc00,
  side: THREE.DoubleSide,
});

// Flower array and settings
const flowers = [];
const maxFlowers = 150; // Increased
const flowerChance = 0.35; // Increased significantly: 35% chance
const flowerStemMaterial = new THREE.MeshStandardMaterial({ color: 0x008800 }); // Darker green for stem
const flowerHeadColors = [
  0xff0000,
  0xffff00,
  0x0000ff,
  0xff00ff,
  0xffa500, // Original
  0x00ffff,
  0x00ff7f,
  0xda70d6,
  0xff1493,
  0x7fff00, // Added: Cyan, SpringGreen, Orchid, DeepPink, Chartreuse
];
let nextFlowerHeadColorIndex = 0;
const initialMaxFlowerHeadRadius = 0.5; // Initial larger size for flower heads - Increased
const minFlowerHeadRadius = 0.1; // Minimum size for flower heads - Increased
const flowerEmissiveIntensity = 0.4;

// --- Phase 1: Crystal Shards (Steps 15-25) ---
const crystalShards = [];
const maxCrystalShards = 50;
const crystalShardMaterial = new THREE.MeshPhongMaterial({
  color: 0x6a5acd, // SlateBlue
  emissive: 0x483d8b, // DarkSlateBlue
  specular: 0xffffff,
  shininess: 50,
  transparent: true,
  opacity: 0.75,
});
const initialCrystalSpawnChance = 0.4; // Chance at the start of phase

// --- Phase 2: Floating Orbs (Steps 26-40) ---
const floatingOrbs = [];
const maxFloatingOrbs = 30;
const floatingOrbMaterial = new THREE.MeshStandardMaterial({
  color: 0xff8c00, // DarkOrange
  emissive: 0xffd700, // Gold
  emissiveIntensity: 0.6,
});
const initialOrbSpawnChance = 0.3;

// --- Phase 3: Ancient Monoliths (Steps 41-83) ---
const ancientMonoliths = [];
const maxAncientMonoliths = 20;
const ancientMonolithMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a4a4a, // Darker Gray
  roughness: 0.8,
  metalness: 0.2,
});
const initialMonolithSpawnChance = 0.25;

// Hopping animation variables
let isHopping = false;
let hopStartTime;
const initialHopDuration = 500; // milliseconds - Base duration
const maxHopDuration = initialHopDuration * 1.4; // Hop will be 40% slower by the end (1.4x initial duration)
let currentActualHopDuration = initialHopDuration; // This will be set before each hop
const initialHopHeight = 0.75; // Store initial hop height
let currentActualHopHeight = initialHopHeight; // This will be set dynamically
let hopStartPosition = new THREE.Vector3();
let hopTargetPosition = new THREE.Vector3();
const sphereBaseY = 0.5; // Player sphere's resting Y position

let controlsInteractionCount = 0; // New variable to track control usage

// --- Sign Constants ---
const signSpawnDisplayedSteps = [10, 20, 30, 40, 50, 60, 70, 80];
const spawnedSignsForDisplayedStep = new Set();
const signs = []; // To manage sign objects if needed for cleanup
const maxSigns = 30; // Limit total signs if they accumulate
const signTextLeft = "I'm winning";
const signTextRight = "I'm losing";
const signPostMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 }); // SaddleBrown
const signPanelTextureMaterialCache = {};

// --- Ground Text Constants ---
const groundTextMilestones = [
  { step: 15, text: "Good progress!" },
  { step: 25, text: "Good progress." },
  { step: 35, text: "You've made it pretty far" },
  { step: 45, text: "Don't give up now" },
  { step: 55, text: "Getting closer..." },
  { step: 65, text: "Closer..." },
  { step: 75, text: "Nearly there!" },
];
const spawnedGroundTextsForDisplayedStep = new Set();
const groundTexts = [];
const maxGroundTexts = 10; // Adjust as needed
const groundTextTextureCache = {};

// --- Game Over Sequence Variables ---
let isFadingToGray = false;
let gameOverStartTime = 0;
const gameOverFadeDuration = 15000; // 20 seconds

// Helper function to convert HSL to Hex
function hslToHex(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Start Button Sphere Hover Effect
const startButtonSphere = document.getElementById("startButtonSphere");
const defaultSphereColor = "#808080"; // Default gray color

if (startButtonSphere) {
  startButtonSphere.addEventListener("mouseover", () => {
    // Generate bright HSL color and convert to Hex
    const h = Math.random(); // Hue (0 to 1)
    const s = 0.7 + Math.random() * 0.3; // Saturation (0.7 to 1.0 for vivid colors)
    const l = 0.55 + Math.random() * 0.15; // Lightness (0.55 to 0.7 for bright, not too pale)
    const randomColor = hslToHex(h, s, l);

    startButtonSphere.style.backgroundColor = randomColor;
    // Update box-shadow color to match the random color
    startButtonSphere.style.boxShadow = `0 0 20px ${randomColor}, inset 0 0 10px rgba(255, 255, 255, 0.7)`;
  });

  startButtonSphere.addEventListener("mouseout", () => {
    startButtonSphere.style.backgroundColor = defaultSphereColor;
    // Revert box-shadow to default gray
    startButtonSphere.style.boxShadow = `0 0 15px ${defaultSphereColor}, inset 0 0 10px rgba(255, 255, 255, 0.5)`;
  });
}

// Helper function to create gray balls
function createGrayBall(position) {
  const grayBallGeometry = new THREE.SphereGeometry(0.5, 32, 32);
  const grayBallMaterial = new THREE.MeshStandardMaterial({
    color: grayBallColor,
  });
  const grayBall = new THREE.Mesh(grayBallGeometry, grayBallMaterial);
  grayBall.castShadow = true;
  grayBall.position.copy(position);
  grayBall.position.y = 0.5; // Ensure it's on the ground
  scene.add(grayBall);
}

function calculateCurrentStepSize(currentDisplayedSteps) {
  if (currentDisplayedSteps <= 0) return initialStepSize;
  if (currentDisplayedSteps <= 20)
    return initialStepSize * (1 - 0.2 * (currentDisplayedSteps / 20));
  if (currentDisplayedSteps <= 40) {
    const p = (currentDisplayedSteps - 20) / 20;
    return initialStepSize * (0.8 - 0.3 * p);
  }
  if (currentDisplayedSteps <= 60) {
    const p = (currentDisplayedSteps - 40) / 20;
    return initialStepSize * (0.5 - 0.25 * p);
  }
  const p = Math.min(1, (currentDisplayedSteps - 60) / (83 - 60));
  return Math.max(
    minStepSize,
    initialStepSize * 0.25 - (initialStepSize * 0.25 - minStepSize) * p
  );
}

function createFlower(position) {
  const stemHeight = Math.random() * 1.5 + 1.0;
  const stemGeo = new THREE.BoxGeometry(0.08, stemHeight, 0.08);
  const stem = new THREE.Mesh(stemGeo, flowerStemMaterial);
  stem.castShadow = true;
  stem.position.copy(position);
  stem.position.y = stemHeight / 2;
  const reductionProgress = Math.min(1, displayedSteps / 83);
  let baseRad =
    initialMaxFlowerHeadRadius -
    (initialMaxFlowerHeadRadius - minFlowerHeadRadius) * reductionProgress;
  baseRad = Math.max(minFlowerHeadRadius, baseRad);
  const actualRad = baseRad * (Math.random() * 0.4 + 0.8);
  const headGeo = new THREE.TorusKnotGeometry(
    actualRad,
    actualRad * 0.3,
    64,
    8,
    2,
    3
  );
  const headColor = flowerHeadColors[nextFlowerHeadColorIndex];
  const headMat = new THREE.MeshStandardMaterial({
    color: headColor,
    emissive: headColor,
    emissiveIntensity: flowerEmissiveIntensity,
  });
  nextFlowerHeadColorIndex =
    (nextFlowerHeadColorIndex + 1) % flowerHeadColors.length;
  const head = new THREE.Mesh(headGeo, headMat);
  head.castShadow = true;
  head.position.copy(stem.position);
  head.position.y += stemHeight / 2 + actualRad * 0.5;
  const flowerGroup = new THREE.Group();
  flowerGroup.add(stem);
  flowerGroup.add(head);
  flowerGroup.rotation.y = Math.random() * Math.PI * 2;
  scene.add(flowerGroup);
  flowers.push(flowerGroup);
  if (flowers.length > maxFlowers) {
    const oG = flowers.shift();
    scene.remove(oG);
    oG.children.forEach((c) => {
      if (c.geometry) c.geometry.dispose();
    });
  }
}

function createGrassBlade(position) {
  const height = Math.random() * 0.4 + 0.2;
  const grassBladeGeometry = new THREE.BoxGeometry(0.05, height, 0.05);
  const blade = new THREE.Mesh(grassBladeGeometry, grassBladeMaterial);
  blade.position.copy(position);
  blade.position.y = height / 2;
  blade.rotation.y = Math.random() * Math.PI * 2;
  scene.add(blade);
  grassBlades.push(blade);
  if (grassBlades.length > maxGrassBlades) {
    const o = grassBlades.shift();
    scene.remove(o);
    o.geometry.dispose();
  }
}

function addFootprint() {
  if (!gameActive) return;
  const fpGeo = new THREE.SphereGeometry(0.25, 32, 16);
  const fpMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const fp = new THREE.Mesh(fpGeo, fpMat);
  fp.position.copy(playerSphere.position);
  fp.position.y = 0.03;
  fp.scale.set(1, 0.2, 1);
  scene.add(fp);
  footprints.push(fp);
  if (footprints.length > maxFootprints) {
    const o = footprints.shift();
    scene.remove(o);
    o.geometry.dispose();
    o.material.dispose();
  }
}

function movePlayer(direction) {
  if (isFadingToGray) return; // Don't allow moves if game is fading out
  if (isHopping || !gameActive) return;
  addFootprint();
  const hopProgressRatioDuration = Math.min(1, displayedSteps / 83);
  currentActualHopDuration =
    initialHopDuration +
    (maxHopDuration - initialHopDuration) * hopProgressRatioDuration;
  isHopping = true;
  hopStartTime = performance.now();
  hopStartPosition.copy(playerSphere.position);
  const move = new THREE.Vector3();
  if (direction === "forward") move.set(0, 0, -currentStepSize);
  else if (direction === "left")
    move.set(-currentStepSize * 0.707, 0, -currentStepSize * 0.707);
  else if (direction === "right")
    move.set(currentStepSize * 0.707, 0, -currentStepSize * 0.707);
  hopTargetPosition.copy(hopStartPosition).add(move);
  hopTargetPosition.y = sphereBaseY;

  actualHopsTaken++;
  displayedSteps = Math.floor(actualHopsTaken / 2);
  stepCounterElement.innerText = displayedSteps;

  // Ground Text Generation
  for (const milestone of groundTextMilestones) {
    if (
      displayedSteps === milestone.step &&
      !spawnedGroundTextsForDisplayedStep.has(milestone.step)
    ) {
      const textPos = hopTargetPosition.clone();
      textPos.z -= 1.5; // Position it slightly in front of where player lands
      createGroundText(textPos, milestone.text);
      spawnedGroundTextsForDisplayedStep.add(milestone.step);
      break; // Assuming only one message per step
    }
  }

  // Sign Generation
  if (
    signSpawnDisplayedSteps.includes(displayedSteps) &&
    !spawnedSignsForDisplayedStep.has(displayedSteps)
  ) {
    const playerLandPos = hopTargetPosition.clone();
    const isWinningSignLeft = Math.random() < 0.5;

    if (isWinningSignLeft) {
      createSign(playerLandPos, signTextLeft, true); // "I'm winning" on the left
      createSign(playerLandPos, signTextRight, false); // "I'm losing" on the right
    } else {
      createSign(playerLandPos, signTextLeft, false); // "I'm winning" on the right
      createSign(playerLandPos, signTextRight, true); // "I'm losing" on the left
    }
    spawnedSignsForDisplayedStep.add(displayedSteps);
  }

  // Special sign at displayedSteps = 12
  if (
    displayedSteps === 12 &&
    !spawnedSignsForDisplayedStep.has("special_12")
  ) {
    const playerLandPos = hopTargetPosition.clone();
    // For a centered sign, pass null as the third argument (isLeft)
    createSign(
      playerLandPos,
      "42% of players do not win—don't be one of them!",
      null
    );
    spawnedSignsForDisplayedStep.add("special_12"); // Use a unique key for this special sign
  }

  if (
    grayBallSpawnDisplayedSteps.includes(displayedSteps) &&
    !spawnedGrayBallsForDisplayedStep.has(displayedSteps)
  ) {
    const gbPos = hopTargetPosition.clone();
    gbPos.x += (Math.random() - 0.5) * 3;
    gbPos.z += (Math.random() - 0.5) * 3;
    createGrayBall(gbPos);
    spawnedGrayBallsForDisplayedStep.add(displayedSteps);
  }

  currentStepSize = calculateCurrentStepSize(displayedSteps);
  if (initialStepSize > 0)
    currentActualHopHeight =
      initialHopHeight * (currentStepSize / initialStepSize);
  currentActualHopHeight = Math.max(0, currentActualHopHeight);

  const saturationProgress = Math.min(1, displayedSteps / 83);
  const newSphereCol = initialSphereColor.clone();
  let hsl = {};
  newSphereCol.getHSL(hsl);
  newSphereCol.setHSL(hsl.h, hsl.s * (1 - saturationProgress), hsl.l);
  playerSphere.material.color.set(newSphereCol);

  const skyProgress = Math.min(1, displayedSteps / 83);
  const currSkyCol = initialSkyColor
    .clone()
    .lerp(targetSkyGrayColor, skyProgress);
  renderer.setClearColor(currSkyCol);

  // Update global lighting
  if (displayedSteps >= LIGHTING_EFFECT_START_STEP) {
    const lightingProgress = Math.min(
      1,
      (displayedSteps - LIGHTING_EFFECT_START_STEP) /
        (LIGHTING_EFFECT_END_STEP - LIGHTING_EFFECT_START_STEP)
    );

    // Ambient Light
    const targetAmbientIntensity =
      initialAmbientLightIntensity * TARGET_LIGHT_INTENSITY_FACTOR;
    ambientLight.intensity = THREE.MathUtils.lerp(
      initialAmbientLightIntensity,
      targetAmbientIntensity,
      lightingProgress
    );
    const newAmbientColor = initialAmbientLightColor
      .clone()
      .lerp(
        MID_GRAY_LIGHT_COLOR,
        lightingProgress * LIGHT_COLOR_TARGET_GRAY_FACTOR
      );
    ambientLight.color.set(newAmbientColor);

    // Directional Light
    const targetDirectionalIntensity =
      initialDirectionalLightIntensity * TARGET_LIGHT_INTENSITY_FACTOR;
    directionalLight.intensity = THREE.MathUtils.lerp(
      initialDirectionalLightIntensity,
      targetDirectionalIntensity,
      lightingProgress
    );
    const newDirectionalColor = initialDirectionalLightColor
      .clone()
      .lerp(
        MID_GRAY_LIGHT_COLOR,
        lightingProgress * LIGHT_COLOR_TARGET_GRAY_FACTOR
      );
    directionalLight.color.set(newDirectionalColor);
  } else {
    // Ensure lights are at their initial state if before the effect starts
    // (primarily for the first few steps before 30, or if a reset happens)
    if (ambientLight.intensity !== initialAmbientLightIntensity) {
      ambientLight.intensity = initialAmbientLightIntensity;
      ambientLight.color.copy(initialAmbientLightColor);
    }
    if (directionalLight.intensity !== initialDirectionalLightIntensity) {
      directionalLight.intensity = initialDirectionalLightIntensity;
      directionalLight.color.copy(initialDirectionalLightColor);
    }
  }

  if (displayedSteps >= 83 && !isFadingToGray && gameActive) {
    // Check gameActive to trigger only once
    gameActive = false; // Stop normal game progression
    isFadingToGray = true;
    gameOverStartTime = performance.now();
    console.log("Game over sequence initiated.");

    // Final state setting for colors etc. can still happen here if desired,
    // or rely on the gradual change having reached its target.
    playerSphere.material.color.setHSL(
      fullyDesaturatedSphereHSL.h,
      0,
      fullyDesaturatedSphereHSL.l
    );
    renderer.setClearColor(targetSkyGrayColor.clone());
  }
  if (currentStepSize < minStepSize && gameActive) {
    currentStepSize = minStepSize;
    currentActualHopHeight = initialHopHeight * (minStepSize / initialStepSize);
    currentActualHopHeight = Math.max(0, currentActualHopHeight);
    console.log("Minimum step size reached (safeguard).");
  }
}

// Key press handler
document.addEventListener("keyup", (event) => {
  if (!gameIsRunning || (!gameActive && currentStepSize <= minStepSize)) return;

  let interactionRegistered = false;
  switch (event.key) {
    case "ArrowUp":
    case "ArrowLeft":
    case "ArrowRight":
      movePlayer(
        event.key === "ArrowUp"
          ? "forward"
          : event.key === "ArrowLeft"
          ? "left"
          : "right"
      );
      interactionRegistered = true;
      break;
  }

  if (interactionRegistered) {
    controlsInteractionCount++;
    if (controlsInteractionCount >= 3) {
      const inGameHintElement = document.getElementById("inGameControlsHint");
      if (inGameHintElement) {
        inGameHintElement.style.display = "none";
      }
    }
  }
});

// --- Touch Controls for Mobile ---
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

document.addEventListener(
  "touchstart",
  function (event) {
    touchStartX = event.changedTouches[0].screenX;
    touchStartY = event.changedTouches[0].screenY;
  },
  false
);

document.addEventListener(
  "touchend",
  function (event) {
    if (!gameIsRunning || (!gameActive && currentStepSize <= minStepSize))
      return;

    touchEndX = event.changedTouches[0].screenX;
    touchEndY = event.changedTouches[0].screenY;
    handleSwipe();
  },
  false
);

function handleSwipe() {
  const swipeThreshold = 50; // Minimum distance for a swipe to be registered
  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;
  let interactionRegistered = false;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    // Horizontal swipe
    if (Math.abs(deltaX) > swipeThreshold) {
      if (deltaX > 0) {
        movePlayer("right");
      } else {
        movePlayer("left");
      }
      interactionRegistered = true;
    }
  } else {
    // Vertical swipe
    if (Math.abs(deltaY) > swipeThreshold) {
      if (deltaY < 0) {
        // Swipe Up
        movePlayer("forward");
        interactionRegistered = true;
      } else {
        // Swipe Down - no action for now, could be implemented later
      }
    }
  }

  if (interactionRegistered) {
    controlsInteractionCount++;
    if (controlsInteractionCount >= 3) {
      const inGameHintElement = document.getElementById("inGameControlsHint");
      if (inGameHintElement) {
        inGameHintElement.style.display = "none";
      }
    }
  }

  // Reset touch coordinates for the next swipe (optional, but good practice)
  touchStartX = 0;
  touchStartY = 0;
  touchEndX = 0;
  touchEndY = 0;
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  if (isFadingToGray) {
    const gameOverScreen = document.getElementById("gameOverScreen");
    const gameOverMessage = document.getElementById("gameOverMessage");
    const elapsedTime = performance.now() - gameOverStartTime;
    let opacity;

    // Slow start, then faster: (time / duration)^3 for example
    const progress = Math.min(elapsedTime / gameOverFadeDuration, 1);
    opacity = Math.pow(progress, 3); // Cubic easing for acceleration

    gameOverScreen.style.visibility = "visible";
    gameOverScreen.style.backgroundColor = `rgba(70, 70, 70, ${opacity})`;

    if (progress >= 1) {
      gameOverMessage.innerText = "The game is now over. You did not win.";
      gameOverMessage.style.opacity = "1";
      gameOverScreen.style.pointerEvents = "auto"; // Allow interaction if any was added
      isFadingToGray = false; // Stop this animation block
    }
    renderer.render(scene, camera); // Keep rendering scene during fade
    return; // Don't process other game logic if fading
  }

  if (!gameIsRunning) {
    renderer.render(scene, camera); // Still render the scene for the start screen
    return;
  }

  const now = performance.now();
  if (isHopping) {
    const elapsedTime = now - hopStartTime;
    let progress = elapsedTime / currentActualHopDuration;

    if (progress >= 1) {
      progress = 1;
      isHopping = false;
      playerSphere.position.copy(hopTargetPosition);
      ground.position.x = playerSphere.position.x;
      ground.position.z = playerSphere.position.z;
      generateFlora();
    } else {
      playerSphere.position.x = THREE.MathUtils.lerp(
        hopStartPosition.x,
        hopTargetPosition.x,
        progress
      );
      playerSphere.position.z = THREE.MathUtils.lerp(
        hopStartPosition.z,
        hopTargetPosition.z,
        progress
      );
      const yOffset = currentActualHopHeight * 4 * progress * (1 - progress);
      playerSphere.position.y = sphereBaseY + yOffset;
    }
  } else {
    if (playerSphere.position.y !== sphereBaseY) {
      playerSphere.position.y = sphereBaseY;
    }
    if (
      ground.position.x !== playerSphere.position.x ||
      ground.position.z !== playerSphere.position.z
    ) {
      ground.position.x = playerSphere.position.x;
      ground.position.z = playerSphere.position.z;
    }
  }

  directionalLight.position
    .copy(playerSphere.position)
    .add(lightInitialPositionOffset);

  const cameraOffsetX = 0;
  const cameraOffsetY = 3;
  const cameraOffsetZ = 6;
  camera.position.x = THREE.MathUtils.lerp(
    camera.position.x,
    playerSphere.position.x + cameraOffsetX,
    0.1
  );
  camera.position.y = THREE.MathUtils.lerp(
    camera.position.y,
    sphereBaseY + cameraOffsetY,
    0.1
  );
  camera.position.z = THREE.MathUtils.lerp(
    camera.position.z,
    playerSphere.position.z + cameraOffsetZ,
    0.1
  );
  camera.lookAt(playerSphere.position.x, sphereBaseY, playerSphere.position.z);

  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start Screen Logic
document.addEventListener("DOMContentLoaded", () => {
  const startScreen = document.getElementById("startScreen");
  const startGameButton = document.getElementById("startGameButton"); // Though likely unused now
  const startButtonSphere = document.getElementById("startButtonSphere");
  // const controlsHintElement = document.getElementById("controlsHint"); // Get the new element // REMOVED

  function actualStartGame() {
    if (gameIsRunning) return; // Prevent multiple starts
    gameIsRunning = true;
    controlsInteractionCount = 0; // Reset count on new game start

    // Display controls hint
    const inGameHintElement = document.getElementById("inGameControlsHint");
    if (inGameHintElement) {
      if (navigator.maxTouchPoints > 0) {
        inGameHintElement.innerText = "Swipe to move. \n\nDon't lose.";
      } else {
        inGameHintElement.innerText = "Use arrow keys to move.\nDon't lose.";
      }
      inGameHintElement.style.display = "block";
    }

    // startScreen.style.display = "none"; // This will be handled by the animation flow now or can remain if desired after fade
    actualHopsTaken = 0; // Ensure actual hops are reset
    displayedSteps = 0; // Ensure displayed steps are reset
    spawnedGrayBallsForDisplayedStep.clear(); // Use renamed Set
    stepCounterElement.innerText = displayedSteps;
    renderer.setClearColor(initialSkyColor.clone());
    currentStepSize = initialStepSize;
    currentActualHopHeight = initialHopHeight;
    currentActualHopDuration = initialHopDuration;
    currentFloraItemsPerHop = initialFloraItemsPerHop; // Reset flora items count
    // Clear new terrain arrays on game start for a full reset
    [crystalShards, floatingOrbs, ancientMonoliths, signs, groundTexts].forEach(
      (arr) => {
        arr.forEach((obj) => {
          if (obj.isMesh || obj.isGroup) scene.remove(obj); // Check if it's a scene object
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
          if (obj.children) {
            // For groups like signs
            obj.children.forEach((child) => {
              if (child.geometry) child.geometry.dispose();
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((m) => m.dispose());
                } else {
                  child.material.dispose();
                }
              }
            });
          }
        });
        arr.length = 0; // Clear the array
      }
    );
    spawnedGroundTextsForDisplayedStep.clear();
    // Hide game over screen elements if restarting
    const gameOverScreen = document.getElementById("gameOverScreen");
    const gameOverMessage = document.getElementById("gameOverMessage");
    gameOverScreen.style.visibility = "hidden";
    gameOverScreen.style.backgroundColor = "rgba(70, 70, 70, 0)";
    gameOverMessage.style.opacity = "0";
    isFadingToGray = false; // Reset fade flag

    // Ensure startScreen is fully hidden after animations if not already
    if (startScreen.style.display !== "none") {
      startScreen.style.display = "none";
    }
  }

  //   startGameButton.addEventListener("click", actualStartGame); // Likely unused

  startButtonSphere.addEventListener("click", () => {
    if (gameIsRunning) return; // Prevent re-triggering if already in process

    // Disable further clicks on the sphere during animation
    startButtonSphere.style.pointerEvents = "none";

    // Add class to trigger sphere's "born" animation
    startButtonSphere.classList.add("sphere-born");

    // Wait for sphere animation (0.3s as per CSS)
    setTimeout(() => {
      // Start fading out the start screen
      startScreen.style.opacity = "0";

      // Wait for start screen fade out (0.5s as per CSS)
      setTimeout(() => {
        actualStartGame(); // Call the original game start logic

        // Optionally, reset sphere for potential reuse if start screen could reappear
        // startButtonSphere.classList.remove("sphere-born");
        // startButtonSphere.style.pointerEvents = 'auto';
      }, 500); // Duration of startScreen fade
    }, 300); // Duration of sphere-born animation
  });
});

// Start animation loop immediately for background rendering
animate();

// Initial flora generation when the game starts (will be visible once start screen is dismissed)
generateFlora();

function createCrystalShard(position) {
  const height = Math.random() * 1.2 + 0.5; // Height 0.5 to 1.7
  const radius = Math.random() * 0.1 + 0.05; // Radius 0.05 to 0.15
  // Cylinder with 0 top radius to make it pointy, or use ConeGeometry
  const shardGeometry = new THREE.CylinderGeometry(0, radius, height, 8);
  const shard = new THREE.Mesh(shardGeometry, crystalShardMaterial);

  shard.position.copy(position);
  shard.position.y = height / 2; // Base on the ground
  shard.rotation.x = (Math.random() - 0.5) * 0.2; // Slight tilt
  shard.rotation.z = (Math.random() - 0.5) * 0.2; // Slight tilt
  shard.castShadow = true;

  scene.add(shard);
  crystalShards.push(shard);
  if (crystalShards.length > maxCrystalShards) {
    const oldShard = crystalShards.shift();
    scene.remove(oldShard);
    oldShard.geometry.dispose();
  }
}

function createFloatingOrb(position) {
  const radius = Math.random() * 0.3 + 0.2; // Radius 0.2 to 0.5
  const orbGeometry = new THREE.SphereGeometry(radius, 16, 16);
  const orb = new THREE.Mesh(orbGeometry, floatingOrbMaterial);

  orb.position.copy(position);
  orb.position.y = Math.random() * 1.0 + 1.0; // Float between 1.0 and 2.0 units high
  orb.castShadow = true;

  scene.add(orb);
  floatingOrbs.push(orb);
  if (floatingOrbs.length > maxFloatingOrbs) {
    const oldOrb = floatingOrbs.shift();
    scene.remove(oldOrb);
    oldOrb.geometry.dispose();
  }
}

function createAncientMonolith(position) {
  const height = Math.random() * 2.5 + 1.5; // Height 1.5 to 4.0
  const width = Math.random() * 0.2 + 0.1;
  const depth = Math.random() * 0.2 + 0.1;
  const monolithGeometry = new THREE.BoxGeometry(width, height, depth);
  const monolith = new THREE.Mesh(monolithGeometry, ancientMonolithMaterial);

  monolith.position.copy(position);
  monolith.position.y = height / 2;
  monolith.rotation.y = Math.random() * Math.PI * 0.1; // Slight random rotation
  monolith.castShadow = true;

  scene.add(monolith);
  ancientMonoliths.push(monolith);
  if (ancientMonoliths.length > maxAncientMonoliths) {
    const oldMonolith = ancientMonoliths.shift();
    scene.remove(oldMonolith);
    oldMonolith.geometry.dispose();
  }
}

function createSign(basePosition, text, isLeft) {
  const signGroup = new THREE.Group();

  // Post - Bigger
  const postHeight = 2.5; // Increased from 1.5
  const postRadius = 0.07; // Slightly thicker post
  const postGeo = new THREE.CylinderGeometry(
    postRadius,
    postRadius,
    postHeight,
    10
  );
  const post = new THREE.Mesh(postGeo, signPostMaterial);
  post.position.y = postHeight / 2;
  post.castShadow = true;
  signGroup.add(post);

  // Panel - Bigger
  const panelWidth = 2.0;
  const panelHeight = 1.0;
  const panelDepth = 0.15; // Increased from 0.08 to make it thicker
  const panelGeo = new THREE.BoxGeometry(panelWidth, panelHeight, panelDepth);

  let texturedPanelMaterial;
  // Generate a unique cache key for text + arrow direction/or lack thereof
  let cacheKey;
  if (isLeft === true) {
    cacheKey = text + "_left_arrow";
  } else if (isLeft === false) {
    cacheKey = text + "_right_arrow";
  } else {
    // isLeft is null or undefined for centered/no arrow
    cacheKey = text + "_centered";
  }

  if (signPanelTextureMaterialCache[cacheKey]) {
    texturedPanelMaterial = signPanelTextureMaterialCache[cacheKey];
  } else {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const canvasWidth = 512;
    const canvasHeight = 256;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    context.fillStyle = "#F5DEB3"; /* Wheat */
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    const fontSize = 40; // Slightly adjusted for potentially longer centered text
    context.font = `bold ${fontSize}px Arial`;
    context.fillStyle = "black";
    context.textAlign = "center";
    context.textBaseline = "middle";

    let textToRender = text;
    if (isLeft === true || isLeft === false) {
      // Only add arrows for side signs
      const arrowUnicode = isLeft ? "\u2190" : "\u2192"; // Left arrow: ←, Right arrow: →
      textToRender = isLeft
        ? `${arrowUnicode} ${text}`
        : `${text} ${arrowUnicode}`;
    }
    // For centered sign (isLeft is null), textToRender is just text

    // Basic word wrapping for longer texts like the new one
    const words = textToRender.split(" ");
    let line = "";
    let lines = [];
    const maxWidth = canvasWidth - 20; // Max width for text with some padding

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line.trim());
        line = words[n] + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());

    const lineHeight = fontSize * 1.2;
    const startY = canvasHeight / 2 - ((lines.length - 1) * lineHeight) / 2;

    for (let i = 0; i < lines.length; i++) {
      context.fillText(lines[i], canvasWidth / 2, startY + i * lineHeight);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texturedPanelMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });
    signPanelTextureMaterialCache[cacheKey] = texturedPanelMaterial;
  }

  const panel = new THREE.Mesh(panelGeo, texturedPanelMaterial);
  panel.position.y = postHeight - panelHeight / 2 - 0.15;
  panel.castShadow = true;
  signGroup.add(panel);

  // Positioning and Rotation
  const forwardOffset = 4.0;
  let sideOffset = 0; // Default to 0 for centered
  let rotationY = 0; // Default to 0 for centered

  if (isLeft === true) {
    sideOffset = -2.5;
    rotationY = Math.PI / 7;
  } else if (isLeft === false) {
    sideOffset = 2.5;
    rotationY = -Math.PI / 7;
  }
  // if isLeft is null, sideOffset and rotationY remain 0, placing the sign centered ahead.

  signGroup.position.x = basePosition.x + sideOffset;
  signGroup.position.y = basePosition.y; // Assumes basePosition.y is ground level (sphereBaseY)
  signGroup.position.z = basePosition.z - forwardOffset;
  signGroup.rotation.y = rotationY;

  scene.add(signGroup);
  signs.push(signGroup);
  if (signs.length > maxSigns) {
    const oldSign = signs.shift();
    scene.remove(oldSign);
    oldSign.children.forEach((child) => {
      if (child.geometry) child.geometry.dispose();
      // Material and texture are cached, so don't dispose them here
    });
  }
}

function createGroundText(position, text) {
  let material;
  let texture; // Declare texture here
  const cacheKey = text;

  if (groundTextTextureCache[cacheKey]) {
    material = groundTextTextureCache[cacheKey];
    texture = material.map; // Get texture from cached material
  } else {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const canvasWidth = 1024; // Increased from 512
    const canvasHeight = 128; // Adjust based on text lines (single line here)
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    context.font = "bold 64px Arial"; // Font size and style - INCREASED from 48px
    context.fillStyle = "rgba(255, 255, 255, 0.9)"; // White text, slightly transparent
    context.textAlign = "center";
    context.textBaseline = "middle";

    context.fillText(text, canvasWidth / 2, canvasHeight / 2);

    texture = new THREE.CanvasTexture(canvas); // Assign newly created texture
    texture.needsUpdate = true;
    material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1, // To handle semi-transparent edges better
      side: THREE.DoubleSide, // Visible from top and bottom if camera clips
    });
    groundTextTextureCache[cacheKey] = material;
  }

  // Adjust plane size based on canvas aspect ratio to avoid distortion
  const planeWidth = 6; // Desired world width of the text plane - INCREASED from 4
  const planeHeight = planeWidth * (texture.image.height / texture.image.width);
  const planeGeo = new THREE.PlaneGeometry(planeWidth, planeHeight);

  const textPlane = new THREE.Mesh(planeGeo, material);
  textPlane.position.copy(position);
  textPlane.position.y = 0.02; // Slightly above the ground
  textPlane.rotation.x = -Math.PI / 2; // Rotate to be flat on the ground

  scene.add(textPlane);
  groundTexts.push(textPlane);

  if (groundTexts.length > maxGroundTexts) {
    const oldText = groundTexts.shift();
    scene.remove(oldText);
    if (oldText.geometry) oldText.geometry.dispose();
    // Material is cached, so don't dispose it here unless it's uniquely generated and not cached
    // if (oldText.material.map) oldText.material.map.dispose();
    // if (oldText.material) oldText.material.dispose();
  }
}

function generateFlora() {
  const genX = playerSphere.position.x;
  const genZ = playerSphere.position.z - grassForwardOffset;
  const floraReductionProgress = Math.min(1, displayedSteps / 83);
  currentFloraItemsPerHop = Math.floor(
    initialFloraItemsPerHop * (1 - floraReductionProgress)
  );
  currentFloraItemsPerHop = Math.max(0, currentFloraItemsPerHop);

  for (let i = 0; i < currentFloraItemsPerHop; i++) {
    const angle = Math.random() * Math.PI * 2,
      radius = Math.random() * grassGenerationRadius;
    const floraPos = new THREE.Vector3(
      genX + Math.cos(angle) * radius,
      0,
      genZ + Math.sin(angle) * radius
    );
    if (Math.random() < flowerChance) createFlower(floraPos);
    else createGrassBlade(floraPos);
  }

  // --- Generate Phased Terrain ---
  const terrainPlacementRadius = grassGenerationRadius * 0.8; // Place special items a bit closer generally

  // Phase 1: Crystal Shards (Steps 15-25)
  if (displayedSteps >= 15 && displayedSteps <= 25) {
    const phaseProgress = (displayedSteps - 15) / (25 - 15);
    const crystalSpawnChance = initialCrystalSpawnChance * (1 - phaseProgress);
    if (Math.random() < crystalSpawnChance) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * terrainPlacementRadius;
      const shardPos = new THREE.Vector3(
        genX + Math.cos(angle) * radius,
        0,
        genZ + Math.sin(angle) * radius
      );
      createCrystalShard(shardPos);
    }
  }

  // Phase 2: Floating Orbs (Steps 26-40)
  if (displayedSteps >= 26 && displayedSteps <= 40) {
    const phaseProgress = (displayedSteps - 26) / (40 - 26);
    const orbSpawnChance = initialOrbSpawnChance * (1 - phaseProgress);
    if (Math.random() < orbSpawnChance) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * terrainPlacementRadius;
      const orbPos = new THREE.Vector3(
        genX + Math.cos(angle) * radius,
        0,
        genZ + Math.sin(angle) * radius
      );
      createFloatingOrb(orbPos);
    }
  }

  // Phase 3: Ancient Monoliths (Steps 41-83)
  if (displayedSteps >= 41 && displayedSteps <= 83) {
    const phaseProgress = (displayedSteps - 41) / (83 - 41);
    const monolithSpawnChance =
      initialMonolithSpawnChance * (1 - phaseProgress);
    if (Math.random() < monolithSpawnChance) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * terrainPlacementRadius;
      const monolithPos = new THREE.Vector3(
        genX + Math.cos(angle) * radius,
        0,
        genZ + Math.sin(angle) * radius
      );
      createAncientMonolith(monolithPos);
    }
  }
}
