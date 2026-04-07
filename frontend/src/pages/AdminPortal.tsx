import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  getAllEmployees,
  createEmployee,
  updateEmployeeRoles,
  getGoogleChatAuditLogs,
  getGoogleChatStats,
  getManagerAllotmentDetails,
  depositAllotment,
  setRecurringBudget,
  getAdminStoreProducts,
  toggleProductStatus,
  deleteProduct,
  getCampaigns,
  User,
  EmailTemplate,
  PurchaseOrder,
  StoreProduct,
  WellnessTask as WellnessTaskType,
  WellnessSubmission,
  Employee,
  ChatCommandAudit,
  ChatAuditStats,
  ManagerAllotmentDetails,
  Campaign,
} from '../services/api';
import Layout from '../components/Layout';
import PendingSubmissionsList from '../components/Admin/PendingSubmissionsList';
import { CampaignStudio } from '../components/Admin/CampaignStudio';

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

type TabType = 'wellness' | 'store' | 'studio' | 'google-chat' | 'settings';
type SettingsTabType = 'email-templates' | 'roles' | 'allotments';

export default function AdminPortal() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('wellness');
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
  const [settingsTab, setSettingsTab] = useState<SettingsTabType>('email-templates');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [updatingEmployeeId, setUpdatingEmployeeId] = useState<string | null>(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    name: '',
    isManager: false,
    isAdmin: false,
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [chatAuditLogs, setChatAuditLogs] = useState<ChatCommandAudit[]>([]);
  const [chatStats, setChatStats] = useState<ChatAuditStats | null>(null);
  const [chatLogsLoading, setChatLogsLoading] = useState(false);
  const [chatPage, setChatPage] = useState(1);
  const [chatTotalPages, setChatTotalPages] = useState(1);
  const [chatFilters, setChatFilters] = useState<{
    status?: string;
    userEmail?: string;
  }>({});
  // Allotment management state
  const [managers, setManagers] = useState<Employee[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [selectedManagerAllotment, setSelectedManagerAllotment] = useState<ManagerAllotmentDetails | null>(null);
  const [allotmentLoading, setAllotmentLoading] = useState(false);
  const [depositForm, setDepositForm] = useState({ amount: '', description: '' });
  const [depositLoading, setDepositLoading] = useState(false);
  const [recurringForm, setRecurringForm] = useState({ amount: '' });
  const [recurringLoading, setRecurringLoading] = useState(false);
  // Store product management state
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [storeProductsLoading, setStoreProductsLoading] = useState(false);
  const [togglingProductId, setTogglingProductId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  // Campaign management state (used for tab badge count)
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

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
  }, [navigate, location.pathname]);

  // Auto-load wellness data when wellness tab becomes active
  useEffect(() => {
    if (activeTab === 'wellness' && !loading) {
      const loadWellnessData = async () => {
        setWellnessTasksLoading(true);
        setUsersLoading(true);
        try {
          const [tasksRes, usersRes] = await Promise.all([
            getAllWellnessTasks(),
            getAllUsersWithSubmissions(),
          ]);
          setWellnessTasks(tasksRes.data);
          setUsersWithSubmissions(usersRes.data);
        } catch (error: any) {
          console.error('Failed to load wellness data:', error);
        } finally {
          setWellnessTasksLoading(false);
          setUsersLoading(false);
        }
      };
      loadWellnessData();
    }
  }, [activeTab, loading]);

  // Auto-load employees when roles tab becomes active
  useEffect(() => {
    if (activeTab === 'settings' && settingsTab === 'roles' && !loading) {
      loadEmployees();
    }
  }, [activeTab, settingsTab, loading]);

  // Auto-load Google Chat data when google-chat tab becomes active
  useEffect(() => {
    if (activeTab === 'google-chat' && !loading) {
      loadGoogleChatData();
    }
  }, [activeTab, loading, chatPage, chatFilters]);

  // Auto-load managers when allotments tab becomes active
  useEffect(() => {
    if (activeTab === 'settings' && settingsTab === 'allotments' && !loading) {
      loadManagers();
    }
  }, [activeTab, settingsTab, loading]);

  // Auto-load store products when store tab becomes active
  useEffect(() => {
    if (activeTab === 'store' && !loading && storeProducts.length === 0) {
      loadStoreProducts();
    }
  }, [activeTab, loading]);

  // Load campaigns on initial load for tab badge count
  useEffect(() => {
    if (activeTab === 'studio' && !loading) {
      loadCampaigns();
    }
  }, [activeTab, loading]);

  const loadCampaigns = async () => {
    try {
      const res = await getCampaigns();
      setCampaigns(res.data);
    } catch (error: any) {
      console.error('Failed to load campaigns:', error);
    }
  };

  const loadGoogleChatData = async () => {
    setChatLogsLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        getGoogleChatAuditLogs({
          page: chatPage,
          limit: 50,
          ...chatFilters,
        }),
        getGoogleChatStats(),
      ]);
      setChatAuditLogs(logsRes.data.data);
      setChatTotalPages(logsRes.data.pagination.totalPages);
      setChatStats(statsRes.data);
    } catch (error: any) {
      console.error('Failed to load Google Chat data:', error);
    } finally {
      setChatLogsLoading(false);
    }
  };

  const loadManagers = async () => {
    setManagersLoading(true);
    try {
      const res = await getAllEmployees();
      // Filter to only managers
      const managerList = res.data.filter((emp: Employee) => emp.isManager);
      setManagers(managerList);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load managers');
    } finally {
      setManagersLoading(false);
    }
  };

  const loadManagerAllotment = async (managerId: string) => {
    setAllotmentLoading(true);
    setSelectedManagerAllotment(null);
    try {
      const res = await getManagerAllotmentDetails(managerId);
      setSelectedManagerAllotment(res.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load manager allotment');
    } finally {
      setAllotmentLoading(false);
    }
  };

  const handleSelectManager = (managerId: string) => {
    setSelectedManagerId(managerId);
    setDepositForm({ amount: '', description: '' });
    setRecurringForm({ amount: '' });
    loadManagerAllotment(managerId);
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManagerId) return;

    const amount = parseFloat(depositForm.amount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }

    setDepositLoading(true);
    try {
      await depositAllotment(selectedManagerId, {
        amount,
        description: depositForm.description || undefined,
      });
      alert('Allotment deposited successfully!');
      setDepositForm({ amount: '', description: '' });
      // Reload the allotment details
      await loadManagerAllotment(selectedManagerId);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to deposit allotment');
    } finally {
      setDepositLoading(false);
    }
  };

  const handleSetRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManagerId) return;

    const amount = parseFloat(recurringForm.amount);
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid amount (0 to disable recurring)');
      return;
    }

    setRecurringLoading(true);
    try {
      await setRecurringBudget(selectedManagerId, { amount });
      alert(amount > 0 ? 'Recurring budget set successfully!' : 'Recurring budget disabled');
      setRecurringForm({ amount: '' });
      // Reload the allotment details
      await loadManagerAllotment(selectedManagerId);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to set recurring budget');
    } finally {
      setRecurringLoading(false);
    }
  };

  const loadStoreProducts = async () => {
    setStoreProductsLoading(true);
    try {
      const res = await getAdminStoreProducts();
      setStoreProducts(res.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load store products');
    } finally {
      setStoreProductsLoading(false);
    }
  };

  const handleToggleProduct = async (productId: string) => {
    setTogglingProductId(productId);
    try {
      const res = await toggleProductStatus(productId);
      setStoreProducts((prev) =>
        prev.map((p) => (p.id === productId ? res.data.product : p))
      );
      alert(res.data.message);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to toggle product status');
    } finally {
      setTogglingProductId(null);
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete "${productName}"? This cannot be undone.`)) {
      return;
    }

    setDeletingProductId(productId);
    try {
      const res = await deleteProduct(productId);
      if (res.data.softDeleted) {
        // Product was soft deleted, update in list
        setStoreProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, isActive: false } : p))
        );
      } else {
        // Product was hard deleted, remove from list
        setStoreProducts((prev) => prev.filter((p) => p.id !== productId));
      }
      alert(res.data.message);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete product');
    } finally {
      setDeletingProductId(null);
    }
  };

  const loadEmployees = async () => {
    setEmployeesLoading(true);
    try {
      const res = await getAllEmployees();
      setEmployees(res.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load employees');
    } finally {
      setEmployeesLoading(false);
    }
  };

  const handleUpdateRoles = async (employeeId: string, updates: { isManager?: boolean; isAdmin?: boolean }) => {
    setUpdatingEmployeeId(employeeId);
    try {
      const res = await updateEmployeeRoles(employeeId, updates);
      setEmployees((prev) => prev.map((emp) => (emp.id === employeeId ? res.data : emp)));
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update roles');
    } finally {
      setUpdatingEmployeeId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUserForm.email.trim() || !newUserForm.name.trim()) {
      alert('Email and name are required');
      return;
    }

    setCreatingUser(true);
    try {
      const res = await createEmployee({
        email: newUserForm.email.trim(),
        name: newUserForm.name.trim(),
        isManager: newUserForm.isManager,
        isAdmin: newUserForm.isAdmin,
      });
      setEmployees((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewUserForm({ email: '', name: '', isManager: false, isAdmin: false });
      setShowAddUserForm(false);
      alert('User created successfully! An email notification has been sent.');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

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
      const input = prompt('Please provide a reason for rejection:');
      if (!input) return;
      reason = input;
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

  const tabConfig = [
    {
      id: 'wellness' as TabType,
      name: 'Wellness',
      description: 'Tasks & submissions',
      count: submissions.length,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
        </svg>
      ),
    },
    {
      id: 'store' as TabType,
      name: 'Store',
      description: 'Products & orders',
      count: pendingPurchases.length,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
        </svg>
      ),
    },
    {
      id: 'studio' as TabType,
      name: 'Campaigns',
      description: 'Studio & banners',
      count: campaigns.filter(c => c.status === 'active').length || null,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
        </svg>
      ),
    },
    {
      id: 'google-chat' as TabType,
      name: 'Google Chat',
      description: 'Logs & statistics',
      count: chatStats?.recentActivity || null,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
      ),
    },
    {
      id: 'settings' as TabType,
      name: 'Settings',
      description: 'Templates & roles',
      count: null,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      ),
    },
  ];

  return (
    <Layout user={user}>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Portal</h1>
              <p className="mt-1 text-sm text-gray-500">Manage wellness programs, store, and system settings</p>
            </div>
            <button
              onClick={() => navigate('/admin/balances')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Balance Report
            </button>
          </div>
        </div>

        {/* Section Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-150 ${
                activeTab === tab.id
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className={`rounded-lg p-2 ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {tab.icon}
              </div>
              <div>
                <p className={`text-sm font-semibold ${
                  activeTab === tab.id ? 'text-blue-900' : 'text-gray-900'
                }`}>
                  {tab.name}
                </p>
                <p className={`text-xs mt-0.5 hidden sm:block ${
                  activeTab === tab.id ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {tab.description}
                </p>
              </div>
              {tab.count !== null && tab.count > 0 && (
                <span className={`absolute top-2 right-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full px-1.5 text-xs font-bold ${
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Wellness Tab */}
        {activeTab === 'wellness' && (
          <div className="space-y-6">
            {/* Pending Submissions */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">Pending Submissions</h2>
                <span className="text-sm text-gray-500">{submissions.length} pending</span>
              </div>
              <PendingSubmissionsList
                submissions={submissions}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            </div>

            {/* Create Wellness Task */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Create Wellness Task</h2>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                  <textarea
                    value={taskForm.instructions}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, instructions: e.target.value }))}
                    rows={2}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <p className="mt-1 text-xs text-gray-500">PDF or image files only (max 5MB)</p>
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

            {/* Wellness Programs Management */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">Wellness Programs</h2>
                <div className="flex gap-2">
                  <button
                    onClick={loadWellnessTasks}
                    disabled={wellnessTasksLoading}
                    className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:bg-gray-200 disabled:text-gray-500"
                  >
                    {wellnessTasksLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>

              {wellnessTasksLoading && wellnessTasks.length === 0 ? (
                <div className="text-center py-6 text-gray-500">Loading tasks...</div>
              ) : wellnessTasks.length === 0 ? (
                <div className="text-center py-6 text-gray-500">No wellness tasks found.</div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {wellnessTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`border rounded-lg p-4 ${
                        task.isActive ? 'border-gray-200' : 'border-gray-300 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-gray-900 truncate">{task.name}</h4>
                            {!task.isActive && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{task.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                            <span>Reward: {task.coinValue.toFixed(2)} Guincoin</span>
                            <span>Frequency: {task.frequencyRule.replace('_', ' ')}</span>
                            {task.maxRewardedUsers && <span>Max: {task.maxRewardedUsers}</span>}
                          </div>
                        </div>
                        {task.isActive && (
                          <button
                            onClick={() => handleDeleteTask(task.id, task.name)}
                            disabled={deletingTaskId === task.id}
                            className="ml-4 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 disabled:bg-gray-200 disabled:text-gray-500"
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

            {/* Users & Documents */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">Users & Documents</h2>
                <button
                  onClick={loadUsersWithSubmissions}
                  disabled={usersLoading}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:bg-gray-200 disabled:text-gray-500"
                >
                  {usersLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {usersLoading && usersWithSubmissions.length === 0 ? (
                <div className="text-center py-6 text-gray-500">Loading users...</div>
              ) : usersWithSubmissions.length === 0 ? (
                <div className="text-center py-6 text-gray-500">No users found.</div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {usersWithSubmissions.map((user) => (
                    <div key={user.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900">{user.name}</h4>
                          <p className="text-xs text-gray-600">{user.email}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {user.submissions.length} submission{user.submissions.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setSelectedUserId(selectedUserId === user.id ? null : user.id)
                          }
                          className="ml-4 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                        >
                          {selectedUserId === user.id ? 'Hide' : 'View'}
                        </button>
                      </div>

                      {selectedUserId === user.id && user.submissions.length > 0 && (
                        <div className="mt-4 border-t border-gray-200 pt-4 space-y-2">
                          {user.submissions.map((submission) => (
                            <div
                              key={submission.id}
                              className="border border-gray-200 rounded-md p-3 bg-gray-50"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="text-xs font-medium text-gray-900">
                                      {submission.wellnessTask.name}
                                    </h5>
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
                                    {new Date(submission.submittedAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <a
                                  href={submission.documentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                                >
                                  View
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Store Tab */}
        {activeTab === 'store' && (
          <div className="space-y-6">
            {/* Purchase Orders */}
            <div className="bg-white shadow rounded-lg p-6">
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

              <div className="mb-4">
                <nav className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setPurchasesTab('pending');
                      loadPurchases();
                    }}
                    className={`whitespace-nowrap rounded-full py-1.5 px-4 text-sm font-medium transition-colors ${
                      purchasesTab === 'pending'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                    }`}
                  >
                    Pending ({pendingPurchases.length})
                  </button>
                  <button
                    onClick={() => {
                      setPurchasesTab('all');
                      loadPurchases();
                    }}
                    className={`whitespace-nowrap rounded-full py-1.5 px-4 text-sm font-medium transition-colors ${
                      purchasesTab === 'all'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
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
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {(purchasesTab === 'pending' ? pendingPurchases : allPurchases).map((purchase) => (
                    <div key={purchase.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-gray-900">
                              {purchase.product.name}
                            </h3>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded ${
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
                          <p className="text-xs text-gray-600 mt-1">
                            {purchase.employee?.name || 'Unknown'} • {purchase.priceGuincoin.toFixed(2)} Guincoin
                          </p>
                          {purchase.shippingAddress && (
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              📍 {purchase.shippingAddress}
                            </p>
                          )}
                        </div>
                        {purchase.status === 'pending' && (
                          <div className="ml-4">
                            {fulfillingId === purchase.id ? (
                              <div className="w-full sm:w-64 space-y-2">
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
                                    className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleFulfillPurchase(purchase.id)}
                                    className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                                  >
                                    Confirm
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setFulfillingId(purchase.id)}
                                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                              >
                                Fulfill
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

            {/* Store Products */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Store Products</h2>
              <p className="text-sm text-gray-500 mb-6">
                Add custom products or import from Amazon. Amazon imports depend on the product page being publicly accessible.
              </p>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">Custom Product</h3>
                    <button
                      type="button"
                      onClick={handleSeedProduct}
                      disabled={seedProductLoading}
                      className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 disabled:bg-gray-200 disabled:text-gray-500"
                    >
                      {seedProductLoading ? 'Seeding...' : 'Seed Sample'}
                    </button>
                  </div>
                  <form onSubmit={handleCreateProduct} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Product Name</label>
                      <input
                        type="text"
                        value={customProductForm.name}
                        onChange={(e) =>
                          setCustomProductForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        rows={2}
                        value={customProductForm.description}
                        onChange={(e) =>
                          setCustomProductForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
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
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Product Image
                      </label>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.gif"
                        onChange={(e) => setCustomProductImage(e.target.files?.[0] || null)}
                        className="block w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        type="submit"
                        disabled={customProductLoading}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        {customProductLoading ? 'Saving...' : 'Add Product'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Amazon Product Link</h3>
                    <form onSubmit={handleImportAmazonProduct} className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Product URL
                        </label>
                        <input
                          type="url"
                          value={amazonProductUrl}
                          onChange={(e) => setAmazonProductUrl(e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          placeholder="https://www.amazon.com/dp/..."
                          required
                        />
                      </div>

                      {amazonProductResult && (
                        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                          {amazonProductResult}
                        </div>
                      )}

                      <div className="flex items-center justify-end">
                        <button
                          type="submit"
                          disabled={amazonProductLoading}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                        >
                          {amazonProductLoading ? 'Importing...' : 'Import Product'}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Amazon List Import</h3>
                    <form onSubmit={handleImportAmazonList} className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          List URL
                        </label>
                        <input
                          type="url"
                          value={amazonListUrl}
                          onChange={(e) => setAmazonListUrl(e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          placeholder="https://www.amazon.com/hz/wishlist/..."
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Limit</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={amazonListLimit}
                          onChange={(e) => setAmazonListLimit(e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        />
                      </div>

                      {amazonListResult && (
                        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                          Imported {amazonListResult.results.filter((item) => item.status === 'imported').length}{' '}
                          of {amazonListResult.requested} items. Total found: {amazonListResult.totalFound}.
                        </div>
                      )}

                      <div className="flex items-center justify-end">
                        <button
                          type="submit"
                          disabled={amazonListLoading}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                        >
                          {amazonListLoading ? 'Importing...' : 'Import List'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            {/* Manage Store Products */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">Manage Products</h2>
                <button
                  onClick={loadStoreProducts}
                  disabled={storeProductsLoading}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                >
                  {storeProductsLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {storeProductsLoading && storeProducts.length === 0 ? (
                <div className="text-center py-6 text-gray-500">Loading products...</div>
              ) : storeProducts.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  No products found. Add products using the forms above.
                  <button
                    onClick={loadStoreProducts}
                    className="block mx-auto mt-2 text-blue-600 hover:text-blue-700"
                  >
                    Load Products
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Source
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {storeProducts.map((product) => (
                        <tr key={product.id} className={!product.isActive ? 'bg-gray-50' : ''}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {product.imageUrls[0] ? (
                                <img
                                  src={product.imageUrls[0]}
                                  alt={product.name}
                                  className="h-10 w-10 object-cover rounded"
                                />
                              ) : (
                                <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                                  No img
                                </div>
                              )}
                              <div className="max-w-xs">
                                <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {product.priceGuincoin.toFixed(2)} GC
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                              product.source === 'custom'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {product.source}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                              product.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {product.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleProduct(product.id)}
                                disabled={togglingProductId === product.id}
                                className={`px-2 py-1 text-xs font-medium rounded ${
                                  product.isActive
                                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                } disabled:opacity-50`}
                              >
                                {togglingProductId === product.id
                                  ? '...'
                                  : product.isActive
                                  ? 'Deactivate'
                                  : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product.id, product.name)}
                                disabled={deletingProductId === product.id}
                                className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                              >
                                {deletingProductId === product.id ? '...' : 'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Campaign Studio Tab */}
        {activeTab === 'studio' && (
          <div className="fixed inset-0 z-50">
            <CampaignStudio />
            <button
              onClick={() => setActiveTab('wellness')}
              className="absolute top-4 right-4 z-50 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
              title="Exit Studio"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Google Chat Tab */}
        {activeTab === 'google-chat' && (
          <div className="space-y-6">
            {/* Stats Overview */}
            {chatStats && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="text-2xl font-bold text-gray-900">{chatStats.total}</div>
                        <div className="text-xs text-gray-500">Total (30d)</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="text-2xl font-bold text-green-600">{chatStats.byStatus.succeeded}</div>
                        <div className="text-xs text-gray-500">Succeeded</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="text-2xl font-bold text-red-600">{chatStats.byStatus.rejected}</div>
                        <div className="text-xs text-gray-500">Rejected</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="text-2xl font-bold text-yellow-600">{chatStats.byStatus.failed}</div>
                        <div className="text-xs text-gray-500">Failed</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="text-2xl font-bold text-blue-600">{chatStats.byStatus.received}</div>
                        <div className="text-xs text-gray-500">Received</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="text-2xl font-bold text-purple-600">{chatStats.recentActivity}</div>
                        <div className="text-xs text-gray-500">Last 7 Days</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Filters</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={chatFilters.status || ''}
                    onChange={(e) =>
                      setChatFilters({ ...chatFilters, status: e.target.value || undefined })
                    }
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="">All Statuses</option>
                    <option value="received">Received</option>
                    <option value="authorized">Authorized</option>
                    <option value="rejected">Rejected</option>
                    <option value="failed">Failed</option>
                    <option value="succeeded">Succeeded</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User Email</label>
                  <input
                    type="email"
                    value={chatFilters.userEmail || ''}
                    onChange={(e) =>
                      setChatFilters({ ...chatFilters, userEmail: e.target.value || undefined })
                    }
                    placeholder="Filter by email..."
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setChatFilters({});
                      setChatPage(1);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Command Audit Logs</h2>
              </div>
              {chatLogsLoading ? (
                <div className="p-6 text-center text-gray-500">Loading...</div>
              ) : chatAuditLogs.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No audit logs found</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Timestamp
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Command
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Space
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Transaction
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Error
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {chatAuditLogs.map((log: ChatCommandAudit) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {log.userEmail || 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="max-w-xs truncate" title={log.commandText || ''}>
                                {log.commandName || 'N/A'}
                              </div>
                              {log.commandText && (
                                <div className="text-xs text-gray-500 truncate max-w-xs" title={log.commandText}>
                                  {log.commandText}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  log.status === 'succeeded'
                                    ? 'bg-green-100 text-green-800'
                                    : log.status === 'rejected' || log.status === 'failed'
                                    ? 'bg-red-100 text-red-800'
                                    : log.status === 'authorized'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              <div className="max-w-xs truncate" title={log.spaceName || ''}>
                                {log.spaceName ? log.spaceName.split('/').pop() : 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {log.transaction ? (
                                <div>
                                  <div className="font-medium">{log.transaction.amount} coins</div>
                                  <div className="text-xs text-gray-500 truncate max-w-xs">
                                    {log.transaction.id.substring(0, 8)}...
                                  </div>
                                </div>
                              ) : (
                                'N/A'
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {log.errorMessage ? (
                                <div className="max-w-xs truncate text-red-600" title={log.errorMessage}>
                                  {log.errorMessage}
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {chatTotalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Page {chatPage} of {chatTotalPages}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setChatPage((p: number) => Math.max(1, p - 1))}
                          disabled={chatPage === 1}
                          className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setChatPage((p: number) => Math.min(chatTotalPages, p + 1))}
                          disabled={chatPage === chatTotalPages}
                          className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Settings Sub-tabs */}
            <div className="mb-2">
              <nav className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSettingsTab('email-templates')}
                  className={`whitespace-nowrap rounded-full py-1.5 px-4 text-sm font-medium transition-colors ${
                    settingsTab === 'email-templates'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                  }`}
                >
                  Email Templates
                </button>
                <button
                  onClick={() => setSettingsTab('roles')}
                  className={`whitespace-nowrap rounded-full py-1.5 px-4 text-sm font-medium transition-colors ${
                    settingsTab === 'roles'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                  }`}
                >
                  Role Management
                </button>
                <button
                  onClick={() => setSettingsTab('allotments')}
                  className={`whitespace-nowrap rounded-full py-1.5 px-4 text-sm font-medium transition-colors ${
                    settingsTab === 'allotments'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                  }`}
                >
                  Manager Allotments
                </button>
              </nav>
            </div>

            {/* Email Templates Sub-tab */}
            {settingsTab === 'email-templates' && (
              <div className="bg-white shadow rounded-lg p-6">
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
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {emailTemplates.map((template) => (
                      <div key={template.key} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">{template.name}</h3>
                            <p className="text-xs text-gray-500">{template.description}</p>
                          </div>
                          <label className="flex items-center gap-2 text-xs text-gray-700">
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

                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
                          <input
                            type="text"
                            value={template.subject}
                            onChange={(e) =>
                              handleTemplateChange(template.key, { subject: e.target.value })
                            }
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>

                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">HTML</label>
                          <textarea
                            rows={6}
                            value={template.html}
                            onChange={(e) =>
                              handleTemplateChange(template.key, { html: e.target.value })
                            }
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-xs"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            Variables: {template.variables.join(', ')}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSaveTemplate(template)}
                            disabled={savingTemplateKey === template.key}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                          >
                            {savingTemplateKey === template.key ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Role Management Sub-tab */}
            {settingsTab === 'roles' && (
              <div className="space-y-6">
                {/* Add User Form */}
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-medium text-gray-900">Add New User</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Add a new user to the Guincoin Rewards Program. They will receive an email notification with a link to access their dashboard.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowAddUserForm(!showAddUserForm);
                        if (showAddUserForm) {
                          setNewUserForm({ email: '', name: '', isManager: false, isAdmin: false });
                        }
                      }}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      {showAddUserForm ? 'Cancel' : 'Add User'}
                    </button>
                  </div>

                  {showAddUserForm && (
                    <form onSubmit={handleCreateUser} className="space-y-4 border-t border-gray-200 pt-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            value={newUserForm.email}
                            onChange={(e) => setNewUserForm((prev) => ({ ...prev, email: e.target.value }))}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            required
                            placeholder="user@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={newUserForm.name}
                            onChange={(e) => setNewUserForm((prev) => ({ ...prev, name: e.target.value }))}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            required
                            placeholder="John Doe"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">Roles</p>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={newUserForm.isManager}
                              onChange={(e) => setNewUserForm((prev) => ({ ...prev, isManager: e.target.checked }))}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700">Manager (can award Guincoins to employees)</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={newUserForm.isAdmin}
                              onChange={(e) => setNewUserForm((prev) => ({ ...prev, isAdmin: e.target.checked }))}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700">Admin (full system access)</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <button
                          type="submit"
                          disabled={creatingUser}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                        >
                          {creatingUser ? 'Creating...' : 'Create User'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Employee List */}
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-medium text-gray-900">Role Management</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Manage employee roles and permissions. Managers can award coins, Admins have full system access.
                      </p>
                    </div>
                    <button
                      onClick={loadEmployees}
                      disabled={employeesLoading}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:bg-gray-200 disabled:text-gray-500"
                    >
                      {employeesLoading ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>

                {employeesLoading && employees.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">Loading employees...</div>
                ) : employees.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">No employees found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Manager
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Admin
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {employees.map((employee) => {
                          const roleName =
                            employee.isAdmin && employee.isManager
                              ? 'Admin & Manager'
                              : employee.isAdmin
                              ? 'Admin'
                              : employee.isManager
                              ? 'Manager'
                              : 'Employee';
                          const isCurrentUser = employee.id === user?.id;

                          return (
                            <tr key={employee.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                                {isCurrentUser && (
                                  <div className="text-xs text-gray-500">(You)</div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">{employee.email}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={employee.isManager}
                                  onChange={(e) =>
                                    handleUpdateRoles(employee.id, { isManager: e.target.checked })
                                  }
                                  disabled={updatingEmployeeId === employee.id || isCurrentUser}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={employee.isAdmin}
                                  onChange={(e) =>
                                    handleUpdateRoles(employee.id, { isAdmin: e.target.checked })
                                  }
                                  disabled={
                                    updatingEmployeeId === employee.id ||
                                    (isCurrentUser && employee.isAdmin)
                                  }
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                                  title={
                                    isCurrentUser && employee.isAdmin
                                      ? 'You cannot remove your own admin status'
                                      : ''
                                  }
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    employee.isAdmin
                                      ? 'bg-purple-100 text-purple-800'
                                      : employee.isManager
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {roleName}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                </div>
              </div>
            )}

            {/* Manager Allotments Sub-tab */}
            {settingsTab === 'allotments' && (
              <div className="space-y-6">
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-medium text-gray-900">Manager Allotments</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Deposit funds into manager allotment balances. Managers use allotments exclusively for awarding coins to employees.
                      </p>
                    </div>
                    <button
                      onClick={loadManagers}
                      disabled={managersLoading}
                      className="px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 disabled:bg-gray-200 disabled:text-gray-500"
                    >
                      {managersLoading ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>

                  {managersLoading && managers.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">Loading managers...</div>
                  ) : managers.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      No managers found. Assign the manager role to employees in the Role Management tab.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                      {/* Manager List */}
                      <div className="lg:col-span-1">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">Select a Manager</h3>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {managers.map((manager) => (
                            <button
                              key={manager.id}
                              onClick={() => handleSelectManager(manager.id)}
                              className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                                selectedManagerId === manager.id
                                  ? 'border-purple-500 bg-purple-50'
                                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                              }`}
                            >
                              <div className="text-sm font-medium text-gray-900">{manager.name}</div>
                              <div className="text-xs text-gray-500">{manager.email}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Allotment Details & Actions */}
                      <div className="lg:col-span-2">
                        {!selectedManagerId ? (
                          <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-500">
                            Select a manager to view and manage their allotment balance
                          </div>
                        ) : allotmentLoading ? (
                          <div className="text-center py-8 text-gray-500">Loading allotment details...</div>
                        ) : selectedManagerAllotment ? (
                          <div className="space-y-6">
                            {/* Current Balance Card */}
                            <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-5">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-purple-900">
                                  {selectedManagerAllotment.employee.name}'s Allotment
                                </h3>
                                <span className="text-2xl">🎁</span>
                              </div>
                              <div className="text-center py-4">
                                <p className="text-sm text-purple-600 mb-1">Current Balance</p>
                                <p className="text-4xl font-bold text-purple-900">
                                  {selectedManagerAllotment.allotment.balance.toFixed(2)}
                                </p>
                                <p className="text-sm text-purple-500 mt-1">Guincoin</p>
                              </div>
                              <div className="bg-purple-100 rounded-lg p-3 mt-4">
                                <div className="grid grid-cols-2 gap-4 text-center">
                                  <div>
                                    <p className="text-xs text-purple-600">Awarded This Period</p>
                                    <p className="text-lg font-semibold text-purple-900">
                                      {selectedManagerAllotment.allotment.usedThisPeriod.toFixed(2)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-purple-600">Recurring Budget</p>
                                    <p className="text-lg font-semibold text-purple-900">
                                      {selectedManagerAllotment.allotment.recurringBudget > 0
                                        ? `${selectedManagerAllotment.allotment.recurringBudget.toFixed(2)}/period`
                                        : 'Not set'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Deposit Form */}
                            <div className="border border-gray-200 rounded-lg p-4">
                              <h4 className="text-sm font-semibold text-gray-900 mb-3">Deposit Funds</h4>
                              <form onSubmit={handleDeposit} className="space-y-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Amount
                                  </label>
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={depositForm.amount}
                                    onChange={(e) =>
                                      setDepositForm((prev) => ({ ...prev, amount: e.target.value }))
                                    }
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
                                    placeholder="100.00"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Description (optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={depositForm.description}
                                    onChange={(e) =>
                                      setDepositForm((prev) => ({ ...prev, description: e.target.value }))
                                    }
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
                                    placeholder="Q1 2026 allotment"
                                  />
                                </div>
                                <div className="flex justify-end">
                                  <button
                                    type="submit"
                                    disabled={depositLoading}
                                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-400"
                                  >
                                    {depositLoading ? 'Depositing...' : 'Deposit'}
                                  </button>
                                </div>
                              </form>
                            </div>

                            {/* Recurring Budget Form */}
                            <div className="border border-gray-200 rounded-lg p-4">
                              <h4 className="text-sm font-semibold text-gray-900 mb-3">Recurring Budget</h4>
                              <p className="text-xs text-gray-500 mb-3">
                                Set an automatic recurring deposit amount. Enter 0 to disable.
                              </p>
                              <form onSubmit={handleSetRecurring} className="space-y-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Amount per Period
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={recurringForm.amount}
                                    onChange={(e) =>
                                      setRecurringForm((prev) => ({ ...prev, amount: e.target.value }))
                                    }
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
                                    placeholder={selectedManagerAllotment.allotment.recurringBudget > 0
                                      ? selectedManagerAllotment.allotment.recurringBudget.toString()
                                      : '500.00'
                                    }
                                    required
                                  />
                                </div>
                                <div className="flex justify-end">
                                  <button
                                    type="submit"
                                    disabled={recurringLoading}
                                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-400"
                                  >
                                    {recurringLoading ? 'Saving...' : 'Set Recurring'}
                                  </button>
                                </div>
                              </form>
                            </div>

                            {/* Recent Deposits */}
                            {selectedManagerAllotment.recentDeposits && selectedManagerAllotment.recentDeposits.length > 0 && (
                              <div className="border border-gray-200 rounded-lg p-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Recent Deposits</h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {selectedManagerAllotment.recentDeposits.map((deposit, index) => (
                                    <div
                                      key={index}
                                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                                    >
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">
                                          +{deposit.amount.toFixed(2)} Guincoin
                                        </p>
                                        {deposit.description && (
                                          <p className="text-xs text-gray-500">{deposit.description}</p>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-400">
                                        {new Date(deposit.createdAt).toLocaleDateString()}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            Failed to load allotment details
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
