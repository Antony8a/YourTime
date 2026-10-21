package task

import (
	"math"

	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

const earthRadiusKm = 6371.0088

// DistanceKm is the great-circle (haversine) distance between two points.
// The SQL search uses the same formula; keep them in sync.
func DistanceKm(a, b valueobjects.Coordinates) float64 {
	lat1, lat2 := toRad(a.Lat), toRad(b.Lat)
	dLat := lat2 - lat1
	dLng := toRad(b.Lng - a.Lng)
	h := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(lat1)*math.Cos(lat2)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthRadiusKm * math.Asin(math.Min(1, math.Sqrt(h)))
}

func toRad(deg float64) float64 { return deg * math.Pi / 180 }

// Speeds, as straight-line km per hour, that bound a believable trip estimate.
// A reported route time outside the range is pulled back into it, so nobody can
// inflate it to excuse a late arrival or shrink it to look punctual.
const (
	fastestKmh = 90.0 // open road
	slowestKmh = 12.0 // heavy city traffic, door to door
	typicalKmh = 20.0 // what we assume when the worker's app sent no estimate
	etaSlackS  = 300  // parking, walking in
)

// RouteETASeconds is the travel time to store when a worker sets out: the one
// their app measured on the route, kept within what the distance allows, or a
// typical urban estimate when none was sent.
func RouteETASeconds(km float64, reported *int) int {
	secs := func(kmh float64) int { return int(math.Round(km / kmh * 3600)) }
	lo, hi := secs(fastestKmh), secs(slowestKmh)+etaSlackS
	eta := secs(typicalKmh) + etaSlackS
	if reported != nil {
		eta = *reported
	}
	return min(max(eta, lo), hi)
}

// WithinRadius answers the "is this reasonably near me?" hint shown next to a
// task. It returns nil when there is nothing to compare (no preference set, no
// known distance). Remote tasks are always within reach.
func WithinRadius(isRemote bool, distanceKm *float64, radiusKm *int) *bool {
	if isRemote {
		yes := true
		return &yes
	}
	if distanceKm == nil || radiusKm == nil {
		return nil
	}
	within := *distanceKm <= float64(*radiusKm)
	return &within
}
