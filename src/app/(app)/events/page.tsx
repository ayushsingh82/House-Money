"use client";

import { EventFeed } from "@/components/event-feed";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";

export default function EventsPage() {
  return (
    <>
      <PageHeader title="Event Log" description="Everything the runner did: triggers, queued and settled exits, refusals, and any price it refused to trust." />
      <Panel title="Runner events" subtitle="Newest first">
        <EventFeed />
      </Panel>
    </>
  );
}
