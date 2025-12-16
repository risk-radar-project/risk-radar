package auth

import (
	"crypto/rsa"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"api-gateway/internal/config"
)

type Validator struct {
	cfg       config.JWTConfig
	algorithm string
	hmacKey   []byte
	rsaKey    *rsa.PublicKey
}

var (
	errMissingToken  = errors.New("missing token")
	errInvalidIssuer = errors.New("invalid issuer")
)

func NewValidator(cfg config.JWTConfig) (*Validator, error) {
	v := &Validator{cfg: cfg}
	alg := strings.ToUpper(cfg.Algorithm)
	if alg == "" {
		alg = "HS256"
	}
	switch alg {
	case "HS256", "HS384", "HS512":
		if cfg.HMACSecret == "" {
			return nil, errors.New("hmac_secret required for HS* algorithms")
		}
		v.hmacKey = []byte(cfg.HMACSecret)
	case "RS256", "RS384", "RS512":
		pk, err := loadRSAPublicKey(cfg)
		if err != nil {
			return nil, err
		}
		v.rsaKey = pk
	default:
		return nil, fmt.Errorf("unsupported jwt algorithm: %s", alg)
	}
	v.algorithm = alg
	return v, nil
}

func loadRSAPublicKey(cfg config.JWTConfig) (*rsa.PublicKey, error) {
	pem := cfg.PublicKey
	if pem == "" && cfg.PublicKeyFile != "" {
		b, err := os.ReadFile(cfg.PublicKeyFile)
		if err != nil {
			return nil, fmt.Errorf("read public key: %w", err)
		}
		pem = string(b)
	}
	if pem == "" {
		return nil, errors.New("public key required for RS* algorithms")
	}
	key, err := jwt.ParseRSAPublicKeyFromPEM([]byte(pem))
	if err != nil {
		return nil, fmt.Errorf("parse rsa public key: %w", err)
	}
	return key, nil
}

func (v *Validator) Validate(tokenString string) (string, error) {
	if tokenString == "" {
		return "", errMissingToken
	}
	parser := jwt.NewParser(
		jwt.WithIssuedAt(),
		jwt.WithExpirationRequired(),
		jwt.WithValidMethods([]string{v.algorithm}),
	)
	claims := jwt.MapClaims{}
	token, err := parser.ParseWithClaims(tokenString, claims, v.keyFunc)
	if err != nil {
		return "", err
	}
	if !token.Valid {
		return "", errors.New("invalid token")
	}
	if iss, ok := claims["iss"].(string); !ok || iss != v.cfg.Issuer {
		return "", errInvalidIssuer
	}
	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		return "", errors.New("sub claim missing")
	}
	return sub, nil
}

func (v *Validator) GenerateDevToken(userID string, duration time.Duration) (string, error) {
	if strings.HasPrefix(v.algorithm, "HS") {
		token := jwt.NewWithClaims(jwt.GetSigningMethod(v.algorithm), jwt.MapClaims{
			"iss": v.cfg.Issuer,
			"sub": userID,
			"exp": time.Now().Add(duration).Unix(),
			"iat": time.Now().Unix(),
		})
		return token.SignedString(v.hmacKey)
	}
	return "", fmt.Errorf("token generation only supported for HMAC algorithms in dev mode")
}

func (v *Validator) keyFunc(token *jwt.Token) (interface{}, error) {
	switch v.algorithm {
	case "HS256", "HS384", "HS512":
		return v.hmacKey, nil
	case "RS256", "RS384", "RS512":
		return v.rsaKey, nil
	default:
		return nil, fmt.Errorf("unsupported algorithm: %s", v.algorithm)
	}
}

func NormalizeError(err error) string {
	_ = err
	return "INVALID_TOKEN"
}

func Now() time.Time {
	return time.Now().UTC()
}
