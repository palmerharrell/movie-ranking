export function RankButton({ onClick, disabled = false }) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="rank-button px-[46px] py-[15px] text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        Rank →
      </button>
      <p className="rank-caption text-[11px]">
        Drag to reorder, click Rank to set order and go to next list
      </p>
    </div>
  )
}
