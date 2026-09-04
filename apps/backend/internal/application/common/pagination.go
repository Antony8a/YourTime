package common

import (
	"encoding/base64"
	"strconv"
)

func EncodeCursor(id string) string {
	return base64.URLEncoding.EncodeToString([]byte(id))
}

func DecodeCursor(cursor string) (string, error) {
	decoded, err := base64.URLEncoding.DecodeString(cursor)
	if err != nil {
		return "", err
	}
	return string(decoded), nil
}

func ParseLimit(limitStr string, defaultLimit, maxLimit int) int {
	if limitStr == "" {
		return defaultLimit
	}
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		return defaultLimit
	}
	if limit > maxLimit {
		return maxLimit
	}
	return limit
}