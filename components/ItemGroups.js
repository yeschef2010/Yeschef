'use client';
import { groupByCategory, stockTag } from '@/lib/helpers';
import { Close } from './Icons';

// Two columns of line items, grouped by category (Dairy & eggs, Veg, Salad…).
export default function ItemGroups({ items, area, onTap, onRemove, showTags = false, showCategories = true }) {
  const groups = showCategories ? groupByCategory(items, area) : [{ category: '', items }];
  return (
    <div className="groups">
      {groups.map((g) => (
        <div key={g.category || 'all'} className="group">
          {showCategories && <p className="cat-label">{g.category}</p>}
          <div className="items2">
            {g.items.map((it) => {
              const tag = showTags ? stockTag(it) : null;
              const sub = it.qty || it.note || it.status || '';
              const body = (
                <span className="txt">
                  <span className="name">{it.name}</span>
                  {(sub || tag) && (
                    <span className="meta-row">
                      <span className="qty">{sub}</span>
                      {tag && <span className={`tag ${tag.cls}`}>{tag.label}</span>}
                    </span>
                  )}
                </span>
              );
              if (onTap) {
                return (
                  <button key={it.id} className="line" onClick={() => onTap(it)}>
                    {body}
                  </button>
                );
              }
              return (
                <div key={it.id} className="line">
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
        </div>
      ))}
    </div>
  );
}
