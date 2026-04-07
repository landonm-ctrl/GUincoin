# Navigation UI Redesign - Code Changes

Two files were modified. Copy each file's content to the specified path.

## File 1: `frontend/src/pages/ManagerPortal.tsx`

```tsx
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
  const [user, setUser] = useState&lt;User | null&gt;(null);
  const [allotment, setAllotment] = useState&lt;any&gt;(null);
  const [awardHistory, setAwardHistory] = useState&lt;any[]&gt;([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState&lt;ManagerTab&gt;('award');

  useEffect(() =&gt; {
    const loadData = async () =&gt; {
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

  const handleAward = async (data: { employeeEmail: string; amount: number; description?: string }) =&gt; {
    try {
      await awardCoins(data);
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
      &lt;Layout&gt;
        &lt;div className="text-center py-12"&gt;Loading...&lt;/div&gt;
      &lt;/Layout&gt;
    );
  }

  if (!user) {
    return null;
  }

  return (
    &lt;Layout user={user}&gt;
      &lt;div className="px-4 py-6 sm:px-0"&gt;
        &lt;div className="mb-8"&gt;
          &lt;h1 className="text-2xl font-bold text-gray-900"&gt;Manager Portal&lt;/h1&gt;
          &lt;p className="mt-1 text-sm text-gray-500"&gt;Award coins to employees&lt;/p&gt;
        &lt;/div&gt;

        {/* Section Navigation */}
        &lt;div className="grid grid-cols-2 gap-3 mb-8"&gt;
          &lt;button
            onClick={() =&gt; setActiveTab('award')}
            className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-150 ${
              activeTab === 'award'
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          &gt;
            &lt;div className={`rounded-lg p-2 ${
              activeTab === 'award'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-400'
            }`}&gt;
              &lt;svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"&gt;
                &lt;path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /&gt;
              &lt;/svg&gt;
            &lt;/div&gt;
            &lt;div&gt;
              &lt;p className={`text-sm font-semibold ${
                activeTab === 'award' ? 'text-blue-900' : 'text-gray-900'
              }`}&gt;
                Award Coins
              &lt;/p&gt;
              &lt;p className={`text-xs mt-0.5 hidden sm:block ${
                activeTab === 'award' ? 'text-blue-600' : 'text-gray-500'
              }`}&gt;
                Recognize employees
              &lt;/p&gt;
            &lt;/div&gt;
            {allotment &amp;&amp; (
              &lt;span className={`absolute top-2 right-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full px-1.5 text-xs font-bold ${
                activeTab === 'award'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}&gt;
                {allotment.remaining.toFixed(0)} left
              &lt;/span&gt;
            )}
          &lt;/button&gt;

          &lt;button
            onClick={() =&gt; setActiveTab('history')}
            className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-150 ${
              activeTab === 'history'
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          &gt;
            &lt;div className={`rounded-lg p-2 ${
              activeTab === 'history'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-400'
            }`}&gt;
              &lt;svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"&gt;
                &lt;path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /&gt;
              &lt;/svg&gt;
            &lt;/div&gt;
            &lt;div&gt;
              &lt;p className={`text-sm font-semibold ${
                activeTab === 'history' ? 'text-blue-900' : 'text-gray-900'
              }`}&gt;
                Award History
              &lt;/p&gt;
              &lt;p className={`text-xs mt-0.5 hidden sm:block ${
                activeTab === 'history' ? 'text-blue-600' : 'text-gray-500'
              }`}&gt;
                View past awards
              &lt;/p&gt;
            &lt;/div&gt;
            {awardHistory.length &gt; 0 &amp;&amp; (
              &lt;span className={`absolute top-2 right-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full px-1.5 text-xs font-bold ${
                activeTab === 'history'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}&gt;
                {awardHistory.length}
              &lt;/span&gt;
            )}
          &lt;/button&gt;
        &lt;/div&gt;

        {/* Section Content */}
        {activeTab === 'award' &amp;&amp; (
          &lt;div className="grid grid-cols-1 gap-6 lg:grid-cols-3"&gt;
            &lt;div className="lg:col-span-1"&gt;
              {allotment &amp;&amp; &lt;AllotmentStatus allotment={allotment} /&gt;}
            &lt;/div&gt;
            &lt;div className="lg:col-span-2"&gt;
              &lt;AwardForm onAward={handleAward} remaining={allotment?.remaining || 0} /&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        )}

        {activeTab === 'history' &amp;&amp; (
          &lt;AwardHistory history={awardHistory} /&gt;
        )}
      &lt;/div&gt;
    &lt;/Layout&gt;
  );
}
```

## File 2: `frontend/src/pages/AdminPortal.tsx`

This file is 2,436 lines. It is already correct on the `main` branch of this repo.
The complete file can be read from the repo directly at `frontend/src/pages/AdminPortal.tsx`.

### Instructions for another agent:

1. The files on `main` are already correct — both AdminPortal.tsx and ManagerPortal.tsx have the redesigned navigation
2. Railway is not auto-deploying. You need to either:
   - Trigger a manual redeploy in Railway
   - Or commit and push any change to `main` to trigger the webhook
3. If pushing doesn't trigger Railway, the GitHub-Railway webhook integration may need to be reconnected in Railway settings

### What changed:
- Admin Portal: horizontal underline tab bar → responsive grid of icon card buttons (2-col mobile, 3-col tablet, 5-col desktop)
- Manager Portal: added tab navigation cards matching admin style
- Sub-tabs (Purchase Orders, Settings): converted to pill/chip buttons with flex-wrap
- Fixed hardcoded w-64 width for mobile responsiveness
