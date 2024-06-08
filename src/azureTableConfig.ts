import { PublicClientApplication, Configuration } from "@azure/msal-browser";
import { InteractiveBrowserCredential, TokenCredential } from "@azure/identity";
import { TableClient } from "@azure/data-tables";

const clientId = "43a4ba8d-112f-4894-8604-2987564fa33f";
const tenantId = "e290c7cd-29c5-4763-a016-cc1bf155224c";

const msalConfig: Configuration = {
  auth: {
    clientId: clientId, // Replace with your Client ID
    authority: `https://login.microsoftonline.com/e290c7cd-29c5-4763-a016-cc1bf155224c`, // Replace with your Tenant ID
    redirectUri: window.location.origin,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);
await msalInstance.initialize();

export async function getTokenCredential(): Promise<TokenCredential> {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    await msalInstance.loginPopup({
      scopes: ["https://storage.azure.com/user_impersonation"]
    });
  }
  return new InteractiveBrowserCredential({
    clientId: clientId, // Replace with your Client ID
    tenantId: tenantId, // Replace with your Tenant ID
  });
}

export async function getTableClient(): Promise<TableClient> {
  const credential = await getTokenCredential();
  const tableClient = new TableClient(
    `https://allpurposesstore.table.core.windows.net`,
    "Expressions",
    credential
  );

  return tableClient;
}