// Package migrations embeds the SQL migrations so the server binary can apply
// them without shipping loose files.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
