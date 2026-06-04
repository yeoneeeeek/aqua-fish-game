const STORAGE_KEY = 'miniAquaFishGame:v1';
const FEED_COOLDOWN = 60 * 1000;
const CLEAN_COOLDOWN = 5 * 60 * 1000;
const FISH_PRICE = 100;
const MAX_GROWTH = 100;

const aquarium = document.getElementById('aquarium');
const coinCount = document.getElementById('coinCount');
const fishCount = document.getElementById('fishCount');
const growthStatus = document.getElementById('growthStatus');
const feedBtn = document.getElementById('feedBtn');
const cleanBtn = document.getElementById('cleanBtn');
const buyFishBtn = document.getElementById('buyFishBtn');
const feedCooldown = document.getElementById('feedCooldown');
const cleanCooldown = document.getElementById('cleanCooldown');
const notice = document.getElementById('notice');

const fishColors = [
  ['#ffb15e', '#ff6f91'],
  ['#ffd45a', '#ff9d56'],
  ['#87e1ff', '#4f8dff'],
  ['#c49cff', '#7f7cff'],
  ['#94e66f', '#2fbf8f']
];

let state = loadState();
let fishes = [];
let lastFrame = performance.now();

function createDefaultState() {
  return {
    coins: 0,
    lastFeedAt: 0,
    lastCleanAt: 0,
    fishes: [createFishData()]
  };
}

function createFishData() {
  const rect = aquarium.getBoundingClientRect();
  const color = fishColors[Math.floor(Math.random() * fishColors.length)];
  const directionX = Math.random() > 0.5 ? 1 : -1;
  const directionY = Math.random() > 0.5 ? 0.55 : -0.55;

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    x: randomNumber(42, Math.max(43, rect.width - 88)),
    y: randomNumber(58, Math.max(59, rect.height - 130)),
    dx: directionX,
    dy: directionY,
    speed: randomNumber(18, 30),
    growth: 0,
    colors: color
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) return createDefaultState();

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.fishes) || parsed.fishes.length === 0) {
      return createDefaultState();
    }
    return parsed;
  } catch (error) {
    return createDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderFishes() {
  fishes.forEach(fish => fish.el.remove());
  fishes = [];

  state.fishes.forEach(data => {
    const fish = document.createElement('div');
    fish.className = 'fish';
    fish.dataset.id = data.id;
    fish.innerHTML = `
      <div class="fish-tail"></div>
      <div class="fish-body">
        <div class="fish-eye"></div>
        <div class="fish-fin"></div>
      </div>
    `;

    const body = fish.querySelector('.fish-body');
    const tail = fish.querySelector('.fish-tail');
    body.style.background = `linear-gradient(135deg, ${data.colors[0]}, ${data.colors[1]})`;
    tail.style.background = data.colors[0];

    aquarium.appendChild(fish);
    fishes.push({ el: fish, data });
  });
}

function updateUI() {
  coinCount.textContent = state.coins;
  fishCount.textContent = `${state.fishes.length}마리`;

  const maxGrowth = Math.max(...state.fishes.map(fish => fish.growth));
  growthStatus.textContent = `${maxGrowth}%`;

  buyFishBtn.disabled = state.coins < FISH_PRICE;
}

function updateCooldowns() {
  const now = Date.now();
  const feedRemaining = Math.max(0, FEED_COOLDOWN - (now - state.lastFeedAt));
  const cleanRemaining = Math.max(0, CLEAN_COOLDOWN - (now - state.lastCleanAt));

  feedBtn.disabled = feedRemaining > 0;
  cleanBtn.disabled = cleanRemaining > 0;

  feedCooldown.textContent = feedRemaining > 0 ? `${formatTime(feedRemaining)} 후 가능` : '+10 coin';
  cleanCooldown.textContent = cleanRemaining > 0 ? `${formatTime(cleanRemaining)} 후 가능` : '+20 coin';
}

function feedFish() {
  if (Date.now() - state.lastFeedAt < FEED_COOLDOWN) return;

  state.coins += 10;
  state.lastFeedAt = Date.now();
  state.fishes = state.fishes.map(fish => ({
    ...fish,
    growth: Math.min(MAX_GROWTH, fish.growth + 1)
  }));

  createFoodEffect();
  showNotice('냠냠! 물고기들이 조금 더 통통해졌어요. +10 coin');
  saveState();
  updateUI();
  updateCooldowns();
}

function cleanTank() {
  if (Date.now() - state.lastCleanAt < CLEAN_COOLDOWN) return;

  state.coins += 20;
  state.lastCleanAt = Date.now();

  const shine = document.createElement('div');
  shine.className = 'clean-shine';
  aquarium.appendChild(shine);
  shine.addEventListener('animationend', () => shine.remove());

  showNotice('반짝반짝! 수조가 깨끗해졌어요. +20 coin');
  saveState();
  updateUI();
  updateCooldowns();
}

function buyFish() {
  if (state.coins < FISH_PRICE) return;

  state.coins -= FISH_PRICE;
  state.fishes.push(createFishData());
  renderFishes();
  showNotice('새로운 물고기가 수조에 들어왔어요!');
  saveState();
  updateUI();
}

function swim(currentTime) {
  const delta = (currentTime - lastFrame) / 1000;
  lastFrame = currentTime;

  const rect = aquarium.getBoundingClientRect();
  const padding = 10;

  fishes.forEach(({ el, data }) => {
    const scale = 1 + data.growth / 100;
    const fishWidth = 58 * scale;
    const fishHeight = 34 * scale;

    data.x += data.dx * data.speed * delta;
    data.y += data.dy * data.speed * delta;

    if (data.x <= padding || data.x + fishWidth >= rect.width - padding) {
      data.dx *= -1;
      data.dy = Math.random() > 0.5 ? 0.58 : -0.58;
      data.y += data.dy * 8;
    }

    if (data.y <= 42 || data.y + fishHeight >= rect.height - 86) {
      data.dy *= -1;
    }

    data.x = clamp(data.x, padding, rect.width - fishWidth - padding);
    data.y = clamp(data.y, 42, rect.height - fishHeight - 86);

    const flip = data.dx > 0 ? 'scaleX(1)' : 'scaleX(-1)';
    el.style.transform = `translate(${data.x}px, ${data.y}px) ${flip} scale(${scale})`;
  });

  requestAnimationFrame(swim);
}

function createFoodEffect() {
  for (let i = 0; i < 10; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'feed-dot';
    dot.style.left = `${randomNumber(60, aquarium.clientWidth - 70)}px`;
    dot.style.top = `${randomNumber(40, 120)}px`;
    dot.style.animationDelay = `${i * 0.04}s`;
    aquarium.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
  }
}

function showNotice(message) {
  notice.textContent = message;
}

function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) return `${seconds}초`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function randomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

feedBtn.addEventListener('click', feedFish);
cleanBtn.addEventListener('click', cleanTank);
buyFishBtn.addEventListener('click', buyFish);

window.addEventListener('beforeunload', saveState);
window.addEventListener('resize', () => {
  state.fishes.forEach(fish => {
    fish.x = clamp(fish.x, 10, aquarium.clientWidth - 80);
    fish.y = clamp(fish.y, 42, aquarium.clientHeight - 120);
  });
});

renderFishes();
updateUI();
updateCooldowns();
setInterval(updateCooldowns, 500);
requestAnimationFrame(swim);
