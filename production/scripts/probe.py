import requests

urls = [
    "https://consultor.adeptify.es/app/health",
    "https://adeptifysystem-1061852826388.europe-west1.run.app/health",
    "https://adeptifysystem-1061852826388.europe-west1.run.app/api/v1/health"
]

for url in urls:
    try:
        r = requests.get(url, timeout=5)
        print(f"[{r.status_code}] {url} -> {r.text[:100]}")
    except Exception as e:
        print(f"[ERR] {url} -> {str(e)}")
