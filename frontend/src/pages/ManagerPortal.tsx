import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getManagerAllotment, awardCoins, getAwardHistory, User } from '../services/api';
import Layout from '../components/Layout';
import AwardForm from '../components/Manager/AwardForm';
import AllotmentStatus from '../components/Manager/AllotmentStatus';
import AwardHistory from '../components/Manager/AwardHistory';

type ManagerTab = 'award' | 'history';

export default function ManagerPortal() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [allotment, setAllotment] = useState<any>(null);
  const [awardHistory, setAwardHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ManagerTab>('award');

  useEffect(() => {
    const loadData = async () => {
      try {
        const userRes = await getCurrentUser();
        if (!userRes.data.isManager) {
          navigate('/dashboard');
          return;
        }

        setUser(userRes.data);

        const [allotmentRes, historyRes] = await Promise.all([
          getManagerAllotment(),
          getAwardHistory({ limit: 20 }),
        ]);

        setAllotment(allotmentRes.data);
        setAwardHistory(historyRes.data.transactions || []);
      } catch (error: any) {
        if (error.response?.status === 401) {
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  const handleAward = async (data: { employeeEmail: string; amount: number; description?: string }) => {
    try {
      await awardCoins(data);
      // Reload data
      const [allotmentRes, historyRes] = await Promise.all([
        getManagerAllotment(),
        getAwardHistory({ limit: 20 }),
      ]);
      setAllotment(allotmentRes.data);
      setAwardHistory(historyRes.data.transactions || []);
      alert('Coins awarded successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to award coins');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading...</div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout user={user}>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Manager Portal</h1>
          <p className="mt-1 text-sm text-gray-500">Award coins to employees</p>
        </div>

        {/* Section Navigation */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button
            onClick={() => setActiveTab('award')}
            className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-150 ${
              activeTab === 'award'
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className={`rounded-lg p-2 ${
              activeTab === 'award'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-400'
            }`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <p className={`text-sm font-semibold ${
                activeTab === 'award' ? 'text-blue-900' : 'text-gray-900'
              }`}>
                Award Coins
              </p>
              <p className={`text-xs mt-0.5 hidden sm:block ${
                activeTab === 'award' ? 'text-blue-600' : 'text-gray-500'
              }`}>
                Recognize employees
              </p>
            </div>
            {allotment && (
              <span className={`absolute top-2 right-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full px-1.5 text-xs font-bold ${
                activeTab === 'award'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                {allotment.remaining.toFixed(0)} left
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-150 ${
              activeTab === 'history'
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className={`rounded-lg p-2 ${
              activeTab === 'history'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-400'
            }`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <p className={`text-sm font-semibold ${
                activeTab === 'history' ? 'text-blue-900' : 'text-gray-900'
              }`}>
                Award History
              </p>
              <p className={`text-xs mt-0.5 hidden sm:block ${
                activeTab === 'history' ? 'text-blue-600' : 'text-gray-500'
              }`}>
                View past awards
              </p>
            </div>
            {awardHistory.length > 0 && (
              <span className={`absolute top-2 right-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full px-1.5 text-xs font-bold ${
                activeTab === 'history'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                {awardHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Section Content */}
        {activeTab === 'award' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              {allotment && <AllotmentStatus allotment={allotment} />}
            </div>
            <div className="lg:col-span-2">
              <AwardForm onAward={handleAward} remaining={allotment?.remaining || 0} />
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <AwardHistory history={awardHistory} />
        )}
      </div>
    </Layout>
  );
}
