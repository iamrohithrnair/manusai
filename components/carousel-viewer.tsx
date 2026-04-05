'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CarouselViewerProps {
  images: string[];
}

/** Convert an absolute file path to a serveable URL via /api/images */
function toImageUrl(path: string): string {
  // Path looks like /abs/path/uploads/images/carousel-xxx-slide1.png
  const filename = path.split('/').pop() || '';
  return `/api/images/${filename}`;
}

export function CarouselViewer({ images }: CarouselViewerProps) {
  const [current, setCurrent] = useState(0);
  const total = images.length;

  const prev = () => setCurrent(i => Math.max(0, i - 1));
  const next = () => setCurrent(i => Math.min(total - 1, i + 1));

  return (
    <div className="space-y-2">
      {/* Image */}
      <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={toImageUrl(images[current])}
          alt={`Slide ${current + 1} of ${total}`}
          className="w-full h-full object-contain"
        />

        {/* Left arrow */}
        {current > 0 && (
          <button
            type="button"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full bg-background/80 border shadow-sm opacity-80 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={(e) => { e.stopPropagation(); prev(); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}

        {/* Right arrow */}
        {current < total - 1 && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full bg-background/80 border shadow-sm opacity-80 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={(e) => { e.stopPropagation(); next(); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        )}

        {/* Slide counter */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
          {current + 1} / {total}
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setCurrent(i)}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === current ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'
            )}
          />
        ))}
      </div>
    </div>
  );
}
