import json

with open('package.json', 'r') as f:
    pkg = json.load(f)

pkg['version'] = "1.0.0"
if "typecheck" not in pkg["scripts"]:
    pkg["scripts"]["typecheck"] = "tsc --noEmit"

with open('package.json', 'w') as f:
    json.dump(pkg, f, indent=2)

print("Version updated to 1.0.0 and typecheck script added.")
