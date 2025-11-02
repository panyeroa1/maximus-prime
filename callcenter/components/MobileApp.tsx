import React, { useState, Suspense, useMemo } from 'react';
import { Template, ActiveView } from '../types';
import { MOCK_TEMPLATES, NAV_ITEMS } from '../constants';
import { LoadingIndicator } from './LoadingIndicator';
import { MobileHeader } from './MobileHeader';
import { MobileDrawer } from './MobileDrawer';
import { MobileBottomNavbar } from './MobileBottomNavbar';
import Dialer from './Dialer';
import FeedbackModal from './FeedbackModal';

// Lazy load all main views for better performance
const WebDemoView = React.lazy(() => import('./WebDemoView'));
const CallLogsView = React.lazy(() => import('./CallLogsView'));
const AgentsView = React.lazy(() => import('./AgentsView'));
const VoicesView = React.lazy(() => import('./VoicesView'));
const ChatbotView = React.lazy(() => import('./ChatbotView'));
const TTSStudioView = React.lazy(() => import('./TTSStudioView'));
const TemplatesView = React.lazy(() => import('./TemplatesView'));
const CrmView = React.lazy(() => import('./CrmView'));

const MobileApp: React.FC = () => {
    const [activeView, setActiveView] = useState<ActiveView>(ActiveView.WebDemo);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isDialerOpen, setIsDialerOpen] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

    const templateForDemo = useMemo(() => MOCK_TEMPLATES.find(t => t.id === 'template-ayla-web-agent'), []);

    if (!templateForDemo) {
        return <div className="h-screen w-screen flex items-center justify-center bg-eburon-bg text-red-400">Web Demo Template not found.</div>;
    }

    const handleEndDemo = () => {
        setActiveView(ActiveView.CallLogs);
    };

    const renderActiveView = () => {
        switch (activeView) {
            case ActiveView.WebDemo:
                return <WebDemoView template={templateForDemo} onEndDemo={handleEndDemo} />;
            case ActiveView.CallLogs:
                return <CallLogsView />;
            case ActiveView.Agents:
                return <AgentsView />;
            case ActiveView.Crm:
                return <CrmView />;
            case ActiveView.Voices:
                return <VoicesView />;
            case ActiveView.Chatbot:
                // Pass a dummy function for setGeneratedAppHtml as it's not used on mobile
                return <ChatbotView setGeneratedAppHtml={() => {}} />;
            case ActiveView.TTSStudio:
                return <TTSStudioView />;
            case ActiveView.Templates:
                // Pass a handler that sets the view to the demo
                return <TemplatesView onUseTemplate={() => setActiveView(ActiveView.WebDemo)} />;
            default:
                return <WebDemoView template={templateForDemo} onEndDemo={handleEndDemo} />;
        }
    };
    
    const currentViewTitle = NAV_ITEMS.find(item => item.id === activeView)?.label || 'Eburon';

    return (
        <div className="h-screen w-screen flex flex-col bg-eburon-bg text-eburon-fg overflow-hidden">
            <MobileHeader
                title={currentViewTitle}
                onMenuClick={() => setIsDrawerOpen(true)}
                onDialerClick={() => setIsDialerOpen(true)}
            />
            
            <MobileDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                activeView={activeView}
                setActiveView={setActiveView}
                onOpenFeedback={() => setIsFeedbackModalOpen(true)}
            />
            
            <main className="flex-1 overflow-y-auto">
                <Suspense fallback={<LoadingIndicator text={`Loading ${currentViewTitle}...`} />}>
                    {renderActiveView()}
                </Suspense>
            </main>

            <MobileBottomNavbar activeView={activeView} setActiveView={setActiveView} />

            {isDialerOpen && (
                <div className="absolute inset-0 z-50 bg-eburon-bg animate-fade-in">
                    <Dialer
                        onClose={() => setIsDialerOpen(false)}
                    />
                </div>
            )}

            {isFeedbackModalOpen && <FeedbackModal onClose={() => setIsFeedbackModalOpen(false)} />}
        </div>
    );
};

export default MobileApp;