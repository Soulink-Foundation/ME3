<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter, type LocationQueryRaw } from "vue-router";
import {
  useSocialStore,
  type SocialAccountRow,
  type SocialProviderSetting,
  type SocialStatus,
} from "../stores/social";
import { useAppToast } from "../composables/useAppToast";
import UiIcon from "./UiIcon.vue";

type SupportedPlatform =
  | "x"
  | "linkedin"
  | "instagram"
  | "instagram_business"
  | "youtube"
  | "tiktok";

const props = defineProps<{
  siteId: string;
}>();

const social = useSocialStore();
const route = useRoute();
const router = useRouter();
const { toastError, toastSuccess } = useAppToast();

const accounts = ref<SocialAccountRow[]>([]);
const status = ref<SocialStatus | null>(null);
const providerSettings = ref<SocialProviderSetting[]>([]);
const busyPlatform = ref<SupportedPlatform | null>(null);
const savingProvider = ref(false);
const connectModalPlatform = ref<SupportedPlatform | null>(null);
const xFundingAcknowledged = ref(false);
const providerDraft = ref({
  clientId: "",
  clientSecret: "",
});

const platforms: {
  id: SupportedPlatform;
  label: string;
}[] = [
  { id: "x", label: "X" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
];

const siteAccounts = computed(() =>
  accounts.value.filter((account) => account.siteId === props.siteId),
);

const accountByPlatform = computed<
  Record<SupportedPlatform, SocialAccountRow | null>
>(() => ({
  x: siteAccounts.value.find((account) => account.platform === "x") || null,
  linkedin:
    siteAccounts.value.find((account) => account.platform === "linkedin") ||
    null,
  instagram:
    siteAccounts.value.find((account) => account.platform === "instagram") ||
    null,
  instagram_business:
    siteAccounts.value.find(
      (account) => account.platform === "instagram_business",
    ) || null,
  youtube:
    siteAccounts.value.find((account) => account.platform === "youtube") ||
    null,
  tiktok:
    siteAccounts.value.find((account) => account.platform === "tiktok") ||
    null,
}));

const oauthConnected = computed(() => {
  const value = route.query.social_connected;
  return typeof value === "string" ? value : null;
});

const oauthError = computed(() => {
  const value = route.query.social_error;
  return typeof value === "string" ? value : null;
});

const oauthMessage = computed(() => {
  if (oauthConnected.value === "x") {
    return "X connected.";
  }
  if (oauthConnected.value === "linkedin") {
    return "LinkedIn connected. It will now appear as a publish target.";
  }
  if (oauthConnected.value === "instagram") {
    return "Instagram connected. It will now appear as a publish target.";
  }
  if (oauthConnected.value === "instagram_business") {
    return "Instagram (Business) connected. It will now appear as a publish target.";
  }
  if (oauthConnected.value === "youtube") {
    return "YouTube channel connected. Review visibility and audience settings before publishing.";
  }
  if (oauthConnected.value === "tiktok") {
    return "TikTok connected. Short videos can be sent as creator drafts or Direct Posts.";
  }
  return null;
});

const oauthErrorMessage = computed(() => {
  switch (oauthError.value) {
    case "config":
      return "This social connection is not configured on the server yet.";
    case "x_config":
      return "X publishing is not configured on the ME3 server yet. The server administrator needs to add the X publishing app credentials before you reconnect.";
    case "instagram_profile_token":
      return "Instagram rejected the access token while loading your profile. Reconnect your Instagram account and try again.";
    case "instagram_profile_permission":
      return "Instagram did not allow ME3 to read your professional profile. Check the app’s Instagram permissions and account access, then reconnect.";
    case "instagram_profile_unavailable":
      return "Instagram could not return your profile. Please try connecting again; if this continues, the server administrator can check the Instagram error code.";
    case "instagram_profile_invalid":
      return "Instagram did not return a professional account ID. Connect an Instagram Business or Creator account with access to the ME3 app.";
    case "token":
      return "OAuth completed, but the token exchange failed.";
    case "youtube_token_invalid_client":
      return "Google rejected the YouTube app credentials. Check that the client ID and client secret belong to the same Web application.";
    case "youtube_token_invalid_grant":
    case "youtube_token_redirect_uri":
      return "Google rejected the YouTube authorization code. Confirm the authorized redirect URI is exactly https://api.me3.app/api/social/youtube/callback, then try again.";
    case "youtube_token_refresh_missing":
      return "Google did not return an offline refresh token. Remove ME3 from your Google Account connections, then reconnect.";
    case "youtube_token_invalid_scope":
    case "youtube_token_unauthorized_client":
      return "The Google OAuth app is not allowed to request the required YouTube scopes yet.";
    case "youtube_token":
      return "Google could not complete the YouTube token exchange. Check the OAuth client configuration and try again.";
    case "tiktok_token_invalid_client":
      return "TikTok rejected the app credentials. Check that the client key and client secret come from the same TikTok app.";
    case "tiktok_token_invalid_grant":
    case "tiktok_token_redirect_uri":
      return "TikTok rejected the authorization code. Confirm the redirect URI is exactly https://api.me3.app/api/social/tiktok/callback, then try again.";
    case "tiktok_token_invalid_scope":
    case "tiktok_token_unauthorized_client":
      return "The TikTok app is not allowed to request user.info.basic, video.upload, and video.publish. Check its Login Kit and Content Posting API configuration.";
    case "tiktok_token_response":
      return "TikTok returned an incomplete token response. Check the app products and scopes, then reconnect.";
    case "tiktok_token":
      return "TikTok could not complete the token exchange. Check the app credentials and redirect URI, then try again.";
    case "profile":
      return "OAuth completed, but ME3 could not load your social profile.";
    case "state_error":
    case "state_expired":
    case "bad_state":
      return "The social connect flow expired. Please try again.";
    case "callback":
      return "The social connect callback failed. Please try again.";
    case "site_missing":
      return "ME3 could not find the site for this social connect flow anymore.";
    default:
      return oauthError.value
        ? "Could not complete the social connect flow."
        : null;
  }
});

const modalPlatformLabel = computed(() => {
  const platform = connectModalPlatform.value;
  return platforms.find((item) => item.id === platform)?.label || "Social account";
});

const modalProviderSetting = computed(() =>
  providerSettings.value.find(
    (provider) => provider.providerId === connectModalPlatform.value,
  ),
);

const modalAccount = computed(() =>
  connectModalPlatform.value ? accountByPlatform.value[connectModalPlatform.value] : null,
);

const hostedOAuthAvailable = computed(() => {
  const platform = connectModalPlatform.value;
  if (!platform) return false;
  return Boolean(
    status.value?.hostedOAuth.configured &&
      status.value.hostedOAuth.platforms.includes(platform),
  );
});

const ownAppReady = computed(() => Boolean(modalProviderSetting.value?.configured));
const managedOnlyPlatform = computed(
  () => connectModalPlatform.value === "youtube" || connectModalPlatform.value === "tiktok",
);
const managedXUsageVisible = computed(
  () =>
    accountByPlatform.value.x?.credentialSource === "hosted_oauth" &&
    Boolean(status.value?.managedXUsage),
);

function reportSocialError(error: unknown, fallback: string) {
  social.setErrorFromApi(error, fallback);
  toastError(social.error || fallback);
}

async function reloadAccounts() {
  try {
    const [nextStatus, nextAccounts, nextSettings] = await Promise.all([
      social.fetchSocialStatus(),
      social.fetchSocialAccounts(),
      social.fetchProviderSettings(),
    ]);
    status.value = nextStatus;
    accounts.value = nextAccounts;
    providerSettings.value = nextSettings;
  } catch (error) {
    reportSocialError(error, "Failed to load connected social accounts");
  }
}

function clearOAuthQueryFromUrl() {
  if (!oauthConnected.value && !oauthError.value) return;
  const query: LocationQueryRaw = { ...route.query };
  delete query.social_connected;
  delete query.social_error;
  void router.replace({ path: route.path, query });
}

function presentOAuthFeedback() {
  if (oauthMessage.value) toastSuccess(oauthMessage.value);
  if (oauthErrorMessage.value) toastError(oauthErrorMessage.value);
  if (oauthMessage.value || oauthErrorMessage.value) {
    clearOAuthQueryFromUrl();
  }
}

function scheduleOAuthFeedback() {
  window.setTimeout(presentOAuthFeedback, 0);
}

function buildReturnPath(): string {
  const query: LocationQueryRaw = { ...route.query };
  delete query.social_connected;
  delete query.social_error;
  return router.resolve({ path: route.path, query }).fullPath;
}

async function connect(
  platform: SupportedPlatform,
  credentialSource: "managed" | "byo",
) {
  if (busyPlatform.value) return;
  busyPlatform.value = platform;
  try {
    const url = await social.startSocialOAuth(
      platform,
      props.siteId,
      buildReturnPath(),
      credentialSource,
    );
    window.location.href = url;
  } catch (error) {
    reportSocialError(error, "Could not start OAuth");
    busyPlatform.value = null;
  }
}

function openConnectModal(platform: SupportedPlatform) {
  connectModalPlatform.value = platform;
  const setting = providerSettings.value.find(
    (provider) => provider.providerId === platform,
  );
  providerDraft.value = {
    clientId: setting?.clientId || "",
    clientSecret: "",
  };
  xFundingAcknowledged.value = false;
}

function closeConnectModal() {
  if (busyPlatform.value || savingProvider.value) return;
  connectModalPlatform.value = null;
  providerDraft.value = { clientId: "", clientSecret: "" };
  xFundingAcknowledged.value = false;
}

async function continueWithManagedApp() {
  if (!connectModalPlatform.value) return;
  await connect(connectModalPlatform.value, "managed");
}

async function continueWithOwnApp() {
  if (!connectModalPlatform.value || savingProvider.value) return;
  const platform = connectModalPlatform.value;
  const current = modalProviderSetting.value;
  const clientId = providerDraft.value.clientId.trim();
  const clientSecret = providerDraft.value.clientSecret.trim();

  if (platform === "x" && !xFundingAcknowledged.value) {
    toastError("Acknowledge that X API usage is funded through your developer account.");
    return;
  }

  if (!clientId) {
    toastError("Client ID is required.");
    return;
  }
  if (!clientSecret && !current?.configured) {
    toastError("Client secret is required the first time you configure this app.");
    return;
  }

  savingProvider.value = true;
  try {
    providerSettings.value = await social.updateProviderSetting({
      id: platform as SocialProviderSetting["providerId"],
      clientId,
      ...(clientSecret ? { clientSecret } : {}),
      enabled: true,
    });
    await connect(platform, "byo");
  } catch (error) {
    reportSocialError(error, "Could not configure social app");
    busyPlatform.value = null;
  } finally {
    savingProvider.value = false;
  }
}

function isConnected(platform: SupportedPlatform): boolean {
  return accountByPlatform.value[platform]?.status === "active";
}

async function disconnectCurrentAccount() {
  const account = modalAccount.value;
  if (!account || busyPlatform.value) return;
  if (!window.confirm(`Disconnect ${modalPlatformLabel.value}? Scheduled posts will pause until you reconnect.`)) {
    return;
  }
  busyPlatform.value = connectModalPlatform.value;
  try {
    await social.disconnectSocialAccount(account.id);
    await reloadAccounts();
    connectModalPlatform.value = null;
  } catch (error) {
    reportSocialError(error, "Could not disconnect social account");
  } finally {
    busyPlatform.value = null;
  }
}

onMounted(() => {
  void reloadAccounts();
  scheduleOAuthFeedback();
});

watch(
  () => [oauthMessage.value, oauthErrorMessage.value] as const,
  scheduleOAuthFeedback,
);

watch(() => props.siteId, () => void reloadAccounts());
</script>

<template>
  <section class="social-panel">
    <h2>Connect social accounts</h2>
    <p
      v-if="managedXUsageVisible"
      class="social-connect-modal__status social-x-usage"
      role="status"
      aria-live="polite"
    >
      X usage: {{ status?.managedXUsage?.usedPercent }}%
    </p>

    <div class="social-connect-row" role="group" aria-label="Social accounts">
      <div v-for="item in platforms" :key="item.id" class="social-connect-card">
        <button
          type="button"
          class="social-connect-btn"
          :class="{
            'social-connect-btn--connected': isConnected(item.id),
          }"
          :disabled="busyPlatform !== null"
          :aria-busy="busyPlatform === item.id"
          :aria-label="
            isConnected(item.id)
              ? `${item.label} connected, click to reconnect`
              : `Connect ${item.label}`
          "
          @click="openConnectModal(item.id)"
        >
          <UiIcon
            v-if="isConnected(item.id)"
            name="Check"
            :size="18"
            class="social-connect-btn__check"
            aria-hidden="true"
          />
          <span
            class="social-connect-btn__icon-ring"
            :class="{
              'social-connect-btn__icon-ring--x': item.id === 'x',
              'social-connect-btn__icon-ring--linkedin': item.id === 'linkedin',
              'social-connect-btn__icon-ring--instagram':
                item.id === 'instagram',
              'social-connect-btn__icon-ring--instagram-business':
                item.id === 'instagram_business',
              'social-connect-btn__icon-ring--youtube': item.id === 'youtube',
              'social-connect-btn__icon-ring--tiktok': item.id === 'tiktok',
            }"
          >
            <!-- LinkedIn (same glyph as login OAuth) -->
            <svg
              v-if="item.id === 'linkedin'"
              class="social-connect-btn__brand"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
              />
            </svg>
            <svg
              v-else-if="
                item.id === 'instagram' || item.id === 'instagram_business'
              "
              class="social-connect-btn__brand"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5zm8.95 1.4a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8z"
              />
            </svg>
            <svg
              v-else-if="item.id === 'youtube'"
              class="social-connect-btn__brand"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M23.5 6.2a3 3 0 0 0-2.11-2.12C19.53 3.6 12 3.6 12 3.6s-7.53 0-9.39.48A3 3 0 0 0 .5 6.2 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .5 5.8 3 3 0 0 0 2.11 2.12c1.86.48 9.39.48 9.39.48s7.53 0 9.39-.48a3 3 0 0 0 2.11-2.12A31.2 31.2 0 0 0 24 12a31.2 31.2 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"
              />
            </svg>
            <svg
              v-else-if="item.id === 'tiktok'"
              class="social-connect-btn__brand"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M16.7 1.9c.36 2.16 1.64 3.45 3.8 3.59v3.02a8.85 8.85 0 0 1-3.76-.87v7.04a7.1 7.1 0 1 1-6.12-7.04v3.1a4.05 4.05 0 1 0 3.02 3.94V1.9h3.06Z"
              />
            </svg>
            <!-- X (same glyph as login OAuth) -->
            <svg
              v-else
              class="social-connect-btn__brand social-connect-btn__brand--x-mark"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
              />
            </svg>
          </span>
          <span
            v-if="busyPlatform === item.id"
            class="social-connect-btn__busy"
          >
            Opening…
          </span>
        </button>
      </div>
    </div>

    <div
      v-if="connectModalPlatform"
      class="social-connect-modal-backdrop"
      role="presentation"
      @click.self="closeConnectModal"
    >
      <section
        class="social-connect-modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`social-connect-title-${connectModalPlatform}`"
      >
        <div class="social-connect-modal__header">
          <h3 :id="`social-connect-title-${connectModalPlatform}`">
            Connect {{ modalPlatformLabel }}
          </h3>
          <button
            type="button"
            class="social-connect-modal__close"
            aria-label="Close connect dialog"
            :disabled="busyPlatform !== null || savingProvider"
            @click="closeConnectModal"
          >
            <UiIcon name="X" :size="18" aria-hidden="true" />
          </button>
        </div>

        <p v-if="modalAccount && modalAccount.status !== 'active'" class="social-connect-modal__status" role="status">
          This account needs to be reconnected before publishing.
        </p>

        <div
          v-if="hostedOAuthAvailable"
          class="social-connect-option social-connect-option--managed"
        >
          <button
            type="button"
            class="social-connect-option__button"
            :disabled="busyPlatform !== null || savingProvider"
            @click="continueWithManagedApp"
          >
            {{ busyPlatform === connectModalPlatform ? "Opening..." : "Connect" }}
          </button>
        </div>

        <p
          v-if="managedOnlyPlatform && !hostedOAuthAvailable"
          class="social-connect-modal__status"
          role="status"
        >
          Link this installation to ME3 Cloud before connecting this provider.
        </p>

        <details
          v-if="!managedOnlyPlatform"
          class="social-own-app"
          :open="!hostedOAuthAvailable"
        >
          <summary class="social-own-app__heading">
            <strong>{{ hostedOAuthAvailable ? "Advanced: use my own app" : "App credentials" }}</strong>
            <span v-if="ownAppReady">Configured</span>
          </summary>
          <label
            v-if="connectModalPlatform === 'x'"
            class="x-funding-notice__acknowledgement"
          >
            <input v-model="xFundingAcknowledged" type="checkbox" />
            <span>I will pay X API charges</span>
          </label>
          <label>
            <span>Client ID</span>
            <input
              v-model="providerDraft.clientId"
              type="text"
              autocomplete="off"
              :placeholder="`${modalPlatformLabel} client ID`"
            />
          </label>
          <label>
            <span>Client secret</span>
            <input
              v-model="providerDraft.clientSecret"
              type="password"
              autocomplete="new-password"
              :placeholder="
                modalProviderSetting?.secretHint
                  ? `Saved ${modalProviderSetting.secretHint}`
                  : `${modalPlatformLabel} client secret`
              "
            />
          </label>
          <p class="social-own-app__hint">
            Callback path: {{ modalProviderSetting?.callbackPath || `/api/social/${connectModalPlatform}/callback` }}
          </p>
          <button
            type="button"
            class="social-own-app__button"
            :disabled="
              busyPlatform !== null ||
              savingProvider ||
              (connectModalPlatform === 'x' && !xFundingAcknowledged)
            "
            @click="continueWithOwnApp"
          >
            {{
              savingProvider || busyPlatform === connectModalPlatform
                ? "Opening..."
                : ownAppReady
                  ? "Save & reconnect"
                  : "Save & connect"
            }}
          </button>
        </details>
        <button
          v-if="modalAccount && modalAccount.status === 'active'"
          type="button"
          class="social-connect-modal__disconnect"
          :disabled="busyPlatform !== null || savingProvider"
          @click="disconnectCurrentAccount"
        >
          Disconnect account
        </button>
      </section>
    </div>
  </section>
</template>

<style scoped>
.social-panel {
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
}

.social-panel h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px;
}

.social-x-usage {
  margin: -8px 0 16px;
}

.social-connect-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 12px;
}

.social-connect-card {
  position: relative;
  min-width: 0;
}

.social-connect-card__help {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: help;
}

.social-connect-card__help:hover {
  border-color: var(--color-border-strong);
}

.social-connect-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 10px 14px 10px;
  border-radius: 14px;
  /* 2px border in both states so connected/unconnected icons align */
  border: 2px solid var(--color-border);
  background: var(--color-bg-subtle);
  color: var(--color-text);
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  font-family: inherit;
  text-align: center;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.social-connect-btn:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  background: var(--color-bg-muted);
}

.social-connect-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.social-connect-btn--connected {
  border-color: #15803d;
}

.social-connect-modal__status {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-muted);
  font-size: 0.9rem;
}

.social-connect-modal__disconnect {
  width: 100%;
  padding: 10px 12px;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  text-decoration: underline;
  cursor: pointer;
}

:root[data-theme="dark"] .social-connect-btn--connected {
  border-color: #4ade80;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) .social-connect-btn--connected {
    border-color: #4ade80;
  }
}

.social-connect-btn__icon-ring {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-bottom: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}

.social-connect-btn__icon-ring--x {
  background: #111;
  color: #fff;
}

.social-connect-btn__icon-ring--linkedin {
  background: #0a66c2;
  color: #fff;
}

.social-connect-btn__icon-ring--instagram {
  background: #c13584;
  color: #fff;
}

.social-connect-btn__icon-ring--instagram-business {
  background: #1877f2;
  color: #fff;
}

.social-connect-btn__icon-ring--youtube {
  background: #ff0033;
  color: #fff;
}

.social-connect-btn__icon-ring--tiktok {
  background: #111;
  color: #fff;
}

.social-connect-btn__brand {
  width: 26px;
  height: 26px;
}

.social-connect-btn__brand--x-mark {
  width: 22px;
  height: 22px;
}

.social-connect-btn__check {
  position: absolute;
  top: 9px;
  right: 9px;
  z-index: 1;
  width: 18px;
  height: 18px;
  padding: 2px;
  border: 2px solid var(--ui-surface, var(--color-bg));
  border-radius: 50%;
  background: #15803d;
  color: #fff;
  pointer-events: none;
}

:root[data-theme="dark"] .social-connect-btn__check {
  background: #4ade80;
  color: #072b15;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) .social-connect-btn__check {
    background: #4ade80;
    color: #072b15;
  }
}

.social-connect-btn__busy {
  margin-top: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.social-connect-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(0 0 0 / 0.42);
}

.social-connect-modal {
  width: min(520px, 100%);
  max-height: min(720px, calc(100vh - 40px));
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  box-shadow: 0 24px 70px rgb(0 0 0 / 0.28);
}

.social-connect-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 20px 0;
}

.social-connect-modal h3 {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
}

.social-connect-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text-muted);
  cursor: pointer;
}

.social-connect-modal__close:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-bg-muted);
}

.social-own-app .x-funding-notice__acknowledgement input:focus-visible {
  outline: 2px solid var(--ui-accent, var(--color-accent));
  outline-offset: 2px;
}

.social-own-app .x-funding-notice__acknowledgement {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 44px;
  margin-top: 8px;
  padding: 10px 0 0;
  color: var(--ui-text, var(--color-text));
  cursor: pointer;
  font-size: 13px;
  line-height: 1.45;
}

.social-own-app .x-funding-notice__acknowledgement input {
  width: 18px;
  height: 18px;
  min-height: 18px;
  margin: 1px 0 0;
  padding: 0;
  flex: 0 0 auto;
  accent-color: var(--ui-accent, var(--color-accent));
}

.social-connect-option,
.social-own-app {
  margin: 16px 20px 18px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-subtle);
}

.social-connect-option {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 14px;
}

.social-own-app__hint {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.4;
}

.social-connect-option__button,
.social-own-app__button {
  min-height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: var(--ui-accent, var(--color-accent));
  color: var(--ui-accent-contrast, #fff);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.social-connect-option__button:disabled,
.social-own-app__button:disabled,
.social-connect-modal__close:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.social-own-app {
  padding: 14px;
}

.social-own-app__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.social-own-app[open] .social-own-app__heading {
  margin-bottom: 12px;
}

.social-own-app__heading span {
  border: 1px solid #86efac;
  border-radius: 999px;
  padding: 3px 8px;
  background: #dcfce7;
  color: #166534;
  font-size: 12px;
  font-weight: 700;
}

.social-own-app label {
  display: grid;
  gap: 6px;
  margin-top: 12px;
  font-size: 13px;
  font-weight: 650;
}

.social-own-app input {
  width: 100%;
  min-height: 38px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
}

.social-own-app input:focus {
  outline: 2px solid var(--ui-accent-soft, var(--color-bg-muted));
  border-color: var(--ui-accent, var(--color-accent));
}

.social-own-app__button {
  display: block;
  margin: 12px 0 0 auto;
}

@media (max-width: 520px) {
  .social-connect-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .social-connect-btn {
    min-height: 78px;
    padding: 10px 8px;
    border-radius: 12px;
  }

  .social-connect-btn__icon-ring {
    width: 48px;
    height: 48px;
    margin-bottom: 0;
  }

  .social-connect-btn__brand {
    width: 23px;
    height: 23px;
  }

  .social-connect-btn__brand--x-mark {
    width: 20px;
    height: 20px;
  }

  .social-connect-modal-backdrop {
    align-items: end;
    padding: 12px;
  }

  .social-connect-modal {
    max-height: calc(100vh - 24px);
  }

  .social-connect-option {
    align-items: stretch;
    flex-direction: column;
  }

  .social-connect-option__button,
  .social-own-app__button {
    width: 100%;
  }
}
</style>
