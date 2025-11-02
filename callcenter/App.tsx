import React, { useState, useEffect, Suspense } from 'react';
import { LeftSidebar } from './components/LeftSidebar';
import { CenterPanel } from './components/CenterPanel';
import { RightSidebar } from './components/RightSidebar';
import { ActiveView, Template } from './types';
import { initializeDataLayer } from './services/dataService';
import { LoadingIndicator } from './components/LoadingIndicator';
import { CallProvider } from './contexts/CallContext';
import { GlobalCallIndicator } from './components/GlobalCallIndicator';
import FeedbackModal from './components/FeedbackModal';
import { MOCK_TEMPLATES } from './constants';
import { useIsMobile } from './hooks/useIsMobile';
import { CrmProvider } from './contexts/CrmContext';

const WebDemoView = React.lazy(() => import('./components/WebDemoView'));
const MobileApp = React.lazy(() => import('./components/MobileApp'));

function App() {
  const [activeView, setActiveView] = useState<ActiveView>(ActiveView.CallLogs);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [isDataLayerInitialized, setIsDataLayerInitialized] = useState(false);
  const [generatedAppHtml, setGeneratedAppHtml] = useState<string | null>(null);
  const [templateForDemo, setTemplateForDemo] = useState<Template | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const init = async () => {
      await initializeDataLayer();
      setIsDataLayerInitialized(true);
    };
    init();
  }, []);

  const handleUseTemplate = (template: Template) => {
    setTemplateForDemo(template);
    setActiveView(ActiveView.WebDemo);
  };

  const handleStartWebDemoFromDialer = () => {
    const webDemoTemplate = MOCK_TEMPLATES.find(t => t.id === 'template-ayla-web-agent');
    if (webDemoTemplate) {
      handleUseTemplate(webDemoTemplate);
    } else {
      console.error("Web Agent Demo template not found!");
      alert("Could not start the Web Agent Demo: Template is missing.");
    }
  };
  
  useEffect(() => {
    // Automatically start the demo if the user navigates to the WebDemo view
    // and a demo isn't already in progress. This makes the sidebar button work.
    if (activeView === ActiveView.WebDemo && !templateForDemo) {
      handleStartWebDemoFromDialer();
    }
  }, [activeView, templateForDemo]);

  const handleEndDemo = () => {
    setTemplateForDemo(null);
    // After a demo, return to a neutral view like CallLogs instead of the now-removed Templates view.
    setActiveView(ActiveView.CallLogs);
  };

  if (!isDataLayerInitialized) {
    return (
      <LoadingIndicator text="Initializing Eburon Studio..." size="large" />
    );
  }

  const mainContent = (
      <Suspense fallback={<LoadingIndicator text="Loading Mobile Experience..." size="large" />}>
        <MobileApp />
      </Suspense>
  );

  if (isMobile) {
    return (
      <CrmProvider>
        {mainContent}
      </CrmProvider>
    );
  }
  
  if (templateForDemo && activeView === ActiveView.WebDemo) {
    return (
      <CrmProvider>
        <Suspense fallback={<LoadingIndicator text="Loading Web Agent Demo..." size="large" />}>
          <WebDemoView template={templateForDemo} onEndDemo={handleEndDemo} />
        </Suspense>
      </CrmProvider>
    );
  }

  return (
    <CrmProvider>
      <CallProvider activeView={activeView}>
        <div className="min-h-screen w-full flex bg-eburon-bg text-eburon-fg">
          <LeftSidebar 
            activeView={activeView}
            setActiveView={setActiveView}
            isCollapsed={isLeftSidebarCollapsed}
            setIsCollapsed={setIsLeftSidebarCollapsed}
            onOpenFeedback={() => setIsFeedbackModalOpen(true)}
          />
          <CenterPanel 
            activeView={activeView} 
            setGeneratedAppHtml={setGeneratedAppHtml}
          />
          <RightSidebar
            isCollapsed={isRightSidebarCollapsed}
            setIsCollapsed={setIsRightSidebarCollapsed}
            activeView={activeView}
            generatedAppHtml={generatedAppHtml}
            onStartWebDemo={handleStartWebDemoFromDialer}
          />
          <GlobalCallIndicator 
              isRightSidebarCollapsed={isRightSidebarCollapsed} 
              setIsRightSidebarCollapsed={setIsRightSidebarCollapsed} 
          />
          {isFeedbackModalOpen && <FeedbackModal onClose={() => setIsFeedbackModalOpen(false)} />}
        </div>
      </CallProvider>
    </CrmProvider>
  );
}

export default App;
