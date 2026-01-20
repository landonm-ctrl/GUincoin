import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  getCurrentUser,
  getBalance,
  getTransactions,
  getGoals,
  checkGoalAchievements,
  deleteGoal,
  User,
  Balance,
  Transaction,
  Goal,
} from '../services/api';
import Layout from '../components/Layout';
import BalanceCard from '../components/Dashboard/BalanceCard';
import TransactionList from '../components/Dashboard/TransactionList';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const confettiPlayed = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.allSettled([
          getCurrentUser(),
          getBalance(),
          getTransactions({ limit: 10 }),
          getGoals(),
          checkGoalAchievements(),
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

        const [userRes, balanceRes, transactionsRes, goalsRes, achievementsRes] = results;

        if (userRes.status === 'fulfilled') {
          setUser(userRes.value.data);
        }

        if (balanceRes.status === 'fulfilled') {
          setBalance(balanceRes.value.data);
        }

        if (transactionsRes.status === 'fulfilled') {
          setTransactions(transactionsRes.value.data.transactions);
        }

        if (goalsRes.status === 'fulfilled') {
          setGoals(goalsRes.value.data);
        }

        // Check for new achievements and play confetti once
        if (
          achievementsRes.status === 'fulfilled' &&
          achievementsRes.value.data.hasNewAchievements &&
          !confettiPlayed.current
        ) {
          confettiPlayed.current = true;
          // Play confetti animation
          const duration = 3000;
          const end = Date.now() + duration;

          const interval = setInterval(() => {
            if (Date.now() > end) {
              clearInterval(interval);
              return;
            }

            confetti({
              particleCount: 3,
              angle: 60,
              spread: 55,
              origin: { x: 0 },
              colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
            });
            confetti({
              particleCount: 3,
              angle: 120,
              spread: 55,
              origin: { x: 1 },
              colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
            });
          }, 25);

          // Update goals after confetti starts
          const updatedGoalsRes = await getGoals();
          if (updatedGoalsRes.status === 'fulfilled') {
            setGoals(updatedGoalsRes.value.data);
          }
        }

        if (results.some((result) => result.status === 'rejected')) {
          setError('We could not load all dashboard data. Please refresh and try again.');
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          navigate('/login');
          return;
        }
        setError('We could not load your dashboard data. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) {
      return;
    }

    try {
      await deleteGoal(goalId);
      const goalsRes = await getGoals();
      setGoals(goalsRes.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete goal');
    }
  };

  const activeGoals = goals.filter((g) => !g.isAchieved);

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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          {user && <p className="mt-1 text-sm text-gray-500">Welcome back, {user.name}!</p>}
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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-6">
              {balance ? (
                <BalanceCard balance={balance} />
              ) : (
                <div className="rounded-md border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-600">
                  Balance is unavailable right now.
                </div>
              )}

              {/* Goals Panel */}
              {activeGoals.length > 0 && (
                <div className="rounded-md border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-200 px-4 py-3">
                    <h2 className="text-lg font-medium text-gray-900">Your Goals</h2>
                  </div>
                  <div className="p-4 space-y-4">
                    {activeGoals.map((goal) => {
                      const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                      const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);

                      return (
                        <div key={goal.id} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">
                                {goal.product.name}
                              </h3>
                              <p className="text-xs text-gray-500 mt-1">
                                Target: {goal.targetAmount.toFixed(2)} Guincoin
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteGoal(goal.id)}
                              className="ml-2 text-gray-400 hover:text-red-600 text-sm"
                              title="Delete goal"
                            >
                              ×
                            </button>
                          </div>
                          <div className="mb-2">
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>
                                {goal.currentAmount.toFixed(2)} / {goal.targetAmount.toFixed(2)} Guincoin
                              </span>
                              <span>{progress.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                          <p className="text-xs text-gray-600">
                            {remaining > 0
                              ? `${remaining.toFixed(2)} Guincoin to go!`
                              : 'Goal achieved! 🎉'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-gray-900">Recent Transactions</h2>
              </div>
              {transactions.length > 0 ? (
                <TransactionList transactions={transactions} />
              ) : (
                <div className="rounded-md border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-600">
                  No transactions available yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
