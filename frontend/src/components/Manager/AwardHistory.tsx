import { Transaction } from '../../services/api';
import { format } from 'date-fns';

interface AwardHistoryProps {
  history: any[];
}

export default function AwardHistory({ history }: AwardHistoryProps) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Award History</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {history.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No awards yet</div>
        ) : (
          history.map((transaction: any) => (
            <div key={transaction.id} className="px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {transaction.account?.employee?.name || transaction.sourceEmployee?.name || 'Unknown Employee'}
                  </p>
                  <p className="text-sm text-gray-500">{transaction.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(transaction.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">
                    +{Number(transaction.amount).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
