import { useState } from 'react';
import { WellnessTask, submitWellness } from '../../services/api';

interface WellnessTaskModalProps {
  task: WellnessTask;
  onClose: () => void;
  onSubmission: () => void;
}

export default function WellnessTaskModal({ task, onClose, onSubmission }: WellnessTaskModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      alert('Please select a file to upload');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('wellnessTaskId', task.id);
      formData.append('document', file);

      await submitWellness(formData);
      alert('Submission created successfully! It will be reviewed by the admin.');
      onSubmission();
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to submit wellness task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{task.name}</h3>
          {task.description && (
            <p className="text-sm text-gray-500 mb-4">{task.description}</p>
          )}
          {task.instructions && (
            <div className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-900">
              <strong>Instructions:</strong> {task.instructions}
            </div>
          )}

          {task.maxRewardedUsers && (
            <p className="text-xs text-gray-500 mb-4">
              Max rewards available: {task.maxRewardedUsers}
            </p>
          )}

          {task.formTemplateUrl && (
            <div className="mb-4">
              <a
                href={task.formTemplateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Download Form Template
              </a>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
                Upload Completed Form
              </label>
              <input
                type="file"
                id="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                PDF or image files only (max 5MB)
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !file}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
