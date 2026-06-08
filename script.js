const STORAGE_KEY = "aquaFishGame_v2";

const MAX_HEARTS = 5;
const HEART_COOLDOWN = 15 * 1000;
const CLEAN_COOLDOWN = 5 * 60 * 1000;
const ALGAE_AFTER = 10 * 60 * 1000;
const FISH_PRICE = 100;
const BASE_MAX_FISH = 25;
const MAX_FISH_PER_EXPANSION = 10;
const EXPAND_PRICE = 5000;
const SEAWEED_PRICE = 100;
const ROCK_PRICE = 200;
const GOLDEN_CHANCE = 0.3;
const FEED_REWARD = 10;
const CLEAN_REWARD = 30;
const MAX_GROWTH = 100;
const MAX_FEED_COUNT = 30;
const GROWTH_PER_FEED = MAX_GROWTH / MAX_FEED_COUNT;

const aquarium = document.getElementById("aquarium");
const coinCount = document.getElementById("coinCount");
const heartCount = document.getElementById("heartCount");
const heartTimer = document.getElementById("heartTimer");
const fishCount = document.getElementById("fishCount");
const feedBtn = document.getElementById("feedBtn");
const cleanBtn = document.getElementById("cleanBtn");
const cleanTimer = document.getElementById("cleanTimer");
const buyFishBtn = document.getElementById("buyFishBtn");
const decorateBtn = document.getElementById("decorateBtn");
const decorateModal = document.getElementById("decorateModal");
const decorateCloseBtn = document.getElementById("decorateCloseBtn");
const expandTankBtn = document.getElementById("expandTankBtn");
const buySeaweedBtn = document.getElementById("buySeaweedBtn");
const buyRockBtn = document.getElementById("buyRockBtn");
const resetBtn = document.getElementById("resetBtn");
const sellModal = document.getElementById("sellModal");
const sellYesBtn = document.getElementById("sellYesBtn");
const sellNoBtn = document.getElementById("sellNoBtn");
const sellModalText = document.getElementById("sellModalText");
const decoEditModal = document.getElementById("decoEditModal");
const decoMoveBtn = document.getElementById("decoMoveBtn");
const decoDeleteBtn = document.getElementById("decoDeleteBtn");
const decoCancelBtn = document.getElementById("decoCancelBtn");

const fishDesignTypes = [1, 2, 3, 4, 5];
const fishMessages = ["나랑 놀래?", "배고파요", "밥주세요", "여기는 어디지?", "나 이만큼 컸어요!"];

let state = loadState();
let fishNodes = new Map();
let lastFrameTime = performance.now();
let sellTargetFishId = null;
let longPressTimer = null;
let longPressTriggered = false;
let decoLongPressTimer = null;
let decoEditTargetId = null;
let movingDecorationId = null;
let activeDecoPointerId = null;
let activeDecoId = null;

const algaeLayer = document.createElement("div");
algaeLayer.className = "algae-layer";
aquarium.appendChild(algaeLayer);

const cleanSponge = document.createElement("div");
cleanSponge.className = "clean-sponge";
aquarium.appendChild(cleanSponge);

const cleanShine = document.createElement("div");
cleanShine.className = "clean-shine";
aquarium.appendChild(cleanShine);

function createInitialState() {
  return {
    coins: 0,
    hearts: MAX_HEARTS,
    lastHeartAt: Date.now(),
    lastCleanAt: 0,
    expansions: 0,
    decorations: [],
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
    growth: 0,
    feedCount: 0,
    isInteracting: false,
    isGolden: false
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
      expansions: Math.max(0, Number(saved.expansions) || 0),
      decorations: Array.isArray(saved.decorations)
        ? saved.decorations.map((item, index) => ({
          id: item.id || `deco_${index}_${Date.now()}`,
          kind: item.kind === "rock" ? "rock" : "seaweed",
          x: Number(item.x) || random(24, 280),
          bottom: Number(item.bottom) || random(40, 56)
        }))
        : [],
      fish: saved.fish.map((fish, index) => ({
        id: fish.id || `fish_${index}_${Date.now()}`,
        type: fish.type || randomPick(fishDesignTypes),
        x: Number(fish.x) || random(40, 240),
        y: Number(fish.y) || random(80, 280),
        vx: Number(fish.vx) || randomPick([-1, 1]) * random(18, 31),
        vy: Number(fish.vy) || randomPick([-1, 1]) * random(8, 18),
        feedCount: Math.min(MAX_FEED_COUNT, Number.isFinite(Number(fish.feedCount)) && Number(fish.feedCount) > 0
          ? Number(fish.feedCount)
          : Math.round((Number(fish.growth) || 0) / GROWTH_PER_FEED)),
        growth: 0,
        isInteracting: false,
        isGolden: Boolean(fish.isGolden)
      })).map(fish => ({
        ...fish,
        growth: Math.min(MAX_GROWTH, fish.feedCount * GROWTH_PER_FEED)
      }))
    };
  } catch (error) {
    return createInitialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getMaxFishCount() {
  return BASE_MAX_FISH + (Math.max(0, Number(state.expansions) || 0) * MAX_FISH_PER_EXPANSION);
}

function getTankInnerScale() {
  const level = Math.max(0, Number(state.expansions) || 0);
  if (level <= 0) return 1;
  return Math.max(0.62, 1 / (1 + 0.3 * level));
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
    fishEl.classList.toggle("is-golden", Boolean(fish.isGolden));
    fishEl.dataset.id = fish.id;
    fishEl.innerHTML = `
      <span class="fish-speech" aria-hidden="true"></span>
      <span class="growth-complete" aria-hidden="true">성장완료!</span>
      <span class="fish-art" aria-hidden="true">
        <span class="fish-tail"></span>
        <span class="fish-body"></span>
        <span class="fish-fin"></span>
        <span class="fish-eye"></span>
        <span class="fish-mouth"></span>
      </span>
    `;

    fishEl.addEventListener("pointerdown", event => {
      event.preventDefault();
      startFishPress(fish.id);
    });

    fishEl.addEventListener("pointerup", event => {
      event.preventDefault();
      finishFishPress(fish.id);
    });

    fishEl.addEventListener("pointercancel", cancelFishPress);
    fishEl.addEventListener("pointerleave", cancelFishPress);

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
    if (fish.isInteracting) return;

    fish.x += fish.vx * deltaSeconds;
    fish.y += fish.vy * deltaSeconds;

    const scale = (1 + fish.growth / 100) * getTankInnerScale();
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
      fish.justTurned = true;
    }

    if (fish.y <= minY || fish.y >= maxY) {
      fish.y = Math.min(Math.max(fish.y, minY), maxY);
      fish.vy *= -1;
    }

    const node = fishNodes.get(fish.id);
    if (node) {
      const isFacingRight = fish.vx > 0;
      node.classList.toggle("facing-right", isFacingRight);
      node.classList.toggle("is-grown", fish.feedCount >= MAX_FEED_COUNT || fish.growth >= MAX_GROWTH);
      node.classList.toggle("is-golden", Boolean(fish.isGolden));
      node.style.left = `${fish.x}px`;
      node.style.top = `${fish.y}px`;
      node.style.setProperty("--fish-scale", scale.toFixed(4));

      if (fish.justTurned) {
        node.classList.remove("is-turning");
        void node.offsetWidth;
        node.classList.add("is-turning");
        fish.justTurned = false;
      }
    }
  });
}

function updateUI() {
  restoreHearts();

  coinCount.textContent = state.coins;
  heartCount.textContent = state.hearts;
  fishCount.textContent = `${state.fish.length}/${getMaxFishCount()}마리`;

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
  buyFishBtn.disabled = state.coins < FISH_PRICE || state.fish.length >= getMaxFishCount();
  updateTankState();
}

function updateTankState() {
  const expansionLevel = Math.min(3, Math.max(0, Number(state.expansions) || 0));
  aquarium.classList.remove("expansion-1", "expansion-2", "expansion-3");
  if (expansionLevel > 0) aquarium.classList.add(`expansion-${expansionLevel}`);

  const hasAlgae = state.lastCleanAt > 0 && Date.now() - state.lastCleanAt >= ALGAE_AFTER;
  aquarium.classList.toggle("has-algae", hasAlgae);
}

function renderDecorations() {
  aquarium.querySelectorAll(".tank-deco").forEach(node => node.remove());
  const decorations = Array.isArray(state.decorations) ? state.decorations : [];
  const innerScale = getTankInnerScale();

  decorations.forEach(item => {
    const deco = document.createElement("span");
    deco.className = `tank-deco ${item.kind === "rock" ? "rock-deco" : "seaweed-deco"}`;
    deco.dataset.id = item.id;
    deco.style.left = `${Number(item.x) || random(25, aquarium.clientWidth - 70)}px`;
    deco.style.bottom = `${Number(item.bottom) || random(40, 54)}px`;
    deco.style.setProperty("--deco-scale", innerScale.toFixed(4));


    aquarium.appendChild(deco);
  });
}

function showToast(text) {
  const toast = document.createElement("div");
  toast.className = "sparkle coin-toast";
  toast.textContent = text;
  toast.style.left = `${random(58, Math.max(60, aquarium.clientWidth - 210))}px`;
  toast.style.top = `${random(72, 180)}px`;
  aquarium.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
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

function showFishSpeech(fishId, message = randomPick(fishMessages)) {
  const node = fishNodes.get(fishId);
  if (!node) return;

  const speech = node.querySelector(".fish-speech");
  if (!speech) return;

  speech.textContent = message;
  speech.classList.remove("show");
  void speech.offsetWidth;
  speech.classList.add("show");

  clearTimeout(speech.hideTimer);
  speech.hideTimer = setTimeout(() => {
    speech.classList.remove("show");
  }, 2600);
}

function startFishPress(fishId) {
  cancelFishPress();
  longPressTriggered = false;
  longPressTimer = setTimeout(() => {
    longPressTriggered = true;
    openSellModal(fishId);
  }, 650);
}

function finishFishPress(fishId) {
  clearTimeout(longPressTimer);
  longPressTimer = null;

  if (longPressTriggered) {
    longPressTriggered = false;
    return;
  }

  interactWithFish(fishId);
}

function cancelFishPress() {
  clearTimeout(longPressTimer);
  longPressTimer = null;
}

function openSellModal(fishId) {
  const fish = state.fish.find(item => item.id === fishId);

  if (!fish) return;

  if (fish.feedCount < MAX_FEED_COUNT && fish.growth < MAX_GROWTH) {
    showToast("다 자란 물고기만 판매 가능!");
    return;
  }

  sellTargetFishId = fishId;
  const sellReward = fish.isGolden ? 1000 : 500;
  const fishLabel = fish.isGolden ? "황금 물고기" : "일반 물고기";
  if (sellModalText) sellModalText.textContent = `${fishLabel}를 ${sellReward}코인에 판매하겠습니까?`;
  sellModal.classList.add("show");
  sellModal.setAttribute("aria-hidden", "false");
}

function closeSellModal() {
  sellTargetFishId = null;
  sellModal.classList.remove("show");
  sellModal.setAttribute("aria-hidden", "true");
}

function sellFish() {
  if (!sellTargetFishId) return;

  const targetIndex = state.fish.findIndex(fish => fish.id === sellTargetFishId);
  if (targetIndex === -1) {
    closeSellModal();
    return;
  }

  const [soldFish] = state.fish.splice(targetIndex, 1);
  const node = fishNodes.get(soldFish.id);
  if (node) node.remove();
  fishNodes.delete(soldFish.id);

  const sellReward = soldFish.isGolden ? 1000 : 500;
  state.coins += sellReward;
  showToast(`판매 완료! +${sellReward} 🪙`);
  closeSellModal();
  saveState();
  updateUI();
}

function interactWithFish(fishId) {
  const fish = state.fish.find(item => item.id === fishId);
  const node = fishNodes.get(fishId);

  if (!fish || !node || fish.isInteracting) return;

  fish.isInteracting = true;
  node.classList.add("is-interacting");
  showFishSpeech(fishId, "나랑 놀래?");

  setTimeout(() => {
    node.classList.remove("is-interacting");
    fish.isInteracting = false;
  }, 1900);
}

function showRandomFishSpeech() {
  if (!state.fish.length) return;
  const fish = randomPick(state.fish);
  showFishSpeech(fish.id);
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
  state.fish = state.fish.map(fish => {
    const nextFeedCount = Math.min(MAX_FEED_COUNT, (Number(fish.feedCount) || 0) + 1);
    const nextGrowth = nextFeedCount >= MAX_FEED_COUNT
      ? MAX_GROWTH
      : Number((nextFeedCount * GROWTH_PER_FEED).toFixed(4));

    const becameGrown = (Number(fish.feedCount) || 0) < MAX_FEED_COUNT && nextFeedCount >= MAX_FEED_COUNT;
    const shouldBecomeGolden = becameGrown && !fish.isGolden && Math.random() < GOLDEN_CHANCE;

    return {
      ...fish,
      feedCount: nextFeedCount,
      growth: nextGrowth,
      isGolden: Boolean(fish.isGolden || shouldBecomeGolden)
    };
  });

  dropFood();
  state.fish.forEach(fish => showFishSpeech(fish.id, "잘 먹겠습니다!"));
  showToast("+10 🪙");
  saveState();
  updateUI();
}

function cleanTank() {
  const remain = CLEAN_COOLDOWN - (Date.now() - state.lastCleanAt);
  if (remain > 0) return;

  cleanBtn.disabled = true;
  aquarium.classList.add("is-cleaning");

  setTimeout(() => {
    aquarium.classList.remove("has-algae");
    aquarium.classList.add("is-shining");

    state.coins += CLEAN_REWARD;
    state.lastCleanAt = Date.now();
    showToast("깨끗해! +30 🪙");
    saveState();
    updateUI();
  }, 1100);

  setTimeout(() => {
    aquarium.classList.remove("is-cleaning", "is-shining");
  }, 2200);
}

function buyFish() {
  if (state.fish.length >= getMaxFishCount()) {
    showToast("수조가 가득 찼어요!");
    return;
  }

  if (state.coins < FISH_PRICE) return;

  state.coins -= FISH_PRICE;
  const newFish = createFishData(false);
  state.fish.push(newFish);
  renderFish();
  showToast("새 친구 등장! 🐠");
  saveState();
  updateUI();
}

function openDecorateModal() {
  decorateModal.classList.add("show");
  decorateModal.setAttribute("aria-hidden", "false");
}

function closeDecorateModal() {
  decorateModal.classList.remove("show");
  decorateModal.setAttribute("aria-hidden", "true");
}

function spendCoins(amount) {
  if (state.coins < amount) {
    showToast("코인 부족!");
    return false;
  }

  state.coins -= amount;
  return true;
}

function expandTank() {
  if (!spendCoins(EXPAND_PRICE)) return;

  state.expansions = Math.max(0, Number(state.expansions) || 0) + 1;
  renderDecorations();
  showToast("수조 확장 완료!");
  saveState();
  updateUI();
}

function buyDecoration(kind) {
  const price = kind === "rock" ? ROCK_PRICE : SEAWEED_PRICE;
  if (!spendCoins(price)) return;

  if (!Array.isArray(state.decorations)) state.decorations = [];
  state.decorations.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `deco_${Date.now()}_${Math.random()}`,
    kind,
    x: random(24, Math.max(25, aquarium.clientWidth - 70)),
    bottom: random(40, 56)
  });

  renderDecorations();
  showToast(kind === "rock" ? "바위 추가!" : "해조류 추가!");
  saveState();
  updateUI();
}

function startDecorationPress(decoId) {
  cancelDecorationPress();
  activeDecoId = decoId;
  decoLongPressTimer = setTimeout(() => {
    if (!activeDecoId) return;
    openDecoEditModal(activeDecoId);
    activeDecoId = null;
    activeDecoPointerId = null;
    decoLongPressTimer = null;
  }, 1000);
}

function cancelDecorationPress() {
  clearTimeout(decoLongPressTimer);
  decoLongPressTimer = null;
  activeDecoId = null;
  activeDecoPointerId = null;
}

function handleDecorationPointerDown(event) {
  const deco = event.target.closest && event.target.closest(".tank-deco");
  if (!deco || !aquarium.contains(deco) || movingDecorationId) return;

  event.preventDefault();
  event.stopPropagation();
  activeDecoPointerId = event.pointerId;
  deco.setPointerCapture?.(event.pointerId);
  startDecorationPress(deco.dataset.id);
}

function handleDecorationPointerEnd(event) {
  if (activeDecoPointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  const deco = event.target.closest && event.target.closest(".tank-deco");
  deco?.releasePointerCapture?.(event.pointerId);
  cancelDecorationPress();
}

function openDecoEditModal(decoId) {
  decoEditTargetId = decoId;
  decoEditModal.classList.add("show");
  decoEditModal.setAttribute("aria-hidden", "false");
}

function closeDecoEditModal() {
  decoEditTargetId = null;
  decoEditModal.classList.remove("show");
  decoEditModal.setAttribute("aria-hidden", "true");
}

function startMoveDecoration() {
  if (!decoEditTargetId) return;
  movingDecorationId = decoEditTargetId;
  closeDecoEditModal();
  showToast("옮길 위치를 터치해주세요");
}

function deleteDecoration() {
  if (!decoEditTargetId) return;
  const ok = confirm("삭제 시 코인은 환불되지 않습니다. 삭제할까요?");
  if (!ok) return;

  state.decorations = (Array.isArray(state.decorations) ? state.decorations : [])
    .filter(item => item.id !== decoEditTargetId);
  closeDecoEditModal();
  renderDecorations();
  showToast("삭제 완료");
  saveState();
}

function moveDecorationTo(event) {
  if (!movingDecorationId) return;
  const rect = aquarium.getBoundingClientRect();
  const target = state.decorations.find(item => item.id === movingDecorationId);
  if (!target) {
    movingDecorationId = null;
    return;
  }

  target.x = Math.min(Math.max(event.clientX - rect.left - 18, 16), aquarium.clientWidth - 62);
  target.bottom = Math.min(Math.max(aquarium.clientHeight - (event.clientY - rect.top) - 15, 36), 120);
  movingDecorationId = null;
  renderDecorations();
  showToast("위치 이동 완료");
  saveState();
}

function resetGame() {
  const ok = confirm("저장된 게임 데이터를 초기화할까요?");
  if (!ok) return;

  localStorage.removeItem(STORAGE_KEY);
  state = createInitialState();
  fishNodes.forEach(node => node.remove());
  fishNodes.clear();
  renderFish();
  renderDecorations();
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
decorateBtn.addEventListener("click", openDecorateModal);
decorateCloseBtn.addEventListener("click", closeDecorateModal);
decorateModal.addEventListener("click", event => {
  if (event.target === decorateModal) closeDecorateModal();
});
expandTankBtn.addEventListener("click", expandTank);
buySeaweedBtn.addEventListener("click", () => buyDecoration("seaweed"));
buyRockBtn.addEventListener("click", () => buyDecoration("rock"));
resetBtn.addEventListener("click", resetGame);
sellYesBtn.addEventListener("click", sellFish);
sellNoBtn.addEventListener("click", closeSellModal);
sellModal.addEventListener("click", event => {
  if (event.target === sellModal) closeSellModal();
});

decoMoveBtn.addEventListener("click", startMoveDecoration);
decoDeleteBtn.addEventListener("click", deleteDecoration);
decoCancelBtn.addEventListener("click", closeDecoEditModal);
decoEditModal.addEventListener("click", event => {
  if (event.target === decoEditModal) closeDecoEditModal();
});
aquarium.addEventListener("pointerdown", handleDecorationPointerDown, true);
aquarium.addEventListener("pointerup", handleDecorationPointerEnd, true);
aquarium.addEventListener("pointercancel", handleDecorationPointerEnd, true);
aquarium.addEventListener("pointerdown", moveDecorationTo);

renderFish();
renderDecorations();
updateUI();
setInterval(updateUI, 500);
setInterval(saveState, 3000);
setInterval(showRandomFishSpeech, 6500);
setTimeout(showRandomFishSpeech, 1800);
requestAnimationFrame(gameLoop);
