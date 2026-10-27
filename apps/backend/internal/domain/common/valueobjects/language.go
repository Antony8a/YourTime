package valueobjects

import "strings"

// Language is a language the apps are translated into. It is the base code
// only ("es", not "es-CO"). Keep it in sync with the apps' translations and
// the users_language_check constraint.
type Language string

var supportedLanguages = map[string]struct{}{"es": {}, "en": {}, "pt": {}, "fr": {}}

// NewLanguage accepts a base code or a regional tag ("pt-BR", "pt_BR") and keeps
// the base, so a device's locale can be sent as it is.
func NewLanguage(code string) (Language, error) {
	c := strings.ToLower(strings.TrimSpace(code))
	if i := strings.IndexAny(c, "-_"); i >= 0 {
		c = c[:i]
	}
	if _, ok := supportedLanguages[c]; !ok {
		return "", ErrInvalidLanguage
	}
	return Language(c), nil
}

func (l Language) String() string { return string(l) }
