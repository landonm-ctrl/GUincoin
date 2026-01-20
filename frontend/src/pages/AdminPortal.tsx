import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createWellnessTask,
  createCustomProduct,
  getCurrentUser,
  getEmailTemplates,
  getPendingSubmissions,
  importAmazonList,
  importAmazonProduct,
  seedStoreProduct,
  approveSubmission,
  rejectSubmission,
  updateEmailTemplate,
  getPendingPurchases,
  getAllPurchases,
  fulfillPurchase,
  getAllWellnessTasks,
  deleteWellnessTask,
  getAllUsersWithSubmissions,
  User,
  EmailTemplate,
  PurchaseOrder,
  WellnessTask as WellnessTaskType,
  WellnessSubmission,
} from '../services/api';
import Layout from '../components/Layout';
import PendingSubmissionsList from '../components/Admin/PendingSubmissionsList';

interface Submission {
  id: string;
  employee: {
    id: string;
    name: string;
    email: string;
  };
  wellnessTask: {
    id: string;
    name: string;
    coinValue: number;
  };
  documentUrl: string;
  submittedAt: string;
  status: string;
}

export default function AdminPortal() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskForm, setTaskForm] = useState({
    name: '',
    description: '',
    instructions: '',
    coinValue: '',
    frequencyRule: 'one_time',
    maxRewardedUsers: '',
  });
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [savingTemplateKey, setSavingTemplateKey] = useState<string | null>(null);
  const [customProductForm, setCustomProductForm] = useState({
    name: '',
    description: '',
    coinValue: '',
  });
  const [customProductImage, setCustomProductImage] = useState<File | null>(null);
  const [customProductLoading, setCustomProductLoading] = useState(false);
  const [amazonProductUrl, setAmazonProductUrl] = useState('');
  const [amazonProductLoading, setAmazonProductLoading] = useState(false);
  const [amazonProductResult, setAmazonProductResult] = useState<string | null>(null);
  const [amazonListUrl, setAmazonListUrl] = useState('');
  const [amazonListLimit, setAmazonListLimit] = useState('20');
  const [amazonListLoading, setAmazonListLoading] = useState(false);
  const [seedProductLoading, setSeedProductLoading] = useState(false);
  const [amazonListResult, setAmazonListResult] = useState<
    | {
        requested: number;
        totalFound: number;
        results: Array<{ asin: string; status: string; message?: string }>;
      }
    | null
  >(null);
  const [pendingPurchases, setPendingPurchases] = useState<PurchaseOrder[]>([]);
  const [allPurchases, setAllPurchases] = useState<PurchaseOrder[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesTab, setPurchasesTab] = useState<'pending' | 'all'>('pending');
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [fulfillForm, setFulfillForm] = useState<{ trackingNumber: string; notes: string }>({
    trackingNumber: '',
    notes: '',
  });
  const [wellnessTasks, setWellnessTasks] = useState<WellnessTaskType[]>([]);
  const [wellnessTasksLoading, setWellnessTasksLoading] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [usersWithSubmissions, setUsersWithSubmissions] = useState<
    Array<{
      id: string;
      name: string;
      email: string;
      submissions: WellnessSubmission[];
    }>
  >([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const userRes = await getCurrentUser();
        setUser(userRes.data);

        const [submissionsRes, templatesRes] = await Promise.all([
          getPendingSubmissions(),
          getEmailTemplates(),
        ]);
        setSubmissions(submissionsRes.data);
        setEmailTemplates(templatesRes.data);
        
        // Load purchases
        const [pendingRes, allRes] = await Promise.all([
          getPendingPurchases(),
          getAllPurchases(),
        ]);
        setPendingPurchases(pendingRes.data);
        setAllPurchases(allRes.data);

        // Load wellness tasks and users
        await Promise.all([loadWellnessTasks(), loadUsersWithSubmissions()]);
      } catch (error: any) {
        if (error.response?.status === 401) {
          navigate('/login');
        }
      } finally {
        setLoading(false);
        setTemplatesLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  const handleApprove = async (id: string) => {
    try {
      await approveSubmission(id);
      alert('Submission approved successfully!');
      // Reload submissions
      const submissionsRes = await getPendingSubmissions();
      setSubmissions(submissionsRes.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to approve submission');
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    if (!reason) {
      reason = prompt('Please provide a reason for rejection:');
      if (!reason) return;
    }

    try {
      await rejectSubmission(id, reason);
      alert('Submission rejected');
      // Reload submissions
      const submissionsRes = await getPendingSubmissions();
      setSubmissions(submissionsRes.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reject submission');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!taskForm.name.trim()) {
      alert('Task name is required');
      return;
    }

    if (!taskForm.coinValue || Number(taskForm.coinValue) <= 0) {
      alert('Coin value must be greater than 0');
      return;
    }

    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('name', taskForm.name.trim());
      if (taskForm.description.trim()) {
        formData.append('description', taskForm.description.trim());
      }
      if (taskForm.instructions.trim()) {
        formData.append('instructions', taskForm.instructions.trim());
      }
      formData.append('coinValue', taskForm.coinValue);
      formData.append('frequencyRule', taskForm.frequencyRule);
      if (taskForm.maxRewardedUsers.trim()) {
        formData.append('maxRewardedUsers', taskForm.maxRewardedUsers.trim());
      }
      if (templateFile) {
        formData.append('template', templateFile);
      }

      await createWellnessTask(formData);
      alert('Wellness task created successfully');
      setTaskForm({
        name: '',
        description: '',
        instructions: '',
        coinValue: '',
        frequencyRule: 'one_time',
        maxRewardedUsers: '',
      });
      setTemplateFile(null);
      // Reload wellness tasks list
      await loadWellnessTasks();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create wellness task');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customProductForm.name.trim()) {
      alert('Product name is required');
      return;
    }

    if (!customProductForm.coinValue || Number(customProductForm.coinValue) <= 0) {
      alert('Guincoin value must be greater than 0');
      return;
    }

    if (!customProductImage) {
      alert('Product image is required');
      return;
    }

    setCustomProductLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', customProductForm.name.trim());
      if (customProductForm.description.trim()) {
        formData.append('description', customProductForm.description.trim());
      }
      formData.append('coinValue', customProductForm.coinValue);
      formData.append('image', customProductImage);

      await createCustomProduct(formData);
      alert('Store product created successfully');
      setCustomProductForm({ name: '', description: '', coinValue: '' });
      setCustomProductImage(null);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create store product');
    } finally {
      setCustomProductLoading(false);
    }
  };

  const handleImportAmazonProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amazonProductUrl.trim()) {
      alert('Amazon product URL is required');
      return;
    }

    setAmazonProductLoading(true);
    setAmazonProductResult(null);
    try {
      await importAmazonProduct(amazonProductUrl.trim());
      setAmazonProductResult('Imported successfully.');
      setAmazonProductUrl('');
    } catch (error: any) {
      setAmazonProductResult(error.response?.data?.error || 'Amazon import failed.');
    } finally {
      setAmazonProductLoading(false);
    }
  };

  const handleImportAmazonList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amazonListUrl.trim()) {
      alert('Amazon list URL is required');
      return;
    }

    const parsedLimit = amazonListLimit.trim() ? Number(amazonListLimit) : undefined;
    if (parsedLimit && Number.isNaN(parsedLimit)) {
      alert('Limit must be a number');
      return;
    }

    setAmazonListLoading(true);
    setAmazonListResult(null);
    try {
      const response = await importAmazonList(amazonListUrl.trim(), parsedLimit);
      setAmazonListResult(response.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Amazon list import failed.');
    } finally {
      setAmazonListLoading(false);
    }
  };

  const handleSeedProduct = async () => {
    setSeedProductLoading(true);
    try {
      await seedStoreProduct();
      alert('Sample store product created.');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to seed store product.');
    } finally {
      setSeedProductLoading(false);
    }
  };

  const loadPurchases = async () => {
    setPurchasesLoading(true);
    try {
      const [pendingRes, allRes] = await Promise.all([
        getPendingPurchases(),
        getAllPurchases(),
      ]);
      setPendingPurchases(pendingRes.data);
      setAllPurchases(allRes.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load purchases');
    } finally {
      setPurchasesLoading(false);
    }
  };

  const handleFulfillPurchase = async (purchaseId: string) => {
    setFulfillingId(purchaseId);
    try {
      await fulfillPurchase(purchaseId, {
        trackingNumber: fulfillForm.trackingNumber || undefined,
        notes: fulfillForm.notes || undefined,
      });
      alert('Purchase marked as fulfilled! The customer will be notified.');
      setFulfillForm({ trackingNumber: '', notes: '' });
      setFulfillingId(null);
      await loadPurchases();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to fulfill purchase');
    } finally {
      setFulfillingId(null);
    }
  };

  const handleTemplateChange = (key: string, updates: Partial<EmailTemplate>) => {
    setEmailTemplates((prev) =>
      prev.map((template) => (template.key === key ? { ...template, ...updates } : template))
    );
  };

  const handleSaveTemplate = async (template: EmailTemplate) => {
    setSavingTemplateKey(template.key);
    try {
      await updateEmailTemplate(template.key, {
        subject: template.subject,
        html: template.html,
        isEnabled: template.isEnabled,
      });
      alert('Email template updated');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update email template');
    } finally {
      setSavingTemplateKey(null);
    }
  };

  const loadWellnessTasks = async () => {
    setWellnessTasksLoading(true);
    try {
      const res = await getAllWellnessTasks();
      setWellnessTasks(res.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load wellness tasks');
    } finally {
      setWellnessTasksLoading(false);
    }
  };

  const handleDeleteTask = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will deactivate the program but preserve all submissions, documents, and rewards.`)) {
      return;
    }

    setDeletingTaskId(id);
    try {
      await deleteWellnessTask(id);
      alert('Wellness program deactivated successfully');
      await loadWellnessTasks();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete wellness task');
    } finally {
      setDeletingTaskId(null);
    }
  };

  const loadUsersWithSubmissions = async () => {
    setUsersLoading(true);
    try {
      const res = await getAllUsersWithSubmissions();
      setUsersWithSubmissions(res.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load users');
    } finally {
      setUsersLoading(false);
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
          <h1 className="text-2xl font-bold text-gray-900">Admin Portal</h1>
          <p className="mt-1 text-sm text-gray-500">Create wellness tasks and review submissions</p>
        </div>

        {/* Wellness Programs Management Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Wellness Programs</h2>
              <p className="mt-1 text-sm text-gray-500">
                Manage wellness programs, view all users, and access submitted documents
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadWellnessTasks}
                disabled={wellnessTasksLoading}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:bg-gray-200 disabled:text-gray-500"
              >
                {wellnessTasksLoading ? 'Loading...' : 'Refresh Tasks'}
              </button>
              <button
                onClick={loadUsersWithSubmissions}
                disabled={usersLoading}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:bg-gray-200 disabled:text-gray-500"
              >
                {usersLoading ? 'Loading...' : 'Refresh Users'}
              </button>
            </div>
          </div>

          {/* Wellness Tasks List */}
          <div className="mb-8">
            <h3 className="text-md font-semibold text-gray-900 mb-4">All Wellness Programs</h3>
            {wellnessTasksLoading && wellnessTasks.length === 0 ? (
              <div className="text-center py-6 text-gray-500">Loading tasks...</div>
            ) : wellnessTasks.length === 0 ? (
              <div className="text-center py-6 text-gray-500">No wellness tasks found.</div>
            ) : (
              <div className="space-y-3">
                {wellnessTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`border rounded-lg p-4 ${
                      task.isActive ? 'border-gray-200' : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-md font-medium text-gray-900">{task.name}</h4>
                          {!task.isActive && (
                            <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                          <span>Reward: {task.coinValue.toFixed(2)} Guincoin</span>
                          <span>Frequency: {task.frequencyRule.replace('_', ' ')}</span>
                          {task.maxRewardedUsers && (
                            <span>Max Users: {task.maxRewardedUsers}</span>
                          )}
                          <span>
                            Created: {new Date(task.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {task.isActive && (
                        <button
                          onClick={() => handleDeleteTask(task.id, task.name)}
                          disabled={deletingTaskId === task.id}
                          className="ml-4 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 disabled:bg-gray-200 disabled:text-gray-500"
                        >
                          {deletingTaskId === task.id ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Users and Documents */}
          <div>
            <h3 className="text-md font-semibold text-gray-900 mb-4">Users & Documents</h3>
            {usersLoading && usersWithSubmissions.length === 0 ? (
              <div className="text-center py-6 text-gray-500">Loading users...</div>
            ) : usersWithSubmissions.length === 0 ? (
              <div className="text-center py-6 text-gray-500">No users found.</div>
            ) : (
              <div className="space-y-4">
                {usersWithSubmissions.map((user) => (
                  <div key={user.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-md font-medium text-gray-900">{user.name}</h4>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {user.submissions.length} submission{user.submissions.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setSelectedUserId(selectedUserId === user.id ? null : user.id)
                        }
                        className="ml-4 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                      >
                        {selectedUserId === user.id ? 'Hide Documents' : 'View Documents'}
                      </button>
                    </div>

                    {selectedUserId === user.id && user.submissions.length > 0 && (
                      <div className="mt-4 border-t border-gray-200 pt-4">
                        <div className="space-y-3">
                          {user.submissions.map((submission) => (
                            <div
                              key={submission.id}
                              className="border border-gray-200 rounded-md p-3 bg-gray-50"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h5 className="text-sm font-medium text-gray-900">
                                      {submission.wellnessTask.name}
                                    </h5>
                                    {!submission.wellnessTask.isActive && (
                                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                                        Program Inactive
                                      </span>
                                    )}
                                    <span
                                      className={`px-2 py-0.5 text-xs font-medium rounded ${
                                        submission.status === 'approved'
                                          ? 'bg-green-100 text-green-800'
                                          : submission.status === 'rejected'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-yellow-100 text-yellow-800'
                                      }`}
                                    >
                                      {submission.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Submitted: {new Date(submission.submittedAt).toLocaleString()}
                                  </p>
                                  {submission.transaction && (
                                    <p className="text-xs text-gray-600 mt-1">
                                      Reward: {submission.transaction.amount.toFixed(2)} Guincoin (
                                      {submission.transaction.status})
                                    </p>
                                  )}
                                  {submission.rejectionReason && (
                                    <p className="text-xs text-red-600 mt-1">
                                      Reason: {submission.rejectionReason}
                                    </p>
                                  )}
                                </div>
                                <a
                                  href={submission.documentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-4 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                                >
                                  View Document
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedUserId === user.id && user.submissions.length === 0 && (
                      <div className="mt-4 border-t border-gray-200 pt-4 text-sm text-gray-500 text-center py-2">
                        No submissions found for this user.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Create Wellness Task</h2>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Name</label>
              <input
                type="text"
                value={taskForm.name}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, name: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
              <textarea
                value={taskForm.instructions}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, instructions: e.target.value }))}
                rows={3}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coin Value</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={taskForm.coinValue}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, coinValue: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  value={taskForm.frequencyRule}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, frequencyRule: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="one_time">One-time</option>
                  <option value="annual">Annual</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Rewarded Users
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={taskForm.maxRewardedUsers}
                  onChange={(e) =>
                    setTaskForm((prev) => ({ ...prev, maxRewardedUsers: e.target.value }))
                  }
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Form Template (optional)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif"
                onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-1 text-xs text-gray-500">
                PDF or image files only (max 5MB)
              </p>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {creating ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>

        <PendingSubmissionsList
          submissions={submissions}
          onApprove={handleApprove}
          onReject={handleReject}
        />

        <div className="bg-white shadow rounded-lg p-6 mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Store Products</h2>
          <p className="text-sm text-gray-500 mb-6">
            Add custom products or import from Amazon. Amazon imports depend on the product page
            being publicly accessible.
          </p>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-gray-900">Custom Product</h3>
                <button
                  type="button"
                  onClick={handleSeedProduct}
                  disabled={seedProductLoading}
                  className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 disabled:bg-gray-200 disabled:text-gray-500"
                >
                  {seedProductLoading ? 'Seeding...' : 'Seed Sample'}
                </button>
              </div>
              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    value={customProductForm.name}
                    onChange={(e) =>
                      setCustomProductForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={customProductForm.description}
                    onChange={(e) =>
                      setCustomProductForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guincoin Value
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customProductForm.coinValue}
                    onChange={(e) =>
                      setCustomProductForm((prev) => ({ ...prev, coinValue: e.target.value }))
                    }
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Image
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif"
                    onChange={(e) => setCustomProductImage(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={customProductLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {customProductLoading ? 'Saving...' : 'Add Product'}
                  </button>
                </div>
              </form>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 space-y-6">
              <div>
                <h3 className="text-md font-semibold text-gray-900 mb-4">Amazon Product Link</h3>
                <form onSubmit={handleImportAmazonProduct} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product URL
                    </label>
                    <input
                      type="url"
                      value={amazonProductUrl}
                      onChange={(e) => setAmazonProductUrl(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="https://www.amazon.com/dp/..."
                      required
                    />
                  </div>

                  {amazonProductResult && (
                    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      {amazonProductResult}
                    </div>
                  )}

                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={amazonProductLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {amazonProductLoading ? 'Importing...' : 'Import Product'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-md font-semibold text-gray-900 mb-4">Amazon List Import</h3>
                <form onSubmit={handleImportAmazonList} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      List URL
                    </label>
                    <input
                      type="url"
                      value={amazonListUrl}
                      onChange={(e) => setAmazonListUrl(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="https://www.amazon.com/hz/wishlist/..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Limit</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={amazonListLimit}
                      onChange={(e) => setAmazonListLimit(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  {amazonListResult && (
                    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      Imported {amazonListResult.results.filter((item) => item.status === 'imported').length}{' '}
                      of {amazonListResult.requested} items. Total found: {amazonListResult.totalFound}.
                    </div>
                  )}

                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={amazonListLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {amazonListLoading ? 'Importing...' : 'Import List'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Purchase Orders Section */}
        <div className="bg-white shadow rounded-lg p-6 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Purchase Orders</h2>
            <button
              onClick={loadPurchases}
              disabled={purchasesLoading}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
            >
              {purchasesLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          <div className="border-b border-gray-200 mb-4">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => {
                  setPurchasesTab('pending');
                  loadPurchases();
                }}
                className={`whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium ${
                  purchasesTab === 'pending'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Pending ({pendingPurchases.length})
              </button>
              <button
                onClick={() => {
                  setPurchasesTab('all');
                  loadPurchases();
                }}
                className={`whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium ${
                  purchasesTab === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                All Purchases
              </button>
            </nav>
          </div>

          {purchasesLoading && purchasesTab === 'pending' && pendingPurchases.length === 0 ? (
            <div className="text-center py-6 text-gray-500">Loading purchases...</div>
          ) : purchasesTab === 'pending' && pendingPurchases.length === 0 ? (
            <div className="text-center py-6 text-gray-500">No pending purchases.</div>
          ) : (
            <div className="space-y-4">
              {(purchasesTab === 'pending' ? pendingPurchases : allPurchases).map((purchase) => (
                <div key={purchase.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-md font-semibold text-gray-900">
                          {purchase.product.name}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            purchase.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : purchase.status === 'fulfilled'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {purchase.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Customer: {purchase.employee?.name || 'Unknown'} (
                        {purchase.employee?.email || 'Unknown'})
                      </p>
                      <p className="text-sm text-gray-600">
                        Price: {purchase.priceGuincoin.toFixed(2)} Guincoin
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Ordered: {new Date(purchase.createdAt).toLocaleString()}
                      </p>
                      {purchase.shippingAddress && (
                        <p className="text-sm text-gray-600 mt-1">
                          <strong>Shipping:</strong> {purchase.shippingAddress}
                        </p>
                      )}
                      {purchase.status === 'fulfilled' && purchase.trackingNumber && (
                        <p className="text-sm text-gray-600 mt-1">
                          <strong>Tracking:</strong> {purchase.trackingNumber}
                        </p>
                      )}
                      {purchase.status === 'fulfilled' && purchase.fulfilledAt && (
                        <p className="text-sm text-gray-500 mt-1">
                          Fulfilled: {new Date(purchase.fulfilledAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {purchase.status === 'pending' && (
                      <div className="ml-4">
                        {fulfillingId === purchase.id ? (
                          <div className="w-64 space-y-2">
                            <input
                              type="text"
                              placeholder="Tracking number (optional)"
                              value={fulfillForm.trackingNumber}
                              onChange={(e) =>
                                setFulfillForm((prev) => ({
                                  ...prev,
                                  trackingNumber: e.target.value,
                                }))
                              }
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                            <textarea
                              placeholder="Notes (optional)"
                              value={fulfillForm.notes}
                              onChange={(e) =>
                                setFulfillForm((prev) => ({ ...prev, notes: e.target.value }))
                              }
                              rows={2}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setFulfillingId(null);
                                  setFulfillForm({ trackingNumber: '', notes: '' });
                                }}
                                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleFulfillPurchase(purchase.id)}
                                className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                              >
                                Confirm
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setFulfillingId(purchase.id)}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            Mark Fulfilled
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white shadow rounded-lg p-6 mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Email Templates</h2>
          <p className="text-sm text-gray-500 mb-6">
            Edit the subject and HTML for notification emails. Variables can be used with
            <code className="ml-1 px-1 py-0.5 bg-gray-100 rounded">{'{{variable}}'}</code>.
          </p>

          {templatesLoading ? (
            <div className="text-center py-6 text-gray-500">Loading templates...</div>
          ) : emailTemplates.length === 0 ? (
            <div className="text-center py-6 text-gray-500">No templates available.</div>
          ) : (
            <div className="space-y-6">
              {emailTemplates.map((template) => (
                <div key={template.key} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-md font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-500">{template.description}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={template.isEnabled}
                        onChange={(e) =>
                          handleTemplateChange(template.key, { isEnabled: e.target.checked })
                        }
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <input
                      type="text"
                      value={template.subject}
                      onChange={(e) =>
                        handleTemplateChange(template.key, { subject: e.target.value })
                      }
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">HTML</label>
                    <textarea
                      rows={8}
                      value={template.html}
                      onChange={(e) =>
                        handleTemplateChange(template.key, { html: e.target.value })
                      }
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-xs"
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      Available variables: {template.variables.join(', ')}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveTemplate(template)}
                      disabled={savingTemplateKey === template.key}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {savingTemplateKey === template.key ? 'Saving...' : 'Save Template'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
