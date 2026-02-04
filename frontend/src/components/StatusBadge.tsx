import { CircleDot } from 'lucide-react';

interface StatusBadgeProps {
  provider: string;
  isConnected: boolean;
  isLoading?: boolean;
}

export function StatusBadge({ provider, isConnected, isLoading = false }: StatusBadgeProps) {
  const statusColor = isLoading ? 'text-yellow-500' : isConnected ? 'text-green-500' : 'text-red-500';
  const backgroundColor = isLoading ? 'bg-yellow-50' : isConnected ? 'bg-green-50' : 'bg-red-50';

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${backgroundColor} border ${
      isLoading ? 'border-yellow-200' : isConnected ? 'border-green-200' : 'border-red-200'
    }`}>
      <CircleDot className={`w-2 h-2 ${statusColor}`} fill="currentColor" />
      <span className={`text-xs font-semibold ${
        isLoading ? 'text-yellow-700' : isConnected ? 'text-green-700' : 'text-red-700'
      }`}>
        {provider}
      </span>
    </div>
  );
}
