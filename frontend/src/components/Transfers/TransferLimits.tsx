interface TransferLimitsProps {
  limits: {
    maxAmount: number;
    usedAmount: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
  };
}

export default function TransferLimits({ limits }: TransferLimitsProps) {
  const maxAmount = Number(limits.maxAmount);
  const usedAmount = Number(limits.usedAmount);
  const remaining = Number(limits.remaining);
  const safeMax = Number.isFinite(maxAmount) && maxAmount > 0 ? maxAmount : 0;
  const percentage = safeMax ? (usedAmount / safeMax) * 100 : 0;

  return (
    <div className="bg-white shadow rounded-lg p-5">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Transfer Limits</h3>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Monthly Limit</span>
            <span className="font-medium text-gray-900">{safeMax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Used</span>
            <span className="font-medium text-gray-900">{(Number.isFinite(usedAmount) ? usedAmount : 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Remaining</span>
            <span className="font-medium text-green-600">{(Number.isFinite(remaining) ? remaining : 0).toFixed(2)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-blue-600"
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
