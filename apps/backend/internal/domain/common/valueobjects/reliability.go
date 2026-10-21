package valueobjects

import "time"

// OnTimeTolerance is how late a worker may start a scheduled service and still
// count as on time.
const OnTimeTolerance = 10 * time.Minute

// Reliability summarises how a person has behaved as a worker, from the
// services they finished. It helps a poster choose between applicants.
type Reliability struct {
	// Completed is the number of finished services as the worker.
	Completed int
	// ResponseSeconds is the median time from being chosen to setting out (or
	// starting, for remote tasks). Nil until there is at least one such service.
	ResponseSeconds *int
	// OnTimeTotal counts the on-site services with a scheduled time that could be
	// judged fairly, and OnTimeCount those started on time. Remote services,
	// ones without a scheduled time and ones where the worker was chosen too late
	// to make the trip say nothing about punctuality and are left out. A late
	// arrival after setting out in time is forgiven as traffic (see the SQL).
	OnTimeCount, OnTimeTotal int
}

// OnTimePercent is the share of scheduled services started on time, or nil when
// there are none to judge.
func (r Reliability) OnTimePercent() *int {
	if r.OnTimeTotal == 0 {
		return nil
	}
	p := (r.OnTimeCount*100 + r.OnTimeTotal/2) / r.OnTimeTotal
	return &p
}
