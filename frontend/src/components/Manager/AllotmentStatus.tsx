interface AllotmentStatusProps {
  allotment: {
    amount: number;
    usedAmount: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
  };
}

export default function AllotmentStatus({ allotment }: AllotmentStatusProps) {
  const percentage = (allotment.usedAmount / allotment.amount) * 100;
  const isWarning = percentage > 80;
  const isDanger = percentage > 95;

  return (
    <div className="bg-white shadow rounded-lg p-5">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Allotment Status</h3>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Total Allotment</span>
            <span className="font-medium text-gray-900">{allotment.amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Used</span>
            <span className="font-medium text-gray-900">{allotment.usedAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Remaining</span>
            <span
              className={`font-medium ${
                isDanger ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-green-600'
              }`}
            >
              {allotment.remaining.toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                isDanger ? 'bg-red-600' : isWarning ? 'bg-yellow-600' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
        {(isWarning || isDanger) && (
          <div
            className={`text-sm p-3 rounded ${
              isDanger ? 'bg-red-50 text-red-800' : 'bg-yellow-50 text-yellow-800'
            }`}
          >
            {isDanger
              ? 'Warning: You are running low on allotment!'
              : 'You have used most of your allotment for this period.'}
          </div>
        )}
      </div>
    </div>
  );
}
