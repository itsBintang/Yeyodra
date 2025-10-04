import "./FilterItem.scss";

export interface FilterItemProps {
  filter: string;
  orbColor: string;
  onRemove: () => void;
}

export function FilterItem({ filter, orbColor, onRemove }: FilterItemProps) {
  return (
    <button type="button" className="filter-item" onClick={onRemove}>
      <div className="filter-item__orb" style={{ backgroundColor: orbColor }} />
      <span className="filter-item__label">{filter}</span>
      <span className="filter-item__remove">×</span>
    </button>
  );
}

