'use strict';
// Web Audio is armed only from a tap; it cannot wake a background browser.
const PhoneAlerts = (() => {
  let audio = null, enabled = false;
  const seen = new Map();
  function running() { return enabled && audio?.state === 'running'; }
  function tone() {
    if (!running()) return false;
    const start = audio.currentTime;
    for (const [offset, frequency] of [[0, 880], [.19, 1175]]) {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      gain.gain.setValueAtTime(0, start + offset);
      gain.gain.linearRampToValueAtTime(.10, start + offset + .012);
      gain.gain.exponentialRampToValueAtTime(.001, start + offset + .15);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(start + offset); oscillator.stop(start + offset + .17);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
    return true;
  }
  async function enable(test = true) {
    try {
      const Constructor = window.AudioContext || window.webkitAudioContext;
      if (!Constructor) return { ok: false, message: 'Son indisponible dans ce navigateur.' };
      if (!audio || audio.state === 'closed') audio = new Constructor();
      await audio.resume(); enabled = audio.state === 'running';
      if (!enabled) return { ok: false, message: 'Touchez Activer le son pour réessayer.' };
      if (test) tone();
      return { ok: true, message: 'Son actif · gardez cette page ouverte et le volume audible.' };
    } catch {
      enabled = false;
      return { ok: false, message: 'Son bloqué : touchez Activer le son pour réessayer.' };
    }
  }
  function arrival(person, taskId) {
    if (!taskId || seen.get(person) === taskId) return false;
    seen.set(person, taskId);
    const sounded = tone();
    if (sounded && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate([120, 60, 120]); } catch {}
    }
    return sounded;
  }
  function forget(person) { seen.delete(person); }
  return { enable, arrival, running, forget };
})();
