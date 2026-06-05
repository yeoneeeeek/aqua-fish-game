const STORAGE_KEY = "aquaFishGame_v2";

const MAX_HEARTS = 5;
const HEART_COOLDOWN = 15 * 1000;
const CLEAN_COOLDOWN = 5 * 60 * 1000;
const FISH_PRICE = 100;
const FEED_REWARD = 10;
const CLEAN_REWARD = 20;
const MAX_GROWTH = 100;

const aquarium = document.getElementById("aquarium");
const coinCount = document.getElementById("coinCount");
const heartCount = document.getElementById("heartCount");
const heartTimer = document.getElementById("heartTimer");
const fishCount = document.getElementById("fishCount");
const feedBtn = document.getElementById("feedBtn");
const cleanBtn = document.getElementById("cleanBtn");
const cleanTimer = document.getElementById("cleanTimer");
const buyFishBtn = document.getElementById("buyFishBtn");
const resetBtn = document.getElementById("resetBtn");

const fishDesignTypes = [1, 2, 3, 4, 5];

let state = loadState();
let fishNodes = new Map();
let lastFrameTime = performance.now();

function createInitialState() {
  return {
    coins: 0,
    hearts: MAX_HEARTS,
    lastHeartAt: Date.now(),
    lastCleanAt: 0,
    fish: [createFishData(true)]
  };
}

function createFishData(isFirst = false) {
  const bounds = getAquariumBounds();
  const angle = randomPick([-30, 30]) * Math.PI / 180;
  const direction = Math.random() > 0.5 ? 1 : -1;

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `fish_${Date.now()}_${Math.random()}`,
    type: isFirst ? 1 : randomPick(fishDesignTypes),
    x: random(30, Math.max(31, bounds.width - 90)),
    y: random(60, Math.max(61, bounds.height - 140)),
    vx: direction * random(18, 31),
    vy: Math.sin(angle) * random(14, 26),
    growth: 0
  };
}

function getAquariumBounds() {
  return {
    width: aquarium.clientWidth || 350,
    height: aquarium.clientHeight || 455
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.fish) || saved.fish.length === 0) {
      return createInitialState();
    }

    return {
      coins: Number(saved.coins) || 0,
      hearts: Math.min(MAX_HEARTS, Number(saved.hearts) || 0),
      lastHeartAt: Number(saved.lastHeartAt) || Date.now(),
      lastCleanAt: Number(saved.lastCleanAt) || 0,
      fish: saved.fish.map((fish, index) => ({
        id: fish.id || `fish_${index}_${Date.now()}`,
        type: fish.type || randomPick(fishDesignTypes),
        x: Number(fish.x) || random(40, 240),
        y: Number(fish.y) || random(80, 280),
        vx: Number(fish.vx) || randomPick([-1, 1]) * random(18, 31),
        vy: Number(fish.vy) || randomPick([-1, 1]) * random(8, 18),
        growth: Math.min(MAX_GROWTH, Number(fish.growth) || 0)
      }))
    };
  } catch (error) {
    return createInitialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function randomPick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return min > 0 ? `${min}:${String(sec).padStart(2, "0")}` : `${sec}s`;
}

function restoreHearts() {
  if (state.hearts >= MAX_HEARTS) {
    state.hearts = MAX_HEARTS;
    state.lastHeartAt = Date.now();
    return;
  }

  const now = Date.now();
  const elapsed = now - state.lastHeartAt;
  const recovered = Math.floor(elapsed / HEART_COOLDOWN);

  if (recovered > 0) {
    state.hearts = Math.min(MAX_HEARTS, state.hearts + recovered);
    state.lastHeartAt += recovered * HEART_COOLDOWN;

    if (state.hearts >= MAX_HEARTS) {
      state.lastHeartAt = now;
    }

    saveState();
  }
}

function renderFish() {
  state.fish.forEach(fish => {
    if (fishNodes.has(fish.id)) return;

    const fishEl = document.createElement("div");
    fishEl.className = `fish type-${fish.type}`;
    fishEl.dataset.id = fish.id;
    fishEl.innerHTML = `
      <span class="fish-tail"></span>
      <span class="fish-body"></span>
      <span class="fish-fin"></span>
      <span class="fish-eye"></span>
      <span class="fish-mouth"></span>
    `;
    aquarium.appendChild(fishEl);
    fishNodes.set(fish.id, fishEl);
  });
}

function updateFishPositions(deltaSeconds) {
  const bounds = getAquariumBounds();
  const fishWidth = 58;
  const fishHeight = 34;
  const padding = 13;

  state.fish.forEach(fish => {
    fish.x += fish.vx * deltaSeconds;
    fish.y += fish.vy * deltaSeconds;

    const scale = 1 + fish.growth / 100;
    const maxX = bounds.width - fishWidth * scale - padding;
    const maxY = bounds.height - fishHeight * scale - 86;
    const minX = padding;
    const minY = 42;

    if (fish.x <= minX || fish.x >= maxX) {
      fish.x = Math.min(Math.max(fish.x, minX), maxX);
      const direction = fish.x <= minX ? 1 : -1;
      const angle = randomPick([-30, 30]) * Math.PI / 180;
      const speed = random(18, 31);
      fish.vx = direction * speed;
      fish.vy = Math.sin(angle) * random(20, 34);
    }

    if (fish.y <= minY || fish.y >= maxY) {
      fish.y = Math.min(Math.max(fish.y, minY), maxY);
      fish.vy *= -1;
    }

    const node = fishNodes.get(fish.id);
    if (node) {
      const flip = fish.vx > 0 ? "scaleX(-1)" : "scaleX(1)";
      node.style.left = `${fish.x}px`;
      node.style.top = `${fish.y}px`;
      node.style.transform = `${flip} scale(${scale})`;
    }
  });
}

function updateUI() {
  restoreHearts();

  coinCount.textContent = state.coins;
  heartCount.textContent = state.hearts;
  fishCount.textContent = `${state.fish.length}마리`;

  if (state.hearts >= MAX_HEARTS) {
    heartTimer.textContent = "MAX";
  } else {
    const nextHeartIn = HEART_COOLDOWN - (Date.now() - state.lastHeartAt);
    heartTimer.textContent = formatTime(nextHeartIn);
  }

  const cleanRemain = CLEAN_COOLDOWN - (Date.now() - state.lastCleanAt);
  cleanBtn.disabled = cleanRemain > 0;
  cleanTimer.textContent = cleanRemain > 0 ? formatTime(cleanRemain) : "READY";

  feedBtn.disabled = state.hearts <= 0;
  buyFishBtn.disabled = state.coins < FISH_PRICE;
}

function showToast(text) {
  const toast = document.createElement("div");
  toast.className = "sparkle";
  toast.textContent = text;
  toast.style.left = `${random(90, aquarium.clientWidth - 130)}px`;
  toast.style.top = `${random(70, 190)}px`;
  aquarium.appendChild(toast);
  setTimeout(() => toast.remove(), 900);
}

function dropFood() {
  for (let i = 0; i < 5; i += 1) {
    const food = document.createElement("span");
    food.className = "feed-piece";
    food.style.left = `${random(55, aquarium.clientWidth - 65)}px`;
    food.style.top = `${random(38, 84)}px`;
    food.style.animationDelay = `${i * 0.08}s`;
    aquarium.appendChild(food);
    setTimeout(() => food.remove(), 1700);
  }
}

function feedFish() {
  restoreHearts();

  if (state.hearts <= 0) {
    showToast("하트 부족!");
    updateUI();
    return;
  }

  state.hearts -= 1;
  if (state.hearts === MAX_HEARTS - 1) {
    state.lastHeartAt = Date.now();
  }

  state.coins += FEED_REWARD;
  state.fish = state.fish.map(fish => ({
    ...fish,
    growth: Math.min(MAX_GROWTH, fish.growth + 1)
  }));

  dropFood();
  showToast("+10 🪙");
  saveState();
  updateUI();
}

function cleanTank() {
  const remain = CLEAN_COOLDOWN - (Date.now() - state.lastCleanAt);
  if (remain > 0) return;

  state.coins += CLEAN_REWARD;
  state.lastCleanAt = Date.now();
  showToast("깨끗해! +20 🪙");
  saveState();
  updateUI();
}

function buyFish() {
  if (state.coins < FISH_PRICE) return;

  state.coins -= FISH_PRICE;
  const newFish = createFishData(false);
  state.fish.push(newFish);
  renderFish();
  showToast("새 친구 등장! 🐠");
  saveState();
  updateUI();
}

function resetGame() {
  const ok = confirm("저장된 게임 데이터를 초기화할까요?");
  if (!ok) return;

  localStorage.removeItem(STORAGE_KEY);
  state = createInitialState();
  fishNodes.forEach(node => node.remove());
  fishNodes.clear();
  renderFish();
  saveState();
  updateUI();
}

function gameLoop(currentTime) {
  const deltaSeconds = Math.min(0.04, (currentTime - lastFrameTime) / 1000);
  lastFrameTime = currentTime;

  updateFishPositions(deltaSeconds);
  requestAnimationFrame(gameLoop);
}

feedBtn.addEventListener("click", feedFish);
cleanBtn.addEventListener("click", cleanTank);
buyFishBtn.addEventListener("click", buyFish);
resetBtn.addEventListener("click", resetGame);

renderFish();
updateUI();
setInterval(updateUI, 500);
setInterval(saveState, 3000);
requestAnimationFrame(gameLoop);
