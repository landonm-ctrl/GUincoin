import { WellnessSubmission } from '../../services/api';
import { format } from 'date-fns';

interface WellnessSubmissionsProps {
  submissions: WellnessSubmission[];
}

export default function WellnessSubmissions({ submissions }: WellnessSubmissionsProps) {
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          styles[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
      {submissions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No submissions yet</div>
      ) : (
        submissions.map((submission) => (
          <div key={submission.id} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-medium text-gray-900">
                {submission.wellnessTask.name}
              </h3>
              {getStatusBadge(submission.status)}
            </div>
            <p className="text-sm text-gray-500">
              Submitted: {format(new Date(submission.submittedAt), 'MMM d, yyyy')}
            </p>
            {submission.reviewedAt && (
              <p className="text-sm text-gray-500">
                Reviewed: {format(new Date(submission.reviewedAt), 'MMM d, yyyy')}
              </p>
            )}
            {submission.rejectionReason && (
              <div className="mt-2 p-3 bg-red-50 rounded text-sm text-red-800">
                <strong>Reason:</strong> {submission.rejectionReason}
              </div>
            )}
            {submission.status === 'approved' && (
              <p className="mt-2 text-sm font-medium text-green-600">
                +{submission.wellnessTask.coinValue.toFixed(2)} coins awarded
              </p>
            )}
            <a
              href={submission.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800"
            >
              View Document
            </a>
          </div>
        ))
      )}
    </div>
  );
}
