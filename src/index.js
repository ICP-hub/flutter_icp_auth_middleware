import { fromHex } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import { Ed25519PublicKey, DelegationIdentity, ECDSAKeyIdentity, DelegationChain } from "@dfinity/identity";

const loginButton = document.getElementById("login");
const redirectToAppButton = document.getElementById("redirect");

// Reciveing the session key from the URL
function getQueryParams() {
  const queryParams = new URLSearchParams(window.location.search);
  return {
    publicKey: queryParams.get("sessionkey"),
    scheme: queryParams.get("scheme"),
    host: queryParams.get("host"),
  }
}

// Converting the sessionKey into Ed25519PublicKey
const appPublicKey = Ed25519PublicKey.fromDer(fromHex(getQueryParams().publicKey));

let delegationChain;
var status = "false";

// Login button
loginButton.onclick = async (e) => {
  e.preventDefault();

  // Creating a middle key identity
  var middleKeyIdentity = await ECDSAKeyIdentity.generate();
  let authClient = await AuthClient.create({
    identity: middleKeyIdentity,
  });

  await new Promise((resolve) => {
    authClient.login({
      identityProvider:
        process.env.DFX_NETWORK === "ic"
          ? "https://identity.ic0.app"
          : `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943`,
      onSuccess: () => {
        resolve;
        status = "true";
        redirectToAppButton.removeAttribute("disabled");
        loginButton.setAttribute("disabled", true);        
        handleSuccessfulLogin(authClient, middleKeyIdentity,status);
      },
    });
  });
  return false;
};

// Handling delegated data after login
async function handleSuccessfulLogin(authClientInstance, middleKeyIdentity, status) {

  const middleIdentity = authClientInstance.getIdentity();

  // Delegated Principal
  console.log('middle identity', middleIdentity.getPrincipal().toString())

  document.getElementById("loginStatus").textContent = "You are logged in ✅";
  document.getElementById("principalId").textContent = "ID: " + middleIdentity.getPrincipal().toString();

  // Creating Delegation Chain
  if (appPublicKey != null && middleIdentity instanceof DelegationIdentity) {
    let middleToApp = await DelegationChain.create(
      middleKeyIdentity,
      appPublicKey,
      new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      { previous: middleIdentity.getDelegation() },
    );

    delegationChain = middleToApp;
  }

  var delegationString = JSON.stringify(
    delegationChain.toJSON()
  );

  const encodedDelegation = encodeURIComponent(delegationString);

  const scheme = getQueryParams().scheme;

  const host = getQueryParams().host;

  // Sending encoded delegation to the app
  redirectToAppButton.onclick = async (e) => {
    e.preventDefault();
    window.location.href = `${scheme}://${host}?del=${encodedDelegation}&status=${status}`;
    loginButton.removeAttribute("disabled");
  };

}
