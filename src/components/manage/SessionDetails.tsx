"use client";

import { useRouter } from "next/navigation";
import { updateSession } from "@/app/manage/actions";
import { card } from "@/components/ui/styles";
import { SessionForm, type SessionDefaults } from "./SessionForm";
import { DeleteSessionButton } from "./DeleteSessionButton";

export function SessionDetails({
  sessionId,
  selective,
  registrations,
  defaults,
}: {
  sessionId: string;
  selective: boolean;
  registrations: number;
  defaults: SessionDefaults & { title: string };
}) {
  const router = useRouter();
  return (
    <div className={`${card} max-w-2xl`}>
      <SessionForm
        selective={selective}
        defaults={defaults}
        submitLabel="Save changes"
        deleteSlot={<DeleteSessionButton sessionId={sessionId} sessionTitle={defaults.title} registrations={registrations} />}
        onSubmit={async (input) => {
          const result = await updateSession(sessionId, input);
          if (result.ok) router.refresh();
          return result;
        }}
      />
    </div>
  );
}
