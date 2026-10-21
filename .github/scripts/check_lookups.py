"""Check the packaged app's lookup files are where Splunk reads them.

Splunk resolves a transforms.conf `filename =` against the app's top-level
`lookups/` directory only. A CSV anywhere else is never read, and a second,
different copy (as `default/lookups/` used to be) misleads anyone editing it.

Usage: python3 check_lookups.py <app dir>
"""
import configparser
import os
import sys

app = sys.argv[1]
problems = []

transforms = os.path.join(app, "default", "transforms.conf")
conf = configparser.ConfigParser(interpolation=None, strict=False)
conf.read(transforms)
filenames = [conf.get(s, "filename") for s in conf.sections() if conf.has_option(s, "filename")]
if not filenames:
    problems.append(f"{transforms} defines no file-based lookups")
for name in filenames:
    if not os.path.isfile(os.path.join(app, "lookups", name)):
        problems.append(f"transforms.conf names {name}, but lookups/{name} is not in the package")

for root, _dirs, files in os.walk(app):
    rel = os.path.relpath(root, app)
    if rel.split(os.sep)[0] == "lookups":
        continue
    for f in files:
        if f.lower().endswith(".csv"):
            problems.append(f"{os.path.join(rel, f)} is outside lookups/, so Splunk never reads it")

for p in problems:
    print(f"::error::{p}")
if problems:
    sys.exit(1)
print(f"lookups OK: {', '.join(filenames)} in lookups/")
