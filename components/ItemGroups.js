'use client';
import { groupByCategory, stockTag } from '@/lib/helpers';
import { Chevron, Close } from './Icons';

// Two columns of line items, grouped by category (Dairy & eggs, Veg, Salad…).
// With `collapsible`, each category folds away under a tappable header showing its count and any warnings.
export default function ItemGroups({ items, area, onTap, onRemove, showTags = false, showCategories = true, collapsible = false, openCats = {}, onToggleCat }) {
  const groups = showCategories ? groupByCategory(items, area) : [{ category: '', items }];
  return (
    <div className="groups">
      {groups.map((g) => {
        const open = !collapsible || !showCategories || !!openCats[g.category];
        const reds = showTags ? g.items.filter((it) => stockTag(it).cls === 'red').length : 0;
        const ambers = showTags ? g.items.filter((it) => stockTag(it).cls === 'amber').length : 0;
        return (
        <div key={g.category || 'all'} className="group">
          {showCategories && !collapsible && <p className="cat-label">{g.category}</p>}
          {showCategories && collapsible && (
            <button className="cat-head" aria-expanded={open} onClick={() => onToggleCat && onToggleCat(g.category)}>
              <span className="cat-label">{g.category}</span>
              <span className="cat-meta">
                {reds > 0 && <span className="cat-flag red">{reds}</span>}
                {ambers > 0 && <span className="cat-flag amber">{ambers}</span>}
                <span>{g.items.length}</span>
                <Chevron open={open} />
              </span>
            </button>
          )}
          {open && (
          <div className="items2">
            {g.items.map((it) => {
              const tag = showTags ? stockTag(it) : null;
              const sub = it.qty || it.note || it.status || '';
              // The amount can be shortened with "…", but the days are always shown in full.
              const body = (
                <span className="txt">
                  <span className="name">{it.name}</span>
                  {(sub || (tag && tag.cls !== 'grey')) && (
                    <span className="qty-row">
                      {sub && <span className="qty">{sub}</span>}
                      {tag && tag.cls !== 'grey' && <span className="days">{sub ? ' · ' : ''}{tag.label}</span>}
                    </span>
                  )}
                </span>
              );
              const tone = tag ? ` tone-${tag.cls}` : '';
              if (onTap) {
                return (
                  <button key={it.id} className={`line${tone}`} onClick={() => onTap(it)} title={it.name}>
                    {body}
                  </button>
                );
              }
              return (
                <div key={it.id} className={`line${tone}`} title={it.name}>
                  {body}
                  {onRemove && (
                    <button className="line-x" onClick={() => onRemove(it.id)} aria-label={`Remove ${it.name}`}>
                      <Close size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
