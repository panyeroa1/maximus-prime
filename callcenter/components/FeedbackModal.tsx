import React, { useState } from 'react';
import * as dataService from '../services/dataService';
import { CheckCircleIcon, SendIcon } from './icons';

interface FeedbackModalProps {
    onClose: () => void;
}

type SubmissionStatus = 'idle' | 'submitting' | 'success' | 'error';

const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose }) => {
    const [feedbackText, setFeedbackText] = useState('');
    const [status, setStatus] = useState<SubmissionStatus>('idle');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!feedbackText.trim()) {
            return;
        }
        setStatus('submitting');
        setError(null);
        try {
            await dataService.submitFeedback(feedbackText);
            setStatus('success');
            setTimeout(() => {
                onClose();
            }, 2000); // Close automatically after 2 seconds
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
            setStatus('error');
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div 
                className="bg-eburon-panel border border-eburon-border rounded-xl w-full max-w-lg shadow-2xl p-6"
                onClick={(e) => e.stopPropagation()}
            >
                {status === 'success' ? (
                    <div className="text-center p-4">
                        <CheckCircleIcon className="w-16 h-16 text-eburon-ok mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-eburon-fg">Thank You!</h2>
                        <p className="text-eburon-fg/70">Your feedback has been received.</p>
                    </div>
                ) : (
                    <>
                        <h2 className="text-xl font-bold text-eburon-fg mb-2">Submit Feedback</h2>
                        <p className="text-eburon-fg/70 mb-4 text-sm">
                            Have a suggestion or found a bug? Let us know!
                        </p>

                        <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="Tell us what you think..."
                            className="w-full h-32 bg-eburon-bg border border-eburon-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-eburon-accent"
                            disabled={status === 'submitting'}
                        />

                        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

                        <div className="flex justify-end gap-3 mt-4">
                            <button 
                                onClick={onClose}
                                className="font-bold py-2 px-4 rounded-lg bg-eburon-border hover:bg-white/10 text-white"
                                disabled={status === 'submitting'}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSubmit}
                                disabled={status === 'submitting' || !feedbackText.trim()}
                                className="font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors duration-200 bg-eburon-accent hover:bg-eburon-accent-dark text-white disabled:bg-gray-500"
                            >
                                {status === 'submitting' ? (
                                    <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <SendIcon className="w-5 h-5" />
                                )}
                                <span>{status === 'submitting' ? 'Sending...' : 'Submit'}</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default FeedbackModal;