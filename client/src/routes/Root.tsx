import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import type { ContextType } from '~/common';
import {
  useSearchEnabled,
  useAssistantsMap,
  useAuthContext,
  useAgentsMap,
  useFileMap,
} from '~/hooks';
import {
  PromptGroupsProvider,
  AssistantsMapContext,
  AgentsMapContext,
  SetConvoProvider,
  FileMapContext,
} from '~/Providers';
import { useUserTermsQuery, useGetStartupConfig } from '~/data-provider';
import { TermsAndConditionsModal } from '~/components/ui';
import { Nav, MobileNav } from '~/components/Nav';
import { useHealthCheck } from '~/data-provider';
import { Banner } from '~/components/Banners';

export default function Root() {
  const [showTerms, setShowTerms] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(0);
  const [navVisible, setNavVisible] = useState(() => {
    const savedNavVisible = localStorage.getItem('navVisible');
    return savedNavVisible !== null ? JSON.parse(savedNavVisible) : true;
  });

  const { isAuthenticated, logout } = useAuthContext();

  // Global health check - runs once per authenticated session
  useHealthCheck(isAuthenticated);

  const assistantsMap = useAssistantsMap({ isAuthenticated });
  const agentsMap = useAgentsMap({ isAuthenticated });
  const fileMap = useFileMap({ isAuthenticated });

  const { data: config, isLoading: configLoading } = useGetStartupConfig();
  const { data: termsData } = useUserTermsQuery({
    enabled: isAuthenticated && config?.interface?.termsOfService?.modalAcceptance === true,
  });

  // Check if chat history is disabled
  const disableChatHistory = config?.interface?.disableChatHistory === true;
  const disableAccountSettings = config?.interface?.accountSettings === false;
  const bypassAuth = config?.interface?.bypassAuth === true;
  
  // Debug logging
  useEffect(() => {
    console.log('[Root] State:', { 
      isAuthenticated, 
      bypassAuth, 
      configLoading,
      hasConfig: !!config 
    });
  }, [isAuthenticated, bypassAuth, configLoading, config]);
  
  // Show nav only when chat history is enabled (we'll move account settings to header when chat history is disabled)
  const shouldShowNav = !disableChatHistory;

  useSearchEnabled(isAuthenticated);

  useEffect(() => {
    if (termsData) {
      setShowTerms(!termsData.termsAccepted);
    }
  }, [termsData]);

  const handleAcceptTerms = () => {
    setShowTerms(false);
  };

  const handleDeclineTerms = () => {
    setShowTerms(false);
    logout('/login?redirect=false');
  };

  // Don't block rendering if:
  // 1. User is authenticated, OR
  // 2. Bypass auth is enabled, OR  
  // 3. Still loading config (give time for bypass auth to initialize)
  const shouldRender = isAuthenticated || bypassAuth || configLoading;
  
  if (!shouldRender) {
    return null;
  }

  // Show minimal loading state while config loads and auth initializes
  if (configLoading && !isAuthenticated && !bypassAuth) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <SetConvoProvider>
      <FileMapContext.Provider value={fileMap}>
        <AssistantsMapContext.Provider value={assistantsMap}>
          <AgentsMapContext.Provider value={agentsMap}>
            <PromptGroupsProvider>
              <Banner onHeightChange={setBannerHeight} />
              <div className="flex" style={{ height: `calc(100dvh - ${bannerHeight}px)` }}>
                <div className="relative z-0 flex h-full w-full overflow-hidden">
                  {shouldShowNav && <Nav navVisible={navVisible} setNavVisible={setNavVisible} />}
                  <div className="relative flex h-full max-w-full flex-1 flex-col overflow-hidden">
                    {shouldShowNav && <MobileNav setNavVisible={setNavVisible} />}
                    <Outlet context={{ navVisible, setNavVisible } satisfies ContextType} />
                  </div>
                </div>
              </div>
            </PromptGroupsProvider>
          </AgentsMapContext.Provider>
          {config?.interface?.termsOfService?.modalAcceptance === true && (
            <TermsAndConditionsModal
              open={showTerms}
              onOpenChange={setShowTerms}
              onAccept={handleAcceptTerms}
              onDecline={handleDeclineTerms}
              title={config.interface.termsOfService.modalTitle}
              modalContent={config.interface.termsOfService.modalContent}
            />
          )}
        </AssistantsMapContext.Provider>
      </FileMapContext.Provider>
    </SetConvoProvider>
  );
}
