const loadFixture = document.querySelector("#open-fixture");
const fixtureStatus = document.querySelector("#fixture-status");
loadFixture.addEventListener("click", async () => {
  loadFixture.disabled = true;
  loadFixture.textContent = "Loading…";
  fixtureStatus.textContent = "Loading the CAD assembly…";
  try {
    const { openFixture } = await import("./fixture-viewer.js");
    await openFixture();
    loadFixture.hidden = true;
    document.querySelector("#fixture-config").focus({ preventScroll: true });
  } catch {
    fixtureStatus.textContent = "3D is unavailable in this browser. Use the rendered view or download the STEP files.";
    loadFixture.textContent = "Retry 3D model";
    loadFixture.disabled = false;
  }
});

const labels = {
  "missing pad": "#8bd5fd",
  "mouse bite": "#ffb970",
  "open circuit": "#fb91b9",
  "short circuit": "#faff81",
  "spur": "#78ffcc",
  "spurious copper": "#d3b3ff"
};
const image = document.querySelector("#pcb-image");
const boxes = document.querySelector("#pcb-boxes");
const list = document.querySelector("#pcb-list");
const detail = document.querySelector("#pcb-detail");
const status = document.querySelector("#pcb-status");
const board = document.querySelector("#pcb-sample");
const filter = document.querySelector("#pcb-filter");
const showBoxes = document.querySelector("#pcb-show");
const exportLabels = document.querySelector("#pcb-export");
let samples = [];
let selected = null;

function currentSample() {
  return samples[Number(board.value)];
}

function visibleDefects() {
  return currentSample().defects
    .map((defect, index) => ({ ...defect, index }))
    .filter(defect => !filter.value || defect.label === filter.value);
}

function paintDetail() {
  detail.hidden = selected === null || !image.complete || !image.naturalWidth;
  if (detail.hidden) return;
  const sample = currentSample();
  const defect = sample.defects[selected];
  const ratioX = image.naturalWidth / sample.width;
  const ratioY = image.naturalHeight / sample.height;
  const [x, y, width, height] = defect.bbox;
  const pixels = [x * ratioX, y * ratioY, width * ratioX, height * ratioY];
  const [dx, dy, dw, dh] = pixels;
  const viewRatio = detail.width / detail.height;
  const cropWidth = Math.min(Math.max(dw * 3.4, dh * 3.4 * viewRatio, 48), image.naturalWidth);
  const cropHeight = Math.min(cropWidth / viewRatio, image.naturalHeight);
  const left = Math.max(0, Math.min(dx + dw / 2 - cropWidth / 2, image.naturalWidth - cropWidth));
  const top = Math.max(0, Math.min(dy + dh / 2 - cropHeight / 2, image.naturalHeight - cropHeight));
  const context = detail.getContext("2d");
  context.drawImage(image, left, top, cropWidth, cropHeight, 0, 0, detail.width, detail.height);
  const scaleX = detail.width / cropWidth;
  const scaleY = detail.height / cropHeight;
  context.strokeStyle = labels[defect.label];
  context.lineWidth = 2;
  context.strokeRect((dx - left) * scaleX, (dy - top) * scaleY, dw * scaleX, dh * scaleY);
  detail.setAttribute("aria-label", `Magnified source photograph around the ${defect.label} annotation`);
}

function selectDefect(index) {
  selected = index;
  for (const button of [...boxes.children, ...list.querySelectorAll("button")]) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.index) === selected));
  }
  paintDetail();
}

function defectButton(defect) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.index = defect.index;
  button.setAttribute("aria-pressed", String(defect.index === selected));
  button.addEventListener("click", () => selectDefect(defect.index));
  return button;
}

function renderAnnotations() {
  const sample = currentSample();
  const defects = visibleDefects();
  boxes.replaceChildren();
  list.replaceChildren();
  if (!defects.some(defect => defect.index === selected)) selected = null;
  boxes.hidden = !showBoxes.checked;
  for (const defect of defects) {
    const [x, y, width, height] = defect.bbox;
    const trigger = defectButton(defect);
    trigger.className = "pcb-box";
    trigger.setAttribute("aria-label", `Inspect ${defect.label}, annotation ${defect.index + 1}`);
    trigger.style.setProperty("--marker", labels[defect.label]);
    Object.assign(trigger.style, {
      left: `${100 * x / sample.width}%`, top: `${100 * y / sample.height}%`,
      width: `${100 * width / sample.width}%`, height: `${100 * height / sample.height}%`
    });
    boxes.append(trigger);
    const item = document.createElement("li");
    const button = defectButton(defect);
    button.textContent = `${defect.label} · ${defect.index + 1}`;
    item.append(button);
    list.append(item);
  }
  status.textContent = `${defects.length} of ${sample.defects.length} published annotations · ${sample.file}`;
  exportLabels.disabled = defects.length === 0;
  paintDetail();
}

function setSample() {
  const sample = currentSample();
  selected = null;
  filter.value = "";
  image.width = sample.width;
  image.height = sample.height;
  image.src = `assets/${sample.asset}`;
  image.alt = `Etched single-layer PCB from the PCB-Defect dataset, ${sample.file}`;
  renderAnnotations();
}

image.addEventListener("load", paintDetail);
board.addEventListener("change", setSample);
filter.addEventListener("change", renderAnnotations);
showBoxes.addEventListener("change", () => { boxes.hidden = !showBoxes.checked; });
exportLabels.addEventListener("click", () => {
  const sample = currentSample();
  const rows = visibleDefects().map(({ label, bbox }) =>
    [sample.file, label, ...bbox, sample.width, sample.height].join(","));
  const csv = ["image,defect_class,x,y,bbox_width,bbox_height,image_width,image_height", ...rows].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const download = document.createElement("a");
  download.href = url;
  download.download = `${sample.file.replace(".jpg", "")}-annotations.csv`;
  download.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
});

try {
  const response = await fetch("./assets/pcb-samples.json");
  if (!response.ok) throw new Error("Sample catalog unavailable");
  samples = await response.json();
  for (const [index, sample] of samples.entries()) {
    board.add(new Option(`Sample ${sample.file.match(/\d+/)[0]}`, String(index)));
  }
  for (const label of Object.keys(labels)) {
    filter.add(new Option(label.at(0).toUpperCase() + label.slice(1), label));
  }
  for (const field of [board, filter, showBoxes]) field.disabled = false;
  setSample();
} catch {
  status.textContent = "The source annotations could not be loaded. Reload the page to retry.";
}
