/**
 * Filmy z YouTube: osadzane przez youtube-nocookie.com dopiero po kliknięciu
 * (miniatura + przycisk), żeby nie spowalniać aplikacji i nie ładować
 * skryptów YouTube bez potrzeby. Gdy brak filmu – link do wyszukiwania.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db';
import { CURATED_VIDEOS } from '../data/videos';
import { Icon } from './ui';

/** Wyciąga 11-znakowe id filmu z typowych postaci adresu YouTube. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else {
        const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
        if (m) id = m[2];
      }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export const ytSearchUrl = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

export function VideoEmbed({ id, title }: { id: string; title: string }) {
  const [on, setOn] = useState(false);
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-black">
      <div className="relative aspect-video">
        {on ? (
          <iframe
            className="absolute inset-0 size-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button className="group absolute inset-0" onClick={() => setOn(true)} aria-label={`Odtwórz film: ${title}`}>
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover opacity-90 group-hover:opacity-100" />
            <span className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white">
              <Icon name="play" size={26} />
            </span>
          </button>
        )}
      </div>
      <figcaption className="bg-surface px-3 py-2 text-sm text-ink">{title}</figcaption>
    </figure>
  );
}

/** Filmy dla obiektu lub partii; gdy brak – link do wyszukiwania na YouTube. */
export function VideoList({ targetType, targetIds, searchQuery }: { targetType: 'feature' | 'deck'; targetIds: string[]; searchQuery: string }) {
  const user = useLiveQuery(() => db.videos.where('targetType').equals(targetType).toArray(), [targetType]) ?? [];
  const list = [
    ...CURATED_VIDEOS.filter((v) => v.target === targetType && targetIds.includes(v.id)),
    ...user.filter((v) => targetIds.includes(v.targetId)),
  ]
    .map((v) => ({ id: youtubeId(v.url), title: v.title }))
    .filter((v): v is { id: string; title: string } => !!v.id);
  const unique = list.filter((v, i) => list.findIndex((x) => x.id === v.id) === i);
  return (
    <div className="space-y-3">
      {unique.map((v) => (
        <VideoEmbed key={v.id} id={v.id} title={v.title} />
      ))}
      <a href={ytSearchUrl(searchQuery)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-water hover:underline">
        <Icon name="external" size={16} />
        {unique.length ? 'Więcej filmów' : 'Szukaj filmów'} na YouTube: „{searchQuery}”
      </a>
    </div>
  );
}
