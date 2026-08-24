export function ListPicker({ lists, activeListId, onSelect }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {lists.map((list) => (
        <button
          key={list.id}
          type="button"
          onClick={() => onSelect(list.id)}
          className={`chip px-4 py-2 text-sm font-medium ${
            list.id === activeListId ? 'active' : ''
          }`}
        >
          {list.label}
        </button>
      ))}
    </div>
  )
}
