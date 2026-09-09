import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { useAuthStore } from "../stores/auth";
import { useSitesStore } from "../stores/sites";
import type { PostVersion } from "../stores/social";
import SocialPage from "./social.vue";

vi.mock("../api", () => ({
  API_BASE: "/api",
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

const toastHarness = vi.hoisted(() => ({
  error: vi.fn(),
  notice: vi.fn(),
  success: vi.fn(),
}));

vi.mock("../composables/useAppToast", () => ({
  useAppToast: () => ({
    toast: toastHarness.notice,
    toastError: toastHarness.error,
    toastSuccess: toastHarness.success,
  }),
}));

const account = {
  id: "account-linkedin", siteId: "site-1", platform: "linkedin", handle: "@kieran",
  displayName: "Kieran", avatarUrl: "https://cdn.test/kieran.jpg", avatarSource: "provider",
  status: "active", lastVerifiedAt: "2026-07-18T08:00:00Z",
};

function platformCapability(
  platform: "linkedin" | "x" | "instagram" | "tiktok" | "youtube",
  options: { schedule: boolean; deliveryMode: "direct_publish" | "provider_draft" },
) {
  const isTikTok = platform === "tiktok";
  const isInstagram = platform === "instagram";
  const isYouTube = platform === "youtube";
  return {
    platform,
    draft: true,
    schedule: options.schedule,
    publish: true,
    deliveryMode: options.deliveryMode,
    supportedDeliveryModes: isTikTok
      ? ["provider_draft", "direct_publish"]
      : undefined,
    deliveryLabel: isTikTok ? "Draft or Direct Post" : "Publishes directly",
    contentRules: isTikTok
      ? [{
          contentType: "short_video",
          label: "Short video",
          requiresText: false,
          maxTextCharacters: null,
          minMediaItems: 1,
          maxMediaItems: 1,
          allowedMediaKinds: ["video"],
          allowedMimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
          maxBytesPerItem: 4 * 1024 * 1024 * 1024,
          guidance: "Finish in TikTok.",
        }]
      : isInstagram || isYouTube ? [{
          contentType: "short_video",
          label: "Short video",
          requiresText: true,
          maxTextCharacters: isYouTube ? 5_000 : 2_200,
          minMediaItems: 1,
          maxMediaItems: 1,
          allowedMediaKinds: ["video"],
          allowedMimeTypes: isYouTube
            ? ["video/mp4", "video/quicktime", "video/webm"]
            : ["video/mp4", "video/quicktime"],
          maxBytesPerItem: isYouTube ? 256 * 1024 * 1024 * 1024 : 1024 * 1024 * 1024,
          guidance: isYouTube
            ? "Choose visibility and disclosures before uploading."
            : "Publishes as a Reel.",
        }] : [{
          contentType: "text",
          label: "Text post",
          requiresText: true,
          maxTextCharacters: platform === "x" ? 280 : 3_000,
          minMediaItems: 0,
          maxMediaItems: 0,
          allowedMediaKinds: [],
          allowedMimeTypes: [],
          maxBytesPerItem: null,
          guidance: null,
        }],
    reason: null,
  };
}

const mediaFiles = [
  {
    id: "file-image-1", folderId: null, filename: "first.jpg", mimeType: "image/jpeg",
    size: 101, sha256: "1".repeat(64), status: "ready", previewKind: "image",
  },
  {
    id: "file-image-2", folderId: null, filename: "second.png", mimeType: "image/png",
    size: 202, sha256: "2".repeat(64), status: "ready", previewKind: "image",
  },
  {
    id: "file-video-1", folderId: null, filename: "short.mp4", mimeType: "video/mp4",
    size: 303, sha256: "3".repeat(64), status: "ready", previewKind: "download",
  },
];

const post = {
  post: {
    id: "post-1", siteId: "site-1", sourceType: "mission_task", sourceRef: "task-1",
    sourceTitle: "A source-backed task", sourceSnapshot: "{}", sourceText: "Source text",
    ideaText: "A social post", tags: [], goal: null, status: "ready", createdBy: "agent",
    createdAt: "2026-07-18T07:00:00Z", updatedAt: "2026-07-18T07:00:00Z",
  },
  versions: [{
    id: "version-1", postId: "post-1", platform: "linkedin", targetAccountId: "account-linkedin",
    format: "post", bodyText: "Post copy https://example.com/story", assetManifest: [
      { url: "https://example.com/one.jpg", kind: "image" },
      { url: "https://example.com/two.jpg", kind: "image" },
    ], sourceExcerpt: "Source text",
    approvalStatus: "draft", approvedAt: null, approvedByUserId: null, scheduledFor: null,
    timezone: null, publicationStatus: null, platformPostUrl: null, publishedAt: null,
    failureClass: null, errorMessage: null, createdAt: "2026-07-18T07:00:00Z",
    updatedAt: "2026-07-18T07:00:00Z",
  }],
};

enableAutoUnmount(afterEach);

function mountPage() {
  return mount(SocialPage, {
    attachTo: document.body,
    global: {
      stubs: {
        RouterLink: { template: "<a><slot /></a>" },
        SocialAccountsPanel: { template: "<div>Account settings</div>" },
        AppDialog: { props: ["open"], template: '<div v-if="open"><slot /></div>' },
      },
    },
  });
}

describe("SocialPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    useAuthStore().user = {
      id: "owner",
      email: "owner@example.com",
      name: "Kieran",
      username: "kieran",
      timezone: "Europe/Dublin",
      locale: "en-IE",
      localeSource: "explicit",
    };
    useSitesStore().sites = [{
      id: "site-1", username: "kieran", user_id: "owner", site_role: "profile", custom_domain: null,
      custom_domain_status: null, created_at: "2026-07-01T08:00:00Z",
      updated_at: "2026-07-18T08:00:00Z", published_at: "2026-07-01T08:00:00Z",
    }];
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") return Promise.resolve({ posts: [post] });
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [account] });
      if (endpoint === "/files/folders") return Promise.resolve({ folders: [] });
      if (endpoint === "/files/items") return Promise.resolve({ files: mediaFiles });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: { status: "installed", enabled: true, ready: true, statusLabel: "Installed", platformCapabilities: [
          platformCapability("linkedin", { schedule: true, deliveryMode: "direct_publish" }),
        ] },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
  });

  it("shows a loading state instead of the account-setup placeholder during cold start", async () => {
    const sitesStore = useSitesStore();
    const configuredSite = sitesStore.sites[0]!;
    sitesStore.sites = [];
    let resolveSites!: (value: { sites: typeof sitesStore.sites }) => void;
    const sitesRequest = new Promise<{ sites: typeof sitesStore.sites }>((resolve) => {
      resolveSites = resolve;
    });
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/sites") return sitesRequest;
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [post] });
      }
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [account] });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: {
          status: "installed",
          enabled: true,
          ready: true,
          statusLabel: "Installed",
          platformCapabilities: [
            platformCapability("linkedin", {
              schedule: true,
              deliveryMode: "direct_publish",
            }),
          ],
        },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });

    const wrapper = mountPage();
    await Promise.resolve();

    expect(wrapper.text()).toContain("Loading social publishing…");
    expect(wrapper.text()).not.toContain("Finish account setup");

    resolveSites({ sites: [configuredSite] });
    await flushPromises();

    expect(wrapper.text()).not.toContain("Finish account setup");
    expect(wrapper.get(".post-row").text()).toContain("Post copy https://example.com/story");
  });

  it("keeps the workspace focused on posts and accounts without search", async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find(".social-toolbar__search").exists()).toBe(false);
    expect(wrapper.find("[role='search']").exists()).toBe(false);
    expect(wrapper.get(".workspace-tabs").text()).toContain("Drafts");
    expect(wrapper.get(".social-toolbar").text()).toContain("Social accounts");
    wrapper.get("[aria-label='New Post']");
    expect(wrapper.findAll(".post-source-group")).toHaveLength(0);
    expect(wrapper.findAll(".post-tags")).toHaveLength(0);
    expect(wrapper.findAll(".publication-panel")).toHaveLength(0);
    expect(wrapper.findAll(".publication-history")).toHaveLength(0);
    expect(wrapper.text()).not.toContain("Suggestions");
    expect(wrapper.text()).not.toContain("Posting plan");
    expect(wrapper.text()).not.toContain("Edit only this platform version.");
    expect(wrapper.classes()).toBeTruthy();
    expect(wrapper.get(".social-workspace").classes())
      .not.toContain("social-workspace--mobile-detail-open");
    await wrapper.get(".post-row__select").trigger("click");
    expect(wrapper.get(".social-workspace").classes())
      .toContain("social-workspace--mobile-detail-open");
    await wrapper.get("[aria-label='Back to social post list']").trigger("click");
    expect(wrapper.get(".social-workspace").classes())
      .not.toContain("social-workspace--mobile-detail-open");
  });

  it("uses tabs as context and hides singular media and row status labels", async () => {
    const singleImagePost = {
      ...post,
      versions: [{
        ...post.versions[0],
        assetManifest: [post.versions[0].assetManifest[0]],
      }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [singleImagePost] });
      }
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [account] });
      if (endpoint === "/social/status") {
        return Promise.resolve({
          plugin: {
            status: "installed",
            enabled: true,
            ready: true,
            statusLabel: "Installed",
            platformCapabilities: [
              platformCapability("linkedin", {
                schedule: true,
                deliveryMode: "direct_publish",
              }),
            ],
          },
          hostedOAuth: { configured: false, platforms: [] },
        });
      }
      throw new Error(`Unexpected GET ${endpoint}`);
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find(".editor-context").exists()).toBe(false);
    expect(wrapper.get(".version-editor textarea").attributes("aria-label")).toBe("Post text");
    expect(wrapper.find(".version-editor > .field > span").exists()).toBe(false);
    expect(wrapper.get(".media-attachments__toolbar").text()).not.toContain("attached");
    expect(wrapper.find(".row-status").exists()).toBe(false);
  });

  it("treats an empty X draft as text even when its stored format is short video", async () => {
    const xAccount = {
      ...account,
      id: "account-x",
      platform: "x",
      handle: "kieranofearth",
      displayName: "Kieran Butler",
    };
    const xPost = {
      ...post,
      versions: [{
        ...post.versions[0],
        id: "version-x",
        platform: "x" as const,
        targetAccountId: xAccount.id,
        format: "short_video" as const,
        bodyText: "Untitled draft",
        assetManifest: [],
      }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") return Promise.resolve({ posts: [xPost] });
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [xAccount] });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: {
          status: "installed",
          enabled: true,
          ready: true,
          statusLabel: "Installed",
          platformCapabilities: [
            platformCapability("x", {
              schedule: true,
              deliveryMode: "direct_publish",
            }),
          ],
        },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).not.toContain("Add one video.");
    expect(wrapper.find(".validation-issue").exists()).toBe(false);
    expect(wrapper.get(".post-preview--x .preview-avatar img").attributes("src"))
      .toBe(xAccount.avatarUrl);
    expect(wrapper.findAll(".post-preview--x .preview-actions svg")).toHaveLength(6);
  });

  it("keeps the editor actions minimal and moves Post now into the publish dialog", async () => {
    const textOnlyPost = {
      ...post,
      versions: [{
        ...post.versions[0],
        assetManifest: [],
      }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [textOnlyPost] });
      }
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [account] });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: {
          status: "installed",
          enabled: true,
          ready: true,
          statusLabel: "Installed",
          platformCapabilities: [
            platformCapability("linkedin", {
              schedule: true,
              deliveryMode: "direct_publish",
            }),
          ],
        },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });

    const wrapper = mountPage();
    await flushPromises();

    const actions = wrapper.get(".editor-actions");
    expect(actions.findAll("button").map((button) => button.text().trim())).toEqual([
      "Schedule",
      "",
    ]);
    expect(actions.find("[aria-label='Delete draft']").classes())
      .toContain("me3-btn--icon-only");
    expect(actions.find("[aria-label^='Review publishing checks']").exists()).toBe(false);
    const schedule = actions.findAll("button")
      .find((button) => button.text().trim() === "Schedule");
    expect(schedule?.classes()).toContain("me3-btn--neutral");
    expect(schedule?.attributes("disabled")).toBeUndefined();
    await schedule!.trigger("click");
    await flushPromises();

    expect(wrapper.get(".social-schedule-dialog h2").text()).toBe("Publish post");
    expect(wrapper.find(".social-schedule-dialog input[type='radio']").exists()).toBe(false);
    expect(wrapper.get(".social-schedule-dialog").text()).toContain("Post now");
    expect(wrapper.find(".social-schedule-dialog .publish-target-list").exists()).toBe(false);
    expect(wrapper.get(".social-schedule-dialog").text()).not.toContain("Timezone");
  });

  it("moves a Post into Scheduled immediately while its schedule is being saved", async () => {
    const textOnlyPost = {
      ...post,
      versions: [{ ...post.versions[0], assetManifest: [] }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [textOnlyPost] });
      }
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [account] });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: {
          status: "installed",
          enabled: true,
          ready: true,
          statusLabel: "Installed",
          platformCapabilities: [
            platformCapability("linkedin", {
              schedule: true,
              deliveryMode: "direct_publish",
            }),
          ],
        },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    let resolveApproval!: (value: { version: typeof textOnlyPost.versions[0] }) => void;
    vi.mocked(api.patch).mockReturnValue(new Promise((resolve) => {
      resolveApproval = resolve;
    }));
    vi.mocked(api.post).mockResolvedValue({
      publication: {
        id: "publication-scheduled",
        versionId: "version-1",
        platform: "linkedin",
        status: "scheduled",
        scheduledFor: "2099-07-30T09:00:00.000Z",
        timezone: "Europe/Dublin",
        queuedAt: null,
        platformPostId: null,
        platformPostUrl: null,
        publishedAt: null,
        failureClass: null,
        errorCode: null,
        errorMessage: null,
        requestedByType: "owner",
        requestedByUserId: "owner",
        requestContext: {},
        createdAt: "2099-07-28T08:00:00.000Z",
        updatedAt: "2099-07-28T08:00:00.000Z",
      },
    });

    const wrapper = mountPage();
    await flushPromises();
    const schedule = wrapper.findAll(".editor-actions button")
      .find((button) => button.text().trim() === "Schedule");
    await schedule!.trigger("click");
    await wrapper.get(".social-schedule-dialog input[type='date']").setValue("2099-07-30");
    await wrapper.get(".social-schedule-dialog input[type='time']").setValue("10:00");
    await wrapper.get(".social-schedule-dialog").trigger("submit");

    expect(wrapper.find(".social-schedule-dialog").exists()).toBe(false);
    expect(wrapper.find(".row-status").exists()).toBe(false);
    expect(wrapper.get(".workspace-tabs").text()).toContain("Scheduled1");
    expect(wrapper.get(".workspace-tabs__tab--active").text()).toContain("Drafts");

    resolveApproval({
      version: {
        ...textOnlyPost.versions[0],
        approvalStatus: "approved",
      },
    });
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith(
      "/social/versions/version-1/publications",
      expect.objectContaining({
        scheduledFor: expect.stringContaining("2099-07-30"),
        timezone: "Europe/Dublin",
      }),
    );
  });

  it("shows Post now as publishing before the network request completes", async () => {
    const textOnlyPost = {
      ...post,
      versions: [{ ...post.versions[0], assetManifest: [] }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [textOnlyPost] });
      }
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [account] });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: {
          status: "installed",
          enabled: true,
          ready: true,
          statusLabel: "Installed",
          platformCapabilities: [
            platformCapability("linkedin", {
              schedule: true,
              deliveryMode: "direct_publish",
            }),
          ],
        },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    let resolveApproval!: (value: { version: typeof textOnlyPost.versions[0] }) => void;
    vi.mocked(api.patch).mockReturnValue(new Promise((resolve) => {
      resolveApproval = resolve;
    }));
    vi.mocked(api.post).mockResolvedValue({
      publication: {
        id: "publication-queued",
        versionId: "version-1",
        platform: "linkedin",
        status: "queued",
        scheduledFor: null,
        timezone: null,
        queuedAt: "2026-07-28T08:00:00.000Z",
        platformPostId: null,
        platformPostUrl: null,
        publishedAt: null,
        failureClass: null,
        errorCode: null,
        errorMessage: null,
        requestedByType: "owner",
        requestedByUserId: "owner",
        requestContext: {},
        createdAt: "2026-07-28T08:00:00.000Z",
        updatedAt: "2026-07-28T08:00:00.000Z",
      },
    });

    const wrapper = mountPage();
    await flushPromises();
    const schedule = wrapper.findAll(".editor-actions button")
      .find((button) => button.text().trim() === "Schedule");
    await schedule!.trigger("click");
    const postNow = wrapper.findAll(".social-schedule-dialog button")
      .find((button) => button.text().trim() === "Post now");
    await postNow!.trigger("click");

    expect(wrapper.find(".row-status").exists()).toBe(false);
    expect(wrapper.get(".workspace-tabs").text()).toContain("Scheduled1");

    resolveApproval({
      version: {
        ...textOnlyPost.versions[0],
        approvalStatus: "approved",
      },
    });
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith("/social/versions/version-1/publish", {});
  });

  it("keeps one labelled delete action beside publishing actions and deletes the selected draft", async () => {
    let resolveDelete!: (value: { ok: true }) => void;
    vi.mocked(api.delete).mockReturnValue(new Promise((resolve) => {
      resolveDelete = resolve;
    }));
    const wrapper = mountPage();
    await flushPromises();

    const deleteActions = wrapper.findAll("[aria-label='Delete draft']");
    expect(deleteActions).toHaveLength(1);
    expect(deleteActions[0]!.element.closest(".editor-actions")).not.toBeNull();
    expect(wrapper.get(".detail-header button").attributes("aria-label"))
      .toBe("Back to social post list");
    expect(wrapper.find(".post-row > button:not(.post-row__select)").exists()).toBe(false);

    await deleteActions[0]!.trigger("click");
    expect(wrapper.get(".confirmation-dialog").text()).toContain(
      "Delete “Post copy https://example.com/story”? This cannot be undone.",
    );
    const confirmDelete = wrapper.get(".confirmation-dialog").findAll("button")
      .find((button) => button.text().trim() === "Delete");
    expect(confirmDelete).toBeTruthy();
    await confirmDelete!.trigger("click");

    expect(api.delete).toHaveBeenCalledWith(
      "/social/posts/post-1?expectedUpdatedAt=2026-07-18T07%3A00%3A00Z",
    );
    expect(wrapper.find(".post-detail").exists()).toBe(false);
    resolveDelete({ ok: true });
    await flushPromises();
  });

  it("removes a published Post from ME3 without implying the provider post is deleted", async () => {
    const publishedPost = {
      ...post,
      versions: [{
        ...post.versions[0],
        assetManifest: [],
        approvalStatus: "approved" as const,
        publicationStatus: "published" as const,
        platformPostUrl: "https://www.linkedin.com/feed/update/urn:li:activity:1",
        publishedAt: "2026-07-28T08:30:00.000Z",
      }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [publishedPost] });
      }
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [account] });
      if (endpoint === "/social/status") {
        return Promise.resolve({
          plugin: {
            status: "installed",
            enabled: true,
            ready: true,
            statusLabel: "Installed",
            platformCapabilities: [
              platformCapability("linkedin", {
                schedule: true,
                deliveryMode: "direct_publish",
              }),
            ],
          },
          hostedOAuth: { configured: false, platforms: [] },
        });
      }
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    vi.mocked(api.delete).mockResolvedValue({ ok: true });

    const wrapper = mountPage();
    await flushPromises();
    const publishedTab = wrapper.findAll(".workspace-tabs button")
      .find((button) => button.text().includes("Published"));
    await publishedTab!.trigger("click");
    await flushPromises();

    const removeAction = wrapper.get("[aria-label='Remove post from ME3']");
    expect(removeAction.classes()).toContain("me3-btn--icon-only");
    expect(removeAction.text()).toBe("");
    await removeAction.trigger("click");
    expect(wrapper.get(".confirmation-dialog").text()).toContain(
      "Published posts will stay on their social platforms.",
    );
    const confirmRemove = wrapper.get(".confirmation-dialog").findAll("button")
      .find((button) => button.text().trim() === "Remove from ME3");
    expect(confirmRemove).toBeTruthy();
    await confirmRemove!.trigger("click");
    await flushPromises();

    expect(api.delete).toHaveBeenCalledWith(
      "/social/posts/post-1?expectedUpdatedAt=2026-07-18T07%3A00%3A00Z",
    );
    expect(toastHarness.success).toHaveBeenCalledWith(
      "Post removed from ME3. Published social posts were not deleted.",
    );
  });

  it("deletes only the active platform draft when a Post has multiple platforms", async () => {
    const xAccount = {
      ...account,
      id: "account-x",
      platform: "x",
      handle: "@kieranofearth",
      displayName: "Kieran Butler",
    };
    const xVersion = {
      ...post.versions[0],
      id: "version-x",
      platform: "x" as const,
      targetAccountId: xAccount.id,
      assetManifest: [],
    };
    const multiPlatformPost = {
      ...post,
      versions: [
        { ...post.versions[0], assetManifest: [] },
        xVersion,
      ],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [multiPlatformPost] });
      }
      if (endpoint === "/social/accounts") {
        return Promise.resolve({ accounts: [account, xAccount] });
      }
      if (endpoint === "/social/status") {
        return Promise.resolve({
          plugin: {
            status: "installed",
            enabled: true,
            ready: true,
            statusLabel: "Installed",
            platformCapabilities: [
              platformCapability("linkedin", {
                schedule: true,
                deliveryMode: "direct_publish",
              }),
              platformCapability("x", {
                schedule: true,
                deliveryMode: "direct_publish",
              }),
            ],
          },
          hostedOAuth: { configured: false, platforms: [] },
        });
      }
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    vi.mocked(api.delete).mockResolvedValue({
      post: {
        ...multiPlatformPost,
        versions: [xVersion],
      },
    });

    const wrapper = mountPage();
    await flushPromises();
    await wrapper.get(".version-tab[title^='LinkedIn ·']").trigger("click");

    const deleteAction = wrapper.get("[aria-label='Delete LinkedIn draft']");
    await deleteAction.trigger("click");
    expect(wrapper.get(".confirmation-dialog").text()).toContain(
      "Remove LinkedIn from this Post? Other platform versions will be kept.",
    );
    const confirm = wrapper.get(".confirmation-dialog").findAll("button")
      .find((button) => button.text().trim() === "Remove LinkedIn");
    await confirm!.trigger("click");
    await flushPromises();

    expect(api.delete).toHaveBeenCalledWith("/social/versions/version-1");
    expect(wrapper.find(".version-tab[title^='LinkedIn ·']").exists()).toBe(false);
    expect(wrapper.find(".version-tab[title^='X ·']").exists()).toBe(true);
  });

  it("deletes the whole multi-platform Post from the All tab", async () => {
    const xAccount = {
      ...account,
      id: "account-x",
      platform: "x",
      handle: "@kieranofearth",
    };
    const multiPlatformPost = {
      ...post,
      versions: [
        { ...post.versions[0], assetManifest: [] },
        {
          ...post.versions[0],
          id: "version-x",
          platform: "x" as const,
          targetAccountId: xAccount.id,
          assetManifest: [],
        },
      ],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [multiPlatformPost] });
      }
      if (endpoint === "/social/accounts") {
        return Promise.resolve({ accounts: [account, xAccount] });
      }
      if (endpoint === "/social/status") {
        return Promise.resolve({
          plugin: {
            status: "installed",
            enabled: true,
            ready: true,
            statusLabel: "Installed",
            platformCapabilities: [
              platformCapability("linkedin", {
                schedule: true,
                deliveryMode: "direct_publish",
              }),
              platformCapability("x", {
                schedule: true,
                deliveryMode: "direct_publish",
              }),
            ],
          },
          hostedOAuth: { configured: false, platforms: [] },
        });
      }
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    vi.mocked(api.delete).mockResolvedValue({ ok: true });

    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.get(".version-tab--shared").classes()).toContain("version-tab--active");
    await wrapper.get(".editor-actions__delete").trigger("click");
    const confirm = wrapper.get(".confirmation-dialog").findAll("button")
      .find((button) => button.text().trim() === "Delete");
    await confirm!.trigger("click");
    await flushPromises();

    expect(api.delete).toHaveBeenCalledWith(
      "/social/posts/post-1?expectedUpdatedAt=2026-07-18T07%3A00%3A00Z",
    );
    expect(wrapper.find(".post-detail").exists()).toBe(false);
  });

  it("shows and orders scheduled posts by their scheduled date and time", async () => {
    const earlyScheduledAt = "2026-07-29T08:15:00.000Z";
    const lateScheduledAt = "2026-07-30T16:45:00.000Z";
    const scheduledPosts = [
      {
        ...post,
        post: {
          ...post.post,
          id: "post-later",
          ideaText: "Later scheduled post",
          updatedAt: "2026-07-26T09:00:00.000Z",
        },
        versions: [{
          ...post.versions[0],
          id: "version-later",
          postId: "post-later",
          bodyText: "Later scheduled post",
          scheduledFor: lateScheduledAt,
          publicationStatus: "scheduled" as const,
        }],
      },
      {
        ...post,
        post: {
          ...post.post,
          id: "post-earlier",
          ideaText: "Earlier scheduled post",
          updatedAt: "2026-07-25T09:00:00.000Z",
        },
        versions: [{
          ...post.versions[0],
          id: "version-earlier",
          postId: "post-earlier",
          bodyText: "Earlier scheduled post",
          scheduledFor: earlyScheduledAt,
          publicationStatus: "scheduled" as const,
        }],
      },
    ];
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: scheduledPosts });
      }
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [account] });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: {
          status: "installed",
          enabled: true,
          ready: true,
          statusLabel: "Installed",
          platformCapabilities: [
            platformCapability("linkedin", {
              schedule: true,
              deliveryMode: "direct_publish",
            }),
          ],
        },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });

    const wrapper = mountPage();
    await flushPromises();
    const scheduledTab = wrapper.findAll(".workspace-tabs button")
      .find((button) => button.text().includes("Scheduled"));
    expect(scheduledTab).toBeTruthy();
    await scheduledTab!.trigger("click");
    await flushPromises();

    const rows = wrapper.findAll(".post-row");
    expect(rows.map((row) => row.get("strong").text())).toEqual([
      "Earlier scheduled post",
      "Later scheduled post",
    ]);
    expect(rows[0]!.get(".post-row__schedule").text()).toContain("Scheduled for");
    expect(rows[0]!.get(".post-row__schedule time").attributes("datetime"))
      .toBe(earlyScheduledAt);
    expect(rows[1]!.get(".post-row__schedule time").attributes("datetime"))
      .toBe(lateScheduledAt);

    const deleteScheduled = wrapper.get("[aria-label='Delete draft']");
    await deleteScheduled.trigger("click");
    expect(wrapper.get(".confirmation-dialog").text()).toContain(
      "Cancel scheduled delivery and delete",
    );
  });

  it("requires an explicit destination choice and uses a platform preview", async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.findAll(".version-editor select")).toHaveLength(0);
    expect(wrapper.get(".post-preview--linkedin").text()).toContain("Kieran");
    expect(wrapper.get(".post-preview--linkedin .preview-avatar img").attributes("src"))
      .toBe(account.avatarUrl);
    expect(wrapper.findAll(".preview-media--gallery img")).toHaveLength(2);
    expect(wrapper.get(".preview-link-card").text()).toContain("example.com");
    vi.mocked(api.post).mockResolvedValue({
      post: {
        ...post,
        post: {
          ...post.post,
          id: "post-2",
          ideaText: "Untitled draft",
          updatedAt: "2026-07-18T08:30:00Z",
        },
        versions: [{
          ...post.versions[0],
          id: "version-2",
          postId: "post-2",
          bodyText: "Untitled draft",
        }],
      },
    });
    await wrapper.get("[aria-label='New Post']").trigger("click");
    await flushPromises();

    expect(api.post).not.toHaveBeenCalled();
    expect(
      (wrapper.get(".content-type-picker input[value='text']").element as HTMLInputElement).checked,
    ).toBe(true);
    expect(wrapper.findAll(".content-type-picker label").map((label) => label.text().trim()))
      .toEqual(["Short video", "Images", "Text"]);
    expect(wrapper.get(".social-destinations-dialog").text())
      .not.toContain("No platform is selected by default");
    expect(wrapper.find(".social-destinations-dialog > footer > span").exists()).toBe(false);
    await wrapper.get(".destination-option").trigger("click");
    const createDraft = wrapper.findAll("button").find((button) => button.text().includes("Create draft"));
    expect(createDraft).toBeTruthy();
    await createDraft!.trigger("click");
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith("/social/posts", expect.objectContaining({
      ideaText: "Untitled draft",
      versions: [expect.objectContaining({
        platform: "linkedin",
        targetAccountId: "account-linkedin",
        format: "post",
      })],
    }));
    expect(wrapper.find("#social-post-title").exists()).toBe(false);
    expect(wrapper.find(".version-editor input[type='text']").exists()).toBe(false);
    expect(wrapper.findAll(".platform-target")).toHaveLength(0);
  });

  it("keeps the empty state concise and gives a fresh YouTube draft a working title", async () => {
    const youtubeAccount = {
      ...account,
      id: "account-youtube",
      platform: "youtube",
      handle: "kieran-video",
      displayName: "Kieran Video",
    };
    const youtubePost = {
      post: {
        ...post.post,
        id: "post-youtube-draft",
        ideaText: "Untitled draft",
      },
      versions: [{
        ...post.versions[0],
        id: "version-youtube-draft",
        postId: "post-youtube-draft",
        platform: "youtube" as const,
        targetAccountId: youtubeAccount.id,
        format: "short_video" as const,
        title: "Untitled draft",
        bodyText: "Untitled draft",
        assetManifest: [],
      }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") return Promise.resolve({ posts: [] });
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [youtubeAccount] });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: {
          status: "installed",
          enabled: true,
          ready: true,
          statusLabel: "Installed",
          platformCapabilities: [
            platformCapability("youtube", {
              schedule: false,
              deliveryMode: "direct_publish",
            }),
          ],
        },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    vi.mocked(api.post).mockResolvedValue({ post: youtubePost });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get(".post-list .empty-state").text()).toBe("No drafts yet. Create a Post");
    expect(wrapper.text()).not.toContain("ask the agent to repurpose");
    await wrapper.get(".post-list .empty-state button").trigger("click");
    await wrapper.get(".content-type-picker input[value='short_video']").setValue();
    await wrapper.get(".destination-option").trigger("click");
    const createDraft = wrapper.findAll("button")
      .find((button) => button.text().includes("Create draft"));
    await createDraft!.trigger("click");
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith("/social/posts", expect.objectContaining({
      versions: [expect.objectContaining({
        platform: "youtube",
        title: "Untitled draft",
      })],
    }));
    expect((wrapper.get(".version-editor input[type='text']").element as HTMLInputElement).value)
      .toBe("Untitled draft");
  });

  it("shows a new draft immediately while account verification finishes", async () => {
    let resolveCreate!: (value: {
      post: typeof post;
    }) => void;
    vi.mocked(api.post).mockReturnValue(new Promise((resolve) => {
      resolveCreate = resolve;
    }));
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.get("[aria-label='New Post']").trigger("click");
    await wrapper.get(".destination-option").trigger("click");
    const createDraft = wrapper.findAll("button")
      .find((button) => button.text().includes("Create draft"));
    await createDraft!.trigger("click");

    expect(wrapper.find(".social-destinations-dialog").exists()).toBe(false);
    expect(wrapper.get(".post-detail").text()).toContain("Untitled draft");
    expect(wrapper.find(".editor-actions").exists()).toBe(false);
    expect(wrapper.find(".media-attachments").exists()).toBe(false);

    const createdPost = {
      post: {
        ...post.post,
        id: "post-optimistic",
        ideaText: "Untitled draft",
        updatedAt: "2026-07-28T08:30:00Z",
      },
      versions: [{
        ...post.versions[0],
        id: "version-optimistic",
        postId: "post-optimistic",
        bodyText: "Untitled draft",
      }],
    };
    resolveCreate({ post: createdPost });
    await flushPromises();

    expect(wrapper.get(".post-detail").text()).toContain("Untitled draft");
    expect(wrapper.find(".editor-actions").exists()).toBe(true);
    expect(wrapper.find(".social-destinations-dialog").exists()).toBe(false);
  });

  it("preserves image selection order, stable Files metadata, and unsaved caption text", async () => {
    vi.mocked(api.patch).mockImplementation(async (_endpoint, input) => ({
      version: {
        ...post.versions[0],
        assetManifest: (input as { assetManifest: typeof post.versions[0]["assetManifest"] }).assetManifest,
      },
    }));
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.get(".version-editor textarea").setValue("Unsaved body");
    const addMedia = wrapper.findAll("button").find((button) => button.text().includes("Add media"));
    expect(addMedia).toBeTruthy();
    await addMedia!.trigger("click");
    await flushPromises();

    const choices = wrapper.findAll(".social-media-picker__grid button");
    expect(choices).toHaveLength(3);
    await choices[1]!.trigger("click");
    await choices[0]!.trigger("click");

    expect(choices[1]!.attributes("aria-label")).toContain("selected 1");
    expect(choices[0]!.attributes("aria-label")).toContain("selected 2");
    const attach = wrapper.findAll("button").find((button) => button.text().includes("Add 2 images"));
    expect(attach).toBeTruthy();
    await attach!.trigger("click");
    await flushPromises();

    expect(api.patch).toHaveBeenCalledWith("/social/versions/version-1", {
      assetManifest: [
        { ...post.versions[0].assetManifest[0], assetIndex: 0 },
        { ...post.versions[0].assetManifest[1], assetIndex: 1 },
        {
          url: "/api/files/file-image-2/content",
          fileId: "file-image-2",
          filename: "second.png",
          mimeType: "image/png",
          kind: "image",
          altText: "second",
          contentHash: `sha256:${"2".repeat(64)}`,
          byteLength: 202,
          assetIndex: 2,
        },
        {
          url: "/api/files/file-image-1/content",
          fileId: "file-image-1",
          filename: "first.jpg",
          mimeType: "image/jpeg",
          kind: "image",
          altText: "first",
          contentHash: `sha256:${"1".repeat(64)}`,
          byteLength: 101,
          assetIndex: 3,
        },
      ],
    });
    expect((wrapper.get(".version-editor textarea").element as HTMLTextAreaElement).value)
      .toBe("Unsaved body");
  });

  it("uploads media into Files from the picker and selects the uploaded file", async () => {
    const uploadedFile = {
      id: "file-uploaded",
      folderId: null,
      filename: "uploaded.jpg",
      mimeType: "image/jpeg",
      size: 404,
      sha256: "4".repeat(64),
      status: "ready" as const,
      previewKind: "image" as const,
    };
    const defaultGet = vi.mocked(api.get).getMockImplementation()!;
    let uploadComplete = false;
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/files/items" && uploadComplete) {
        return Promise.resolve({ files: [...mediaFiles, uploadedFile] });
      }
      return defaultGet(endpoint);
    });
    vi.mocked(api.upload).mockImplementation(async () => {
      uploadComplete = true;
      return { ok: true, files: [uploadedFile] };
    });

    const wrapper = mountPage();
    await flushPromises();
    const addMedia = wrapper.findAll("button").find((button) => button.text().includes("Add media"));
    await addMedia!.trigger("click");
    await flushPromises();

    const file = new File(["image"], "uploaded.jpg", { type: "image/jpeg" });
    const input = wrapper.get<HTMLInputElement>(".social-media-picker__upload-input");
    Object.defineProperty(input.element, "files", {
      configurable: true,
      value: [file],
    });
    await input.trigger("change");
    await flushPromises();

    expect(api.upload).toHaveBeenCalledTimes(1);
    const [endpoint, form] = vi.mocked(api.upload).mock.calls[0]!;
    expect(endpoint).toBe("/files/upload");
    expect((form as FormData).get("files")).toBe(file);
    expect(wrapper.findAll(".social-media-picker__grid button")).toHaveLength(4);
    expect(wrapper.get('button[aria-label^="uploaded.jpg"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.text()).toContain("Add 1 image");
    expect(toastHarness.success).toHaveBeenCalledWith(
      "uploaded.jpg uploaded to Files and selected.",
    );
  });

  it("shows and saves a platform title only when YouTube requires it", async () => {
    const youtubeAccount = {
      ...account,
      id: "account-youtube",
      platform: "youtube",
      handle: "@kieran-video",
    };
    const youtubePost = {
      ...post,
      versions: [{
        ...post.versions[0],
        platform: "youtube",
        targetAccountId: youtubeAccount.id,
        title: "Original YouTube title",
      }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [youtubePost] });
      }
      if (endpoint === "/social/accounts") {
        return Promise.resolve({ accounts: [youtubeAccount] });
      }
      if (endpoint === "/social/status") {
        return Promise.resolve({
          plugin: {
            status: "installed",
            enabled: true,
            ready: true,
            statusLabel: "Installed",
            platformCapabilities: [
              platformCapability("youtube", {
                schedule: true,
                deliveryMode: "direct_publish",
              }),
            ],
          },
          hostedOAuth: { configured: false, platforms: [] },
        });
      }
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    vi.mocked(api.patch).mockImplementation(async (endpoint, input) => {
      if (endpoint === "/social/versions/version-1") {
        return {
          version: {
            ...youtubePost.versions[0],
            title: (input as { title: string }).title,
            bodyText: (input as { bodyText: string }).bodyText,
          },
        };
      }
      throw new Error(`Unexpected PATCH ${endpoint}`);
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find("#social-post-title").exists()).toBe(false);
    expect(wrapper.get(".field").text()).not.toContain("Post title");
    const titleInput = wrapper.get(".version-editor input[type='text']");
    expect((titleInput.element as HTMLInputElement).value).toBe("Original YouTube title");
    await titleInput.setValue("Saved YouTube title");
    await wrapper.get(".version-editor textarea").setValue("Saved body");
    await wrapper.get(".version-editor textarea").trigger("blur");
    await flushPromises();

    expect(api.patch).toHaveBeenCalledWith("/social/versions/version-1", {
      title: "Saved YouTube title",
      bodyText: "Saved body",
      targetAccountId: youtubeAccount.id,
    });
    expect((wrapper.get(".version-editor input[type='text']").element as HTMLInputElement).value)
      .toBe("Saved YouTube title");
    expect((wrapper.get(".version-editor textarea").element as HTMLTextAreaElement).value)
      .toBe("Saved body");
  });

  it("renders a YouTube Short as a simple portrait player preview", async () => {
    const youtubeAccount = {
      ...account,
      id: "account-youtube",
      platform: "youtube",
      handle: "kieran-video",
      displayName: "Kieran Video",
    };
    const youtubePost = {
      ...post,
      versions: [{
        ...post.versions[0],
        id: "version-youtube",
        platform: "youtube" as const,
        targetAccountId: youtubeAccount.id,
        format: "short_video" as const,
        title: "A quick field note",
        bodyText: "The full YouTube description.",
        assetManifest: [{
          url: "https://example.com/short.mp4",
          kind: "video" as const,
          mimeType: "video/mp4",
        }],
      }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") return Promise.resolve({ posts: [youtubePost] });
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [youtubeAccount] });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: { status: "installed", enabled: true, ready: true, statusLabel: "Installed", platformCapabilities: [
          platformCapability("youtube", { schedule: false, deliveryMode: "direct_publish" }),
        ] },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    vi.mocked(api.patch).mockImplementation(async (endpoint, input) => {
      if (endpoint === "/social/accounts/account-youtube/publishing-defaults") {
        return {
          publishingDefaults: input,
        };
      }
      throw new Error(`Unexpected PATCH ${endpoint}`);
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get(".post-preview--youtube-short").text()).toContain("YouTube Short");
    expect(wrapper.get(".youtube-short-preview__caption").text()).toContain("@kieran-video");
    expect(wrapper.get(".youtube-short-preview__caption").text()).toContain("A quick field note");
    expect(wrapper.get(".youtube-short-preview__caption img").attributes("src"))
      .toBe(youtubeAccount.avatarUrl);
    expect(wrapper.get(".youtube-short-preview__stage video").attributes("controls")).toBeDefined();
    expect(wrapper.find(".youtube-short-preview__controls").exists()).toBe(false);
    expect(wrapper.find(".preview-profile").exists()).toBe(false);

    const publish = wrapper.get(".editor-actions").findAll("button")
      .find((button) => button.text().trim() === "Upload");
    await publish!.trigger("click");
    await flushPromises();

    const settingsDialog = wrapper.get(".youtube-settings-dialog");
    expect(settingsDialog.get("h2").text()).toBe("YouTube publishing");
    expect(settingsDialog.text()).toContain("Uploading to");
    expect(settingsDialog.text()).toContain("Kieran Video");
    expect(settingsDialog.findAll("select option").map((option) => option.text())).toEqual([
      "Choose visibility",
      "Private",
      "Unlisted",
      "Public",
    ]);
    expect((settingsDialog.get("select").element as HTMLSelectElement).value).toBe("public");
    await settingsDialog.get("select").setValue("unlisted");
    await settingsDialog.get("input[type='radio'][value='no']").setValue();
    await settingsDialog.get("input[type='checkbox']").setValue(true);
    await settingsDialog.trigger("submit");
    await flushPromises();

    expect(api.patch).toHaveBeenCalledWith(
      "/social/accounts/account-youtube/publishing-defaults",
      {
        youtube: {
          privacyStatus: "unlisted",
          madeForKids: false,
          containsSyntheticMedia: true,
        },
      },
    );
    expect(wrapper.find(".platform-publish-readiness").exists()).toBe(false);
    expect(wrapper.get(".editor-actions__settings").text()).toBe("YouTube settings");

    const upload = wrapper.get(".editor-actions").findAll("button")
      .find((button) => button.text().trim() === "Upload");
    await upload!.trigger("click");
    await flushPromises();

    const dialog = wrapper.get(".social-schedule-dialog");
    expect(dialog.get("h2").text()).toBe("Upload to YouTube");
    expect(dialog.text()).toContain(
      "Review the saved YouTube settings, then upload this Short.",
    );
    expect(dialog.text()).toContain("Unlisted · Not made for kids · Altered or synthetic");
    expect(dialog.text()).toContain("Upload now");
    expect(dialog.text()).not.toContain("choose a date and time");
    expect(dialog.find(".schedule-fields").exists()).toBe(false);
  });

  it("autosaves text changes after the journal-style debounce", async () => {
    vi.useFakeTimers();
    vi.mocked(api.patch).mockImplementation(async (_endpoint, input) => ({
      version: {
        ...post.versions[0],
        bodyText: (input as { bodyText: string }).bodyText,
      },
    }));
    const wrapper = mountPage();
    try {
      await flushPromises();
      await wrapper.get(".version-editor textarea").setValue("Autosaved body");

      expect(api.patch).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(699);
      expect(api.patch).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await flushPromises();

      expect(api.patch).toHaveBeenCalledWith("/social/versions/version-1", {
        bodyText: "Autosaved body",
        targetAccountId: "account-linkedin",
      });
      expect(wrapper.get(".editor-actions").text()).not.toContain("Save Draft");
    } finally {
      wrapper.unmount();
      vi.useRealTimers();
    }
  });

  it("keeps a platform edit when switching tabs before autosave finishes", async () => {
    vi.useFakeTimers();
    const xAccount = {
      ...account,
      id: "account-x",
      platform: "x",
      handle: "@kieranofearth",
      displayName: "Kieran Butler",
    };
    const multiPlatformPost = {
      ...post,
      versions: [
        { ...post.versions[0], assetManifest: [], bodyText: "LinkedIn original" },
        {
          ...post.versions[0],
          id: "version-x",
          platform: "x" as const,
          targetAccountId: xAccount.id,
          bodyText: "X original",
          assetManifest: [],
        },
      ],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [multiPlatformPost] });
      }
      if (endpoint === "/social/accounts") {
        return Promise.resolve({ accounts: [account, xAccount] });
      }
      if (endpoint === "/social/status") {
        return Promise.resolve({
          plugin: {
            status: "installed",
            enabled: true,
            ready: true,
            statusLabel: "Installed",
            platformCapabilities: [
              platformCapability("linkedin", {
                schedule: true,
                deliveryMode: "direct_publish",
              }),
              platformCapability("x", {
                schedule: true,
                deliveryMode: "direct_publish",
              }),
            ],
          },
          hostedOAuth: { configured: false, platforms: [] },
        });
      }
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    vi.mocked(api.patch).mockImplementation(async (endpoint, input) => {
      const version = multiPlatformPost.versions.find(
        (item) => endpoint.endsWith(item.id),
      )!;
      return { version: { ...version, ...(input as Record<string, unknown>) } };
    });

    const wrapper = mountPage();
    try {
      await flushPromises();
      await wrapper.get(".version-tab[title^='LinkedIn ·']").trigger("click");
      await wrapper.get(".version-editor textarea").setValue("LinkedIn edited");
      await wrapper.get(".version-tab[title^='X ·']").trigger("click");
      expect((wrapper.get(".version-editor textarea").element as HTMLTextAreaElement).value)
        .toBe("X original");
      await wrapper.get(".version-tab[title^='LinkedIn ·']").trigger("click");
      expect((wrapper.get(".version-editor textarea").element as HTMLTextAreaElement).value)
        .toBe("LinkedIn edited");

      await vi.advanceTimersByTimeAsync(700);
      await flushPromises();
      expect(api.patch).toHaveBeenCalledWith("/social/versions/version-1", {
        bodyText: "LinkedIn edited",
        targetAccountId: "account-linkedin",
      });
      expect((wrapper.get(".version-editor textarea").element as HTMLTextAreaElement).value)
        .toBe("LinkedIn edited");
    } finally {
      wrapper.unmount();
      vi.useRealTimers();
    }
  });

  it("renders an image-rich link card for LinkedIn and X captions", async () => {
    vi.useFakeTimers();
    const textOnlyPost = {
      ...post,
      versions: [{ ...post.versions[0], assetManifest: [] }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [textOnlyPost] });
      }
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [account] });
      if (endpoint === "/social/status") {
        return Promise.resolve({
          plugin: {
            status: "installed",
            enabled: true,
            ready: true,
            statusLabel: "Installed",
            platformCapabilities: [
              platformCapability("linkedin", {
                schedule: true,
                deliveryMode: "direct_publish",
              }),
            ],
          },
          hostedOAuth: { configured: false, platforms: [] },
        });
      }
      if (endpoint.startsWith("/social/link-preview?url=")) {
        return Promise.resolve({
          preview: {
            url: "https://example.com/story",
            title: "A useful visual story",
            description: "The short version of the story.",
            imageUrl: "https://example.com/card.jpg",
            siteName: "Example",
          },
        });
      }
      throw new Error(`Unexpected GET ${endpoint}`);
    });

    const wrapper = mountPage();
    try {
      await flushPromises();
      await vi.advanceTimersByTimeAsync(350);
      await flushPromises();

      const card = wrapper.get(".preview-link-card");
      expect(card.text()).toContain("A useful visual story");
      expect(card.text()).toContain("The short version of the story.");
      expect(card.get("img").attributes("src")).toBe("https://example.com/card.jpg");
      expect(api.get).toHaveBeenCalledWith(
        `/social/link-preview?url=${encodeURIComponent("https://example.com/story")}`,
      );
    } finally {
      wrapper.unmount();
      vi.useRealTimers();
    }
  });

  it("keeps video selection exclusive in the Files picker", async () => {
    const wrapper = mountPage();
    await flushPromises();

    const addMedia = wrapper.findAll("button").find((button) => button.text().includes("Add media"));
    await addMedia!.trigger("click");
    await flushPromises();
    expect(vi.mocked(api.get).mock.calls.filter(([endpoint]) =>
      endpoint === "/files/folders" || endpoint === "/files/items"
    )).toHaveLength(2);
    const cancel = wrapper.findAll(".social-media-picker button")
      .find((button) => button.text().trim() === "Cancel");
    await cancel!.trigger("click");
    await addMedia!.trigger("click");
    await flushPromises();
    expect(vi.mocked(api.get).mock.calls.filter(([endpoint]) =>
      endpoint === "/files/folders" || endpoint === "/files/items"
    )).toHaveLength(2);
    const choices = wrapper.findAll(".social-media-picker__grid button");
    await choices[0]!.trigger("click");
    await choices[2]!.trigger("click");

    expect(choices[0]!.attributes("aria-selected")).toBe("false");
    expect(choices[2]!.attributes("aria-selected")).toBe("true");
    expect(wrapper.text()).toContain("Add 1 video");
    expect(wrapper.findAll(".social-media-picker__grid video")).toHaveLength(1);
  });

  it("bulk-edits shared copy while preserving truthful platform delivery modes", async () => {
    const instagramAccount = {
      ...account,
      id: "account-instagram",
      platform: "instagram",
      handle: "kieran",
      displayName: "Kieran on Instagram",
    };
    const tiktokAccount = {
      ...account,
      id: "account-tiktok",
      platform: "tiktok",
      handle: "kieranofearth",
      displayName: "kieranofearth",
    };
    const sharedVideo = {
      url: "https://example.com/short.mp4",
      kind: "video" as const,
      mimeType: "video/mp4",
      byteLength: 303,
    };
    const multiPlatformPost = {
      ...post,
      versions: [
        {
          ...post.versions[0],
          id: "version-instagram",
          platform: "instagram" as const,
          targetAccountId: instagramAccount.id,
          bodyText: "Shared short caption.",
          assetManifest: [sharedVideo],
        },
        {
          ...post.versions[0],
          id: "version-tiktok",
          platform: "tiktok" as const,
          targetAccountId: tiktokAccount.id,
          bodyText: "Shared short caption.",
          assetManifest: [sharedVideo],
        },
      ],
    };

    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [multiPlatformPost] });
      }
      if (endpoint === "/social/accounts") {
        return Promise.resolve({ accounts: [instagramAccount, tiktokAccount] });
      }
      if (endpoint === "/social/status") {
        return Promise.resolve({
          plugin: {
            status: "installed",
            enabled: true,
            ready: true,
            statusLabel: "Installed",
            platformCapabilities: [
              platformCapability("instagram", {
                schedule: true,
                deliveryMode: "direct_publish",
              }),
              platformCapability("tiktok", {
                schedule: false,
                deliveryMode: "provider_draft",
              }),
            ],
          },
          hostedOAuth: { configured: false, platforms: [] },
        });
      }
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    vi.mocked(api.patch).mockImplementation(async (endpoint, input) => {
      const versionId = endpoint.split("/").at(-1);
      const version = multiPlatformPost.versions.find((item) => item.id === versionId)!;
      return { version: { ...version, ...(input as Record<string, unknown>) } };
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get(".version-tab--shared").classes()).toContain("version-tab--active");
    expect(wrapper.get(".version-tab--shared").find("svg").exists()).toBe(false);
    expect(wrapper.find(".publishing-checks").exists()).toBe(false);
    expect(wrapper.get(".version-workspace").classes()).toContain("version-workspace--shared");
    expect(wrapper.text()).not.toContain("All selected platforms");
    expect(wrapper.text()).not.toContain("Shared edits replace copy and media");
    expect(wrapper.find("[aria-label^='Review publishing checks']").exists()).toBe(false);
    expect(wrapper.get(".editor-actions").text()).not.toContain("Post now");
    expect(wrapper.get(".editor-actions").text()).toContain("Publish");
    expect(wrapper.get(".editor-actions").text()).not.toContain("Send to TikTok");
    const scheduleButton = wrapper.findAll(".editor-actions button")
      .find((button) => button.text().trim() === "Publish");
    expect(scheduleButton?.attributes("disabled")).toBeUndefined();
    expect(wrapper.findAll(".social-account-avatar__image").length).toBeGreaterThan(0);

    await wrapper.get(".version-editor textarea").setValue("Revised shared caption.");
    await wrapper.get(".version-editor textarea").trigger("blur");
    await flushPromises();

    const versionUpdates = vi.mocked(api.patch).mock.calls.filter(
      ([endpoint]) => endpoint.startsWith("/social/versions/"),
    );
    expect(versionUpdates).toHaveLength(2);
    expect(versionUpdates.map(([, input]) => input)).toEqual([
      expect.objectContaining({ bodyText: "Revised shared caption." }),
      expect.objectContaining({ bodyText: "Revised shared caption." }),
    ]);
  });

  it("renders an Instagram short video as a simple Reels preview", async () => {
    const instagramAccount = {
      ...account,
      id: "account-instagram",
      platform: "instagram",
      handle: "kieran",
      displayName: "Kieran on Instagram",
    };
    const instagramPost = {
      ...post,
      versions: [{
        ...post.versions[0],
        id: "version-instagram",
        platform: "instagram" as const,
        targetAccountId: instagramAccount.id,
        format: "short_video" as const,
        bodyText: "A short Reel caption.",
        assetManifest: [{
          url: "https://example.com/reel.mp4",
          kind: "video" as const,
          mimeType: "video/mp4",
        }],
      }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") return Promise.resolve({ posts: [instagramPost] });
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [instagramAccount] });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: { status: "installed", enabled: true, ready: true, statusLabel: "Installed", platformCapabilities: [
          platformCapability("instagram", { schedule: true, deliveryMode: "direct_publish" }),
        ] },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get(".post-preview--instagram-reel").text()).toContain("Instagram Reel");
    expect(wrapper.get(".instagram-reel-preview__topbar").text()).toContain("Reels");
    expect(wrapper.get(".instagram-reel-preview__caption").text()).toContain("@kieran");
    expect(wrapper.get(".instagram-reel-preview__caption").text()).toContain("A short Reel caption.");
    expect(wrapper.get(".instagram-reel-preview__caption img").attributes("src"))
      .toBe(instagramAccount.avatarUrl);
    expect(wrapper.find(".instagram-reel-preview__rail").exists()).toBe(true);
    expect(wrapper.get(".instagram-reel-preview__stage video").attributes("controls")).toBeDefined();
    expect(wrapper.find(".preview-profile").exists()).toBe(false);
  });

  it("renders TikTok video previews with the caption at the bottom of the stage", async () => {
    const tiktokAccount = {
      ...account,
      id: "account-tiktok",
      platform: "tiktok",
      handle: "kieranofearth",
      displayName: "kieranofearth",
    };
    const tiktokPost = {
      ...post,
      versions: [{
        ...post.versions[0],
        id: "version-tiktok",
        platform: "tiktok" as const,
        targetAccountId: "account-tiktok",
        bodyText: "Greetings Earthling 🌍",
        assetManifest: [{ url: "https://example.com/short.mp4", kind: "video" as const, mimeType: "video/mp4" }],
      }],
    };

    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") return Promise.resolve({ posts: [tiktokPost] });
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [tiktokAccount] });
      if (endpoint === "/files/folders") return Promise.resolve({ folders: [] });
      if (endpoint === "/files/items") return Promise.resolve({ files: mediaFiles });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: { status: "installed", enabled: true, ready: true, statusLabel: "Installed", platformCapabilities: [
          platformCapability("tiktok", { schedule: false, deliveryMode: "provider_draft" }),
        ] },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get(".post-preview--tiktok .tiktok-preview__stage")).toBeTruthy();
    expect(wrapper.find(".post-preview--tiktok > p").exists()).toBe(false);
    expect(wrapper.get(".tiktok-preview__caption").text()).toContain("Greetings Earthling");
    expect(wrapper.find(".tiktok-preview__rail").exists()).toBe(true);
    expect(wrapper.get(".tiktok-preview__profile-avatar img").attributes("src"))
      .toBe(tiktokAccount.avatarUrl);
    expect(wrapper.find(".tiktok-preview__topbar").exists()).toBe(false);
    expect(wrapper.find(".tiktok-preview__draft-toast").exists()).toBe(false);
    expect(wrapper.find(".tiktok-preview__footer").exists()).toBe(false);
    expect(wrapper.get(".tiktok-preview__stage video").attributes("controls")).toBeDefined();
  });

  it("keeps provider failures visible after reload and allows an intentional retry", async () => {
    const tiktokAccount = {
      ...account,
      id: "account-tiktok",
      platform: "tiktok",
      handle: "kieranofearth",
      displayName: "kieranofearth",
    };
    const failedMessage = "TikTok could not import the video from this media URL.";
    const failedPost = {
      ...post,
      versions: [{
        ...post.versions[0],
        id: "version-tiktok",
        platform: "tiktok" as const,
        targetAccountId: tiktokAccount.id,
        bodyText: "Greetings Earthling 🌍",
        assetManifest: [{
          url: "https://example.com/short.mp4",
          kind: "video" as const,
          mimeType: "video/mp4",
        }],
        publicationStatus: "failed" as const,
        failureClass: "retryable" as const,
        errorMessage: failedMessage,
      }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [failedPost] });
      }
      if (endpoint === "/social/accounts") {
        return Promise.resolve({ accounts: [tiktokAccount] });
      }
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: {
          status: "installed",
          enabled: true,
          ready: true,
          statusLabel: "Installed",
          platformCapabilities: [
            platformCapability("tiktok", {
              schedule: false,
              deliveryMode: "provider_draft",
            }),
          ],
        },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get(".delivery-error-banner").text())
      .toContain("TikTok delivery failed");
    expect(wrapper.get(".delivery-error-banner").text()).toContain(failedMessage);
    const schedule = wrapper.findAll(".editor-actions button")
      .find((button) => button.text().trim() === "Publish");
    expect(schedule?.attributes("disabled")).toBeUndefined();
    await schedule!.trigger("click");
    const postNow = wrapper.findAll(".social-schedule-dialog button")
      .find((button) => button.text().trim() === "Post now");
    expect(postNow?.attributes("disabled")).toBeUndefined();
  });

  it("prevents duplicate publishing while a destination is already queued", async () => {
    const tiktokAccount = {
      ...account,
      id: "account-tiktok",
      platform: "tiktok",
      handle: "kieranofearth",
      displayName: "kieranofearth",
    };
    const queuedPost = {
      ...post,
      versions: [{
        ...post.versions[0],
        id: "version-tiktok",
        platform: "tiktok" as const,
        targetAccountId: tiktokAccount.id,
        bodyText: "Greetings Earthling 🌍",
        assetManifest: [{
          url: "https://example.com/short.mp4",
          kind: "video" as const,
          mimeType: "video/mp4",
        }],
        publicationStatus: "queued" as const,
      }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [queuedPost] });
      }
      if (endpoint === "/social/accounts") {
        return Promise.resolve({ accounts: [tiktokAccount] });
      }
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: {
          status: "installed",
          enabled: true,
          ready: true,
          statusLabel: "Installed",
          platformCapabilities: [
            platformCapability("tiktok", {
              schedule: false,
              deliveryMode: "provider_draft",
            }),
          ],
        },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });

    const wrapper = mountPage();
    await flushPromises();
    const scheduledTab = wrapper.findAll(".workspace-tabs button")
      .find((button) => button.text().includes("Scheduled"));
    await scheduledTab!.trigger("click");
    await flushPromises();

    expect(wrapper.find(".row-status").exists()).toBe(false);
    const schedule = wrapper.findAll(".editor-actions button")
      .find((button) => button.text().trim() === "Publish");
    expect(schedule?.attributes("disabled")).toBeDefined();
    expect(wrapper.findAll(".editor-actions button")
      .some((button) => button.text().trim() === "Post now")).toBe(false);
  });

  it("allows a needs-review Post to be removed without discarding delivery history", async () => {
    const needsReviewPost = {
      ...post,
      versions: [{
        ...post.versions[0],
        assetManifest: [],
        publicationStatus: "publishing" as const,
        failureClass: "outcome_unknown" as const,
        errorCode: "outcome_unknown:provider_write_started",
        errorMessage: "Check X before trying again.",
      }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [needsReviewPost] });
      }
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [account] });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: {
          status: "installed",
          enabled: true,
          ready: true,
          statusLabel: "Installed",
          platformCapabilities: [
            platformCapability("linkedin", {
              schedule: true,
              deliveryMode: "direct_publish",
            }),
          ],
        },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });

    const wrapper = mountPage();
    await flushPromises();
    const scheduledTab = wrapper.findAll(".workspace-tabs button")
      .find((button) => button.text().includes("Scheduled"));
    await scheduledTab!.trigger("click");

    expect(wrapper.find(".row-status").exists()).toBe(false);
    expect(wrapper.get(".delivery-error-banner").text()).toContain("Check X before trying again.");
    const deleteAction = wrapper.get("[aria-label='Delete draft']");
    await deleteAction.trigger("click");
    expect(wrapper.get(".confirmation-dialog").text()).toContain(
      "Delivery history will be retained.",
    );
  });

  it("labels retryable queue failures clearly and lets the owner stop retries and delete", async () => {
    const retryingPost = {
      ...post,
      versions: [{
        ...post.versions[0],
        assetManifest: [],
        publicationStatus: "queued" as const,
        failureClass: "retryable" as const,
        errorMessage: "LinkedIn did not finish preparing the post.",
      }],
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") {
        return Promise.resolve({ posts: [retryingPost] });
      }
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [account] });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: {
          status: "installed",
          enabled: true,
          ready: true,
          statusLabel: "Installed",
          platformCapabilities: [
            platformCapability("linkedin", {
              schedule: true,
              deliveryMode: "direct_publish",
            }),
          ],
        },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    vi.mocked(api.delete).mockResolvedValue({ ok: true });

    const wrapper = mountPage();
    await flushPromises();
    const scheduledTab = wrapper.findAll(".workspace-tabs button")
      .find((button) => button.text().includes("Scheduled"));
    await scheduledTab!.trigger("click");
    await flushPromises();

    expect(wrapper.find(".row-status").exists()).toBe(false);
    const checks = wrapper.get("[aria-label^='Review publishing checks']");
    expect(checks.classes()).toContain("me3-btn--ghost");
    expect(checks.classes()).not.toContain("me3-btn--outline");
    await checks.trigger("click");
    expect(wrapper.get(".publishing-checks-dialog").text())
      .toContain("Retrying automatically");
    const deleteAction = wrapper.get("[aria-label='Delete draft']");
    await deleteAction.trigger("click");
    expect(wrapper.get(".confirmation-dialog").text()).toContain(
      "Stop pending retries and delete “Post copy https://example.com/story”",
    );
    const confirmDelete = wrapper.get(".confirmation-dialog").findAll("button")
      .find((button) => button.text().trim() === "Delete");
    expect(confirmDelete).toBeTruthy();
    await confirmDelete!.trigger("click");
    await flushPromises();

    expect(api.delete).toHaveBeenCalledWith(
      "/social/posts/post-1?expectedUpdatedAt=2026-07-18T07%3A00%3A00Z",
    );
  });

  it("copies the TikTok caption and submits an explicitly configured Direct Post", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const tiktokAccount = {
      ...account,
      id: "account-tiktok",
      platform: "tiktok",
      handle: "kieranofearth",
      displayName: "Kieran on TikTok",
      scopes: ["user.info.basic", "video.upload", "video.publish"],
    };
    const tiktokVersion = {
      ...post.versions[0],
      id: "version-tiktok",
      platform: "tiktok" as const,
      targetAccountId: "account-tiktok",
      bodyText: "Greetings Earthling 🌍 #ME3",
      assetManifest: [{
        url: "/api/files/file-video-1/content",
        fileId: "file-video-1",
        kind: "video" as const,
        mimeType: "video/mp4",
        byteLength: 303,
      }],
    };
    const tiktokPost = { ...post, versions: [tiktokVersion] };

    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") return Promise.resolve({ posts: [tiktokPost] });
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [tiktokAccount] });
      if (endpoint === "/files/folders") return Promise.resolve({ folders: [] });
      if (endpoint === "/files/items") return Promise.resolve({ files: mediaFiles });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: {
          status: "installed",
          enabled: true,
          ready: true,
          statusLabel: "Installed",
          platformCapabilities: [
            platformCapability("tiktok", {
              schedule: false,
              deliveryMode: "provider_draft",
            }),
          ],
        },
        hostedOAuth: { configured: true, platforms: ["tiktok"] },
      });
      if (endpoint === "/social/accounts/account-tiktok/tiktok/creator-info") {
        return Promise.resolve({
          creatorInfo: {
            avatarUrl: "https://cdn.test/tiktok.jpg",
            username: "kieranofearth",
            nickname: "Kieran on TikTok",
            privacyLevelOptions: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
            commentDisabled: false,
            duetDisabled: true,
            stitchDisabled: false,
            maxVideoPostDurationSeconds: 60,
          },
        });
      }
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    let persistedTikTokVersion = { ...tiktokVersion } as PostVersion;
    vi.mocked(api.patch).mockImplementation(async (_endpoint, input) => {
      persistedTikTokVersion = {
        ...persistedTikTokVersion,
        ...(input as Partial<PostVersion>),
        approvalStatus: "approved",
      } as PostVersion;
      return { version: persistedTikTokVersion };
    });
    vi.mocked(api.post).mockResolvedValue({
      publication: {
        id: "publication-tiktok-direct",
        versionId: "version-tiktok",
        platform: "tiktok",
        status: "queued",
        scheduledFor: null,
        timezone: null,
        queuedAt: null,
        platformPostId: null,
        platformPostUrl: null,
        publishedAt: null,
        failureClass: null,
        errorCode: null,
        errorMessage: null,
        requestedByType: "owner",
        requestedByUserId: "owner",
        requestContext: {},
        createdAt: "2026-07-25T12:00:00.000Z",
        updatedAt: "2026-07-25T12:00:00.000Z",
      },
    });

    const wrapper = mountPage();
    await flushPromises();

    const video = wrapper.get("video.tiktok-preview__media").element;
    Object.defineProperty(video, "duration", { configurable: true, value: 12.4 });
    await wrapper.get("video.tiktok-preview__media").trigger("loadedmetadata");

    const copyCaption = wrapper.get("[aria-label='Copy TikTok caption']");
    await copyCaption.trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith("Greetings Earthling 🌍 #ME3");
    expect(wrapper.find("[aria-label='TikTok caption copied']").exists()).toBe(true);

    const schedule = wrapper.findAll(".editor-actions button").find(
      (button) => button.text().trim() === "Publish",
    );
    await schedule!.trigger("click");
    await flushPromises();

    expect((
      wrapper.get(".tiktok-settings-dialog input[value='direct_publish']")
        .element as HTMLInputElement
    ).checked).toBe(true);
    expect(wrapper.get(".tiktok-settings-dialog .tiktok-direct-post__creator").text())
      .toContain("Kieran on TikTok");
    expect(wrapper.get(".tiktok-settings-dialog .tiktok-direct-post__duration").text())
      .toContain("Video length: 13 seconds");
    expect(wrapper.get(".tiktok-settings-dialog .tiktok-direct-post__checks").text())
      .toContain("Unavailable in TikTok settings");
    expect(wrapper.find(".tiktok-direct-post__review-note").exists()).toBe(false);
    expect((
      wrapper.get(".tiktok-settings-dialog .tiktok-direct-post select")
        .element as HTMLSelectElement
    ).value).toBe("");
    expect((
      wrapper.get(".tiktok-settings-dialog .tiktok-direct-post__consent input")
        .element as HTMLInputElement
    ).checked).toBe(false);
    expect(wrapper.find(".platform-publish-readiness").exists()).toBe(false);
    expect(wrapper.get(".editor-actions__settings").text()).toBe("Review settings");

    await wrapper.get(".tiktok-settings-dialog .tiktok-direct-post select")
      .setValue("PUBLIC_TO_EVERYONE");
    await wrapper.get(".tiktok-settings-dialog .tiktok-direct-post__consent input")
      .setValue(true);
    const allowComments = wrapper
      .findAll(".tiktok-settings-dialog .tiktok-direct-post__checks label")
      .find((label) => label.text().includes("Comments"));
    await allowComments!.get("input").setValue(true);

    const saveSettings = wrapper.findAll(".tiktok-settings-dialog button").find(
      (button) => button.text().trim() === "Save TikTok settings",
    );
    expect(saveSettings?.attributes("disabled")).toBeUndefined();
    await saveSettings!.trigger("click");
    await flushPromises();

    expect(api.patch).toHaveBeenCalledWith(
      "/social/versions/version-tiktok",
      {
        publishingSettings: {
          tiktok: {
            deliveryMode: "direct_publish",
            privacyLevel: "PUBLIC_TO_EVERYONE",
            allowComment: true,
            allowDuet: false,
            allowStitch: false,
            brandContent: false,
            brandOrganic: false,
            isAiGenerated: false,
            consent: true,
            videoDurationSeconds: 12.4,
          },
        },
      },
    );

    const readySchedule = wrapper.findAll(".editor-actions button").find(
      (button) => button.text().trim() === "Publish",
    );
    await readySchedule!.trigger("click");
    await flushPromises();

    const postNow = wrapper.findAll(".social-schedule-dialog button").find(
      (button) => button.text().trim() === "Post now",
    );
    expect(postNow?.attributes("disabled")).toBeUndefined();
    await postNow!.trigger("click");
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith(
      "/social/versions/version-tiktok/publish",
      {
        requestContext: {
          surface: "social-editor",
          batch: false,
          tiktok: {
            deliveryMode: "direct_publish",
            privacyLevel: "PUBLIC_TO_EVERYONE",
            allowComment: true,
            allowDuet: false,
            allowStitch: false,
            brandContent: false,
            brandOrganic: false,
            isAiGenerated: false,
            consent: true,
            videoDurationSeconds: 12.4,
          },
        },
      },
    );
  });

  it("shows a TikTok delivery failure instead of a success confirmation", async () => {
    const tiktokAccount = {
      ...account,
      id: "account-tiktok",
      platform: "tiktok",
      handle: "kieranofearth",
      displayName: "kieranofearth",
    };
    const tiktokVersion = {
      ...post.versions[0],
      id: "version-tiktok",
      platform: "tiktok" as const,
      targetAccountId: "account-tiktok",
      bodyText: "Greetings Earthling 🌍",
      publishingSettings: {
        tiktok: { deliveryMode: "provider_draft" as const },
      },
      assetManifest: [{
        url: "/api/files/file-video-1/content",
        fileId: "file-video-1",
        kind: "video" as const,
        mimeType: "video/mp4",
        byteLength: 303,
      }],
    };
    const tiktokPost = {
      ...post,
      versions: [tiktokVersion],
    };

    vi.mocked(api.get).mockImplementation((endpoint: string) => {
      if (endpoint === "/social/posts?siteId=site-1") return Promise.resolve({ posts: [tiktokPost] });
      if (endpoint === "/social/accounts") return Promise.resolve({ accounts: [tiktokAccount] });
      if (endpoint === "/files/folders") return Promise.resolve({ folders: [] });
      if (endpoint === "/files/items") return Promise.resolve({ files: mediaFiles });
      if (endpoint === "/social/status") return Promise.resolve({
        plugin: { status: "installed", enabled: true, ready: true, statusLabel: "Installed", platformCapabilities: [
          platformCapability("tiktok", { schedule: false, deliveryMode: "provider_draft" }),
        ] },
        hostedOAuth: { configured: false, platforms: [] },
      });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    vi.mocked(api.patch).mockResolvedValue({
      version: { ...tiktokVersion, approvalStatus: "approved" },
    });
    vi.mocked(api.post).mockResolvedValue({
      publication: {
        id: "publication-tiktok-failed",
        versionId: "version-tiktok",
        platform: "tiktok",
        status: "failed",
        scheduledFor: null,
        timezone: null,
        queuedAt: null,
        platformPostId: null,
        platformPostUrl: null,
        publishedAt: null,
        failureClass: "retryable",
        errorCode: "retryable:media_delivery_setup",
        errorMessage: "ME3 needs an exact public API origin before private Files media can be delivered.",
        requestedByType: "owner",
        requestedByUserId: "owner",
        requestContext: {},
        createdAt: "2026-07-25T12:00:00.000Z",
        updatedAt: "2026-07-25T12:00:01.000Z",
      },
    });

    const wrapper = mountPage();
    await flushPromises();

    const schedule = wrapper.findAll(".editor-actions button").find(
      (button) => button.text().trim() === "Publish",
    );
    expect(schedule).toBeTruthy();
    await schedule!.trigger("click");
    const postNow = wrapper.findAll(".social-schedule-dialog button").find(
      (button) => button.text().trim() === "Post now",
    );
    expect(postNow).toBeTruthy();
    await postNow!.trigger("click");
    await flushPromises();

    const message =
      "ME3 needs an exact public API origin before private Files media can be delivered.";
    expect(wrapper.find(".social-schedule-dialog").exists()).toBe(false);
    expect(wrapper.find(".editor-action-error").exists()).toBe(false);
    expect(wrapper.find(".social-main > .state-banner--error").exists()).toBe(false);
    expect(wrapper.get(".delivery-error-banner").text()).toContain(message);
    expect(wrapper.findAll("[role='alert']")).toHaveLength(1);
    expect(toastHarness.error).toHaveBeenCalledWith(message);
    expect(toastHarness.success).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith(
      "/social/versions/version-tiktok/publish",
      {
        requestContext: {
          surface: "social-editor",
          batch: false,
          tiktok: { deliveryMode: "provider_draft" },
        },
      },
    );
  });
});
