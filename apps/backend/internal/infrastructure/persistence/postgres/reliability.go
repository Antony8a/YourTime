package postgres

import (
	"fmt"

	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

// reliabilityColumns are the columns reliabilityJoin exposes, in scan order.
const reliabilityColumns = `rel.completed, rel.response_seconds, rel.on_time, rel.on_time_total`

// reliabilityJoin joins, for the worker in workerCol, what their finished
// services say about them. It is computed on read from the tasks table (served
// by tasks_worker_completed_idx) rather than stored, so it can never drift.
//
// Response time is the median from being chosen to setting out (or starting,
// for a remote task). Punctuality is only judged for on-site services with a
// scheduled time, and fairly:
//
//   - If the worker was chosen with less time than the trip takes, the service is
//     left out: nobody could have made it.
//   - Starting within the tolerance of the scheduled time is on time.
//   - Otherwise, if they set out early enough for the estimated trip, the delay
//     is put down to the road and forgiven up to the larger of the tolerance and
//     half the trip time. Setting out late is not forgiven.
func reliabilityJoin(workerCol string) string {
	tol := fmt.Sprintf("interval '%d seconds'", int(valueobjects.OnTimeTolerance.Seconds()))
	return fmt.Sprintf(`
	LEFT JOIN LATERAL (
		SELECT count(*)::int AS completed,
			(percentile_cont(0.5) WITHIN GROUP (
				ORDER BY EXTRACT(EPOCH FROM (COALESCE(w.en_route_at, w.started_at) - w.assigned_at)))
				FILTER (WHERE w.assigned_at IS NOT NULL
					AND COALESCE(w.en_route_at, w.started_at) IS NOT NULL))::int AS response_seconds,
			(count(*) FILTER (WHERE w.judged AND (
				w.started_at <= w.scheduled_at + %[1]s
				OR (w.en_route_at + w.eta <= w.scheduled_at + %[1]s
					AND w.started_at <= w.scheduled_at + %[1]s + GREATEST(%[1]s, w.eta / 2))
			)))::int AS on_time,
			(count(*) FILTER (WHERE w.judged))::int AS on_time_total
		FROM (
			SELECT wt.assigned_at, wt.en_route_at, wt.started_at, wt.scheduled_at,
				make_interval(secs => COALESCE(wt.route_eta_seconds, 0)) AS eta,
				(NOT wt.is_remote AND wt.scheduled_at IS NOT NULL AND wt.assigned_at IS NOT NULL
					AND wt.en_route_at IS NOT NULL AND wt.started_at IS NOT NULL
					AND wt.assigned_at + make_interval(secs => COALESCE(wt.route_eta_seconds, 0)) <= wt.scheduled_at) AS judged
			FROM tasks wt
			WHERE wt.assigned_applicant_id = %[2]s AND wt.status = 'completed'
		) w
	) rel ON true`, tol, workerCol)
}

// reliabilityScan receives the columns of reliabilityColumns.
type reliabilityScan struct {
	completed, responseSeconds, onTime, onTimeTotal *int
}

func (s *reliabilityScan) dest() []any {
	return []any{&s.completed, &s.responseSeconds, &s.onTime, &s.onTimeTotal}
}

func (s *reliabilityScan) value() valueobjects.Reliability {
	r := valueobjects.Reliability{ResponseSeconds: s.responseSeconds}
	if s.completed != nil {
		r.Completed = *s.completed
	}
	if s.onTime != nil {
		r.OnTimeCount = *s.onTime
	}
	if s.onTimeTotal != nil {
		r.OnTimeTotal = *s.onTimeTotal
	}
	return r
}
