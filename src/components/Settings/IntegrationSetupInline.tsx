import { useState } from "react";
import { BookOpen, ChevronDown, ExternalLink } from "lucide-react";
import clsx from "clsx";
import { openExternal } from "../../lib/openExternal";
import { getIntegrationGuide, type IntegrationId } from "../../lib/integrationGuides";
import { SetupAssistantChat } from "./SetupAssistantChat";
import { SetupIssueCards } from "./SetupIssueCards";
import { SetupAccordion } from "./SetupAccordion";
import styles from "./IntegrationSetupInline.module.css";

interface IntegrationSetupInlineProps {
  integrationId: IntegrationId;
  locked: boolean;
}

export function IntegrationSetupInline({
  integrationId,
  locked,
}: IntegrationSetupInlineProps) {
  const guide = getIntegrationGuide(integrationId);
  const [guideOpen, setGuideOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const stepItems = guide.steps.map((step, i) => ({
    id: `step-${i}`,
    title: `${i + 1}. ${step.title}`,
    content: <p>{step.body}</p>,
  }));

  if (guide.comingSoon) {
    return (
      <p className={styles.comingSoon}>This integration is not available yet.</p>
    );
  }

  return (
    <section
      className={clsx(styles.guideZone, guideOpen && styles.guideZoneOpen)}
      aria-label="Setup guide"
    >
      <button
        type="button"
        className={styles.guideHeader}
        onClick={() => setGuideOpen((v) => !v)}
        aria-expanded={guideOpen}
      >
        <BookOpen size={14} className={styles.guideHeaderIcon} />
        <div className={styles.guideHeaderText}>
          <p className={styles.guideLabel}>Setup guide</p>
          <p className={styles.guideHint}>
            {guideOpen
              ? "Follow these steps, then fill in the fields below."
              : `${guide.steps.length} steps · tap to expand`}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={clsx(styles.guideChevron, guideOpen && styles.guideChevronOpen)}
        />
      </button>

      {guideOpen && (
      <div className={styles.guideBody}>
        {locked && (
          <p className={styles.locked}>Turn off Local Only Mode under Privacy first.</p>
        )}

        <SetupAccordion
          items={stepItems}
          defaultOpenId={stepItems[0]?.id ?? null}
        />

        <SetupIssueCards items={guide.troubleshooting} />

        {guide.links && guide.links.length > 0 && (
          <div className={styles.links}>
            {guide.links.map((link) => (
              <button
                key={link.url}
                type="button"
                className={styles.linkChip}
                onClick={() => void openExternal(link.url)}
              >
                {link.label}
                <ExternalLink size={11} />
              </button>
            ))}
          </div>
        )}

        <div className={styles.chatBlock}>
          <button
            type="button"
            className={styles.chatToggle}
            onClick={() => setChatOpen((v) => !v)}
            aria-expanded={chatOpen}
          >
            <span>Ask setup assistant</span>
            <ChevronDown
              size={14}
              className={clsx(styles.chatChevron, chatOpen && styles.chatChevronOpen)}
            />
          </button>
          {chatOpen && (
            <SetupAssistantChat
              integrationId={integrationId}
              locked={locked}
              compact
            />
          )}
        </div>
      </div>
      )}
    </section>
  );
}
