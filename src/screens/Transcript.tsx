import { useEffect, useRef } from 'react';
import type { TranscriptLine } from '../../shared/types';

const WHO = { ai: 'AI', nurse: 'Nurse', patient: 'Patient', caregiver: 'Caregiver', system: '' } as const;

export function Transcript({ lines, live }: { lines: TranscriptLine[]; live?: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (live) end.current?.scrollIntoView({ block: 'nearest' });
  }, [lines.length, live]);
  return (
    <div className={`transcript ${live ? 'live' : ''}`}>
      {lines.map((l, i) => (
        <div key={i} className={`line line-${l.who} ${l.step === 'disclosure' ? 'disclosure' : ''}`}>
          {WHO[l.who] && <span className="who">{WHO[l.who]}</span>}
          <span className="text">{l.text}</span>
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}
