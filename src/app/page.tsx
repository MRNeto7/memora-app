// The map is rendered once at the layout level by PersistentMapShell, which
// shows itself only on this route. Keeping the map mounted across tab switches
// avoids re-instantiating google.maps.Map (a billed Maps load) every visit.
// This route is intentionally empty — the shell shows through.
export default function MapPage() {
  return null
}
