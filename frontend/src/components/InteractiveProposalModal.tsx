import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Download, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

interface InteractiveProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  proposalHtmlUrl: string;
  proposalType?: string | null;
  status?: string | null;
}

export const InteractiveProposalModal: React.FC<InteractiveProposalModalProps> = ({
  isOpen,
  onClose,
  title,
  proposalHtmlUrl,
  proposalType,
  status
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const getFullApiUrl = (path: string) => {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const rawEnv = (import.meta as any).env?.VITE_API_URL;
    const baseUrl = rawEnv ? rawEnv.replace(/\/+$/, '') : '';
    return baseUrl ? `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}` : path;
  };

  useEffect(() => {
    if (!isOpen || !proposalHtmlUrl) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('aptech_token');
    const fullUrl = getFullApiUrl(proposalHtmlUrl);

    fetch(fullUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load proposal (HTTP ${res.status})`);
        }
        return res.blob();
      })
      .then((blob) => {
        if (!isMounted) return;
        const url = URL.createObjectURL(new Blob([blob], { type: 'text/html;charset=utf-8' }));
        setBlobUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error fetching proposal HTML:', err);
        setError(err.message || 'Could not load interactive proposal document.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, proposalHtmlUrl]);

  if (!isOpen) return null;

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    } else {
      const token = localStorage.getItem('aptech_token');
      const url = getFullApiUrl(proposalHtmlUrl);
      const authUrl = token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url;
      window.open(authUrl, '_blank');
    }
  };

  const handleDownload = () => {
    const token = localStorage.getItem('aptech_token');
    const url = getFullApiUrl(proposalHtmlUrl);
    const authUrl = token ? `${url}${url.includes('?') ? '&' : '?'}&download=true&token=${encodeURIComponent(token)}` : `${url}?download=true`;
    const a = document.createElement('a');
    a.href = authUrl;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-proposal.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full h-[95vh] max-w-7xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/80">
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white truncate max-w-md sm:max-w-xl">{title}</h3>
                {proposalType && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {proposalType.replace(/_/g, ' ')}
                  </span>
                )}
                {status && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {status}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">Interactive Proposal &amp; Execution Roadmap</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleOpenNewTab}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
              title="Open full page in new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open in Tab</span>
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
              title="Download HTML file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10 space-y-3">
              <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
              <p className="text-xs font-bold text-slate-700">Loading interactive proposal view...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white p-6 z-10 space-y-3 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Unable to load proposal document</h4>
              <p className="text-xs text-slate-500 max-w-md">{error}</p>
              <button
                onClick={handleOpenNewTab}
                className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Try Opening Directly in Browser</span>
              </button>
            </div>
          )}

          {blobUrl && !error && (
            <iframe
              src={blobUrl}
              title={title}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"
            />
          )}
        </div>
      </div>
    </div>
  );
};
