export function applyThemeWording(label, theme) {
  if (theme !== 'classic') {
    if (label === 'Random Five') return 'Random 5'
    return label
  }
  return label.replace(/\bMovies\b/g, 'Films').replace(/\bMovie\b/g, 'Film')
}
