import { useEffect, useState } from 'react';
import { Download, Loader2, Share2 } from 'lucide-react';
import Sheet from './Sheet';
import { canShareFiles, downloadImage, shareImage, toBlob } from '../lib/shareImage';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  filename: string;
  /** Draws the image; called each time the sheet opens. */
  render: () => Promise<HTMLCanvasElement>;
}

/** Preview of a generated story image with share / download buttons. */
export default function ShareSheet({ open, onClose, title, filename, render }: Props) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let objectUrl: string | null = null;
    setBlob(null);
    setUrl(null);
    setError(null);
    render()
      .then(toBlob)
      .then((b) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // `render` is rebuilt every render of the parent; only reopening redraws.
  }, [open]);

  const share = async () => {
    if (!blob) return;
    try {
      await shareImage(blob, filename, title);
    } catch (e) {
      // Closing the share sheet isn't an error; anything else falls back to a download.
      if ((e as Error).name !== 'AbortError') downloadImage(blob, filename);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex justify-center">
        {url ? (
          <img src={url} alt={title} className="max-h-[55dvh] rounded-2xl border border-line shadow-2xl" />
        ) : (
          <div className="flex aspect-[9/16] h-[55dvh] max-h-[460px] items-center justify-center rounded-2xl border border-dashed border-line text-muted">
            {error ? <p className="px-6 text-center text-sm text-rose-400">{error}</p> : <Loader2 className="animate-spin" />}
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {canShareFiles() && (
          <button
            onClick={share}
            disabled={!blob}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accent to-accent-2 py-3 font-semibold text-black disabled:opacity-40"
          >
            <Share2 size={18} /> Compartir
          </button>
        )}
        <button
          onClick={() => blob && downloadImage(blob, filename)}
          disabled={!blob}
          className={`flex items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 font-semibold disabled:opacity-40 ${canShareFiles() ? '' : 'col-span-2'}`}
        >
          <Download size={18} /> Descargar
        </button>
      </div>
    </Sheet>
  );
}
