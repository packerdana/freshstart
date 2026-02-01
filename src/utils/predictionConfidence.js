// Simple, deterministic confidence-to-minutes mapping.
// Keep it boring and predictable so carriers learn to trust it.

export function confidenceToMinutes(confidence, { waypointEnhanced = false } = {}) {
  // Waypoint-enhanced estimates are usually tighter.
  if (waypointEnhanced) return 8;

  switch (confidence) {
    case 'high':
      return 10;
    case 'medium':
      return 20;
    case 'low':
      return 35;
    default:
      return 25;
  }
}
