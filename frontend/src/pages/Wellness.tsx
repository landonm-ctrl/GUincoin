import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getWellnessTasks, getWellnessSubmissions, User, WellnessTask, WellnessSubmission } from '../services/api';
import Layout from '../components/Layout';
import WellnessTaskList from '../components/Wellness/WellnessTaskList';
import WellnessSubmissions from '../components/Wellness/WellnessSubmissions';

export default function Wellness() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<WellnessTask[]>([]);
  const [submissions, setSubmissions] = useState<WellnessSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const userRes = await getCurrentUser();
        setUser(userRes.data);

        const [tasksRes, submissionsRes] = await Promise.all([
          getWellnessTasks(),
          getWellnessSubmissions(),
        ]);

        setTasks(tasksRes.data);
        setSubmissions(submissionsRes.data);
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

  const handleSubmission = () => {
    // Reload submissions after new submission
    getWellnessSubmissions().then((res) => setSubmissions(res.data));
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
          <h1 className="text-2xl font-bold text-gray-900">Wellness Program</h1>
          <p className="mt-1 text-sm text-gray-500">Complete wellness tasks to earn Guincoins</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Available Tasks</h2>
            <WellnessTaskList tasks={tasks} onSubmission={handleSubmission} />
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">My Submissions</h2>
            <WellnessSubmissions submissions={submissions} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
