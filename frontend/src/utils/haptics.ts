/**
 * Simple haptic feedback utility
 * Provides tactile vibration for supported devices (mostly Android/Mobile)
 */
export function playHapticTap() {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    try {
      // Short 10ms tap
      navigator.vibrate(10);
    } catch (e) {
      // Fail silently if vibration is blocked or unsupported
    }
  }
}

export function playHapticSuccess() {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    try {
      // Success pattern: short tap, pause, short tap
      navigator.vibrate([10, 30, 10]);
    } catch (e) {}
  }
}
