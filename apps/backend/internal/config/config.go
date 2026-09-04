package config

import (
	"github.com/spf13/viper"
)

type Config struct {
	App       AppConfig
	Database  DatabaseConfig
	Redis     RedisConfig
	MinIO     MinIOConfig
	JWT       JWTConfig
	SMTP      SMTPConfig
	Payments  PaymentsConfig
	Features  FeaturesConfig
}

type AppConfig struct {
	Env        string
	Port       string
	URL        string
	WebURL     string
	MobileURL  string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
	URL      string
}

type RedisConfig struct {
	URL string
}

type MinIOConfig struct {
	Endpoint        string
	AccessKey       string
	SecretKey       string
	Bucket          string
	UseSSL          bool
}

type JWTConfig struct {
	Secret        string
	AccessTTL     string
	RefreshTTL    string
}

type SMTPConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	From     string
}

type PaymentsConfig struct {
	Stripe          StripeConfig
	MercadoPago     MercadoPagoConfig
}

type StripeConfig struct {
	SecretKey       string
	PublishableKey  string
	WebhookSecret   string
}

type MercadoPagoConfig struct {
	AccessToken  string
	PublicKey    string
	WebhookSecret string
}

type FeaturesConfig struct {
	WebSockets          bool
	PushNotifications   bool
}

func Load() *Config {
	v := viper.New()

	// Set defaults
	v.SetDefault("app.env", "development")
	v.SetDefault("app.port", "8080")
	v.SetDefault("app.url", "http://localhost:8080")
	v.SetDefault("app.web_url", "http://localhost:4200")
	v.SetDefault("app.mobile_url", "exp://localhost:8081")

	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", "5432")
	v.SetDefault("database.user", "yourtime")
	v.SetDefault("database.password", "yourtime_dev")
	v.SetDefault("database.name", "yourtime")
	v.SetDefault("database.ssl_mode", "disable")

	v.SetDefault("redis.url", "redis://localhost:6379")

	v.SetDefault("minio.endpoint", "localhost:9000")
	v.SetDefault("minio.access_key", "yourtime")
	v.SetDefault("minio.secret_key", "yourtime_dev")
	v.SetDefault("minio.bucket", "yourtime")
	v.SetDefault("minio.use_ssl", false)

	v.SetDefault("jwt.access_ttl", "15m")
	v.SetDefault("jwt.refresh_ttl", "7d")

	v.SetDefault("smtp.host", "localhost")
	v.SetDefault("smtp.port", 1025)
	v.SetDefault("smtp.from", "noreply@yourtime.local")

	v.SetDefault("features.websockets", true)
	v.SetDefault("features.push_notifications", true)

	// Environment variables
	v.AutomaticEnv()

	// Config file
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")
	v.AddConfigPath("/etc/yourtime")
	_ = v.ReadInConfig() // Optional

	return &Config{
		App: AppConfig{
			Env:       v.GetString("app.env"),
			Port:      v.GetString("app.port"),
			URL:       v.GetString("app.url"),
			WebURL:    v.GetString("app.web_url"),
			MobileURL: v.GetString("app.mobile_url"),
		},
		Database: DatabaseConfig{
			Host:     v.GetString("database.host"),
			Port:     v.GetString("database.port"),
			User:     v.GetString("database.user"),
			Password: v.GetString("database.password"),
			Name:     v.GetString("database.name"),
			SSLMode:  v.GetString("database.ssl_mode"),
			URL:      v.GetString("database.url"),
		},
		Redis: RedisConfig{
			URL: v.GetString("redis.url"),
		},
		MinIO: MinIOConfig{
			Endpoint:  v.GetString("minio.endpoint"),
			AccessKey: v.GetString("minio.access_key"),
			SecretKey: v.GetString("minio.secret_key"),
			Bucket:    v.GetString("minio.bucket"),
			UseSSL:    v.GetBool("minio.use_ssl"),
		},
		JWT: JWTConfig{
			Secret:     v.GetString("jwt.secret"),
			AccessTTL:  v.GetString("jwt.access_ttl"),
			RefreshTTL: v.GetString("jwt.refresh_ttl"),
		},
		SMTP: SMTPConfig{
			Host:     v.GetString("smtp.host"),
			Port:     v.GetInt("smtp.port"),
			User:     v.GetString("smtp.user"),
			Password: v.GetString("smtp.password"),
			From:     v.GetString("smtp.from"),
		},
		Payments: PaymentsConfig{
			Stripe: StripeConfig{
				SecretKey:      v.GetString("stripe.secret_key"),
				PublishableKey: v.GetString("stripe.publishable_key"),
				WebhookSecret:  v.GetString("stripe.webhook_secret"),
			},
			MercadoPago: MercadoPagoConfig{
				AccessToken:   v.GetString("mercadopago.access_token"),
				PublicKey:     v.GetString("mercadopago.public_key"),
				WebhookSecret: v.GetString("mercadopago.webhook_secret"),
			},
		},
		Features: FeaturesConfig{
			WebSockets:        v.GetBool("features.websockets"),
			PushNotifications: v.GetBool("features.push_notifications"),
		},
	}
}