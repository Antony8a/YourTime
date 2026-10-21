package valueobjects

import "math"

// Rating summarises the reviews a person has received. It stores the sum and
// the count (not the average) so a new review updates it with two additions
// and the average is always exact.
type Rating struct {
	Sum   int
	Count int
}

// Average is the mean number of stars rounded to one decimal, or 0 with no reviews.
func (r Rating) Average() float64 {
	if r.Count == 0 {
		return 0
	}
	return math.Round(float64(r.Sum)/float64(r.Count)*10) / 10
}
