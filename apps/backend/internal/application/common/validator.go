package common

import (
	"github.com/go-playground/validator/v10"
)

var validate = validator.New(validator.WithRequiredStructEnabled())

func ValidateStruct(s interface{}) error {
	return validate.Struct(s)
}

func RegisterValidation(tag string, fn validator.Func, callValidationEvenIfNull bool) error {
	return validate.RegisterValidation(tag, fn, callValidationEvenIfNull)
}