// Transaction Status Component

import type { TxStatus } from "@/types/equibasket";

interface TransactionStatusProps {
  status: TxStatus;
  onClose?: () => void;
}

export function TransactionStatus({ status, onClose }: TransactionStatusProps) {
  if (status.status === "idle") return null;

  const statusConfig = {
    building: {
      icon: (
        <svg
          className="w-6 h-6 text-blue-400 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ),
      bg: "bg-blue-500/10 border-blue-500/30",
      title: "Building Transaction",
    },
    signing: {
      icon: (
        <svg
          className="w-6 h-6 text-yellow-400 animate-pulse"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
          />
        </svg>
      ),
      bg: "bg-yellow-500/10 border-yellow-500/30",
      title: "Waiting for Signature",
    },
    submitting: {
      icon: (
        <svg
          className="w-6 h-6 text-purple-400 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ),
      bg: "bg-purple-500/10 border-purple-500/30",
      title: "Submitting to Network",
    },
    success: {
      icon: (
        <svg
          className="w-6 h-6 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      bg: "bg-green-500/10 border-green-500/30",
      title: "Transaction Successful",
    },
    error: {
      icon: (
        <svg
          className="w-6 h-6 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      bg: "bg-red-500/10 border-red-500/30",
      title: "Transaction Failed",
    },
  };

  const config = statusConfig[status.status];

  return (
    <div
      className={`
      rounded-lg border p-4 ${config.bg}
      transition-all duration-300
    `}
    >
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="flex-1">
          <h4 className="font-medium text-white">{config.title}</h4>
          {"message" in status && (
            <p className="text-sm text-slate-400 mt-1">{status.message}</p>
          )}
          {"txHash" in status && status.txHash && (
            <div className="mt-2">
              <a
                href={`https://preview.cardanoscan.io/transaction/${status.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 font-mono break-all"
              >
                {status.txHash}
              </a>
            </div>
          )}
          {"error" in status && (
            <p className="text-sm text-red-400 mt-1 break-words">{status.error}</p>
          )}
        </div>
        {(status.status === "success" || status.status === "error") && onClose && (
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default TransactionStatus;

