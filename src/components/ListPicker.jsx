import manifest from '../../data/curated-lists/manifest.json'

export function ListPicker({ activeListId, onSelect }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 py-4">
      {manifest.map((list) => (
        <button
          key={list.id}
          type="button"
          onClick={() => onSelect(list.id)}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
            list.id === activeListId
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 text-gray-700 hover:border-gray-400'
          }`}
        >
          {list.label}
        </button>
      ))}
    </div>
  )
}
