import React, { Suspense } from 'react';
import { ActiveView, Template } from '../types';
import { LoadingIndicator } from './LoadingIndicator';

// Lazy load the main view components
const ChatbotView = React.lazy(() => import('./ChatbotView'));
const AgentsView = React.lazy(() => import('./AgentsView'));
const VoicesView = React.lazy(() => import('./VoicesView'));
const CallLogsView = React.lazy(() => import('./CallLogsView'));
const TTSStudioView = React.lazy(() => import('./TTSStudioView'));
const ActiveCallView = React.lazy(() => import('./ActiveCallView'));
const CrmView = React.lazy(() => import('./CrmView'));


interface CenterPanelProps {
  activeView: ActiveView;
  setGeneratedAppHtml: (html: string | null) => void;
}

export const CenterPanel: React.FC<CenterPanelProps> = ({ 
  activeView, 
  setGeneratedAppHtml,
}) => {
  const renderContent = () => {
    switch (activeView) {
      case ActiveView.Chatbot:
        return <ChatbotView setGeneratedAppHtml={setGeneratedAppHtml} />;
      case ActiveView.Agents:
        return <AgentsView />;
      case ActiveView.Crm:
        return <CrmView />;
      case ActiveView.Voices:
        return <VoicesView />;
      case ActiveView.CallLogs:
        return <CallLogsView />;
      case ActiveView.TTSStudio:
        return <TTSStudioView />;
      case ActiveView.ActiveCall:
        return <ActiveCallView />;
      default:
        return <CallLogsView />;
    }
  };

  return (
    <main className="flex-1 bg-eburon-bg">
      <Suspense fallback={<LoadingIndicator text={`Loading ${activeView}...`} />}>
        {renderContent()}
      </Suspense>
    </main>
  );
};
