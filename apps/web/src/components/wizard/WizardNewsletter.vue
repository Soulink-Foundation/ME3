<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useWizardStore } from "../../stores/wizard";
import NewsletterSubscribers from "../NewsletterSubscribers.vue";

const wizard = useWizardStore();

// Newsletter Config
const newsletterTitle = computed({
  get: () => wizard.profile.newsletter.title,
  set: (val: string) => wizard.setNewsletter({ title: val }),
});

const newsletterDescription = computed({
  get: () => wizard.profile.newsletter.description,
  set: (val: string) => wizard.setNewsletter({ description: val }),
});

const newsletterDoubleOptIn = computed({
  get: () => wizard.profile.newsletter.doubleOptIn,
  set: (val: boolean) => wizard.setNewsletter({ doubleOptIn: val }),
});

onMounted(() => {
  wizard.setNewsletter({ enabled: true });
});
</script>

<template>
  <div class="step-newsletter">
    <h2>Newsletter</h2>
    <p class="section-desc">
      Allow visitors to subscribe to your newsletter. Send emails from your blog
      posts.
    </p>

    <div class="config-fields">
      <div class="form-group">
        <label>
          Newsletter title
          <span class="optional">(optional)</span>
        </label>
        <input
          v-model="newsletterTitle"
          type="text"
          placeholder="e.g., Weekly Insights"
          maxlength="100"
        />
        <p class="field-hint">
          Helps visitors know what they're signing up for
        </p>
      </div>

      <div class="form-group">
        <label>
          Description
          <span class="optional">(optional)</span>
        </label>
        <textarea
          v-model="newsletterDescription"
          placeholder="e.g., Curated thoughts on design and tech, delivered every Sunday"
          maxlength="300"
          rows="2"
        ></textarea>
      </div>

      <label class="confirmation-option">
        <input v-model="newsletterDoubleOptIn" type="checkbox" />
        <span>
          <span class="confirmation-label">
            Require email confirmation
            <span class="recommended">(recommended)</span>
          </span>
          <span class="field-hint">
            Subscribers join your list after confirming through an email from
            your configured sender.
          </span>
        </span>
      </label>
    </div>

    <div class="config-fields" v-if="wizard.username">
      <div class="form-group">
        <NewsletterSubscribers :username="wizard.username" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.step-newsletter h2 {
  font-size: 28px;
  margin-bottom: 8px;
}

.section-desc {
  color: var(--color-text-muted);
  font-size: 14px;
  margin-bottom: 24px;
}

/* Config Fields */
.config-fields {
  padding: 20px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-muted);
  margin-bottom: 6px;
}

.form-group input[type="text"],
.form-group textarea {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-text);
}

.field-hint {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.optional {
  font-weight: 400;
  color: var(--color-text-muted);
}

.confirmation-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.confirmation-option input {
  margin-top: 3px;
  accent-color: var(--ui-accent, var(--color-text));
}

.confirmation-option input:focus-visible {
  outline: 2px solid var(--ui-focus, var(--color-text));
  outline-offset: 2px;
}

.confirmation-label {
  display: block;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
}

.recommended {
  color: var(--color-text-muted);
  font-weight: 400;
}
</style>
