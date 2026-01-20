import { Transaction } from '../../services/api';
import { format } from 'date-fns';

interface TransactionListProps {
  transactions: Transaction[];
}

export default function TransactionList({ transactions }: TransactionListProps) {
  const formatAmount = (amount: unknown) => {
    const numericAmount = typeof amount === 'number' ? amount : Number(amount);
    return Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : '0.00';
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      manager_award: 'Manager Award',
      peer_transfer_sent: 'Sent Transfer',
      peer_transfer_received: 'Received Transfer',
      wellness_reward: 'Wellness Reward',
      adjustment: 'Adjustment',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      posted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          styles[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {transactions.map((transaction) => (
          <li key={transaction.id}>
            <div className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {getTransactionTypeLabel(transaction.transactionType)}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {transaction.description || 'No description'}
                  </p>
                  {transaction.sourceEmployee && (
                    <p className="text-xs text-gray-400 mt-1">
                      From: {transaction.sourceEmployee.name}
                    </p>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0 text-right">
                  <p
                    className={`text-sm font-medium ${
                      transaction.transactionType === 'peer_transfer_sent'
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}
                  >
                    {transaction.transactionType === 'peer_transfer_sent' ? '-' : '+'}
                    {formatAmount(transaction.amount)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {format(new Date(transaction.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="mt-2">{getStatusBadge(transaction.status)}</div>
            </div>
          </li>
        ))}
      </ul>
      {transactions.length === 0 && (
        <div className="text-center py-12 text-gray-500">No transactions yet</div>
      )}
    </div>
  );
}
