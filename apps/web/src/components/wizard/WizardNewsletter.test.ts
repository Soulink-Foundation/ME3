import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import WizardNewsletter from "./WizardNewsletter.vue";
import { useWizardStore } from "../../stores/wizard";

describe("WizardNewsletter", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("recommends email confirmation and saves the choice", async () => {
    const wrapper = mount(WizardNewsletter);
    const option = wrapper.get(".confirmation-option");
    const checkbox = option.get('input[type="checkbox"]');

    expect(option.text()).toContain("Require email confirmation");
    expect(option.text()).toContain("recommended");
    expect((checkbox.element as HTMLInputElement).checked).toBe(true);

    await checkbox.setValue(false);
    expect(useWizardStore().profile.newsletter.doubleOptIn).toBe(false);
  });
});
