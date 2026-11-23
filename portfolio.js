"use strict";

function bindChoices(selector, update) {
  const choices = document.querySelectorAll(selector);
  choices.forEach(choice => choice.addEventListener("click", () => {
    choices.forEach(item => item.setAttribute("aria-pressed", String(item === choice)));
    update(choice);
  }));
}

const diamond = document.querySelector("#diamond-image");
const porosity = document.querySelector("#diamond-porosity");
const porosityValue = document.querySelector("#diamond-value");
porosity.addEventListener("input", () => {
  const value = porosity.value;
  diamond.src = `assets/porosity/${value}.webp`;
  diamond.alt = `Ivory Sheet-Diamond mesh at a nominal ${value} percent void fraction`;
  porosityValue.value = `${value}%`;
  porosity.setAttribute("aria-valuetext", `${value} percent`);
});

const nest = document.querySelector("#nest-image");
bindChoices("[data-nest]", ({ dataset }) => {
  nest.src = `assets/nest-${dataset.nest}.webp`;
  nest.alt = `${dataset.nest === "exploded" ? "Exploded" : "Assembled"} CAD view of the handling nest and lap-joint coupon`;
});

const player = document.querySelector("#rx-player");
const rxMaps = [...player.querySelectorAll("[data-rx-map]")];
const mapLabels = { ipfz: "inverse pole figure", osm: "orientation similarity" };
const slider = document.querySelector("#rx-range");
const stageLabel = document.querySelector("#rx-stage");
const play = document.querySelector("#rx-play");
const finalStage = Number(slider.max);
const frameCache = new Map();
let timer;

function loadPair(stage) {
  if (!frameCache.has(stage)) {
    const pair = Promise.all(rxMaps.map(async ({ dataset }) => {
      const image = new Image();
      image.src = `assets/rx-${dataset.rxMap}-${stage}.webp`;
      await image.decode();
      return image;
    })).catch(error => {
      frameCache.delete(stage);
      throw error;
    });
    frameCache.set(stage, pair);
  }
  return frameCache.get(stage);
}

async function showFrame() {
  const stage = Number(slider.value);
  slider.setAttribute("aria-valuetext", `Stage t${stage} of t0–t${finalStage}`);
  const pair = loadPair(stage);
  loadPair((stage + 1) % (finalStage + 1)).catch(() => {});
  try {
    const images = await pair;
    if (Number(slider.value) !== stage) return;
    rxMaps.forEach((image, index) => {
      image.src = images[index].src;
      image.alt = `EBSD ${mapLabels[image.dataset.rxMap]} map at stage t${stage}`;
    });
    stageLabel.value = `t${stage} / t${finalStage}`;
  } catch {
    if (Number(slider.value) === stage) {
      pause();
      stageLabel.value = `t${stage} unavailable`;
    }
  }
}

function pause() {
  window.clearInterval(timer);
  timer = undefined;
  play.textContent = "Play";
}

play.addEventListener("click", () => {
  if (timer) {
    pause();
    return;
  }
  play.textContent = "Pause";
  showFrame();
  timer = window.setInterval(() => {
    slider.value = (Number(slider.value) + 1) % (finalStage + 1);
    showFrame();
  }, 850);
});

slider.addEventListener("input", () => {
  pause();
  showFrame();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});

if ("IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) pause();
  }).observe(player);
}
