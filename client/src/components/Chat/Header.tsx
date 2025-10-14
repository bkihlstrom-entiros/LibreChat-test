import { useMemo, lazy, Suspense } from 'react';
import { useMediaQuery } from '@librechat/client';
import { useOutletContext } from 'react-router-dom';
import { getConfigDefaults, PermissionTypes, Permissions } from 'librechat-data-provider';
import { LogOut } from 'lucide-react';
import type { ContextType } from '~/common';
import ModelSelector from './Menus/Endpoints/ModelSelector';
import { PresetsMenu, HeaderNewChat, OpenSidebar } from './Menus';
import { useGetStartupConfig } from '~/data-provider';
import ExportAndShareMenu from './ExportAndShareMenu';
import BookmarkMenu from './Menus/BookmarkMenu';
import { TemporaryChat } from './TemporaryChat';
import AddMultiConvo from './AddMultiConvo';
import { useAuthContext, useLocalize } from '~/hooks';
import { useHasAccess } from '~/hooks';

const AccountSettings = lazy(() => import('../Nav/AccountSettings'));

const defaultInterface = getConfigDefaults().interface;

export default function Header() {
  const localize = useLocalize();
  const { logout } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();

  const interfaceConfig = useMemo(
    () => startupConfig?.interface ?? defaultInterface,
    [startupConfig],
  );

  const disableChatHistory = interfaceConfig.disableChatHistory === true;
  const disableAccountSettings = interfaceConfig.accountSettings === false;
  const bypassAuth = interfaceConfig.bypassAuth === true;
  
  // Show account settings in header when chat history is disabled but account settings are enabled
  const showAccountSettingsInHeader = disableChatHistory && !disableAccountSettings && !bypassAuth;
  // Show logout button when account settings are disabled, but NOT in bypass auth mode
  const showLogoutButton = disableAccountSettings && !bypassAuth;

  const hasAccessToBookmarks = useHasAccess({
    permissionType: PermissionTypes.BOOKMARKS,
    permission: Permissions.USE,
  });

  const hasAccessToMultiConvo = useHasAccess({
    permissionType: PermissionTypes.MULTI_CONVO,
    permission: Permissions.USE,
  });

  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  return (
    <div className="sticky top-0 z-10 flex h-14 w-full items-center justify-between bg-white p-2 font-semibold text-text-primary dark:bg-gray-800">
      <div className="hide-scrollbar flex w-full items-center justify-between gap-2 overflow-x-auto">
        <div className="mx-1 flex items-center gap-2">
          <div
            className={`flex items-center gap-2 ${
              !isSmallScreen ? 'transition-all duration-200 ease-in-out' : ''
            } ${
              !navVisible
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none translate-x-[-100px] opacity-0'
            }`}
          >
            <OpenSidebar setNavVisible={setNavVisible} className="max-md:hidden" />
            <HeaderNewChat />
          </div>
          <div
            className={`flex items-center gap-2 ${
              !isSmallScreen ? 'transition-all duration-200 ease-in-out' : ''
            } ${!navVisible ? 'translate-x-0' : 'translate-x-[-100px]'}`}
          >
            {interfaceConfig.modelSelect !== false && (
              <ModelSelector startupConfig={startupConfig} />
            )}
            {interfaceConfig.presets === true && interfaceConfig.modelSelect && <PresetsMenu />}
            {hasAccessToBookmarks === true && <BookmarkMenu />}
            {hasAccessToMultiConvo === true && <AddMultiConvo />}
            {isSmallScreen && (
              <>
                <ExportAndShareMenu
                  isSharedButtonEnabled={startupConfig?.sharedLinksEnabled ?? false}
                />
                {interfaceConfig.disableChatHistory !== true && <TemporaryChat />}
                {showAccountSettingsInHeader && (
                  <Suspense fallback={null}>
                    <AccountSettings />
                  </Suspense>
                )}
                {showLogoutButton && !showAccountSettingsInHeader && (
                  <button
                    onClick={() => logout()}
                    className="flex items-center gap-2 rounded-md p-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                    title={localize('com_nav_log_out')}
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {!isSmallScreen && (
          <div className="flex items-center gap-2">
            <ExportAndShareMenu
              isSharedButtonEnabled={startupConfig?.sharedLinksEnabled ?? false}
            />
            {interfaceConfig.disableChatHistory !== true && <TemporaryChat />}
            {showAccountSettingsInHeader && (
              <Suspense fallback={null}>
                <AccountSettings />
              </Suspense>
            )}
            {showLogoutButton && !showAccountSettingsInHeader && (
              <button
                onClick={() => logout()}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                title={localize('com_nav_log_out')}
              >
                <LogOut className="h-4 w-4" />
                <span className="max-md:hidden">{localize('com_nav_log_out')}</span>
              </button>
            )}
          </div>
        )}
      </div>
      {/* Empty div for spacing */}
      <div />
    </div>
  );
}
