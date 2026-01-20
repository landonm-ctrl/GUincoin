import { Balance } from '../../services/api';

interface BalanceCardProps {
  balance: Balance;
}

export default function BalanceCard({ balance }: BalanceCardProps) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="text-3xl">💰</div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">Total Balance</dt>
              <dd className="text-2xl font-semibold text-gray-900">{balance.total.toFixed(2)}</dd>
            </dl>
          </div>
        </div>
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Posted</span>
            <span className="font-medium text-gray-900">{balance.posted.toFixed(2)}</span>
          </div>
          {balance.pending > 0 && (
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-500">Pending</span>
              <span className="font-medium text-yellow-600">{balance.pending.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
