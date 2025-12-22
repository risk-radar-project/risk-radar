package router

import "strings"

import "api-gateway/internal/config"

type Matcher struct {
	routes []config.RuntimeRoute
}

func NewMatcher(routes []config.RuntimeRoute) Matcher {
	return Matcher{routes: routes}
}

func (m Matcher) Match(path string) (config.RuntimeRoute, bool) {
	var (
		best    config.RuntimeRoute
		found   bool
		bestLen int
	)
	for _, r := range m.routes {
		if matchPrefix(path, r.Prefix) {
			if l := len(r.Prefix); l > bestLen {
				best = r
				found = true
				bestLen = l
			}
		}
	}
	return best, found
}

func matchPrefix(path, prefix string) bool {
	if prefix == "/" {
		return true
	}
	if strings.HasPrefix(path, prefix) {
		if len(path) == len(prefix) {
			return true
		}
		if path[len(prefix)] == '/' {
			return true
		}
	}
	return false
}
