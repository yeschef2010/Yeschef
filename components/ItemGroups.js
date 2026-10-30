'use client';
import { WINE_STYLES, groupByCategory, stockTag, wineStyleOf } from '@/lib/helpers';
import { Chevron, Close } from './Icons';
import SwipeRow from './SwipeRow';

// Two columns of line items, grouped by category (Dairy & eggs, Veg, Salad…).
// With `collapsible`, each category folds away under a tappable header showing its count and any warnings.
export default function ItemGroups({ items, area, onTap, onDelete, onRemove, onSelect, showTags = false, showCategories = true, collapsible = false, openCats = {}, onToggleCat }) {
  const groups = showCategories ? groupByCategory(items, area) : [{ category: '', items }];
  const renderItem = (it) => {
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
              if (onTap && onDelete) {
                return (
                  <SwipeRow key={it.id} className={tone.trim()} title={it.name} label={it.name} onTap={() => onTap(it)} onDelete={() => onDelete(it)}>
                    {body}
                  </SwipeRow>
                );
              }
              if (onTap) {
                return (
                  <button key={it.id} className={`line${tone}`} onClick={() => onTap(it)} title={it.name}>
                    {body}
                  </button>
                );
              }
              return (
                <div key={it.id} className={`line${tone}`} title={it.name}>
                  {onSelect ? (
                    <button className="line-body" onClick={() => onSelect(it)} aria-label={`Move ${it.name}`}>
                      {body}
                    </button>
                  ) : (
                    body
                  )}
                  {onRemove && (
                    <button className="line-x" onClick={() => onRemove(it.id)} aria-label={`Remove ${it.name}`}>
                      <Close size={12} />
                    </button>
                  )}
                </div>
              );
  };
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
          {open &&
            (g.category === 'Wine' && area === 'Drinks'
              ? [...WINE_STYLES, 'Other']
                  .map((st) => [st, g.items.filter((it) => wineStyleOf(it) === st)])
                  .filter(([, list]) => list.length)
                  .map(([st, list]) => (
                    <div key={st} className="wine-style">
                      <p className="sub-label">{st === 'Other' ? 'Other wine' : st}</p>
                      <div className="items2">{list.map(renderItem)}</div>
                    </div>
                  ))
              : <div className="items2">{g.items.map(renderItem)}</div>)}

        </div>
        );
      })}
    </div>
  );
}
