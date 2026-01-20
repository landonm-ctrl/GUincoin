import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getTransferLimits, sendTransfer, getTransferHistory, getPendingTransfers, cancelTransfer, User, Transaction } from '../services/api';
import Layout from '../components/Layout';
import TransferForm from '../components/Transfers/TransferForm';
import TransferLimits from '../components/Transfers/TransferLimits';
import TransactionList from '../components/Dashboard/TransactionList';
import { format } from 'date-fns';

export default function Transfers() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [limits, setLimits] = useState<any>(null);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.allSettled([
          getCurrentUser(),
          getTransferLimits(),
          getTransferHistory(),
          getPendingTransfers(),
        ]);

        const hasAuthError = results.some(
          (result) =>
            result.status === 'rejected' &&
            (result.reason as any)?.response?.status === 401
        );
        if (hasAuthError) {
          navigate('/login');
          return;
        }

        const [userRes, limitsRes, historyRes, pendingRes] = results;

        if (userRes.status === 'fulfilled') {
          setUser(userRes.value.data);
        }

        if (limitsRes.status === 'fulfilled') {
          setLimits(limitsRes.value.data);
        }

        if (historyRes.status === 'fulfilled') {
          setHistory(historyRes.value.data.transactions || []);
        }

        if (pendingRes.status === 'fulfilled') {
          setPendingTransfers(pendingRes.value.data || []);
        }

        if (results.some((result) => result.status === 'rejected')) {
          setError('We could not load all transfer data. Please refresh and try again.');
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          navigate('/login');
          return;
        }
        setError('We could not load transfer data. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  const handleTransfer = async (data: { recipientEmail: string; amount: number; message?: string }) => {
    try {
      await sendTransfer(data);
      // Reload data
      const [limitsRes, historyRes, pendingRes] = await Promise.all([
        getTransferLimits(),
        getTransferHistory(),
        getPendingTransfers(),
      ]);
      setLimits(limitsRes.data);
      setHistory(historyRes.data.transactions || []);
      setPendingTransfers(pendingRes.data || []);
      alert('Transfer completed successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to send transfer');
    }
  };

  const handleCancelTransfer = async (transferId: string) => {
    if (!confirm('Are you sure you want to cancel this transfer?')) {
      return;
    }

    try {
      await cancelTransfer(transferId);
      // Reload data
      const [limitsRes, historyRes, pendingRes] = await Promise.all([
        getTransferLimits(),
        getTransferHistory(),
        getPendingTransfers(),
      ]);
      setLimits(limitsRes.data);
      setHistory(historyRes.data.transactions || []);
      setPendingTransfers(pendingRes.data || []);
      alert('Transfer cancelled successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to cancel transfer');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout user={user || undefined}>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Peer Transfers</h1>
          <p className="mt-1 text-sm text-gray-500">Send coins to your colleagues</p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!user && !loading && (
          <div className="rounded-md border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-600">
            We could not load your profile details. Please refresh or log in again.
          </div>
        )}

        {user && (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1">
                {limits ? (
                  <TransferLimits limits={limits} />
                ) : (
                  <div className="rounded-md border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-600">
                    Transfer limits are unavailable right now.
                  </div>
                )}
              </div>
              <div className="lg:col-span-2">
                <TransferForm onTransfer={handleTransfer} remaining={limits?.remaining || 0} />
              </div>
            </div>

            {pendingTransfers.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Pending Transfers</h2>
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {pendingTransfers.map((transfer) => (
                      <li key={transfer.id}>
                        <div className="px-4 py-4 sm:px-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                To: {transfer.recipientEmail}
                              </p>
                              {transfer.message && (
                                <p className="text-sm text-gray-500 truncate mt-1">
                                  {transfer.message}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {format(new Date(transfer.createdAt), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                            <div className="ml-4 flex-shrink-0 flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-sm font-medium text-red-600">
                                  -{Number(transfer.amount).toFixed(2)}
                                </p>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                                  Pending
                                </span>
                              </div>
                              <button
                                onClick={() => handleCancelTransfer(transfer.id)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="mt-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Transfer History</h2>
              {history.length > 0 ? (
                <TransactionList transactions={history} />
              ) : (
                <div className="rounded-md border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-600">
                  No transfers yet.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
