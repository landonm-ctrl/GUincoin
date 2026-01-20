import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getManagerAllotment, awardCoins, getAwardHistory, User } from '../services/api';
import Layout from '../components/Layout';
import AwardForm from '../components/Manager/AwardForm';
import AllotmentStatus from '../components/Manager/AllotmentStatus';
import AwardHistory from '../components/Manager/AwardHistory';

export default function ManagerPortal() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [allotment, setAllotment] = useState<any>(null);
  const [awardHistory, setAwardHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Manager Portal</h1>
          <p className="mt-1 text-sm text-gray-500">Award coins to employees</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            {allotment && <AllotmentStatus allotment={allotment} />}
          </div>
          <div className="lg:col-span-2">
            <AwardForm onAward={handleAward} remaining={allotment?.remaining || 0} />
          </div>
        </div>

        <div className="mt-8">
          <AwardHistory history={awardHistory} />
        </div>
      </div>
    </Layout>
  );
}
