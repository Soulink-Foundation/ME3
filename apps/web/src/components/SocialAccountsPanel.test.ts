import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useSocialStore,
  type SocialProviderSetting,
  type SocialStatus,
} from "../stores/social";
import SocialAccountsPanel from "./SocialAccountsPanel.vue";

const routerHarness = vi.hoisted(() => ({
  replace: vi.fn(),
  route: { path: "/social", query: {} as Record<string, string> },
}));
const toastHarness = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRoute: () => routerHarness.route,
  useRouter: () => ({
    replace: routerHarness.replace,
    resolve: (location: { path: string }) => ({ fullPath: location.path }),
  }),
}));

vi.mock("../composables/useAppToast", () => ({
  useAppToast: () => ({
    toastError: toastHarness.error,
    toastSuccess: toastHarness.success,
  }),
}));

const status = {
  plugin: {
    status: "ready",
    enabled: true,
    ready: true,
    statusLabel: "Ready",
    platformCapabilities: [],
  },
  hostedOAuth: { configured: true, platforms: ["linkedin", "instagram"] },
} satisfies SocialStatus;

const xProvider = {
  providerId: "x",
  label: "X",
  clientId: "",
  configured: false,
  enabled: false,
  secretHint: null,
  secretUpdatedAt: null,
  callbackPath: "/api/social/x/callback",
} satisfies SocialProviderSetting;

describe("SocialAccountsPanel managed X connection", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    routerHarness.route.query = {};
    const store = useSocialStore();
    vi.spyOn(store, "fetchSocialStatus").mockResolvedValue(status);
    vi.spyOn(store, "fetchSocialAccounts").mockResolvedValue([]);
    vi.spyOn(store, "fetchProviderSettings").mockResolvedValue([xProvider]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps BYO X credentials in Advanced and requires a concise acknowledgement", async () => {
    const store = useSocialStore();
    const configured = { ...xProvider, clientId: "client-id", configured: true, enabled: true };
    const updateProvider = vi.spyOn(store, "updateProviderSetting").mockResolvedValue([configured]);
    const startOAuth = vi.spyOn(store, "startSocialOAuth").mockRejectedValue(
      new Error("Stop before navigation"),
    );
    const wrapper = mount(SocialAccountsPanel, {
      props: { siteId: "site-1" },
      global: {
        stubs: {
          UiIcon: { template: "<span aria-hidden=\"true\" />" },
        },
      },
    });
    await flushPromises();

    await wrapper.findAll(".social-connect-btn")[0]!.trigger("click");
    const dialog = wrapper.get('[role="dialog"]');
    const notice = dialog.get(".x-funding-notice__acknowledgement");
    expect(dialog.text()).not.toContain("X API access is pay-per-use");
    expect(dialog.text()).not.toContain("your own X developer account");
    expect(dialog.findAll("a")).toHaveLength(0);
    expect(notice.text()).toBe("I will pay X API charges");

    const connectButton = wrapper.get(".social-own-app__button");
    expect(connectButton.attributes()).toHaveProperty("disabled");
    await wrapper.get('.social-own-app input[type="text"]').setValue("client-id");
    await wrapper.get('.social-own-app input[type="password"]').setValue("client-secret");
    await notice.get('input[type="checkbox"]').setValue(true);
    expect(connectButton.attributes()).not.toHaveProperty("disabled");

    await connectButton.trigger("click");
    await flushPromises();

    expect(updateProvider).toHaveBeenCalledWith({
      id: "x",
      clientId: "client-id",
      clientSecret: "client-secret",
      enabled: true,
    });
    expect(startOAuth).toHaveBeenCalledWith("x", "site-1", "/social", "byo");
  });

  it.each([
    ["x", "X connected."],
    ["instagram", "Instagram connected. It will now appear as a publish target."],
    ["youtube", "YouTube channel connected. Review visibility and audience settings before publishing."],
    ["linkedin", "LinkedIn connected. It will now appear as a publish target."],
  ])("reports truthful capability language after connecting %s", async (platform, message) => {
    routerHarness.route.query = { social_connected: platform };
    const wrapper = mount(SocialAccountsPanel, {
      props: { siteId: "site-1" },
      global: {
        stubs: {
          UiIcon: { template: "<span aria-hidden=\"true\" />" },
        },
      },
    });
    expect(toastHarness.error).not.toHaveBeenCalled();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await flushPromises();

    expect(toastHarness.success).toHaveBeenCalledWith(message);
    expect(routerHarness.replace).toHaveBeenCalledWith({
      path: "/social",
      query: {},
    });
    expect(wrapper.find(".banner").exists()).toBe(false);
  });

  it.each([
    ["x_config", "X publishing is not configured on the ME3 server yet."],
    ["instagram_profile_token", "Instagram rejected the access token"],
    ["instagram_profile_permission", "Instagram did not allow ME3 to read your professional profile."],
    ["instagram_profile_unavailable", "Instagram could not return your profile."],
    ["instagram_profile_invalid", "Instagram did not return a professional account ID."],
  ])("explains %s connection failures without reporting success", async (error, message) => {
    routerHarness.route.query = { social_error: error };
    mount(SocialAccountsPanel, {
      props: { siteId: "site-1" },
      global: { stubs: { UiIcon: true } },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await flushPromises();
    expect(toastHarness.error).toHaveBeenCalledWith(expect.stringContaining(message));
    expect(toastHarness.success).not.toHaveBeenCalled();
    expect(routerHarness.replace).toHaveBeenCalledWith({ path: "/social", query: {} });
  });

  it("keeps hosted connection choices concise", async () => {
    const wrapper = mount(SocialAccountsPanel, {
      props: { siteId: "site-1" },
      global: {
        stubs: {
          UiIcon: { template: "<span aria-hidden=\"true\" />" },
        },
      },
    });
    await flushPromises();

    await wrapper.findAll(".social-connect-btn")[1]!.trigger("click");
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.get(".social-connect-option__button").text()).toBe("Connect");
    expect(dialog.text()).toContain("Advanced: use my own app");
    expect(dialog.text()).not.toContain("Connect with ME3");
    expect(dialog.text()).not.toContain("Connect through ME3 Cloud");
    expect(dialog.text()).not.toContain("Recommended. Requires this installation");
  });

  it("uses the managed X app by default and leaves BYO collapsed", async () => {
    const store = useSocialStore();
    vi.mocked(store.fetchSocialStatus).mockResolvedValue({
      ...status,
      hostedOAuth: { configured: true, platforms: ["x", "linkedin", "instagram"] },
      managedXUsage: null,
    });
    const startOAuth = vi.spyOn(store, "startSocialOAuth").mockRejectedValue(
      new Error("Stop before navigation"),
    );
    const wrapper = mount(SocialAccountsPanel, {
      props: { siteId: "site-1" },
      global: {
        stubs: {
          UiIcon: { template: "<span aria-hidden=\"true\" />" },
        },
      },
    });
    await flushPromises();

    await wrapper.findAll(".social-connect-btn")[0]!.trigger("click");
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.get("h3").text()).toBe("Connect X");
    expect(dialog.get(".social-connect-option__button").text()).toBe("Connect");
    expect(dialog.get("details").attributes()).not.toHaveProperty("open");
    expect(dialog.text()).not.toContain("API usage");

    await dialog.get(".social-connect-option__button").trigger("click");
    await flushPromises();
    expect(startOAuth).toHaveBeenCalledWith("x", "site-1", "/social", "managed");
  });

  it("shows only the percentage after managed X usage reaches 80%", async () => {
    const store = useSocialStore();
    vi.mocked(store.fetchSocialStatus).mockResolvedValue({
      ...status,
      hostedOAuth: { configured: true, platforms: ["x"] },
      managedXUsage: {
        usedPercent: 83,
        blocked: false,
        resetsAt: "2026-08-01T00:00:00.000Z",
      },
    });
    vi.mocked(store.fetchSocialAccounts).mockResolvedValue([{
      id: "account-x",
      siteId: "site-1",
      platform: "x",
      handle: "owner",
      displayName: "Owner",
      credentialSource: "hosted_oauth",
      status: "active",
      lastVerifiedAt: null,
    }]);
    const wrapper = mount(SocialAccountsPanel, {
      props: { siteId: "site-1" },
      global: {
        stubs: {
          UiIcon: { template: "<span aria-hidden=\"true\" />" },
        },
      },
    });
    await flushPromises();

    expect(wrapper.get(".social-x-usage").text()).toBe("X usage: 83%");
    expect(wrapper.text()).not.toContain("$");
  });

  it("reports actionable hosted OAuth failures through vue-sonner", async () => {
    routerHarness.route.query = {
      social_error: "youtube_token_invalid_client",
    };
    const wrapper = mount(SocialAccountsPanel, {
      props: { siteId: "site-1" },
      global: {
        stubs: {
          UiIcon: { template: "<span aria-hidden=\"true\" />" },
        },
      },
    });
    expect(toastHarness.error).not.toHaveBeenCalled();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await flushPromises();

    expect(toastHarness.error).toHaveBeenCalledWith(
      "Google rejected the YouTube app credentials. Check that the client ID and client secret belong to the same Web application.",
    );
    expect(routerHarness.replace).toHaveBeenCalledWith({
      path: "/social",
      query: {},
    });
    expect(wrapper.find(".banner").exists()).toBe(false);
  });
});
