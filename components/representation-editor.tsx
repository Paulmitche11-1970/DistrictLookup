'use client';

import { useId, useState } from 'react';
import { Save } from 'lucide-react';
import type { Content, DistrictElection, Official } from '@/lib/model';

type Assignment = Pick<Official, 'id' | 'district' | 'selectionMethod'>;
type Draft = {
  assignments: Assignment[];
  districtElections: Record<string, DistrictElection>;
};
type Props = {
  content: Content;
  busy: boolean;
  save: (body: Record<string, unknown>) => Promise<boolean>;
};

function districtsFor(content: Content) {
  return [
    ...new Set(content.map.features.map((f) => f.properties.district)),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function initialDraft(content: Content): Draft {
  return {
    assignments: content.officials.map(({ id, district, selectionMethod }) => ({
      id,
      district,
      ...(selectionMethod ? { selectionMethod } : {}),
    })),
    districtElections: Object.fromEntries(
      districtsFor(content).map((district) => [
        district,
        {
          ...(content.districtElections?.[district] || { status: 'district' }),
        },
      ]),
    ),
  };
}

function problemsFor(content: Content, draft: Draft) {
  const problems: string[] = [];
  const districtIds = districtsFor(content);
  for (const assignment of draft.assignments) {
    if (
      assignment.district !== null &&
      !districtIds.includes(assignment.district)
    ) {
      const official = content.officials.find((o) => o.id === assignment.id);
      problems.push(
        `${official?.name || 'This seat'} needs a district from the current map or an at-large assignment.`,
      );
    }
  }
  for (const district of districtIds) {
    const election = draft.districtElections[district];
    const seats = draft.assignments.filter((a) => a.district === district);
    const occupied = seats.filter(
      (seat) => !content.officials.find((o) => o.id === seat.id)?.vacant,
    );
    if (election.status === 'transition' && occupied.length) {
      problems.push(
        `District ${district} is in transition. Its current officials must remain at large until their district terms begin.`,
      );
    }
    if (seats.length > 1) {
      problems.push(
        `District ${district} has ${seats.length} assigned records. Keep only one seat record for this district.`,
      );
    } else if (election.status === 'district' && seats.length === 0) {
      problems.push(
        `District ${district} needs an official or a vacant seat record. Assign one below, or mark the district as in transition.`,
      );
    }
    if (
      election.firstElection &&
      !/^20\d{2}-(0[1-9]|1[0-2])$/.test(election.firstElection)
    ) {
      problems.push(
        `District ${district} needs a valid first-election month, or leave it blank.`,
      );
    }
  }
  return problems;
}

export function RepresentationEditor(props: Props) {
  const snapshot = initialDraft(props.content);
  const key = JSON.stringify({
    agency: props.content.agency.instanceId || props.content.agency.name,
    snapshot,
    vacancies: props.content.officials.map((o) => [o.id, o.vacant]),
  });
  return <RepresentationForm key={key} {...props} />;
}

function RepresentationForm({ content, busy, save }: Props) {
  const id = useId();
  const [draft, setDraft] = useState(() => initialDraft(content));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const districts = districtsFor(content);
  const problems = problemsFor(content, draft);
  const changed =
    JSON.stringify(draft) !== JSON.stringify(initialDraft(content));
  const disabled = busy || submitting;

  function changeAssignment(officialId: string, change: Partial<Assignment>) {
    setError('');
    setDraft((current) => ({
      ...current,
      assignments: current.assignments.map((assignment) =>
        assignment.id === officialId
          ? { ...assignment, ...change }
          : assignment,
      ),
    }));
  }

  function changeElection(district: string, change: Partial<DistrictElection>) {
    setError('');
    setDraft((current) => ({
      ...current,
      districtElections: {
        ...current.districtElections,
        [district]: { ...current.districtElections[district], ...change },
      },
    }));
  }

  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (disabled || !changed || problems.length) return;
        setSubmitting(true);
        setError('');
        try {
          await save({
            action: 'representation',
            assignments: draft.assignments,
            districtElections: Object.fromEntries(
              districts.map((district) => {
                const election = draft.districtElections[district];
                return [
                  district,
                  {
                    status: election.status,
                    ...(election.firstElection
                      ? { firstElection: election.firstElection }
                      : {}),
                  },
                ];
              }),
            ),
          });
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'These changes could not be saved. Please try again.',
          );
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="panel stack">
        <div>
          <h2>Districts & representation</h2>
          <p className="muted">
            Match each current seat to its district or at-large status. Use the
            seat’s official election records when making these assignments.
          </p>
        </div>
        <div className="notice">
          A mayor, chair, or board president can also hold a district seat.
          Update titles in the official’s profile. For a transition to district
          elections, keep continuing at-large members at large until their new
          district terms begin.
        </div>
      </div>

      <fieldset
        className="panel stack"
        disabled={disabled}
        style={{ minWidth: 0 }}
      >
        <legend style={{ padding: '0 8px', fontWeight: 700 }}>
          District election status
        </legend>
        <p className="small muted">
          A first-election month is for information only. Change the status to
          active when the district term begins; the date will not make that
          change automatically.
        </p>
        {districts.map((district, index) => {
          const election = draft.districtElections[district];
          const districtId = `${id}-district-${index}`;
          return (
            <div
              key={district}
              style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}
            >
              <h3 style={{ marginBottom: 12 }}>District {district}</h3>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor={districtId}>Seat status</label>
                  <select
                    id={districtId}
                    value={election.status}
                    onChange={(event) =>
                      changeElection(district, {
                        status: event.target
                          .value as DistrictElection['status'],
                      })
                    }
                  >
                    <option value="district">Active district seat</option>
                    <option value="transition">
                      Transition — district term has not begun
                    </option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`${districtId}-month`}>
                    First district election (optional)
                  </label>
                  <input
                    id={`${districtId}-month`}
                    type="month"
                    min="2000-01"
                    max="2099-12"
                    value={election.firstElection || ''}
                    onChange={(event) =>
                      changeElection(district, {
                        firstElection: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
      </fieldset>

      <fieldset
        className="panel stack"
        disabled={disabled}
        style={{ minWidth: 0 }}
      >
        <legend style={{ padding: '0 8px', fontWeight: 700 }}>
          Current seat assignments
        </legend>
        <p className="small muted">
          An at-large seat is chosen by voters across the agency. An appointee
          keeps the representation scope of the seat being filled.
        </p>
        {content.officials.map((official, index) => {
          const assignment = draft.assignments.find(
            (a) => a.id === official.id,
          )!;
          const officialId = `${id}-official-${index}`;
          return (
            <div
              key={official.id}
              style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}
            >
              <h3 style={{ marginBottom: 3 }}>
                {official.vacant ? 'Vacant seat' : official.name}
              </h3>
              <p className="small muted" style={{ marginBottom: 12 }}>
                {official.title}
                {official.additionalTitles?.length
                  ? ` · ${official.additionalTitles.join(' · ')}`
                  : ''}
              </p>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor={officialId}>Representation</label>
                  <select
                    id={officialId}
                    value={
                      assignment.district === null ? '' : assignment.district
                    }
                    onChange={(event) =>
                      changeAssignment(official.id, {
                        district: event.target.value || null,
                      })
                    }
                  >
                    <option value="">At large — entire agency</option>
                    {assignment.district !== null &&
                      !districts.includes(assignment.district) && (
                        <option value={assignment.district} disabled>
                          Unavailable district {assignment.district}
                        </option>
                      )}
                    {districts.map((district) => (
                      <option key={district} value={district}>
                        District {district}
                      </option>
                    ))}
                  </select>
                </div>
                {!official.vacant && (
                  <div className="field">
                    <label htmlFor={`${officialId}-method`}>
                      How the seat was filled
                    </label>
                    <select
                      id={`${officialId}-method`}
                      value={assignment.selectionMethod || ''}
                      onChange={(event) =>
                        changeAssignment(official.id, {
                          selectionMethod: (event.target.value ||
                            undefined) as Assignment['selectionMethod'],
                        })
                      }
                    >
                      <option value="">Not recorded</option>
                      <option value="elected">Elected</option>
                      <option value="appointed">Appointed</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </fieldset>

      {problems.length > 0 && (
        <div className="notice error" role="alert">
          <strong>Resolve these assignments before saving:</strong>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button
          className="btn"
          type="submit"
          disabled={disabled || !changed || problems.length > 0}
        >
          <Save size={17} />
          {submitting ? 'Saving…' : 'Save representation'}
        </button>
        <button
          className="btn secondary"
          type="button"
          disabled={disabled || !changed}
          onClick={() => {
            setDraft(initialDraft(content));
            setError('');
          }}
        >
          Reset changes
        </button>
        <span className="small muted">
          Assignments and district status are saved together as a draft.
        </span>
      </div>
    </form>
  );
}

export default RepresentationEditor;
