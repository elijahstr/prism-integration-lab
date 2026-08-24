import { IngestionContent } from "../components/ingestion-content";
import { DashboardShell } from "../components/dashboard-shell";

export default function HowIngestionWorksPage() {
  return (
    <DashboardShell
      organization="Integration design reference"
      page="ingestion"
      sessionNote="This reference page does not create a browser session."
      topbarControl={<span className="muted">Static reference</span>}
    >
      <IngestionContent />
    </DashboardShell>
  );
}
