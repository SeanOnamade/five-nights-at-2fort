/**
 * Mobile detection and utilities
 */

/**
 * Check if the device is a mobile/touch device
 * ONLY uses user agent to avoid false positives on touchscreen laptops/desktops
 */
export function isMobileDevice(): boolean {
  // ONLY check user agent for mobile devices - most reliable method
  // This avoids false positives from touchscreen laptops, dev tools emulation, etc.
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  return mobileUA;
}

/**
 * Check if the current orientation is landscape
 */
export function isLandscape(): boolean {
  // Use screen.orientation if available
  if (screen.orientation) {
    return screen.orientation.type.includes('landscape');
  }
  
  // Fallback to window dimensions
  return window.innerWidth > window.innerHeight;
}

/**
 * Add orientation change listener
 */
export function onOrientationChange(callback: (isLandscape: boolean) => void): () => void {
  const handler = () => {
    // Small delay to let the orientation settle
    setTimeout(() => {
      callback(isLandscape());
    }, 100);
  };
  
  // Listen to both events for cross-browser support
  window.addEventListener('orientationchange', handler);
  window.addEventListener('resize', handler);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('orientationchange', handler);
    window.removeEventListener('resize', handler);
  };
}

/**
 * Request fullscreen (useful for mobile)
 */
export function requestFullscreen(): void {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch(() => {
      // Ignore errors - fullscreen may not be available
    });
  }
}

/**
 * Lock orientation to landscape if supported
 */
export function lockToLandscape(): void {
  if (screen.orientation && 'lock' in screen.orientation) {
    (screen.orientation as any).lock('landscape').catch(() => {
      // Ignore errors - orientation lock may not be supported
    });
  }
}

