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
