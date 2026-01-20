import { useState } from 'react';

interface TransferFormProps {
  onTransfer: (data: { recipientEmail: string; amount: number; message?: string }) => void;
  remaining: number;
}

export default function TransferForm({ onTransfer, remaining }: TransferFormProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);

    if (!recipientEmail || !amountNum || amountNum <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    if (amountNum > remaining) {
      alert(`Amount exceeds remaining transfer limit (${remaining.toFixed(2)})`);
      return;
    }

    setSubmitting(true);
    try {
      await onTransfer({
        recipientEmail,
        amount: amountNum,
        message: message || undefined,
      });
      setRecipientEmail('');
      setAmount('');
      setMessage('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-5">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Send Coins</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">
            Recipient Email
          </label>
          <input
            type="email"
            id="recipient"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="colleague@example.com"
            required
          />
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
            Amount
          </label>
          <input
            type="number"
            id="amount"
            min="0.01"
            step="0.01"
            max={remaining}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="0.00"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Remaining limit: {remaining.toFixed(2)} coins
          </p>
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700">
            Message (Optional)
          </label>
          <textarea
            id="message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Great job on the presentation!"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || remaining <= 0}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {submitting ? 'Sending...' : 'Send Coins'}
        </button>
      </form>
    </div>
  );
}
