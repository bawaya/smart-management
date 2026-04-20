interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-6 h-6 border-2',
  md: 'w-10 h-10 border-4',
  lg: 'w-14 h-14 border-4',
};

export function LoadingSpinner({ size = 'md', text = 'טוען...' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
      <div
        aria-hidden
        className={`${SIZE_CLASSES[size]} border-[#f59e0b]/20 border-t-[#f59e0b] rounded-full animate-spin`}
      />
      {text && <p className="text-sm text-gray-600">{text}</p>}
    </div>
  );
}
