document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settings-form');
  const apiBaseInput = document.getElementById('api-base-url');
  const ageInput = document.getElementById('user-age');
  const status = document.getElementById('status');

  loadSettings();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus();
    const apiBaseUrl = formatApiBase(apiBaseInput.value.trim());
    if (!apiBaseUrl) {
      setStatus('Enter a valid API base URL (http or https).', true);
      return;
    }

    const ageValue = parseAge(ageInput.value.trim());
    try {
      await chrome.storage.sync.set({
        apiBaseUrl,
        age: ageValue,
      });
      setStatus('Settings saved.');
    } catch (error) {
      setStatus(`Failed to save settings: ${error.message}`, true);
    }
  });

  function loadSettings() {
    chrome.storage.sync.get(['apiBaseUrl', 'age'], (stored) => {
      apiBaseInput.value = stored.apiBaseUrl || 'http://127.0.0.1:8000';
      ageInput.value = stored.age ?? '';
    });
  }

  function parseAge(value) {
    if (!value) {
      return null;
    }
    const age = Number.parseInt(value, 10);
    if (Number.isNaN(age)) {
      setStatus('Age must be a number.', true);
      throw new Error('Invalid age');
    }
    if (age < 0 || age > 130) {
      setStatus('Age must be between 0 and 130.', true);
      throw new Error('Out of range age');
    }
    return age;
  }

  function formatApiBase(raw) {
    if (!raw) {
      return null;
    }
    if (!/^https?:\/\//.test(raw)) {
      return null;
    }
    return raw.replace(/\/$/, '');
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.style.color = isError ? '#c92a2a' : '#2b8a3e';
  }

  function clearStatus() {
    status.textContent = '';
  }
});
