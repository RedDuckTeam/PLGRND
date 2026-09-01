import { EMBED_PATH, isLegacyViewMode } from './embed-location'

if (typeof window !== 'undefined' && isLegacyViewMode()) {
  window.history.replaceState(null, '', EMBED_PATH + window.location.search + window.location.hash)
}
