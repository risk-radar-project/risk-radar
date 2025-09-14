import requests
import sys
import time

def wait_for_service(url, retries=10, delay=2):
    """Wait until the service is available"""
    for i in range(retries):
        try:
            r = requests.get(url, timeout=3)
            if r.status_code == 200:
                print(f"[ai-categorization-service] Service is up at {url}")
                return True
        except requests.exceptions.RequestException:
            pass
        print(f"[ai-categorization-service]  Waiting for service... attempt {i+1}/{retries}")
        time.sleep(delay)
    return False

def run_tests(base_url="http://localhost:8080"):
    # Wait until FastAPI is ready
    if not wait_for_service(f"{base_url}/health"):
        print("[ai-categorization-service] Service did not start in time")
        sys.exit(1)

    # Test root endpoint
    r = requests.get(f"{base_url}/")
    print("[ai-categorization-service] Root:", r.status_code, r.json())

    # Test health endpoint
    r = requests.get(f"{base_url}/health")
    print("[ai-categorization-service] Health:", r.status_code, r.json())

    # Test categorize
    r = requests.post(f"{base_url}/categorize", json={"title": "Wypadek drogowy na głównej ulicy"})
    print("[ai-categorization-service] Categorize:", r.status_code, r.json())

if __name__ == "__main__":
    run_tests()
