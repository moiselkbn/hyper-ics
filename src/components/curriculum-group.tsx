import { useState } from 'react';
import type { Curriculum } from '../data/curricula';
import { CheckboxRow } from './checkbox-row';
import './curriculum-group.css';

type CurriculumGroupProps = {
  curriculum: Curriculum;
  selected: ReadonlySet<string>;
  isDisabled: (promotion: string) => boolean;
  onToggle: (promotion: string, checked: boolean) => void;
};

export function CurriculumGroup({ curriculum, selected, isDisabled, onToggle }: CurriculumGroupProps) {
  const [open, setOpen] = useState(false);
  const panelId = `curriculum-${curriculum.id}`;
  const selectedCount = curriculum.promotions.filter((promotion) => selected.has(promotion)).length;

  return (
    <section className="curriculum-group">
      <button
        className="curriculum-group__toggle"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="curriculum-group__name">{curriculum.name}</span>
        <span
          className={open ? 'curriculum-group__chevron curriculum-group__chevron--open' : 'curriculum-group__chevron'}
          aria-hidden="true"
        />
        {selectedCount > 0 && <span className="curriculum-group__count">{selectedCount}</span>}
      </button>
      {open && (
        <div className="curriculum-group__list" id={panelId}>
          {curriculum.promotions.map((promotion) => (
            <CheckboxRow
              key={promotion}
              label={promotion}
              checked={selected.has(promotion)}
              disabled={isDisabled(promotion)}
              onChange={(checked) => onToggle(promotion, checked)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
