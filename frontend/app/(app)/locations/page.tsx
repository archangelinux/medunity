'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LocationsPage } from '@/components/locations/LocationsPage';

function LocationsContent() {
  const searchParams = useSearchParams();
  const entryId = searchParams.get('entryId') ?? undefined;
  const patternEntryIds = searchParams.get('patternEntryIds')?.split(',').filter(Boolean) ?? undefined;

  return <LocationsPage entryId={entryId} patternEntryIds={patternEntryIds} />;
}

export default function LocationsRoute() {
  return (
    <Suspense>
      <LocationsContent />
    </Suspense>
  );
}
