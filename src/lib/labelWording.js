export function applyThemeWording(label, theme) {
  if (theme !== 'classic') return label
  return label.replace(/\bMovies\b/g, 'Films').replace(/\bMovie\b/g, 'Film')
}
