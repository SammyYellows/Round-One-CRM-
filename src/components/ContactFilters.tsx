"use client";

import { ContactFilter, EMPTY_FILTER, SORTS, SortKey, allAds } from "@/lib/contactQuery";
import { useStore } from "@/lib/store";
import { SOURCES, STAGES, Source, Stage } from "@/lib/types";

export function ContactFilters({
  filter, onChange, sort, onSort, showStages = true, showSource = true, showAds = true, showMembership = false, addedLabel = "Added", count, total,
}: {
  filter: ContactFilter;
  onChange: (f: ContactFilter) => void;
  sort?: SortKey;
  onSort?: (k: SortKey) => void;
  showStages?: boolean;
  showSource?: boolean;
  showAds?: boolean;
  showMembership?: boolean; // the TeamUp pipeline: members, ex-members, never joined
  addedLabel?: string; // "Added" for leads, "Came in" for TeamUp people
  count: number;
  total: number;
}) {
  const { s } = useStore();
  const set = (patch: Partial<ContactFilter>) => onChange({ ...filter, ...patch });
  const dirty = JSON.stringify(filter) !== JSON.stringify(EMPTY_FILTER);
  const toggleStage = (st: Stage) =>
    set({ stages: filter.stages.includes(st) ? filter.stages.filter((x) => x !== st) : [...filter.stages, st] });

  return (
    <div className="filters" role="search">
      <div className="filters-row">
        <div className="search">
          <label htmlFor="cf-q" className="sr-only">Search contacts</label>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <input
            id="cf-q"
            className="input"
            type="search"
            placeholder="Search name, mobile, email, ad, tag or answer"
            value={filter.q}
            onChange={(e) => set({ q: e.target.value })}
          />
        </div>
        {showSource && (
          <select className="select" aria-label="Source" value={filter.source} onChange={(e) => set({ source: e.target.value as Source | "all" })}>
            <option value="all">All sources</option>
            {SOURCES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        )}
        {showAds && (
          <select className="select" aria-label="Ad" value={filter.ad} onChange={(e) => set({ ad: e.target.value })}>
            <option value="all">All ads</option>
            <option value="none">No ad</option>
            {allAds(s).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.campaign})</option>)}
          </select>
        )}
        {showMembership && (
          <select className="select" aria-label="Membership" value={filter.membership} onChange={(e) => set({ membership: e.target.value as ContactFilter["membership"] })}>
            <option value="all">Members, ex-members and never joined</option>
            <option value="never">Never joined</option>
            <option value="ended">Ex-members</option>
            <option value="active">Current members</option>
          </select>
        )}
        <select className="select" aria-label={addedLabel} value={filter.added} onChange={(e) => set({ added: e.target.value as ContactFilter["added"] })}>
          <option value="all">{addedLabel} any time</option>
          <option value="7">{addedLabel} in the last 7 days</option>
          <option value="30">{addedLabel} in the last 30 days</option>
          <option value="90">{addedLabel} in the last 3 months</option>
          <option value="180">{addedLabel} in the last 6 months</option>
          <option value="365">{addedLabel} in the last year</option>
        </select>
        {onSort && sort && (
          <select className="select" aria-label="Sort" value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
            {SORTS.map((x) => <option key={x.id} value={x.id}>Sort: {x.label}</option>)}
          </select>
        )}
      </div>
      <div className="filters-row">
        {showStages && STAGES.map((st) => (
          <button key={st.id} className={`fchip fchip-sm ${filter.stages.includes(st.id) ? "on" : ""}`} aria-pressed={filter.stages.includes(st.id)} onClick={() => toggleStage(st.id)}>
            {st.label}
          </button>
        ))}
        <button className={`fchip fchip-sm ${filter.waiting ? "on" : ""}`} aria-pressed={filter.waiting} onClick={() => set({ waiting: !filter.waiting })}>
          Waiting on a reply
        </button>
        <span className="small muted" style={{ marginLeft: "auto" }} aria-live="polite">
          {count === total ? `${total} people` : `${count} of ${total} people`}
        </span>
        {dirty && <button className="link-btn" onClick={() => onChange(EMPTY_FILTER)}>Clear filters</button>}
      </div>
    </div>
  );
}
