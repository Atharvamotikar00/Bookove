// audio-helper.js - Minimal version, accessibility panel removed
(function () {
  // Keep audio config for potential future use, but no UI injection
  window.AccessibilityAudio = {
    isEnabled: false,
    isSpeechEnabled: false,
    volume: 0.5,
    play: function () {},
  };
  window.AccessibilityHelper = {
    isEnabled: function () { return false; },
    speak: function () {},
  };
})();
