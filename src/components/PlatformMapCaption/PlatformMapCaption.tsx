"use client";

/**
 * PlatformMapCaption
 *
 * Placeholder for the map legend/caption overlay (bottom-right).
 *
 * This is intentionally minimal for now; the goal is to make the planned
 * component hierarchy explicit.
 */
export function PlatformMapCaption() {
  return (
    <div className="absolute bottom-6 right-6 w-[280px] rounded-lg border border-neutral-200 bg-white/90 p-3 shadow-sm z-10">
      <div className="text-xs font-semibold text-neutral-700">PlatformMapCaption</div>
      <div className="mt-1 text-[11px] text-neutral-500">
        Legend / caption overlay placeholder
      </div>
    </div>
  );
}
