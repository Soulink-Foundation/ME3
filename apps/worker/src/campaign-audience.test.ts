import { describe, expect, it } from "vitest";
import {
  MARKETING_PERMISSION_ATTESTATION_STATEMENT,
  createDoubleOptInPermissionEvidence,
  createImportAttestationEvidence,
  createSiteFormPermissionEvidence,
  evaluateCampaignAudience,
  type CampaignAudienceSubscriber,
} from "./campaign-audience";

function subscriber(
  overrides: Partial<CampaignAudienceSubscriber> & Pick<CampaignAudienceSubscriber, "id" | "email">,
): CampaignAudienceSubscriber {
  return {
    first_name: null,
    last_name: null,
    subscribed_at: "2026-08-01T10:00:00.000Z",
    unsubscribed_at: null,
    marketing_status: "marketable",
    marketing_permission_method: "single_opt_in",
    marketing_permission_granted_at: "2026-08-01T10:00:00.000Z",
    marketing_permission_evidence_json: '{"kind":"site_form"}',
    delivery_status: "deliverable",
    ...overrides,
    id: overrides.id,
    email: overrides.email,
  };
}

describe("campaign audience eligibility", () => {
  it("accepts every durable marketing-permission method", () => {
    const result = evaluateCampaignAudience([
      subscriber({ id: 1, email: "single@example.com", marketing_permission_method: "single_opt_in" }),
      subscriber({ id: 2, email: "double@example.com", marketing_permission_method: "double_opt_in" }),
      subscriber({ id: 3, email: "import@example.com", marketing_permission_method: "import_attested" }),
    ]);

    expect(result.eligible.map((item) => item.normalizedEmail)).toEqual([
      "double@example.com",
      "import@example.com",
      "single@example.com",
    ]);
    expect(result.excluded).toEqual([]);
  });

  it("excludes unavailable recipients with a stable reason", () => {
    const result = evaluateCampaignAudience([
      subscriber({ id: 1, email: "not-an-email" }),
      subscriber({ id: 2, email: "pending@example.com", marketing_status: "pending" }),
      subscriber({ id: 3, email: "unsubscribed@example.com", unsubscribed_at: "2026-08-02T10:00:00.000Z" }),
      subscriber({ id: 4, email: "bounce@example.com", delivery_status: "bounced" }),
      subscriber({ id: 5, email: "complaint@example.com", delivery_status: "complained" }),
      subscriber({ id: 6, email: "suppressed@example.com", delivery_status: "suppressed" }),
      subscriber({ id: 7, email: "missing-evidence@example.com", marketing_permission_evidence_json: null }),
    ]);

    expect(result.eligible).toEqual([]);
    expect(result.exclusionCounts).toEqual({
      invalid_email: 1,
      pending_permission: 2,
      unsubscribed: 1,
      bounced: 1,
      complained: 1,
      suppressed: 1,
      duplicate: 0,
    });
  });

  it("normalizes and deduplicates otherwise eligible addresses", () => {
    const result = evaluateCampaignAudience([
      subscriber({
        id: 1,
        email: " Person@Example.com ",
        marketing_permission_granted_at: "2026-08-01T10:00:00.000Z",
      }),
      subscriber({
        id: 2,
        email: "person@example.com",
        marketing_permission_granted_at: "2026-08-02T10:00:00.000Z",
      }),
    ]);

    expect(result.eligible).toHaveLength(1);
    expect(result.eligible[0]?.id).toBe(2);
    expect(result.excluded).toEqual([
      { subscriberId: 1, email: " Person@Example.com ", reason: "duplicate" },
    ]);
  });
});

describe("campaign permission evidence", () => {
  it("captures the signup context without requiring double opt-in", () => {
    expect(JSON.parse(createSiteFormPermissionEvidence({ pageId: "page-1", campaign: "launch" }))).toEqual({
      version: 1,
      kind: "site_form",
      source: "me3",
      pageId: "page-1",
      actionId: null,
      campaign: "launch",
    });
  });

  it("records both halves of double opt-in", () => {
    expect(JSON.parse(createDoubleOptInPermissionEvidence({
      requestedAt: "2026-09-03T10:00:00.000Z",
      confirmedAt: "2026-09-03T10:05:00.000Z",
      actionId: "footer",
    }))).toEqual({
      version: 1,
      kind: "site_form",
      source: "me3",
      method: "double_opt_in",
      requestedAt: "2026-09-03T10:00:00.000Z",
      confirmedAt: "2026-09-03T10:05:00.000Z",
      pageId: null,
      actionId: "footer",
      campaign: null,
    });
  });

  it("stores the exact versioned owner attestation", () => {
    const evidence = JSON.parse(
      createImportAttestationEvidence({
        attestedAt: "2026-08-26T12:00:00.000Z",
        source: "manual",
      }),
    );

    expect(evidence.statement).toBe(MARKETING_PERMISSION_ATTESTATION_STATEMENT);
    expect(evidence.statementVersion).toBe("me3.marketing-permission-attestation.v1");
    expect(evidence.attestedBy).toBe("owner");
  });
});
