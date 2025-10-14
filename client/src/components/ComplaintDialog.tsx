import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, Mail, CheckCircle, Clock, XCircle } from 'lucide-react';

interface ComplaintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  barcode: string;
  date: string;
  onComplaintCreated: (complaint: any) => void;
}

interface Complaint {
  id: string;
  barcode: string;
  date: string;
  email: string;
  description: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

const ComplaintDialog: React.FC<ComplaintDialogProps> = ({
  isOpen,
  onClose,
  barcode,
  date,
  onComplaintCreated,
}) => {
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [existingComplaint, setExistingComplaint] = useState<Complaint | null>(
    null,
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'mail_done':
        return <Mail className="h-4 w-4 text-blue-600" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'closed':
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending Review';
      case 'mail_done':
        return 'Mail Sent';
      case 'resolved':
        return 'Resolved';
      case 'closed':
        return 'Closed';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'mail_done':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5003/api/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode,
          date,
          email,
          description,
          mailSubject,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create complaint');
        return;
      }

      setSuccess(true);
      setSuccessMessage(data.message);
      onComplaintCreated(data.complaint);

      // Reset form
      setEmail('');
      setDescription('');
      setMailSubject('');

      // Close dialog after 2 seconds
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setExistingComplaint(null);
      }, 2000);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setDescription('');
    setMailSubject('');
    setError('');
    setSuccess(false);
    setSuccessMessage('');
    setExistingComplaint(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            Raise Complaint
          </DialogTitle>
          <DialogDescription>
            Report an issue with the matched item for barcode{' '}
            <span className="font-mono font-semibold">{barcode}</span> on{' '}
            <span className="font-semibold">
              {new Date(date).toLocaleDateString()}
            </span>
          </DialogDescription>
        </DialogHeader>

        {existingComplaint && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Existing Complaint Found:</p>
                <div className="flex items-center gap-2">
                  {getStatusIcon(existingComplaint.status)}
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                      existingComplaint.status,
                    )}`}
                  >
                    {getStatusText(existingComplaint.status)}
                  </span>
                  <span className="text-sm text-gray-600">
                    Created:{' '}
                    {new Date(existingComplaint.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {existingComplaint.resolution && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                    <strong>Resolution:</strong> {existingComplaint.resolution}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {successMessage ||
                'Complaint created successfully! You will receive email updates on the status.'}
            </AlertDescription>
          </Alert>
        )}

        {error && !existingComplaint && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              required
              disabled={isLoading || success}
            />
            <p className="text-xs text-gray-500">
              We'll send you updates about your complaint status
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mailSubject">Mail Subject *</Label>
            <Input
              id="mailSubject"
              type="text"
              value={mailSubject}
              onChange={(e) => setMailSubject(e.target.value)}
              placeholder="e.g., Complaint Resolution - Barcode 34572715952870"
              required
              disabled={isLoading || success}
            />
            <p className="text-xs text-gray-500">
              Subject line for the complaint email notification
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Issue Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue with this matched item..."
              rows={4}
              disabled={isLoading || success}
            />
            <p className="text-xs text-gray-500">
              Optional: Provide details about why this match is incorrect
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading || success || !email.trim() || !mailSubject.trim()
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading
                ? 'Creating...'
                : success
                ? 'Created!'
                : 'Create Complaint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ComplaintDialog;
