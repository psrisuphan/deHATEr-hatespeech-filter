document.addEventListener("DOMContentLoaded", () => {
  const ageSlider = document.getElementById("ageSlider");
  const ageDisplay = document.getElementById("ageDisplay");
  const playButton = document.getElementById("playButton");
  const srOnly = playButton?.querySelector(".sr-only");
  const powerStatus = document.getElementById("powerStatus");

  const DEFAULTS = { age: 18, enabled: false };

  const updateAgeDisplay = (value) => {
    if (!ageDisplay) {
      return;
    }

    const numericValue = typeof value === "number" ? value : parseInt(String(value), 10);
    const safeValue = Number.isFinite(numericValue) ? numericValue : DEFAULTS.age;
    ageDisplay.textContent = "Age: " + safeValue;

    if (ageSlider) {
      const min = Number(ageSlider.min || 0);
      const max = Number(ageSlider.max || 100);
      const percent = max === min ? 0 : ((safeValue - min) / (max - min)) * 100;
      const clampedPercent = Math.min(Math.max(percent, 0), 100);
      ageSlider.style.setProperty("--progress", `${clampedPercent}%`);
    }
  };

  const syncPowerState = (isEnabled) => {
    if (playButton) {
      playButton.classList.toggle("active", isEnabled);
      playButton.classList.toggle("is-playing", isEnabled);
      playButton.setAttribute("aria-pressed", isEnabled ? "true" : "false");
    }

    if (srOnly) {
      srOnly.textContent = isEnabled ? "Turn off hate speech filter" : "Turn on hate speech filter";
    }

    if (powerStatus) {
      powerStatus.textContent = isEnabled ? "Turned On" : "Turned Off";
      powerStatus.classList.toggle("is-on", isEnabled);
      powerStatus.classList.toggle("is-off", !isEnabled);
    }
  };

  chrome.storage.local.get(DEFAULTS, (stored) => {
    const rawAge = stored.age;
    const parsedAge = typeof rawAge === "number" ? rawAge : parseInt(String(rawAge), 10);
    const ageValue = Number.isFinite(parsedAge) ? parsedAge : DEFAULTS.age;

    if (ageSlider) {
      ageSlider.value = String(ageValue);
    }

    updateAgeDisplay(ageValue);
    syncPowerState(Boolean(stored.enabled));
  });

  if (ageSlider) {
    ageSlider.addEventListener("input", () => {
      updateAgeDisplay(ageSlider.value);
    });

    ageSlider.addEventListener("change", () => {
      const value = parseInt(ageSlider.value, 10);
      chrome.storage.local.set({ age: Number.isFinite(value) ? value : DEFAULTS.age });
    });
  }

  if (playButton) {
    playButton.addEventListener("click", () => {
      const nextState = playButton.getAttribute("aria-pressed") !== "true";
      syncPowerState(nextState);
      chrome.storage.local.set({ enabled: nextState });
    });
  }
});
