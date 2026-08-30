import { Play } from 'lucide-react';

export default function AnimeCard({ anime, onClick }) {
  const pic = anime.pic || anime.image || 'https://via.placeholder.com/300x400/25262B/748ffc?text=' + encodeURIComponent(anime.name || 'Anime');
  return (
    <div onClick={onClick} className="card cursor-pointer group relative overflow-hidden">
      <div className="aspect-[3/4] rounded-lg overflow-hidden bg-dark-600 mb-3">
        <img
          src={pic}
          alt={anime.name || anime.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
          <Play className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
        {anime.note && (
          <span className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">{anime.note}</span>
        )}
      </div>
      <h3 className="font-medium text-sm text-gray-200 line-clamp-1">{anime.name || anime.title}</h3>
      {(anime.year || anime.region) && (
        <p className="text-xs text-gray-500 mt-1">{[anime.year, anime.region].filter(Boolean).join(' · ')}</p>
      )}
    </div>
  );
}