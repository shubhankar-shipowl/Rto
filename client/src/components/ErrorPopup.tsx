import React from 'react';
import { X, AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ErrorPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
  title: string;
  message: string;
  type?: 'error' | 'warning' | 'info' | 'success';
  showRetry?: boolean;
  previousScan?: {
    timestamp: string;
    status: string;
  };
}

export const ErrorPopup: React.FC<ErrorPopupProps> = ({
  isOpen,
  onClose,
  onRetry,
  title,
  message,
  type = 'error',
  showRetry = true,
  previousScan,
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-8 w-8 text-yellow-500" />;
      case 'info':
        return <AlertCircle className="h-8 w-8 text-blue-500" />;
      default:
        return <XCircle className="h-8 w-8 text-red-500" />;
    }
  };

  const getCardStyles = () => {
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50/50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50/50';
      case 'info':
        return 'border-blue-200 bg-blue-50/50';
      default:
        return 'border-red-200 bg-red-50/50';
    }
  };

  const getTitleColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-800';
      case 'warning':
        return 'text-yellow-800';
      case 'info':
        return 'text-blue-800';
      default:
        return 'text-red-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'matched':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'unmatched':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'duplicate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card
        className={`w-full max-w-md shadow-2xl border-2 ${getCardStyles()} animate-in zoom-in-95 duration-200`}
      >
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">{getIcon()}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-lg font-semibold ${getTitleColor()}`}>
                  {title}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-gray-700 mb-4 leading-relaxed">{message}</p>

              {previousScan && (
                <div className="mb-4 p-3 bg-white/60 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-600 mb-2">
                    Previous Scan Details:
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(previousScan.status)}>
                      {previousScan.status}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {new Date(previousScan.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={onClose} variant="outline" className="flex-1">
                  Close
                </Button>
                {showRetry && onRetry && (
                  <Button
                    onClick={onRetry}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
