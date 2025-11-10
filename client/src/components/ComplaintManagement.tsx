import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import {
  Mail,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface Complaint {
  id: string;
  barcode: string;
  date: string;
  email: string;
  description: string;
  status: 'pending' | 'mail_done' | 'resolved' | 'closed';
  mailSubject?: string;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

const ComplaintManagement: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(
    null,
  );
  const [mailDialog, setMailDialog] = useState(false);
  const [resolutionDialog, setResolutionDialog] = useState(false);
  const [mailSubject, setMailSubject] = useState('');
  const [resolution, setResolution] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [deleteAllDialog, setDeleteAllDialog] = useState(false);

  const toggleRowExpansion = (complaintId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(complaintId)) {
        newSet.delete(complaintId);
      } else {
        newSet.add(complaintId);
      }
      return newSet;
    });
  };

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
        return 'Pending';
      case 'mail_done':
        return 'Mail Done';
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

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.COMPLAINTS.ALL);
      if (!response.ok) {
        throw new Error('Failed to fetch complaints');
      }
      const data = await response.json();
      setComplaints(data.complaints || []);
    } catch (err) {
      setError('Failed to load complaints');
      console.error('Error fetching complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleMarkMailDone = async () => {
    if (!selectedComplaint || !mailSubject.trim()) return;

    try {
      setActionLoading(true);
      const response = await fetch(
        API_ENDPOINTS.COMPLAINTS.MAIL_DONE(selectedComplaint.id),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mailSubject: mailSubject.trim(),
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark mail as done');
      }

      await fetchComplaints();
      setMailDialog(false);
      setMailSubject('');
      setSelectedComplaint(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to mark mail as done',
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkResolved = async () => {
    if (!selectedComplaint) return;

    try {
      setActionLoading(true);
      const response = await fetch(
        API_ENDPOINTS.COMPLAINTS.STATUS(selectedComplaint.id),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'resolved',
            resolution: resolution.trim() || 'Issue resolved',
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark as resolved');
      }

      await fetchComplaints();
      setResolutionDialog(false);
      setResolution('');
      setSelectedComplaint(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to mark as resolved',
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPending = async (complaint: Complaint) => {
    try {
      setActionLoading(true);
      const response = await fetch(
        API_ENDPOINTS.COMPLAINTS.STATUS(complaint.id),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'pending',
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark as pending');
      }

      await fetchComplaints();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to mark as pending',
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    try {
      setActionLoading(true);
      const response = await fetch(API_ENDPOINTS.COMPLAINTS.DELETE_ALL, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          throw new Error('Access denied: Admin privileges required');
        }
        throw new Error(errorData.error || 'Failed to delete all complaints');
      }

      const result = await response.json();
      await fetchComplaints();
      setDeleteAllDialog(false);
      setError(''); // Clear any previous errors
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete all complaints',
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading complaints...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-lg">
        <CardHeader className="pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Complaint Management
              </CardTitle>
              <CardDescription>
                Manage complaint statuses and track resolution progress
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {complaints.length > 0 && isAdmin && (
                <Button
                  onClick={() => setDeleteAllDialog(true)}
                  variant="destructive"
                  size="sm"
                  disabled={actionLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </Button>
              )}
              <Button onClick={fetchComplaints} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="max-h-96 overflow-y-auto">
            <Table className="table-fixed-layout">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Barcode</TableHead>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead className="w-[200px]">Email</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead className="w-[200px]">Mail Subject</TableHead>
                  <TableHead className="w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complaints.map((complaint) => (
                  <React.Fragment key={complaint.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleRowExpansion(complaint.id)}
                    >
                      <TableCell className="font-mono text-sm table-cell-vertical-center">
                        <div className="table-badge-container">
                          {expandedRows.has(complaint.id) ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                          {complaint.barcode}
                        </div>
                      </TableCell>
                      <TableCell className="table-cell-vertical-center">
                        {new Date(complaint.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="table-cell-vertical-center">
                        {complaint.email}
                      </TableCell>
                      <TableCell className="table-cell-vertical-center">
                        <div className="table-badge-container">
                          {getStatusIcon(complaint.status)}
                          <Badge
                            variant="outline"
                            size="sm"
                            className={`status-badge ${getStatusColor(
                              complaint.status,
                            )}`}
                          >
                            {getStatusText(complaint.status)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate table-cell-vertical-center">
                        {complaint.mailSubject || '-'}
                      </TableCell>
                      <TableCell className="table-cell-vertical-center">
                        <div className="flex gap-2">
                          {complaint.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedComplaint(complaint);
                                // Pre-fill the mail subject from the existing complaint
                                setMailSubject(complaint.mailSubject || '');
                                setMailDialog(true);
                              }}
                              className="button-with-icon bg-blue-600 hover:bg-blue-700"
                            >
                              <Mail className="h-4 w-4" />
                              Mark Mail Done
                            </Button>
                          )}
                          {complaint.status === 'mail_done' && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedComplaint(complaint);
                                setResolutionDialog(true);
                              }}
                              className="button-with-icon bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Mark Resolved
                            </Button>
                          )}
                          {complaint.status === 'resolved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkPending(complaint);
                              }}
                              disabled={actionLoading}
                              className="action-button"
                            >
                              Back to Pending
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(complaint.id) && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-gray-50 p-4">
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-semibold text-sm text-gray-700 mb-2">
                                  Complaint Details
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="font-medium text-gray-600">
                                      Description:
                                    </span>
                                    <p className="text-gray-800 mt-1 p-2 bg-white rounded border">
                                      {complaint.description ||
                                        'No description provided'}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-600">
                                      Created:
                                    </span>
                                    <span className="ml-2 text-gray-800">
                                      {new Date(
                                        complaint.createdAt,
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                  {complaint.resolvedAt && (
                                    <div>
                                      <span className="font-medium text-gray-600">
                                        Resolved:
                                      </span>
                                      <span className="ml-2 text-gray-800">
                                        {new Date(
                                          complaint.resolvedAt,
                                        ).toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm text-gray-700 mb-2">
                                  Mail Information
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="font-medium text-gray-600">
                                      Mail Subject:
                                    </span>
                                    <p className="text-gray-800 mt-1 p-2 bg-white rounded border">
                                      {complaint.mailSubject ||
                                        'No mail subject provided'}
                                    </p>
                                  </div>
                                  {complaint.resolution && (
                                    <div>
                                      <span className="font-medium text-gray-600">
                                        Resolution:
                                      </span>
                                      <p className="text-gray-800 mt-1 p-2 bg-white rounded border">
                                        {complaint.resolution}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
                {complaints.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-gray-500"
                    >
                      No complaints found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mail Done Dialog */}
      <Dialog open={mailDialog} onOpenChange={setMailDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Mark Mail as Done
            </DialogTitle>
            <DialogDescription>
              {selectedComplaint?.mailSubject ? (
                <>
                  The mail subject from the original complaint is pre-filled
                  below. You can modify it if needed for barcode{' '}
                  <span className="font-mono font-semibold">
                    {selectedComplaint?.barcode}
                  </span>
                </>
              ) : (
                <>
                  Enter the subject of the email you sent for barcode{' '}
                  <span className="font-mono font-semibold">
                    {selectedComplaint?.barcode}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mailSubject">Email Subject *</Label>
              <Input
                id="mailSubject"
                value={mailSubject}
                onChange={(e) => setMailSubject(e.target.value)}
                placeholder={
                  selectedComplaint?.mailSubject
                    ? 'Modify the pre-filled mail subject if needed'
                    : 'e.g., Complaint Resolution - Barcode 123456789'
                }
                disabled={actionLoading}
                className={
                  selectedComplaint?.mailSubject
                    ? 'bg-blue-50 border-blue-200'
                    : ''
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMailDialog(false);
                setMailSubject('');
                setSelectedComplaint(null);
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkMailDone}
              disabled={actionLoading || !mailSubject.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {actionLoading ? 'Marking...' : 'Mark Mail Done'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolution Dialog */}
      <Dialog open={resolutionDialog} onOpenChange={setResolutionDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Mark as Resolved
            </DialogTitle>
            <DialogDescription>
              Mark the complaint for barcode{' '}
              <span className="font-mono font-semibold">
                {selectedComplaint?.barcode}
              </span>{' '}
              as resolved
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resolution">Resolution Notes (Optional)</Label>
              <Textarea
                id="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Add any resolution notes..."
                rows={3}
                disabled={actionLoading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResolutionDialog(false);
                setResolution('');
                setSelectedComplaint(null);
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkResolved}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? 'Marking...' : 'Mark Resolved'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={deleteAllDialog} onOpenChange={setDeleteAllDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Delete All Complaints
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all complaints? This action cannot
              be undone.
              <br />
              <span className="font-semibold text-red-600">
                {complaints.length} complaint
                {complaints.length !== 1 ? 's' : ''} will be permanently
                deleted.
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteAllDialog(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAll}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? 'Deleting...' : 'Delete All Complaints'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplaintManagement;
