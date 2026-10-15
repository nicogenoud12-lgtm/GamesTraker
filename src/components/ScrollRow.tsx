import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  className?: string;
  children: ReactNode;
}

/**
 * Horizontal scroller that also works with a mouse: the wheel scrolls it
 * sideways, it can be dragged, and on hover devices it shows arrow buttons.
 */
export default function ScrollRow({ className = '', children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () =>
      setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const canLeft = el.scrollLeft > 0;
      const canRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      // Only hijack the wheel while the row can still move that way, so the page keeps scrolling at the ends.
      if ((e.deltaY > 0 && canRight) || (e.deltaY < 0 && canLeft)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    let drag: { x: number; left: number; moved: boolean } | null = null;
    let suppressClick = false;
    // Swallow the click that ends a drag so links and chips don't fire.
    const onClick = (e: MouseEvent) => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: el.scrollLeft, moved: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 5) drag.moved = true;
      if (drag.moved) el.scrollLeft = drag.left - dx;
    };
    const onUp = () => {
      if (drag?.moved) {
        suppressClick = true;
        setTimeout(() => (suppressClick = false), 0);
      }
      drag = null;
    };
    const onDragStart = (e: DragEvent) => e.preventDefault();

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('click', onClick, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', update);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('dragstart', onDragStart);
      el.removeEventListener('click', onClick, true);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className="group/row relative">
      <div ref={ref} className={`no-scrollbar overflow-x-auto ${className}`}>
        {children}
      </div>
      {edges.left && (
        <ArrowButton side="left" onClick={() => scrollBy(-1)}>
          <ChevronLeft size={18} />
        </ArrowButton>
      )}
      {edges.right && (
        <ArrowButton side="right" onClick={() => scrollBy(1)}>
          <ChevronRight size={18} />
        </ArrowButton>
      )}
    </div>
  );
}

function ArrowButton({ side, onClick, children }: { side: 'left' | 'right'; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Anterior' : 'Siguiente'}
      className={`absolute top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white opacity-0 shadow-lg backdrop-blur transition group-hover/row:opacity-100 [@media(hover:hover)]:flex ${side === 'left' ? 'left-1' : 'right-1'}`}
    >
      {children}
    </button>
  );
}
