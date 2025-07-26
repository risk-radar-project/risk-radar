package validation

import (
	"strings"
	"testing"
)

func TestValidateUUIDString(t *testing.T) {
	tests := []struct {
		name    string
		uuid    string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "Valid UUID",
			uuid:    "550e8400-e29b-41d4-a716-446655440000",
			wantErr: false,
		},
		{
			name:    "Valid UUID uppercase",
			uuid:    "550E8400-E29B-41D4-A716-446655440000",
			wantErr: false,
		},
		{
			name:    "Empty UUID",
			uuid:    "",
			wantErr: true,
			errMsg:  "UUID is required",
		},
		{
			name:    "Too long UUID",
			uuid:    "550e8400-e29b-41d4-a716-446655440000-extra",
			wantErr: true,
			errMsg:  "UUID must not exceed 36 characters",
		},
		{
			name:    "Too short UUID",
			uuid:    "550e8400-e29b-41d4",
			wantErr: true,
			errMsg:  "UUID must be exactly 36 characters long",
		},
		{
			name:    "Missing hyphens",
			uuid:    "550e8400e29b41d4a716446655440000",
			wantErr: true,
			errMsg:  "UUID must be exactly 36 characters long",
		},
		{
			name:    "Wrong hyphen position",
			uuid:    "550e840-0e29b-41d4-a716-446655440000",
			wantErr: true,
			errMsg:  "UUID must have hyphens at positions 8, 13, 18, 23",
		},
		{
			name:    "Invalid characters",
			uuid:    "550e8400-e29b-41d4-a716-44665544000g",
			wantErr: true,
			errMsg:  "UUID must contain only hexadecimal characters and hyphens",
		},
		{
			name:    "Very long string (DoS test)",
			uuid:    strings.Repeat("a", 1000),
			wantErr: true,
			errMsg:  "UUID must not exceed 36 characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateUUIDString(tt.uuid)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ValidateUUIDString() expected error but got none")
					return
				}
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("ValidateUUIDString() error = %v, want error containing %v", err, tt.errMsg)
				}
			} else {
				if err != nil {
					t.Errorf("ValidateUUIDString() unexpected error = %v", err)
				}
			}
		})
	}
}
