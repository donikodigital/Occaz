// web-admin/src/app/(app)/drivers/[id]/page.tsx
'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { DisputeMotionStyles, disputeFont } from '@/components/disputes/disputeUi';
import { DriverProfile } from '@/components/drivers/DriverProfile';

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className={`${disputeFont.className} max-w-3xl space-y-4 pb-4`}>
      <DisputeMotionStyles />

      <Link
        href="/drivers"
        className="dispute-fade-up inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
      >
        <IconArrowLeft size={16} />
        Retour aux chauffeurs
      </Link>

      <DriverProfile key={id} driverId={id} />
    </div>
  );
}