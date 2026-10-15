import { useToast } from '../store/useToast';

export default function Toast() {
  const message = useToast((s) => s.message);
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
      <div className="animate-fade rounded-full border border-line bg-surface-2/95 px-4 py-2.5 text-sm font-medium shadow-xl backdrop-blur">
        {message}
      </div>
    </div>
  );
}
