import { useState } from 'react';
import { format } from 'date-fns';

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

interface PendingSubmissionsListProps {
  submissions: Submission[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
}

export default function PendingSubmissionsList({
  submissions,
  onApprove,
  onReject,
}: PendingSubmissionsListProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (submissions.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-12 text-center">
        <p className="text-gray-500">No pending submissions</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
        {submissions.map((submission) => (
          <div key={submission.id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  {submission.wellnessTask.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Submitted by: {submission.employee.name} ({submission.employee.email})
                </p>
                <p className="text-sm text-gray-500">
                  Submitted: {format(new Date(submission.submittedAt), 'MMM d, yyyy h:mm a')}
                </p>
                <p className="text-sm font-medium text-green-600 mt-2">
                  Reward: {submission.wellnessTask.coinValue.toFixed(2)} coins
                </p>
              </div>
              <div className="ml-4 flex space-x-2">
                <button
                  onClick={() => setSelectedSubmission(submission)}
                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  View
                </button>
                <button
                  onClick={() => onApprove(submission.id)}
                  className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => onReject(submission.id)}
                  className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedSubmission && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedSubmission.wellnessTask.name}
              </h3>
              <div className="mb-4">
                <p className="text-sm text-gray-500">
                  <strong>Employee:</strong> {selectedSubmission.employee.name} (
                  {selectedSubmission.employee.email})
                </p>
                <p className="text-sm text-gray-500">
                  <strong>Submitted:</strong>{' '}
                  {format(new Date(selectedSubmission.submittedAt), 'MMM d, yyyy h:mm a')}
                </p>
                <p className="text-sm text-gray-500">
                  <strong>Reward:</strong> {selectedSubmission.wellnessTask.coinValue.toFixed(2)}{' '}
                  coins
                </p>
              </div>

              <div className="mb-4">
                <iframe
                  src={selectedSubmission.documentUrl}
                  className="w-full h-96 border border-gray-300 rounded"
                  title="Document Viewer"
                />
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onApprove(selectedSubmission.id);
                    setSelectedSubmission(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('Please provide a reason for rejection:');
                    if (reason) {
                      onReject(selectedSubmission.id, reason);
                      setSelectedSubmission(null);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
