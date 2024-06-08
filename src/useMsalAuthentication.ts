import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { InteractiveBrowserCredential, TokenCredential } from '@azure/identity';

export function useMsalAuthentication() {
  const { instance, accounts } = useMsal();
  const [credential, setCredential] = useState<TokenCredential | null>(null);

  useEffect(() => {
    const initialize = async () => {
      if (accounts.length > 0) {
        try {
          const credential = new InteractiveBrowserCredential({
            clientId: "43a4ba8d-112f-4894-8604-2987564fa33f", // Replace with your Client ID
            tenantId: "e290c7cd-29c5-4763-a016-cc1bf155224c", // Replace with your Tenant ID
          });
          setCredential(credential);
        } catch (error) {
          if (error instanceof InteractionRequiredAuthError) {
            instance.acquireTokenPopup({
              scopes: ["https://storage.azure.com/user_impersonation"]
            });
          }
        }
      } else {
        instance.loginPopup({
          scopes: ["https://storage.azure.com/user_impersonation"]
        });
      }
    };

    initialize();
  }, [instance, accounts]);

  return credential;
}
