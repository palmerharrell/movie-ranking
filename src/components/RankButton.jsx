export function RankButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-gray-900 px-8 py-3 font-medium text-white hover:bg-gray-700"
    >
      Rank →
    </button>
  )
}
